/**
 * Chamadas ao Gemini feitas pelo servidor.
 *
 * Antes, o portal chamava o Gemini direto do navegador e a chave da API ia junto
 * no código publicado (qualquer pessoa podia copiá-la). Agora:
 *  - a chave fica no Secret Manager (GEMINI_API_KEY) e nunca vai ao navegador;
 *  - só usuários logados com o módulo liberado no perfil podem chamar;
 *  - o modelo é fixado aqui, não pelo navegador.
 *
 * Configuração (uma vez):  firebase functions:secrets:set GEMINI_API_KEY
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

/** Trocar o modelo de todo o portal é mudar só esta linha. */
const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
/** Prazo total dentro dos 300 s da função; cada tentativa tem limite próprio. */
const GEMINI_DEADLINE_MS = 285_000;
/** Uma leitura de RDO leva 20–60 s; acima disso o modelo travou e vale tentar de novo. */
const GEMINI_ATTEMPT_TIMEOUT_MS = 110_000;
const MIN_ATTEMPT_MS = 15_000;
const GEMINI_ATTEMPTS = 4;
const RETRY_STATUS = [429, 500, 503];
const RETRY_BASE_MS = 5_000;

/** Módulos que podem usar a IA (chave do perfil em user_profiles.modules). */
const AI_FEATURES = ["construction_rdo", "human_capital"] as const;
type AiFeature = typeof AI_FEATURES[number];

/**
 * Raciocínio do modelo antes de responder. O Gemini 3 conta o raciocínio no mesmo limite de
 * saída: em extrações de RDO ele chegou a gastar 63 mil tokens pensando e cortou o JSON no meio.
 * "low" resolveu nos testes com 23 RDOs reais da Vale (mesmos números, sem respostas cortadas).
 */
const THINKING_LEVELS = ["minimal", "low", "medium", "high"] as const;
type ThinkingLevel = typeof THINKING_LEVELS[number];
const MAX_OUTPUT_TOKENS = 65_536;

/** Limite do pedido: o callable aceita até 10 MB e os PDFs vão em base64 (+33%). */
const MAX_REQUEST_CHARS = 9_500_000;

interface AiRequest {
    feature: AiFeature;
    contents: unknown[];
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: unknown;
    thinkingLevel?: ThinkingLevel;
}

const parseRequest = (data: unknown): AiRequest => {
    const input = (data ?? {}) as Record<string, unknown>;
    const feature = input.feature as AiFeature;
    if (!AI_FEATURES.includes(feature)) {
        throw new HttpsError("invalid-argument", "Módulo inválido para a IA.");
    }
    if (!Array.isArray(input.contents) || input.contents.length === 0) {
        throw new HttpsError("invalid-argument", "Conteúdo vazio.");
    }
    if (JSON.stringify(input).length > MAX_REQUEST_CHARS) {
        throw new HttpsError("invalid-argument", "Arquivo grande demais para a IA (máx. ~7 MB).");
    }
    const temperature = typeof input.temperature === "number"
        ? Math.min(Math.max(input.temperature, 0), 1)
        : undefined;
    return {
        feature,
        contents: input.contents,
        systemInstruction: typeof input.systemInstruction === "string" ? input.systemInstruction : undefined,
        temperature,
        responseMimeType: input.responseMimeType === "application/json" ? "application/json" : undefined,
        responseSchema: input.responseSchema,
        thinkingLevel: THINKING_LEVELS.includes(input.thinkingLevel as ThinkingLevel)
            ? input.thinkingLevel as ThinkingLevel
            : undefined,
    };
};

/** Mesmo critério das regras do Firestore (canReadModule): super admin ou módulo habilitado. */
const assertModuleAccess = async (uid: string, feature: AiFeature): Promise<void> => {
    const snap = await admin.firestore().collection("user_profiles").doc(uid).get();
    const profile = snap.data();
    if (!profile) throw new HttpsError("permission-denied", "Perfil de usuário não encontrado.");
    if (profile.isSuperAdmin === true) return;
    if (profile.modules?.[feature]?.enabled !== true) {
        throw new HttpsError("permission-denied", "Sem acesso ao módulo para usar a IA.");
    }
};

export const aiGenerateContent = onCall(
    {
        region: "us-central1",
        secrets: [GEMINI_API_KEY],
        timeoutSeconds: 300,
        memory: "512MiB",
    },
    async request => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "O usuário deve estar logado.");
        }
        const req = parseRequest(request.data);
        await assertModuleAccess(request.auth.uid, req.feature);

        const body = {
            contents: req.contents.map(content => {
                const c = content as Record<string, unknown>;
                return c && typeof c === "object" && !c.role ? { role: "user", ...c } : c;
            }),
            ...(req.systemInstruction ? { systemInstruction: { parts: [{ text: req.systemInstruction }] } } : {}),
            generationConfig: {
                ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
                ...(req.responseMimeType ? { responseMimeType: req.responseMimeType } : {}),
                ...(req.responseSchema ? { responseSchema: req.responseSchema } : {}),
                maxOutputTokens: MAX_OUTPUT_TOKENS,
                ...(req.thinkingLevel ? { thinkingConfig: { thinkingLevel: req.thinkingLevel } } : {}),
            },
        };

        // Tenta de novo quando o modelo está ocupado (429/500/503), trava sem responder
        // ou a rede falha, enquanto couber outra tentativa no prazo da função.
        const deadline = Date.now() + GEMINI_DEADLINE_MS;
        let response: Response | undefined;
        let timedOut = false;
        for (let attempt = 1; attempt <= GEMINI_ATTEMPTS; attempt++) {
            const remaining = deadline - Date.now();
            if (remaining < MIN_ATTEMPT_MS) break;
            try {
                response = await fetch(GEMINI_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": GEMINI_API_KEY.value(),
                    },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, remaining)),
                });
                timedOut = false;
                if (!RETRY_STATUS.includes(response.status)) break;
                logger.warn("aiGenerateContent: Gemini ocupado, nova tentativa", { feature: req.feature, status: response.status, attempt });
            } catch (error) {
                response = undefined;
                timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
                logger.warn("aiGenerateContent: sem resposta do Gemini, nova tentativa", {
                    feature: req.feature, attempt, timedOut, error: String(error),
                });
            }
            if (attempt < GEMINI_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, Math.min(RETRY_BASE_MS * attempt, Math.max(deadline - Date.now() - MIN_ATTEMPT_MS, 0))));
            }
        }

        if (!response) {
            logger.error("aiGenerateContent: Gemini não respondeu", { feature: req.feature, timedOut });
            throw timedOut
                ? new HttpsError("deadline-exceeded", "A IA não respondeu a tempo (serviço sobrecarregado). Tente de novo em alguns minutos.")
                : new HttpsError("unavailable", "Não foi possível falar com a IA. Tente de novo em alguns minutos.");
        }

        if (!response.ok) {
            const detail = (await response.text()).slice(0, 500);
            logger.error("aiGenerateContent: Gemini recusou", { feature: req.feature, status: response.status, detail });
            if (response.status === 429 || response.status === 503) {
                throw new HttpsError("resource-exhausted", "A IA está sobrecarregada no momento. Tente em alguns minutos.");
            }
            if (response.status === 400) {
                throw new HttpsError("invalid-argument", "A IA não aceitou o arquivo ou o pedido.");
            }
            throw new HttpsError("internal", "A IA respondeu com erro. Tente novamente.");
        }

        const json = await response.json() as {
            candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
            usageMetadata?: { totalTokenCount?: number; thoughtsTokenCount?: number };
        };
        const candidate = json.candidates?.[0];
        const text = (candidate?.content?.parts ?? []).map(p => p.text ?? "").join("");
        if (candidate?.finishReason === "MAX_TOKENS") {
            // Resposta cortada: entregar o texto quebraria o JSON no navegador.
            logger.error("aiGenerateContent: resposta cortada no limite de tokens", {
                feature: req.feature, usage: json.usageMetadata,
            });
            throw new HttpsError("out-of-range", "A IA não terminou a resposta (documento longo demais). Tente de novo ou divida o arquivo.");
        }
        if (!text) {
            logger.warn("aiGenerateContent: resposta vazia", { feature: req.feature, finishReason: candidate?.finishReason });
            throw new HttpsError("internal", "A IA não devolveu conteúdo.");
        }

        logger.info("aiGenerateContent", {
            uid: request.auth.uid,
            feature: req.feature,
            tokens: json.usageMetadata?.totalTokenCount ?? 0,
            thinkingTokens: json.usageMetadata?.thoughtsTokenCount ?? 0,
        });
        return { text, totalTokenCount: json.usageMetadata?.totalTokenCount ?? 0 };
    }
);

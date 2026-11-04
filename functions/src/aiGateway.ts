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
const GEMINI_TIMEOUT_MS = 280_000;

/** Módulos que podem usar a IA (chave do perfil em user_profiles.modules). */
const AI_FEATURES = ["construction_rdo", "human_capital"] as const;
type AiFeature = typeof AI_FEATURES[number];

/** Limite do pedido: o callable aceita até 10 MB e os PDFs vão em base64 (+33%). */
const MAX_REQUEST_CHARS = 9_500_000;

interface AiRequest {
    feature: AiFeature;
    contents: unknown[];
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: unknown;
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
            },
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
        let response: Response;
        try {
            response = await fetch(GEMINI_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": GEMINI_API_KEY.value(),
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
        } catch (error) {
            logger.error("aiGenerateContent: falha de rede", { feature: req.feature, error: String(error) });
            throw new HttpsError("unavailable", "Não foi possível falar com a IA. Tente novamente.");
        } finally {
            clearTimeout(timer);
        }

        if (!response.ok) {
            const detail = (await response.text()).slice(0, 500);
            logger.error("aiGenerateContent: Gemini recusou", { feature: req.feature, status: response.status, detail });
            if (response.status === 429) {
                throw new HttpsError("resource-exhausted", "Limite de uso da IA atingido. Tente em alguns minutos.");
            }
            if (response.status === 400) {
                throw new HttpsError("invalid-argument", "A IA não aceitou o arquivo ou o pedido.");
            }
            throw new HttpsError("internal", "A IA respondeu com erro. Tente novamente.");
        }

        const json = await response.json() as {
            candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
            usageMetadata?: { totalTokenCount?: number };
        };
        const candidate = json.candidates?.[0];
        const text = (candidate?.content?.parts ?? []).map(p => p.text ?? "").join("");
        if (!text) {
            logger.warn("aiGenerateContent: resposta vazia", { feature: req.feature, finishReason: candidate?.finishReason });
            throw new HttpsError("internal", "A IA não devolveu conteúdo.");
        }

        logger.info("aiGenerateContent", {
            uid: request.auth.uid,
            feature: req.feature,
            tokens: json.usageMetadata?.totalTokenCount ?? 0,
        });
        return { text, totalTokenCount: json.usageMetadata?.totalTokenCount ?? 0 };
    }
);

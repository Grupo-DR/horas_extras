"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiGenerateContent = void 0;
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
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const GEMINI_API_KEY = (0, params_1.defineSecret)("GEMINI_API_KEY");
/** Trocar o modelo de todo o portal é mudar só esta linha. */
const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
/** Prazo total dentro dos 300 s da função; cada tentativa tem limite próprio. */
const GEMINI_DEADLINE_MS = 285000;
/** Uma leitura de RDO leva 20–60 s; acima disso o modelo travou e vale tentar de novo. */
const GEMINI_ATTEMPT_TIMEOUT_MS = 110000;
const MIN_ATTEMPT_MS = 15000;
const GEMINI_ATTEMPTS = 4;
const RETRY_STATUS = [429, 500, 503];
const RETRY_BASE_MS = 5000;
/** Módulos que podem usar a IA (chave do perfil em user_profiles.modules). */
const AI_FEATURES = ["construction_rdo", "human_capital"];
/**
 * Raciocínio do modelo antes de responder. O Gemini 3 conta o raciocínio no mesmo limite de
 * saída: em extrações de RDO ele chegou a gastar 63 mil tokens pensando e cortou o JSON no meio.
 * "low" resolveu nos testes com 23 RDOs reais da Vale (mesmos números, sem respostas cortadas).
 */
const THINKING_LEVELS = ["minimal", "low", "medium", "high"];
const MAX_OUTPUT_TOKENS = 65536;
/** Limite do pedido: o callable aceita até 10 MB e os PDFs vão em base64 (+33%). */
const MAX_REQUEST_CHARS = 9500000;
const parseRequest = (data) => {
    const input = (data !== null && data !== void 0 ? data : {});
    const feature = input.feature;
    if (!AI_FEATURES.includes(feature)) {
        throw new https_1.HttpsError("invalid-argument", "Módulo inválido para a IA.");
    }
    if (!Array.isArray(input.contents) || input.contents.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Conteúdo vazio.");
    }
    if (JSON.stringify(input).length > MAX_REQUEST_CHARS) {
        throw new https_1.HttpsError("invalid-argument", "Arquivo grande demais para a IA (máx. ~7 MB).");
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
        thinkingLevel: THINKING_LEVELS.includes(input.thinkingLevel)
            ? input.thinkingLevel
            : undefined,
    };
};
/** Mesmo critério das regras do Firestore (canReadModule): super admin ou módulo habilitado. */
const assertModuleAccess = async (uid, feature) => {
    var _a, _b;
    const snap = await admin.firestore().collection("user_profiles").doc(uid).get();
    const profile = snap.data();
    if (!profile)
        throw new https_1.HttpsError("permission-denied", "Perfil de usuário não encontrado.");
    if (profile.isSuperAdmin === true)
        return;
    if (((_b = (_a = profile.modules) === null || _a === void 0 ? void 0 : _a[feature]) === null || _b === void 0 ? void 0 : _b.enabled) !== true) {
        throw new https_1.HttpsError("permission-denied", "Sem acesso ao módulo para usar a IA.");
    }
};
exports.aiGenerateContent = (0, https_1.onCall)({
    region: "us-central1",
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 300,
    memory: "512MiB",
}, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "O usuário deve estar logado.");
    }
    const req = parseRequest(request.data);
    await assertModuleAccess(request.auth.uid, req.feature);
    const body = Object.assign(Object.assign({ contents: req.contents.map(content => {
            const c = content;
            return c && typeof c === "object" && !c.role ? Object.assign({ role: "user" }, c) : c;
        }) }, (req.systemInstruction ? { systemInstruction: { parts: [{ text: req.systemInstruction }] } } : {})), { generationConfig: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (req.temperature !== undefined ? { temperature: req.temperature } : {})), (req.responseMimeType ? { responseMimeType: req.responseMimeType } : {})), (req.responseSchema ? { responseSchema: req.responseSchema } : {})), { maxOutputTokens: MAX_OUTPUT_TOKENS }), (req.thinkingLevel ? { thinkingConfig: { thinkingLevel: req.thinkingLevel } } : {})) });
    // Tenta de novo quando o modelo está ocupado (429/500/503), trava sem responder
    // ou a rede falha, enquanto couber outra tentativa no prazo da função.
    const deadline = Date.now() + GEMINI_DEADLINE_MS;
    let response;
    let timedOut = false;
    for (let attempt = 1; attempt <= GEMINI_ATTEMPTS; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining < MIN_ATTEMPT_MS)
            break;
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
            if (!RETRY_STATUS.includes(response.status))
                break;
            logger.warn("aiGenerateContent: Gemini ocupado, nova tentativa", { feature: req.feature, status: response.status, attempt });
        }
        catch (error) {
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
            ? new https_1.HttpsError("deadline-exceeded", "A IA não respondeu a tempo (serviço sobrecarregado). Tente de novo em alguns minutos.")
            : new https_1.HttpsError("unavailable", "Não foi possível falar com a IA. Tente de novo em alguns minutos.");
    }
    if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        logger.error("aiGenerateContent: Gemini recusou", { feature: req.feature, status: response.status, detail });
        if (response.status === 429 || response.status === 503) {
            throw new https_1.HttpsError("resource-exhausted", "A IA está sobrecarregada no momento. Tente em alguns minutos.");
        }
        if (response.status === 400) {
            throw new https_1.HttpsError("invalid-argument", "A IA não aceitou o arquivo ou o pedido.");
        }
        throw new https_1.HttpsError("internal", "A IA respondeu com erro. Tente novamente.");
    }
    const json = await response.json();
    const candidate = (_a = json.candidates) === null || _a === void 0 ? void 0 : _a[0];
    const text = ((_c = (_b = candidate === null || candidate === void 0 ? void 0 : candidate.content) === null || _b === void 0 ? void 0 : _b.parts) !== null && _c !== void 0 ? _c : []).map(p => { var _a; return (_a = p.text) !== null && _a !== void 0 ? _a : ""; }).join("");
    if ((candidate === null || candidate === void 0 ? void 0 : candidate.finishReason) === "MAX_TOKENS") {
        // Resposta cortada: entregar o texto quebraria o JSON no navegador.
        logger.error("aiGenerateContent: resposta cortada no limite de tokens", {
            feature: req.feature, usage: json.usageMetadata,
        });
        throw new https_1.HttpsError("out-of-range", "A IA não terminou a resposta (documento longo demais). Tente de novo ou divida o arquivo.");
    }
    if (!text) {
        logger.warn("aiGenerateContent: resposta vazia", { feature: req.feature, finishReason: candidate === null || candidate === void 0 ? void 0 : candidate.finishReason });
        throw new https_1.HttpsError("internal", "A IA não devolveu conteúdo.");
    }
    logger.info("aiGenerateContent", {
        uid: request.auth.uid,
        feature: req.feature,
        tokens: (_e = (_d = json.usageMetadata) === null || _d === void 0 ? void 0 : _d.totalTokenCount) !== null && _e !== void 0 ? _e : 0,
        thinkingTokens: (_g = (_f = json.usageMetadata) === null || _f === void 0 ? void 0 : _f.thoughtsTokenCount) !== null && _g !== void 0 ? _g : 0,
    });
    return { text, totalTokenCount: (_j = (_h = json.usageMetadata) === null || _h === void 0 ? void 0 : _h.totalTokenCount) !== null && _j !== void 0 ? _j : 0 };
});
//# sourceMappingURL=aiGateway.js.map
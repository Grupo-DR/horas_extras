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
const GEMINI_TIMEOUT_MS = 280000;
/** Módulos que podem usar a IA (chave do perfil em user_profiles.modules). */
const AI_FEATURES = ["construction_rdo", "human_capital"];
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
    var _a, _b, _c, _d, _e, _f, _g;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "O usuário deve estar logado.");
    }
    const req = parseRequest(request.data);
    await assertModuleAccess(request.auth.uid, req.feature);
    const body = Object.assign(Object.assign({ contents: req.contents.map(content => {
            const c = content;
            return c && typeof c === "object" && !c.role ? Object.assign({ role: "user" }, c) : c;
        }) }, (req.systemInstruction ? { systemInstruction: { parts: [{ text: req.systemInstruction }] } } : {})), { generationConfig: Object.assign(Object.assign(Object.assign({}, (req.temperature !== undefined ? { temperature: req.temperature } : {})), (req.responseMimeType ? { responseMimeType: req.responseMimeType } : {})), (req.responseSchema ? { responseSchema: req.responseSchema } : {})) });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    let response;
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
    }
    catch (error) {
        logger.error("aiGenerateContent: falha de rede", { feature: req.feature, error: String(error) });
        throw new https_1.HttpsError("unavailable", "Não foi possível falar com a IA. Tente novamente.");
    }
    finally {
        clearTimeout(timer);
    }
    if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        logger.error("aiGenerateContent: Gemini recusou", { feature: req.feature, status: response.status, detail });
        if (response.status === 429) {
            throw new https_1.HttpsError("resource-exhausted", "Limite de uso da IA atingido. Tente em alguns minutos.");
        }
        if (response.status === 400) {
            throw new https_1.HttpsError("invalid-argument", "A IA não aceitou o arquivo ou o pedido.");
        }
        throw new https_1.HttpsError("internal", "A IA respondeu com erro. Tente novamente.");
    }
    const json = await response.json();
    const candidate = (_a = json.candidates) === null || _a === void 0 ? void 0 : _a[0];
    const text = ((_c = (_b = candidate === null || candidate === void 0 ? void 0 : candidate.content) === null || _b === void 0 ? void 0 : _b.parts) !== null && _c !== void 0 ? _c : []).map(p => { var _a; return (_a = p.text) !== null && _a !== void 0 ? _a : ""; }).join("");
    if (!text) {
        logger.warn("aiGenerateContent: resposta vazia", { feature: req.feature, finishReason: candidate === null || candidate === void 0 ? void 0 : candidate.finishReason });
        throw new https_1.HttpsError("internal", "A IA não devolveu conteúdo.");
    }
    logger.info("aiGenerateContent", {
        uid: request.auth.uid,
        feature: req.feature,
        tokens: (_e = (_d = json.usageMetadata) === null || _d === void 0 ? void 0 : _d.totalTokenCount) !== null && _e !== void 0 ? _e : 0,
    });
    return { text, totalTokenCount: (_g = (_f = json.usageMetadata) === null || _f === void 0 ? void 0 : _f.totalTokenCount) !== null && _g !== void 0 ? _g : 0 };
});
//# sourceMappingURL=aiGateway.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hcFetchOvertime = void 0;
/**
 * Consulta de horas extras no TOTVS feita pelo servidor.
 *
 * Antes, o portal chamava o TOTVS direto do navegador, com usuário e senha
 * escritos no código publicado, e cada usuário recebia a empresa inteira.
 * Agora:
 *  - a senha fica no Secret Manager (TOTVS_API_PASSWORD) e nunca vai ao navegador;
 *  - só usuários com acesso ao Capital Humano podem chamar;
 *  - o servidor devolve apenas os registros do escopo do usuário (regional ou CC).
 *
 * Configuração (uma vez):  firebase functions:secrets:set TOTVS_API_PASSWORD
 */
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const ccMaster_1 = require("./shared/ccMaster");
const TOTVS_API_PASSWORD = (0, params_1.defineSecret)("TOTVS_API_PASSWORD");
const TOTVS_API_URL = "https://drconstrutora116480.rm.cloudtotvs.com.br:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/TOTVSTOTAL/0/P";
const TOTVS_API_USERNAME = "api";
const HC_ROLES = ["CH_ADMIN", "CH_MANAGER", "CH_COSTCENTER_PLANNER", "CH_APPROVER", "CH_AUDITOR_VIEWER"];
const FIRESTORE_IN_LIMIT = 10;
const MAX_PERIOD_DAYS = 3 * 366;
const TOTVS_TIMEOUT_MS = 100000;
/** Converte MM/DD/AAAA (formato da consulta TOTVS) para AAAA-MM-DD. */
const toIsoDate = (value) => {
    if (typeof value !== "string")
        return null;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    if (!match)
        return null;
    const [, month, day, year] = match;
    const iso = `${year}-${month}-${day}`;
    const date = new Date(`${iso}T12:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.getUTCMonth() + 1 !== Number(month))
        return null;
    return iso;
};
const normalizeRole = (role) => {
    const value = typeof role === "string" ? role : "";
    return value.startsWith("HC_") ? value.replace("HC_", "CH_") : value;
};
const isCostCenterInScope = (scope, rawCostCenter) => {
    if (scope.type === "ALL")
        return true;
    if (scope.type === "COST_CENTER")
        return scope.costCenters.includes((0, ccMaster_1.normalizeCC)(rawCostCenter));
    if (scope.type === "REGIONAL")
        return scope.regionals.includes((0, ccMaster_1.getCCRegional)(rawCostCenter));
    return false;
};
const chunk = (items, size) => {
    const result = [];
    for (let i = 0; i < items.length; i += size)
        result.push(items.slice(i, i + size));
    return result;
};
/** Lê o perfil do usuário e devolve o escopo do Capital Humano, ou recusa o acesso. */
const resolveHumanCapitalScope = async (uid) => {
    var _a;
    const snap = await admin.firestore().collection("user_profiles").doc(uid).get();
    const profile = snap.data();
    if (!profile)
        throw new https_1.HttpsError("permission-denied", "Perfil de usuário não encontrado.");
    if (profile.isSuperAdmin === true)
        return { type: "ALL" };
    const hc = (_a = profile.modules) === null || _a === void 0 ? void 0 : _a.human_capital;
    if (!hc || hc.enabled !== true || !HC_ROLES.includes(normalizeRole(hc.role))) {
        throw new https_1.HttpsError("permission-denied", "Sem acesso ao módulo Capital Humano.");
    }
    const scope = hc.scope;
    if (!scope || scope.type === "ALL")
        return { type: "ALL" };
    if (scope.type === "REGIONAL") {
        return { type: "REGIONAL", regionals: (scope.regionals || []).filter(Boolean) };
    }
    if (scope.type === "COST_CENTER") {
        return { type: "COST_CENTER", costCenters: (scope.costCenters || []).filter(Boolean) };
    }
    throw new https_1.HttpsError("permission-denied", "Escopo do Capital Humano inválido.");
};
/**
 * Chapas que o headcount aloca em alguma obra do escopo durante o período.
 * O portal rateia as horas pelo headcount, então um colaborador lotado no TOTVS
 * em outra obra ainda pode ter horas atribuídas a uma obra do usuário.
 */
const getChapasAllocatedInScope = async (scope, startIso, endIso) => {
    const chapas = new Set();
    if (scope.type === "ALL")
        return chapas;
    const field = scope.type === "REGIONAL" ? "regional" : "centroCusto";
    const values = scope.type === "REGIONAL" ? scope.regionals : scope.costCenters;
    const collection = admin.firestore().collection("hc_headcount");
    const snapshots = await Promise.all(chunk(Array.from(new Set(values)), FIRESTORE_IN_LIMIT).map(part => collection.where(field, "in", part).get()));
    snapshots.forEach(snapshot => snapshot.docs.forEach(doc => {
        const record = doc.data();
        const overlaps = String(record.dataInicio || "") <= endIso && String(record.dataFim || "") >= startIso;
        if (overlaps && record.chapa && isCostCenterInScope(scope, String(record.centroCusto || ""))) {
            chapas.add(String(record.chapa));
        }
    }));
    return chapas;
};
const extractRawItems = (payload) => {
    var _a;
    const items = Array.isArray(payload)
        ? payload
        : (payload && typeof payload === "object")
            ? ((_a = payload.Items) !== null && _a !== void 0 ? _a : payload.items)
            : null;
    if (!Array.isArray(items))
        return null;
    return items.every(item => item && typeof item === "object" && !Array.isArray(item)) ? items : null;
};
const fetchTotvs = async (startDate, endDate) => {
    const url = `${TOTVS_API_URL}?parameters=PLN_B1_D=${startDate};PLN_B2_D=${endDate}`;
    const auth = btoa(`${TOTVS_API_USERNAME}:${TOTVS_API_PASSWORD.value()}`);
    let response;
    try {
        response = await fetch(url, {
            method: "GET",
            headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
            signal: AbortSignal.timeout(TOTVS_TIMEOUT_MS),
        });
    }
    catch (error) {
        logger.error("[hcFetchOvertime] falha de rede ao consultar o TOTVS", { message: String(error) });
        throw new https_1.HttpsError("unavailable", "Falha de conexão com a API TOTVS.", { totvsCode: "NETWORK_ERROR" });
    }
    if (!response.ok) {
        const totvsCode = response.status === 401 ? "HTTP_UNAUTHORIZED"
            : response.status === 403 ? "HTTP_FORBIDDEN"
                : "HTTP_ERROR";
        logger.error("[hcFetchOvertime] TOTVS respondeu com erro", { status: response.status });
        throw new https_1.HttpsError("unavailable", `API TOTVS retornou status ${response.status}.`, {
            totvsCode,
            httpStatus: response.status,
        });
    }
    let payload;
    try {
        payload = await response.json();
    }
    catch (_a) {
        throw new https_1.HttpsError("internal", "Resposta do TOTVS não é JSON.", { totvsCode: "UNEXPECTED_FORMAT" });
    }
    const items = extractRawItems(payload);
    if (!items) {
        throw new https_1.HttpsError("internal", "Formato inesperado na resposta do TOTVS.", { totvsCode: "UNEXPECTED_FORMAT" });
    }
    return items;
};
exports.hcFetchOvertime = (0, https_1.onCall)({
    region: "us-central1",
    secrets: [TOTVS_API_PASSWORD],
    timeoutSeconds: 120,
    memory: "512MiB",
}, async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "O usuário deve estar logado.");
    }
    const startDate = String((_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.startDate) !== null && _b !== void 0 ? _b : "").trim();
    const endDate = String((_d = (_c = request.data) === null || _c === void 0 ? void 0 : _c.endDate) !== null && _d !== void 0 ? _d : "").trim();
    const startIso = toIsoDate(startDate);
    const endIso = toIsoDate(endDate);
    if (!startIso || !endIso) {
        throw new https_1.HttpsError("invalid-argument", "Período inválido. Use MM/DD/AAAA.");
    }
    if (startIso > endIso) {
        throw new https_1.HttpsError("invalid-argument", "A data inicial é posterior à data final.");
    }
    const days = (Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${startIso}T00:00:00Z`)) / 86400000;
    if (days > MAX_PERIOD_DAYS) {
        throw new https_1.HttpsError("invalid-argument", "Período máximo de consulta: 3 anos.");
    }
    const scope = await resolveHumanCapitalScope(request.auth.uid);
    const [items, allocatedChapas] = await Promise.all([
        fetchTotvs(startDate, endDate),
        getChapasAllocatedInScope(scope, startIso, endIso),
    ]);
    const visible = scope.type === "ALL"
        ? items
        : items.filter(item => {
            var _a, _b;
            return isCostCenterInScope(scope, String((_a = item.CODCCUSTO) !== null && _a !== void 0 ? _a : "")) ||
                allocatedChapas.has(String((_b = item.CHAPA) !== null && _b !== void 0 ? _b : ""));
        });
    logger.info("[hcFetchOvertime] consulta atendida", {
        uid: request.auth.uid,
        email: request.auth.token.email,
        scope: scope.type,
        startDate,
        endDate,
        returned: visible.length,
        total: items.length,
    });
    return { items: visible };
});
//# sourceMappingURL=hcTotvs.js.map
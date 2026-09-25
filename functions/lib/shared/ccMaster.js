"use strict";
// ARQUIVO GERADO por functions/scripts/sync-shared.js. Nao editar aqui.
// Fonte: src/modules/human-capital/data/ccMaster.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCCRegional = exports.getCCName = exports.normalizeCC = exports.CC_MAP = exports.CC_MASTER = void 0;
exports.CC_MASTER = [
    // ── SEDE ──────────────────────────────────────────────────────────────────
    { ccNorm: "10101", name: "ADMINISTRATIVO FINANCEIRO", regional: "Sede" },
    { ccNorm: "1001", name: "ADMINISTRATIVO", regional: "Sede" },
    { ccNorm: "10104", name: "TECNOLOGIA DA INFORMACAO", regional: "Sede" },
    { ccNorm: "10301", name: "COMERCIAL", regional: "Sede" },
    { ccNorm: "10401", name: "CAPITAL HUMANO", regional: "Sede" },
    { ccNorm: "10501", name: "SSMA", regional: "Sede" },
    { ccNorm: "10601", name: "SUPRIMENTOS", regional: "Sede" },
    { ccNorm: "3000001", name: "GESTAO DE ATIVOS", regional: "Sede" },
    { ccNorm: "300001", name: "GESTAO DE ATIVOS", regional: "Sede" }, // formato DR: 3000.01
    // ── REGIONAL 01 ──────────────────────────────────────────────────────────
    { ccNorm: "301502", name: "VLI - ESTRADAS VICINAIS", regional: "Regional 01" },
    { ccNorm: "301503", name: "SER E LOC DE EQUIP COR. CENTRO-NORTE VL", regional: "Regional 01" },
    { ccNorm: "303701", name: "INFRA ESTRUTURA - GERDAU S/A", regional: "Regional 01" },
    { ccNorm: "303801", name: "MANUTENCAO DE FORNOS TMA - GERDAU", regional: "Regional 01" },
    { ccNorm: "304202", name: "OBRAS DE PAVIMENT TERM RONDONOPOLIS/MT", regional: "Regional 01" },
    { ccNorm: "304301", name: "CONSORCIO PERA FERREA", regional: "Regional 01" },
    { ccNorm: "304302", name: "CONSORCIO PERA FERREA", regional: "Regional 01" },
    { ccNorm: "304501", name: "RUMO PATIO CATANDUVA - CATIGUA", regional: "Regional 01" },
    { ccNorm: "301201", name: "SERVICOS REGIONAL 01", regional: "Regional 01" },
    { ccNorm: "302801", name: "OBRAS CIVIS REGIONAL 01", regional: "Regional 01" },
    // ── REGIONAL 02 ──────────────────────────────────────────────────────────
    { ccNorm: "301804", name: "PATRULHAS FIXAS RUMO", regional: "Regional 02" },
    { ccNorm: "301805", name: "MODERNIZACAO E LIMPEZA DE LASTRO", regional: "Regional 02" },
    { ccNorm: "301806", name: "MANUT. INFRA NORTE ZEV - ZBV", regional: "Regional 02" },
    { ccNorm: "301903", name: "MANUT. INFRA NORTE ZAR - TMI", regional: "Regional 02" },
    { ccNorm: "303702", name: "SERV CORRECAO GEOMETRICA SOCADORA - RUMO", regional: "Regional 02" },
    { ccNorm: "303703", name: "LOCACAO SOCADORA E REGULADORA - VLI", regional: "Regional 02" },
    { ccNorm: "304401", name: "MODERNIZACAO E LIMP LASTRO - ARARAQUARA", regional: "Regional 02" },
    { ccNorm: "304402", name: "INFRANORTE - ARARAQUARA", regional: "Regional 02" },
    { ccNorm: "304403", name: "LIMPEZA DE LASTRO ZMA/ZDZ", regional: "Regional 02" },
    { ccNorm: "304601", name: "EXECUÇÃO DE REDE DE AGUA SERVIDA", regional: "Regional 02" },
    { ccNorm: "304701", name: "VALE - MANUTENCAO DE ATIVOS", regional: "Regional 02" },
    { ccNorm: "304801", name: "VL! PAULISTA", regional: "Regional 02" },
    // ── OUTROS ───────────────────────────────────────────────────────────────
    { ccNorm: "302701", name: "VLI TC IBAMA", regional: "Outros" },
];
/** Lookup rápido: ccNorm → CCInfo */
exports.CC_MAP = Object.fromEntries(exports.CC_MASTER.map((c) => [c.ccNorm, c]));
/** Remove pontos de um código de CC para normalização (3.0.1.502 → 301502) */
const normalizeCC = (cc) => cc.replace(/\./g, "");
exports.normalizeCC = normalizeCC;
/** Retorna o nome oficial do CC; se não mapeado, retorna o próprio código */
const getCCName = (rawCC) => {
    var _a, _b;
    const norm = (0, exports.normalizeCC)(rawCC);
    return (_b = (_a = exports.CC_MAP[norm]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : rawCC;
};
exports.getCCName = getCCName;
/** Retorna a regional do CC; se não mapeado, retorna 'Outros' */
const getCCRegional = (rawCC) => {
    var _a, _b;
    const norm = (0, exports.normalizeCC)(rawCC);
    return (_b = (_a = exports.CC_MAP[norm]) === null || _a === void 0 ? void 0 : _a.regional) !== null && _b !== void 0 ? _b : "Outros";
};
exports.getCCRegional = getCCRegional;
//# sourceMappingURL=ccMaster.js.map
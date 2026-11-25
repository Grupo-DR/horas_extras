"use strict";
// ARQUIVO GERADO por functions/scripts/sync-shared.js. Nao editar aqui.
// Fonte: src/modules/financeiro/lib/planilha.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.localizarColunas = exports.numero = exports.dataExcel = exports.isBlank = exports.texto = exports.norm = void 0;
/** Texto comparável: sem acentos, espaços simples, maiúsculas. */
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
exports.norm = norm;
const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());
exports.texto = texto;
const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
exports.isBlank = isBlank;
/** Número de série do Excel (ou "dd/mm/aaaa") → "AAAA-MM-DD"; null se inválido. */
const dataExcel = (v) => {
    if (typeof v === 'number' && Number.isFinite(v)) {
        const ms = Math.round((Math.floor(v) - 25569) * 86400000);
        const d = new Date(ms);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
    // Aceita hora depois da data ("07/01/2026 00:00"), como as exportações do Protheus.
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v ?? '').trim());
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};
exports.dataExcel = dataExcel;
/** Número de célula: aceita número ou texto no formato brasileiro; vazio = 0; inválido = NaN. */
const numero = (v) => {
    if (typeof v === 'number')
        return v;
    const s = String(v ?? '').trim();
    if (!s)
        return 0;
    const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
    return Number.isFinite(n) ? n : NaN;
};
exports.numero = numero;
/**
 * Acha o cabeçalho nas primeiras linhas (a primeira que tem todas as colunas exigidas) e devolve
 * o índice de cada coluna. `colunas` mapeia o nome interno para os nomes aceitos no arquivo.
 */
const localizarColunas = (rows, colunas, obrigatorias, maxLinhas = 15) => {
    for (let h = 0; h < Math.min(rows.length, maxLinhas); h++) {
        const header = (rows[h] ?? []).map(exports.norm);
        const idx = {};
        for (const [k, nomes] of Object.entries(colunas)) {
            idx[k] = nomes.map(n => header.indexOf((0, exports.norm)(n))).find(i => i >= 0) ?? -1;
        }
        if (obrigatorias.every(k => idx[k] >= 0))
            return { headerIdx: h, idx };
    }
    return null;
};
exports.localizarColunas = localizarColunas;
//# sourceMappingURL=planilha.js.map
"use strict";
// ARQUIVO GERADO por functions/scripts/sync-shared.js. Nao editar aqui.
// Fonte: src/modules/financeiro/lib/razaoProtheus.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.lerRazaoProtheus = exports.dataExcel = void 0;
/**
 * Leitura do razão contábil exportado do Protheus (arquivo cru, como sai do sistema).
 *
 * - Localiza as colunas pelo nome do cabeçalho (aceita maiúsculas/minúsculas e acentos).
 * - Junta as linhas de continuação: quando o histórico é longo, o Protheus o quebra nas linhas
 *   seguintes com o Débito vazio (mesma regra do `protheus_parserV5.py`).
 * - Classifica o histórico (`classificarHistorico`). Se o arquivo já vier processado pelo script
 *   Python, as colunas de classificação dele são ignoradas e recalculadas aqui.
 *
 * Função pura: recebe as linhas da planilha (matriz, como `sheet_to_json(..., { header: 1 })`).
 */
const historicoClassifier_1 = require("./historicoClassifier");
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
/** Nomes aceitos para cada coluna (o relatório do Protheus pode variar entre versões). */
const COLUNAS = {
    filial: ['FILIAL', 'FL'],
    data: ['DATA LANCAMENTO', 'DATA'],
    centroCusto: ['CENTRO DE CUSTO MASC', 'CUSTO'],
    centroCustoSemMascara: ['CENTRO DE CUSTO'],
    conta: ['COD CONTA MASC', 'CONTA'],
    contaSemMascara: ['CODIGO DA CONTA'],
    descricaoConta: ['DESCRICAO DA CONTA', 'DESCCON'],
    historico: ['HISTORICO'],
    debito: ['DEBITO'],
    credito: ['CREDITO'],
};
const OBRIGATORIAS = ['filial', 'data', 'conta', 'historico', 'debito', 'credito'];
const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
/** Número de série do Excel (ou "dd/mm/aaaa") → "AAAA-MM-DD". */
const dataExcel = (v) => {
    if (typeof v === 'number' && Number.isFinite(v)) {
        const ms = Math.round((Math.floor(v) - 25569) * 86400000);
        const d = new Date(ms);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v ?? '').trim());
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};
exports.dataExcel = dataExcel;
const numero = (v) => {
    if (typeof v === 'number')
        return v;
    const s = String(v ?? '').trim();
    if (!s)
        return 0;
    const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
    return Number.isFinite(n) ? n : NaN;
};
/** Aplica a máscara do Protheus quando o arquivo só traz o código "cru" (ex.: 301804 → 3.0.1.804). */
const mascararCC = (cc) => (/^\d{6}$/.test(cc) ? `${cc[0]}.${cc[1]}.${cc[2]}.${cc.slice(3)}` : cc);
const mascararConta = (c) => /^\d{11}$/.test(c) ? `${c[0]}.${c[1]}.${c[2]}.${c.slice(3, 5)}.${c.slice(5)}` : c;
const lerRazaoProtheus = (rows) => {
    const headerIdx = rows.slice(0, 15).findIndex(r => r.some(c => norm(c) === 'HISTORICO'));
    if (headerIdx < 0)
        throw new Error('Cabeçalho do razão não encontrado (coluna "Historico") nas primeiras linhas.');
    const header = rows[headerIdx].map(norm);
    const col = (nomes) => {
        for (const nome of nomes) {
            const i = header.indexOf(nome);
            if (i >= 0)
                return i;
        }
        return -1;
    };
    const idx = Object.fromEntries(Object.entries(COLUNAS).map(([k, nomes]) => [k, col(nomes)]));
    const faltando = OBRIGATORIAS.filter(k => idx[k] < 0);
    if (faltando.length)
        throw new Error(`Colunas obrigatórias ausentes no razão: ${faltando.join(', ')}.`);
    const lancamentos = [];
    const avisos = [];
    let linhasContinuacao = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const linha = i + 1;
        if (r.every(isBlank))
            continue;
        // Continuação do histórico do lançamento anterior: Débito vazio (regra do script Python).
        if (isBlank(r[idx.debito])) {
            const texto = String(r[idx.historico] ?? '').trim();
            if (lancamentos.length) {
                if (texto)
                    lancamentos[lancamentos.length - 1].historico += texto;
            }
            else if (texto) {
                avisos.push(`Linha ${linha}: continuação de histórico sem lançamento anterior; ignorada.`);
            }
            linhasContinuacao++;
            continue;
        }
        const data = (0, exports.dataExcel)(r[idx.data]);
        const debito = numero(r[idx.debito]);
        const credito = numero(r[idx.credito]);
        if (!data) {
            avisos.push(`Linha ${linha}: data inválida (${String(r[idx.data])}); lançamento ignorado.`);
            continue;
        }
        if (Number.isNaN(debito) || Number.isNaN(credito)) {
            avisos.push(`Linha ${linha}: débito ou crédito não numérico; lançamento ignorado.`);
            continue;
        }
        const contaBruta = String(r[idx.conta] ?? '').trim() || String(r[idx.contaSemMascara] ?? '').trim();
        const ccBruto = idx.centroCusto >= 0 ? String(r[idx.centroCusto] ?? '').trim() : '';
        const ccSemMascara = idx.centroCustoSemMascara >= 0 ? String(r[idx.centroCustoSemMascara] ?? '').trim() : '';
        if (!contaBruta)
            avisos.push(`Linha ${linha}: lançamento sem conta.`);
        lancamentos.push({
            linha,
            filial: String(r[idx.filial] ?? '').trim().padStart(4, '0'),
            data,
            competencia: data.slice(0, 7),
            centroCusto: mascararCC(ccBruto || ccSemMascara),
            conta: mascararConta(contaBruta),
            descricaoConta: idx.descricaoConta >= 0 ? String(r[idx.descricaoConta] ?? '').trim() : '',
            historico: String(r[idx.historico] ?? '').trim(),
            debito,
            credito,
            ...(0, historicoClassifier_1.classificarHistorico)(''), // preenchido abaixo, depois de juntar as continuações
        });
    }
    for (const l of lancamentos)
        Object.assign(l, (0, historicoClassifier_1.classificarHistorico)(l.historico));
    return {
        lancamentos,
        linhasContinuacao,
        avisos,
        competencias: [...new Set(lancamentos.map(l => l.competencia))].sort(),
        filiais: [...new Set(lancamentos.map(l => l.filial))].sort(),
    };
};
exports.lerRazaoProtheus = lerRazaoProtheus;
//# sourceMappingURL=razaoProtheus.js.map
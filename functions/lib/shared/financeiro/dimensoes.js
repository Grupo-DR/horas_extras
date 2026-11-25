"use strict";
// ARQUIVO GERADO por functions/scripts/sync-shared.js. Nao editar aqui.
// Fonte: src/modules/financeiro/lib/dimensoes.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.lerDimensoes = void 0;
/**
 * Leitura da "Planilha Dimensão": abas de Centros de Custo e de Contas.
 * Cada carga substitui as duas dimensões inteiras. Chave repetida fica com a primeira ocorrência
 * (como o Power Query, que removia duplicidades de CC Totvs) e gera aviso.
 */
const planilha_1 = require("./planilha");
const COLUNAS_CC = {
    ccTotvs: ['CC TOTVS'],
    identificacao: ['IDENTIFICAÇÃO', 'IDENTIFICACAO'],
    ccDr: ['CC DR'],
    tipoCc: ['TIPO CC'],
    status: ['STATUS'],
    regional: ['REGIONAL'],
};
const COLUNAS_CONTA = {
    conta: ['CONTA'],
    descricao: ['DESCRIÇÃO', 'DESCRICAO'],
    grupo: ['GRUPO'],
    tipoConta: ['TIPO CONTA'],
    tipoConta2: ['TIPO CONTA 2'],
};
const TIPOS_CONTA = ['Faturamento', 'Impostos', 'Despesa', 'Medição'];
const lerAba = (rows, colunas, obrigatorias, chave, nomeAba, avisos) => {
    const achado = (0, planilha_1.localizarColunas)(rows, colunas, obrigatorias);
    if (!achado)
        throw new Error(`Aba de ${nomeAba}: colunas obrigatórias não encontradas (${obrigatorias.join(', ')}).`);
    const vistos = new Set();
    const saida = [];
    for (let i = achado.headerIdx + 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        if (r.every(c => (0, planilha_1.texto)(c) === ''))
            continue;
        const item = Object.fromEntries(Object.keys(colunas).map(k => [k, achado.idx[k] >= 0 ? (0, planilha_1.texto)(r[achado.idx[k]]) : '']));
        if (!item[chave]) {
            avisos.push(`${nomeAba}, linha ${i + 1}: sem ${chave}; ignorada.`);
            continue;
        }
        if (vistos.has(item[chave])) {
            avisos.push(`${nomeAba}, linha ${i + 1}: ${item[chave]} repetido; mantida a primeira ocorrência.`);
            continue;
        }
        vistos.add(item[chave]);
        saida.push(item);
    }
    return saida;
};
/** Recebe todas as abas do arquivo e acha as de centros de custo e de contas pelo cabeçalho. */
const lerDimensoes = (abas) => {
    const avisos = [];
    const abaCC = Object.keys(abas).find(n => (0, planilha_1.localizarColunas)(abas[n], COLUNAS_CC, ['ccTotvs', 'ccDr', 'regional']));
    const abaContas = Object.keys(abas).find(n => (0, planilha_1.localizarColunas)(abas[n], COLUNAS_CONTA, ['conta', 'tipoConta']));
    if (!abaCC)
        throw new Error('Aba de centros de custo não encontrada (colunas CC Totvs, CC DR, Regional).');
    if (!abaContas)
        throw new Error('Aba de contas não encontrada (colunas Conta, Tipo Conta).');
    const centros = lerAba(abas[abaCC], COLUNAS_CC, ['ccTotvs', 'ccDr', 'regional'], 'ccTotvs', 'Centros de custo', avisos);
    const contas = lerAba(abas[abaContas], COLUNAS_CONTA, ['conta', 'tipoConta'], 'conta', 'Contas', avisos);
    for (const c of contas) {
        if (!TIPOS_CONTA.includes(c.tipoConta)) {
            avisos.push(`Conta ${c.conta}: Tipo Conta "${c.tipoConta || '(vazio)'}" não é ${TIPOS_CONTA.join(', ')}; ela não entra nas medidas dos relatórios.`);
        }
    }
    if (centros.length === 0 || contas.length === 0)
        throw new Error('As abas de centros de custo e de contas não podem estar vazias.');
    return { centros, contas, avisos };
};
exports.lerDimensoes = lerDimensoes;
//# sourceMappingURL=dimensoes.js.map
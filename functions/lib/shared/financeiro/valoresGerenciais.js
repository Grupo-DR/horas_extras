"use strict";
// ARQUIVO GERADO por functions/scripts/sync-shared.js. Nao editar aqui.
// Fonte: src/modules/financeiro/lib/valoresGerenciais.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.abaDosGerenciais = exports.lerValoresGerenciais = void 0;
/**
 * Leitura dos "Valores gerenciais" (lançamentos fora do TOTVS, aba "Fatos Fora Totvs").
 * Layout parecido com o razão, mas sem linhas de continuação: toda linha com conta e data é um
 * lançamento; débito e crédito vazios valem 0 (como no Power Query: Valor = (Débito − Crédito) × −1).
 * O histórico é classificado como no razão. Cada carga substitui as competências do arquivo.
 */
const historicoClassifier_1 = require("./historicoClassifier");
const planilha_1 = require("./planilha");
const COLUNAS = {
    centroCusto: ['CUSTO', 'CENTRO DE CUSTO MASC'],
    conta: ['CONTA', 'COD CONTA MASC'],
    data: ['DATA', 'DATA LANCAMENTO'],
    historico: ['HISTORICO'],
    debito: ['DEBITO'],
    credito: ['CREDITO'],
};
const OBRIGATORIAS = ['centroCusto', 'conta', 'data', 'historico', 'debito', 'credito'];
const lerValoresGerenciais = (rows) => {
    const achado = (0, planilha_1.localizarColunas)(rows, COLUNAS, OBRIGATORIAS);
    if (!achado)
        throw new Error('Colunas obrigatórias não encontradas: CUSTO, CONTA, DATA, HISTORICO, DEBITO, CREDITO.');
    const { headerIdx, idx } = achado;
    const lancamentos = [];
    const avisos = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const linha = i + 1;
        if (r.every(c => (0, planilha_1.texto)(c) === ''))
            continue;
        const conta = (0, planilha_1.texto)(r[idx.conta]);
        const data = (0, planilha_1.dataExcel)(r[idx.data]);
        if (!conta) {
            avisos.push(`Linha ${linha}: sem conta; ignorada.`);
            continue;
        }
        if (!data) {
            avisos.push(`Linha ${linha}: data inválida (${(0, planilha_1.texto)(r[idx.data])}); ignorada.`);
            continue;
        }
        const debito = (0, planilha_1.numero)(r[idx.debito]);
        const credito = (0, planilha_1.numero)(r[idx.credito]);
        if (Number.isNaN(debito) || Number.isNaN(credito)) {
            avisos.push(`Linha ${linha}: débito ou crédito não numérico; ignorada.`);
            continue;
        }
        const historico = (0, planilha_1.texto)(r[idx.historico]);
        lancamentos.push({
            linha, data, competencia: data.slice(0, 7),
            centroCusto: (0, planilha_1.texto)(r[idx.centroCusto]), conta, historico, debito, credito,
            ...(0, historicoClassifier_1.classificarHistorico)(historico),
        });
    }
    if (lancamentos.length === 0)
        throw new Error('Nenhum lançamento encontrado no arquivo.');
    return { lancamentos, avisos, competencias: [...new Set(lancamentos.map(l => l.competencia))].sort() };
};
exports.lerValoresGerenciais = lerValoresGerenciais;
/** Escolhe a aba de dados (ex.: "Fatos Fora Totvs"), ignorando abas auxiliares. */
const abaDosGerenciais = (abas) => Object.keys(abas).find(nome => (0, planilha_1.localizarColunas)(abas[nome], COLUNAS, OBRIGATORIAS) !== null) ?? null;
exports.abaDosGerenciais = abaDosGerenciais;
//# sourceMappingURL=valoresGerenciais.js.map
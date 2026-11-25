"use strict";
// ARQUIVO GERADO por functions/scripts/sync-shared.js. Nao editar aqui.
// Fonte: src/modules/financeiro/lib/budgetForecast.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIPOS_FORECAST = exports.abaDoPlano = exports.lerPlanilhaPlano = exports.mesDoNome = exports.DivergenciaMesError = void 0;
/**
 * Leitura das planilhas de Budget e Forecast (mesmo layout: Mês, CC DR, Grupo, Conta, Descrição,
 * Tipo, Valor, Classe, Ano).
 *
 * - O mês vem da coluna "Ano", que na verdade é a data da competência (1º dia do mês) — como o Power BI.
 * - Se o nome do mês ("Mês") divergir dessa data, o arquivo é RECUSADO (decisão de 25/11/2026): o erro
 *   informa quantas linhas divergem e até 20 exemplos com o número da linha na planilha.
 * - Um arquivo = um ano (a versão de Budget/Forecast é anual).
 * - Linhas com data inválida ou valor não numérico são ignoradas com aviso (como o Power Query fazia).
 */
const planilha_1 = require("./planilha");
/** Erro de carga com as linhas em que o nome do mês não bate com a data. */
class DivergenciaMesError extends Error {
    constructor(total, exemplos) {
        super(`Arquivo recusado: ${total} linha(s) com o nome do mês diferente da data (coluna "Ano"). ` +
            `Exemplos: ${exemplos.map(e => `linha ${e.linha} (${e.mesInformado} × ${e.dataInformada.split('-').reverse().join('/')})`).join('; ')}. ` +
            'Corrija a planilha e envie de novo.');
        this.total = total;
        this.exemplos = exemplos;
        this.name = 'DivergenciaMesError';
    }
}
exports.DivergenciaMesError = DivergenciaMesError;
const COLUNAS = {
    mes: ['MÊS', 'MES'],
    ccDr: ['CC DR'],
    grupo: ['GRUPO'],
    conta: ['CONTA'],
    descricao: ['DESCRIÇÃO', 'DESCRICAO'],
    tipo: ['TIPO'],
    valor: ['VALOR'],
    classe: ['CLASSE'],
    data: ['ANO'],
};
const OBRIGATORIAS = ['mes', 'ccDr', 'conta', 'valor', 'data'];
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
/** "Janeiro", "jan", "Feveiro" (erro de digitação comum) → 1..12; null se não reconhecer. */
const mesDoNome = (v) => {
    const n = (0, planilha_1.norm)(v);
    const i = MESES.indexOf(n.slice(0, 3));
    return i >= 0 ? i + 1 : null;
};
exports.mesDoNome = mesDoNome;
const MAX_EXEMPLOS = 20;
const lerPlanilhaPlano = (rows) => {
    const achado = (0, planilha_1.localizarColunas)(rows, COLUNAS, OBRIGATORIAS);
    if (!achado)
        throw new Error('Colunas obrigatórias não encontradas: Mês, CC DR, Conta, Valor e Ano.');
    const { headerIdx, idx } = achado;
    const linhas = [];
    const avisos = [];
    const divergencias = [];
    let totalDivergencias = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const linha = i + 1;
        if (r.every(c => (0, planilha_1.texto)(c) === ''))
            continue;
        const data = (0, planilha_1.dataExcel)(r[idx.data]);
        if (!data) {
            avisos.push(`Linha ${linha}: data inválida na coluna "Ano" (${(0, planilha_1.texto)(r[idx.data])}); linha ignorada.`);
            continue;
        }
        const valor = (0, planilha_1.numero)(r[idx.valor]);
        if (Number.isNaN(valor)) {
            avisos.push(`Linha ${linha}: valor não numérico; linha ignorada.`);
            continue;
        }
        const conta = (0, planilha_1.texto)(r[idx.conta]);
        if (!conta) {
            avisos.push(`Linha ${linha}: sem conta; linha ignorada.`);
            continue;
        }
        const mesNome = (0, planilha_1.texto)(r[idx.mes]);
        if ((0, exports.mesDoNome)(mesNome) !== Number(data.slice(5, 7))) {
            totalDivergencias++;
            if (divergencias.length < MAX_EXEMPLOS)
                divergencias.push({ linha, mesInformado: mesNome || '(vazio)', dataInformada: data });
            continue;
        }
        linhas.push({
            linha,
            competencia: data.slice(0, 7),
            ccDr: (0, planilha_1.texto)(r[idx.ccDr]),
            grupo: idx.grupo >= 0 ? (0, planilha_1.texto)(r[idx.grupo]) : '',
            conta,
            descricao: idx.descricao >= 0 ? (0, planilha_1.texto)(r[idx.descricao]) : '',
            tipo: idx.tipo >= 0 ? (0, planilha_1.texto)(r[idx.tipo]) : '',
            valor,
            classe: idx.classe >= 0 ? (0, planilha_1.texto)(r[idx.classe]) : '',
        });
    }
    if (totalDivergencias > 0)
        throw new DivergenciaMesError(totalDivergencias, divergencias);
    if (linhas.length === 0)
        throw new Error('Nenhuma linha válida encontrada no arquivo.');
    const anos = [...new Set(linhas.map(l => Number(l.competencia.slice(0, 4))))].sort();
    if (anos.length > 1) {
        throw new Error(`O arquivo tem mais de um ano (${anos.join(', ')}). Envie um arquivo por ano: cada versão de Budget/Forecast é anual.`);
    }
    const porMes = {};
    for (const l of linhas)
        porMes[l.competencia] = (porMes[l.competencia] ?? 0) + l.valor;
    return { ano: anos[0], linhas, avisos, porMes, total: linhas.reduce((s, l) => s + l.valor, 0) };
};
exports.lerPlanilhaPlano = lerPlanilhaPlano;
/** Escolhe a aba de dados (ignora tabelas dinâmicas como "Planilha1"). */
const abaDoPlano = (abas) => Object.keys(abas).find(nome => (0, planilha_1.localizarColunas)(abas[nome], COLUNAS, OBRIGATORIAS) !== null) ?? null;
exports.abaDoPlano = abaDoPlano;
/** Tipos de Forecast "meses realizados + meses projetados" (3+9, 6+6...). */
exports.TIPOS_FORECAST = Array.from({ length: 11 }, (_, i) => `${i + 1}+${11 - i}`);
//# sourceMappingURL=budgetForecast.js.map
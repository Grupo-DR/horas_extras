/**
 * Leitura dos "Valores gerenciais" (lançamentos fora do TOTVS, aba "Fatos Fora Totvs").
 * Layout parecido com o razão, mas sem linhas de continuação: toda linha com conta e data é um
 * lançamento; débito e crédito vazios valem 0 (como no Power Query: Valor = (Débito − Crédito) × −1).
 * O histórico é classificado como no razão. Cada carga substitui as competências do arquivo.
 */
import { classificarHistorico, HistoricoClassificado } from './historicoClassifier';
import { dataExcel, Linhas, localizarColunas, numero, texto } from './planilha';

export interface LancamentoGerencial extends HistoricoClassificado {
  linha: number;
  data: string;
  competencia: string;
  centroCusto: string;
  conta: string;
  historico: string;
  debito: number;
  credito: number;
}

export interface LeituraGerenciais {
  lancamentos: LancamentoGerencial[];
  avisos: string[];
  competencias: string[];
}

const COLUNAS = {
  centroCusto: ['CUSTO', 'CENTRO DE CUSTO MASC'],
  conta: ['CONTA', 'COD CONTA MASC'],
  data: ['DATA', 'DATA LANCAMENTO'],
  historico: ['HISTORICO'],
  debito: ['DEBITO'],
  credito: ['CREDITO'],
} as const;

const OBRIGATORIAS = ['centroCusto', 'conta', 'data', 'historico', 'debito', 'credito'] as const;

export const lerValoresGerenciais = (rows: Linhas): LeituraGerenciais => {
  const achado = localizarColunas(rows, COLUNAS, OBRIGATORIAS);
  if (!achado) throw new Error('Colunas obrigatórias não encontradas: CUSTO, CONTA, DATA, HISTORICO, DEBITO, CREDITO.');
  const { headerIdx, idx } = achado;
  const lancamentos: LancamentoGerencial[] = [];
  const avisos: string[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const linha = i + 1;
    if (r.every(c => texto(c) === '')) continue;
    const conta = texto(r[idx.conta]);
    const data = dataExcel(r[idx.data]);
    if (!conta) { avisos.push(`Linha ${linha}: sem conta; ignorada.`); continue; }
    if (!data) { avisos.push(`Linha ${linha}: data inválida (${texto(r[idx.data])}); ignorada.`); continue; }
    const debito = numero(r[idx.debito]);
    const credito = numero(r[idx.credito]);
    if (Number.isNaN(debito) || Number.isNaN(credito)) { avisos.push(`Linha ${linha}: débito ou crédito não numérico; ignorada.`); continue; }
    const historico = texto(r[idx.historico]);
    lancamentos.push({
      linha, data, competencia: data.slice(0, 7),
      centroCusto: texto(r[idx.centroCusto]), conta, historico, debito, credito,
      ...classificarHistorico(historico),
    });
  }
  if (lancamentos.length === 0) throw new Error('Nenhum lançamento encontrado no arquivo.');
  return { lancamentos, avisos, competencias: [...new Set(lancamentos.map(l => l.competencia))].sort() };
};

/** Escolhe a aba de dados (ex.: "Fatos Fora Totvs"), ignorando abas auxiliares. */
export const abaDosGerenciais = (abas: Record<string, Linhas>): string | null =>
  Object.keys(abas).find(nome => localizarColunas(abas[nome], COLUNAS, OBRIGATORIAS) !== null) ?? null;

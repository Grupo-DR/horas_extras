/**
 * Leitura da "Planilha Dimensão": abas de Centros de Custo e de Contas.
 * Cada carga substitui as duas dimensões inteiras. Chave repetida fica com a primeira ocorrência
 * (como o Power Query, que removia duplicidades de CC Totvs) e gera aviso.
 */
import { Linhas, localizarColunas, texto } from './planilha';

export interface CentroCusto {
  ccTotvs: string;
  identificacao: string;
  ccDr: string;
  tipoCc: string;
  status: string;
  regional: string;
}

export interface Conta {
  conta: string;
  descricao: string;
  grupo: string;
  tipoConta: string; // Faturamento, Impostos, Despesa, Medição — base de todas as medidas
  tipoConta2: string;
}

export interface LeituraDimensoes {
  centros: CentroCusto[];
  contas: Conta[];
  avisos: string[];
}

const COLUNAS_CC = {
  ccTotvs: ['CC TOTVS'],
  identificacao: ['IDENTIFICAÇÃO', 'IDENTIFICACAO'],
  ccDr: ['CC DR'],
  tipoCc: ['TIPO CC'],
  status: ['STATUS'],
  regional: ['REGIONAL'],
} as const;

const COLUNAS_CONTA = {
  conta: ['CONTA'],
  descricao: ['DESCRIÇÃO', 'DESCRICAO'],
  grupo: ['GRUPO'],
  tipoConta: ['TIPO CONTA'],
  tipoConta2: ['TIPO CONTA 2'],
} as const;

const TIPOS_CONTA = ['Faturamento', 'Impostos', 'Despesa', 'Medição'];

const lerAba = <C extends Record<string, readonly string[]>>(
  rows: Linhas, colunas: C, obrigatorias: readonly (keyof C & string)[], chave: keyof C & string, nomeAba: string, avisos: string[]
): Record<keyof C & string, string>[] => {
  type K = keyof C & string;
  const achado = localizarColunas(rows, colunas, obrigatorias);
  if (!achado) throw new Error(`Aba de ${nomeAba}: colunas obrigatórias não encontradas (${obrigatorias.join(', ')}).`);
  const vistos = new Set<string>();
  const saida: Record<K, string>[] = [];
  for (let i = achado.headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (r.every(c => texto(c) === '')) continue;
    const item = Object.fromEntries(
      (Object.keys(colunas) as K[]).map(k => [k, achado.idx[k] >= 0 ? texto(r[achado.idx[k]]) : ''])
    ) as Record<K, string>;
    if (!item[chave]) { avisos.push(`${nomeAba}, linha ${i + 1}: sem ${chave}; ignorada.`); continue; }
    if (vistos.has(item[chave])) { avisos.push(`${nomeAba}, linha ${i + 1}: ${item[chave]} repetido; mantida a primeira ocorrência.`); continue; }
    vistos.add(item[chave]);
    saida.push(item);
  }
  return saida;
};

/** Recebe todas as abas do arquivo e acha as de centros de custo e de contas pelo cabeçalho. */
export const lerDimensoes = (abas: Record<string, Linhas>): LeituraDimensoes => {
  const avisos: string[] = [];
  const abaCC = Object.keys(abas).find(n => localizarColunas(abas[n], COLUNAS_CC, ['ccTotvs', 'ccDr', 'regional']));
  const abaContas = Object.keys(abas).find(n => localizarColunas(abas[n], COLUNAS_CONTA, ['conta', 'tipoConta']));
  if (!abaCC) throw new Error('Aba de centros de custo não encontrada (colunas CC Totvs, CC DR, Regional).');
  if (!abaContas) throw new Error('Aba de contas não encontrada (colunas Conta, Tipo Conta).');

  const centros = lerAba(abas[abaCC], COLUNAS_CC, ['ccTotvs', 'ccDr', 'regional'], 'ccTotvs', 'Centros de custo', avisos);
  const contas = lerAba(abas[abaContas], COLUNAS_CONTA, ['conta', 'tipoConta'], 'conta', 'Contas', avisos);

  for (const c of contas) {
    if (!TIPOS_CONTA.includes(c.tipoConta)) {
      avisos.push(`Conta ${c.conta}: Tipo Conta "${c.tipoConta || '(vazio)'}" não é ${TIPOS_CONTA.join(', ')}; ela não entra nas medidas dos relatórios.`);
    }
  }
  if (centros.length === 0 || contas.length === 0) throw new Error('As abas de centros de custo e de contas não podem estar vazias.');
  return { centros, contas, avisos };
};

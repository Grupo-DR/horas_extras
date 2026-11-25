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
import { dataExcel, Linhas, localizarColunas, norm, numero, texto } from './planilha';

export interface LinhaPlano {
  linha: number;
  competencia: string; // "AAAA-MM"
  ccDr: string;
  grupo: string;
  conta: string;
  descricao: string;
  tipo: string;
  valor: number;
  classe: string;
}

export interface LeituraPlano {
  ano: number;
  linhas: LinhaPlano[];
  avisos: string[];
  porMes: Record<string, number>; // "AAAA-MM" → soma do valor
  total: number;
}

export interface DivergenciaMes {
  linha: number;
  mesInformado: string;
  dataInformada: string; // "AAAA-MM-DD"
}

/** Erro de carga com as linhas em que o nome do mês não bate com a data. */
export class DivergenciaMesError extends Error {
  constructor(public readonly total: number, public readonly exemplos: DivergenciaMes[]) {
    super(
      `Arquivo recusado: ${total} linha(s) com o nome do mês diferente da data (coluna "Ano"). ` +
      `Exemplos: ${exemplos.map(e => `linha ${e.linha} (${e.mesInformado} × ${e.dataInformada.split('-').reverse().join('/')})`).join('; ')}. ` +
      'Corrija a planilha e envie de novo.'
    );
    this.name = 'DivergenciaMesError';
  }
}

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
} as const;

const OBRIGATORIAS = ['mes', 'ccDr', 'conta', 'valor', 'data'] as const;

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** "Janeiro", "jan", "Feveiro" (erro de digitação comum) → 1..12; null se não reconhecer. */
export const mesDoNome = (v: unknown): number | null => {
  const n = norm(v);
  const i = MESES.indexOf(n.slice(0, 3));
  return i >= 0 ? i + 1 : null;
};

const MAX_EXEMPLOS = 20;

export const lerPlanilhaPlano = (rows: Linhas): LeituraPlano => {
  const achado = localizarColunas(rows, COLUNAS, OBRIGATORIAS);
  if (!achado) throw new Error('Colunas obrigatórias não encontradas: Mês, CC DR, Conta, Valor e Ano.');
  const { headerIdx, idx } = achado;

  const linhas: LinhaPlano[] = [];
  const avisos: string[] = [];
  const divergencias: DivergenciaMes[] = [];
  let totalDivergencias = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const linha = i + 1;
    if (r.every(c => texto(c) === '')) continue;

    const data = dataExcel(r[idx.data]);
    if (!data) { avisos.push(`Linha ${linha}: data inválida na coluna "Ano" (${texto(r[idx.data])}); linha ignorada.`); continue; }
    const valor = numero(r[idx.valor]);
    if (Number.isNaN(valor)) { avisos.push(`Linha ${linha}: valor não numérico; linha ignorada.`); continue; }
    const conta = texto(r[idx.conta]);
    if (!conta) { avisos.push(`Linha ${linha}: sem conta; linha ignorada.`); continue; }

    const mesNome = texto(r[idx.mes]);
    if (mesDoNome(mesNome) !== Number(data.slice(5, 7))) {
      totalDivergencias++;
      if (divergencias.length < MAX_EXEMPLOS) divergencias.push({ linha, mesInformado: mesNome || '(vazio)', dataInformada: data });
      continue;
    }

    linhas.push({
      linha,
      competencia: data.slice(0, 7),
      ccDr: texto(r[idx.ccDr]),
      grupo: idx.grupo >= 0 ? texto(r[idx.grupo]) : '',
      conta,
      descricao: idx.descricao >= 0 ? texto(r[idx.descricao]) : '',
      tipo: idx.tipo >= 0 ? texto(r[idx.tipo]) : '',
      valor,
      classe: idx.classe >= 0 ? texto(r[idx.classe]) : '',
    });
  }

  if (totalDivergencias > 0) throw new DivergenciaMesError(totalDivergencias, divergencias);
  if (linhas.length === 0) throw new Error('Nenhuma linha válida encontrada no arquivo.');

  const anos = [...new Set(linhas.map(l => Number(l.competencia.slice(0, 4))))].sort();
  if (anos.length > 1) {
    throw new Error(`O arquivo tem mais de um ano (${anos.join(', ')}). Envie um arquivo por ano: cada versão de Budget/Forecast é anual.`);
  }

  const porMes: Record<string, number> = {};
  for (const l of linhas) porMes[l.competencia] = (porMes[l.competencia] ?? 0) + l.valor;
  return { ano: anos[0], linhas, avisos, porMes, total: linhas.reduce((s, l) => s + l.valor, 0) };
};

/** Escolhe a aba de dados (ignora tabelas dinâmicas como "Planilha1"). */
export const abaDoPlano = (abas: Record<string, Linhas>): string | null =>
  Object.keys(abas).find(nome => localizarColunas(abas[nome], COLUNAS, OBRIGATORIAS) !== null) ?? null;

/** Tipos de Forecast "meses realizados + meses projetados" (3+9, 6+6...). */
export const TIPOS_FORECAST = Array.from({ length: 11 }, (_, i) => `${i + 1}+${11 - i}`);

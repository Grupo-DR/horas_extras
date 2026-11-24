/**
 * Curva S física e financeira, semana a semana (segunda a domingo), no mesmo formato da
 * planilha "Planejamento - Modelo": previsto por linha de base, realizado, tendência e desvio.
 *
 * Tudo é digitado no sistema; aqui só se calcula. Convenções:
 *  - físico em pontos percentuais por semana (2,45 = 2,45%);
 *  - financeiro em R$ por semana; o % é sobre o total da linha de base vigente (= 100%),
 *    como a aba "DadosFinanc." da planilha.
 */
import { SCurveBaseline, SCurveDoc, SCurveSeries, SCurveWeekly } from '../types';

export type SCurveKind = 'fisico' | 'financeiro';

// ─── Semanas ─────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

/** Segunda-feira da semana da data ("AAAA-MM-DD"). */
export const mondayOf = (iso: string): string => {
  const d = fromIso(iso);
  const offset = (d.getDay() + 6) % 7; // segunda = 0
  return toIso(addDays(d, -offset));
};

/** Número da semana ISO (a mesma da planilha: semana 21/2025 = 19/05 a 25/05). */
export const isoWeek = (iso: string): { week: number; year: number } => {
  const d = fromIso(iso);
  const thursday = addDays(d, 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const week = 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return { week, year: thursday.getFullYear() };
};

export interface SCurveWeek {
  key: string;     // segunda-feira "AAAA-MM-DD"
  label: string;   // "19/05 a 25/05"
  week: number;
  year: number;
}

export const buildWeeks = (startWeek: string, weekCount: number): SCurveWeek[] => {
  const start = fromIso(mondayOf(startWeek));
  return Array.from({ length: Math.max(0, weekCount) }, (_, i) => {
    const monday = addDays(start, i * 7);
    const sunday = addDays(monday, 6);
    const key = toIso(monday);
    return {
      key,
      label: `${pad(monday.getDate())}/${pad(monday.getMonth() + 1)} a ${pad(sunday.getDate())}/${pad(sunday.getMonth() + 1)}`,
      ...isoWeek(key),
    };
  });
};

// ─── Documento ───────────────────────────────────────────────────────────────

const emptySeries = (): SCurveSeries => ({ fisico: {}, financeiro: {} });

export const newSCurveDoc = (projectId: string, startWeek: string, weekCount: number): SCurveDoc => ({
  projectId,
  startWeek: mondayOf(startWeek),
  weekCount,
  baselines: [{ id: 'LB0', name: 'LB0', createdAt: new Date().toISOString(), ...emptySeries() }],
  realizado: emptySeries(),
  tendencia: emptySeries(),
  updatedAt: new Date().toISOString(),
});

/** Nova revisão (LB1, LB2...) copiando a vigente, para ajustar só o que mudou. */
export const addBaselineRevision = (doc: SCurveDoc): SCurveDoc => {
  const current = doc.baselines[doc.baselines.length - 1];
  const next: SCurveBaseline = {
    id: `LB${doc.baselines.length}`,
    name: `LB${doc.baselines.length}`,
    createdAt: new Date().toISOString(),
    fisico: { ...current.fisico },
    financeiro: { ...current.financeiro },
  };
  return { ...doc, baselines: [...doc.baselines, next] };
};

// ─── Cálculo ─────────────────────────────────────────────────────────────────

export interface SCurveRow {
  week: SCurveWeek;
  /** Valor digitado: % (físico) ou R$ (financeiro). */
  previstoValor: number;
  realizadoValor: number | null;
  tendenciaValor: number | null;
  /** Em % (0–100). */
  previsto: number;
  previstoAcum: number;
  previstoLB0Acum: number;
  realizado: number | null;
  realizadoAcum: number | null;
  tendencia: number | null;
  tendenciaAcum: number | null;
  /** Realizado acumulado − previsto acumulado da linha de base vigente (pontos percentuais). */
  desvio: number | null;
  /** Realizado acumulado − previsto acumulado da LB0 ("Desvio a reportar" da planilha). */
  desvioLB0: number | null;
}

export interface SCurveResult {
  rows: SCurveRow[];
  /** Total da linha de base vigente: 100% do físico ou R$ do financeiro. */
  baselineTotal: number;
  statusWeek: SCurveWeek | null;
  previstoNoStatus: number | null;
  realizadoNoStatus: number | null;
  desvioNoStatus: number | null;
  desvioLB0NoStatus: number | null;
  terminoLB: SCurveWeek | null;
  terminoTendencia: SCurveWeek | null;
  tendenciaFinal: number | null;
}

const has = (series: SCurveWeekly, key: string) => typeof series[key] === 'number' && Number.isFinite(series[key]);
const sumOf = (series: SCurveWeekly, weeks: SCurveWeek[]) => weeks.reduce((s, w) => s + (has(series, w.key) ? series[w.key] : 0), 0);

export const buildSCurve = (doc: SCurveDoc, kind: SCurveKind): SCurveResult => {
  const weeks = buildWeeks(doc.startWeek, doc.weekCount);
  const lb0 = doc.baselines[0];
  const vigente = doc.baselines[doc.baselines.length - 1];
  const prevSeries = vigente?.[kind] ?? {};
  const lb0Series = lb0?.[kind] ?? {};
  const realSeries = doc.realizado[kind];
  const tendSeries = doc.tendencia[kind];

  // Financeiro vira % sobre o total da linha de base vigente; físico já está em %.
  const baselineTotal = kind === 'fisico' ? 100 : sumOf(prevSeries, weeks);
  const lb0Total = kind === 'fisico' ? 100 : sumOf(lb0Series, weeks);
  const pct = (value: number, total = baselineTotal) => (kind === 'fisico' ? value : total > 0 ? (value / total) * 100 : 0);

  // Semana de status: a última com realizado lançado.
  let statusIdx = -1;
  weeks.forEach((w, i) => { if (has(realSeries, w.key)) statusIdx = i; });

  let prevAcum = 0;
  let lb0Acum = 0;
  let realAcum = 0;
  let tendAcum: number | null = null;

  const rows = weeks.map((week, i): SCurveRow => {
    const previstoValor = has(prevSeries, week.key) ? prevSeries[week.key] : 0;
    const previsto = pct(previstoValor);
    prevAcum += previsto;
    lb0Acum += pct(has(lb0Series, week.key) ? lb0Series[week.key] : 0, lb0Total);

    const isRealized = i <= statusIdx;
    const realizadoValor = isRealized ? (has(realSeries, week.key) ? realSeries[week.key] : 0) : null;
    const realizado = realizadoValor === null ? null : pct(realizadoValor);
    if (realizado !== null) realAcum += realizado;

    // Mesma regra da planilha: a tendência começa no realizado acumulado da semana de status
    // e soma a tendência semanal digitada nas semanas seguintes.
    const tendenciaValor = i > statusIdx && has(tendSeries, week.key) ? tendSeries[week.key] : null;
    const tendencia = tendenciaValor === null ? null : pct(tendenciaValor);
    if (i === statusIdx) tendAcum = realAcum;
    else if (i > statusIdx && statusIdx >= 0 && tendAcum !== null) tendAcum += tendencia ?? 0;

    return {
      week,
      previstoValor,
      realizadoValor,
      tendenciaValor,
      previsto,
      previstoAcum: prevAcum,
      previstoLB0Acum: lb0Acum,
      realizado,
      realizadoAcum: isRealized ? realAcum : null,
      tendencia,
      tendenciaAcum: i >= statusIdx && statusIdx >= 0 ? tendAcum : null,
      desvio: isRealized ? realAcum - prevAcum : null,
      desvioLB0: isRealized ? realAcum - lb0Acum : null,
    };
  });

  const lastIdx = (pred: (r: SCurveRow, i: number) => boolean) => {
    for (let i = rows.length - 1; i >= 0; i--) if (pred(rows[i], i)) return i;
    return -1;
  };
  const terminoLbIdx = lastIdx(r => r.previstoValor > 0);
  const terminoTendIdx = statusIdx < 0 ? -1 : Math.max(statusIdx, lastIdx((r, i) => i > statusIdx && (r.tendenciaValor ?? 0) > 0));
  const status = statusIdx >= 0 ? rows[statusIdx] : null;

  return {
    rows,
    baselineTotal,
    statusWeek: status?.week ?? null,
    previstoNoStatus: status?.previstoAcum ?? null,
    realizadoNoStatus: status?.realizadoAcum ?? null,
    desvioNoStatus: status?.desvio ?? null,
    desvioLB0NoStatus: status?.desvioLB0 ?? null,
    terminoLB: terminoLbIdx >= 0 ? rows[terminoLbIdx].week : null,
    terminoTendencia: terminoTendIdx >= 0 ? rows[terminoTendIdx].week : null,
    tendenciaFinal: terminoTendIdx >= 0 ? rows[terminoTendIdx].tendenciaAcum : null,
  };
};

// ─── Digitação e colagem do Excel ────────────────────────────────────────────

/**
 * Converte o texto de uma célula em número.
 * Aceita "2,45", "2,45%", "R$ 458.427,48", "458427.48" e "0.0245".
 */
export const parseCellNumber = (raw: string): number | null => {
  const text = raw.replace(/R\$|\s/g, '').trim();
  if (!text || text === '-' || text === '—') return null;
  // "%" só indica a unidade: "2,45%" e "2,45" valem 2,45 pontos percentuais.
  let body = text.replace('%', '');
  // Separador decimal brasileiro: "1.234,56" → "1234.56"; "2,45" → "2.45".
  if (body.includes(',')) body = body.replace(/\./g, '').replace(',', '.');
  // Milhar sem decimais: "1.200.000" → "1200000".
  else if ((body.match(/\./g) ?? []).length > 1) body = body.replace(/\./g, '');
  const n = Number(body);
  return Number.isFinite(n) ? n : null;
};

/**
 * Valores colados de uma coluna do Excel (uma linha por semana). No físico, se nenhuma célula
 * tiver "%" e todas forem frações (≤ 1, somando no máximo 1), entende que vieram como 0,0245
 * e converte para pontos percentuais (2,45).
 */
export const parsePastedColumn = (text: string, kind: SCurveKind): (number | null)[] => {
  const lines = text.replace(/\r/g, '').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const cells = lines.map(line => line.split('\t')[0] ?? '');
  const values = cells.map(parseCellNumber);
  if (kind !== 'fisico' || cells.some(c => c.includes('%'))) return values;
  const numbers = values.filter((v): v is number => v !== null);
  const looksLikeFractions = numbers.length > 0 && numbers.every(v => Math.abs(v) <= 1) &&
    numbers.reduce((s, v) => s + v, 0) <= 1.0001;
  return looksLikeFractions ? values.map(v => (v === null ? null : v * 100)) : values;
};

/** Grava valores a partir de uma semana; null apaga a semana. */
export const setWeeklyValues = (series: SCurveWeekly, weeks: SCurveWeek[], fromIndex: number, values: (number | null)[]): SCurveWeekly => {
  const next = { ...series };
  values.forEach((value, offset) => {
    const week = weeks[fromIndex + offset];
    if (!week) return;
    if (value === null) delete next[week.key];
    else next[week.key] = value;
  });
  return next;
};

/**
 * Indicadores de mercado: tipos, catálogo e cálculos puros (sem rede).
 * A busca nas fontes fica em marketSources.ts; o cache e a orquestração em loadMarketIndicators.ts.
 */

export type IndicatorGroup = 'custos' | 'macro' | 'atividade' | 'ferroviario';

export const INDICATOR_GROUP_LABELS: Record<IndicatorGroup, string> = {
    custos: 'Custos da construção',
    macro: 'Macroeconomia',
    atividade: 'Atividade do setor',
    ferroviario: 'Mercado ferroviário'
};

/** Ponto de uma série temporal, com data em AAAA-MM-DD. */
export interface SeriesPoint {
    date: string;
    value: number;
}

/** Como o valor principal é lido e exibido. */
export type IndicatorFormat = 'percent' | 'percentYear' | 'currency';

export interface IndicatorMeta {
    id: string;
    name: string;
    group: IndicatorGroup;
    description: string;
    source: string;
    sourceUrl: string;
    frequency: string;
    format: IndicatorFormat;
}

export interface IndicatorResult {
    meta: IndicatorMeta;
    /** Valor mais recente e sua data de referência. */
    latest: SeriesPoint;
    /** Texto curto que acompanha o valor (ex.: "acumulado 12 meses: 5,2%"). */
    detail?: string;
    /** Variação para exibir como chip (mesma unidade do valor, em pontos). */
    change?: { value: number; label: string };
    /** Pontos do minigráfico, do mais antigo ao mais recente. */
    history: SeriesPoint[];
}

export interface FocusExpectation {
    indicator: string;
    year: string;
    median: number;
    date: string;
}

// ─── Cálculos ────────────────────────────────────────────────────────────────

/** "05/11/2026" (SGS) → "2026-11-05". */
export const parseBrDate = (value: string): string => {
    const [day, month, year] = value.split('/');
    return `${year}-${month}-${day}`;
};

/** Variação acumulada de taxas mensais em %: (1+a)(1+b)... − 1. */
export const accumulateRates = (monthlyRates: number[]): number =>
    (monthlyRates.reduce((acc, rate) => acc * (1 + rate / 100), 1) - 1) * 100;

/** Último ponto de cada mês (para séries diárias virarem mensais no gráfico). */
export const lastPointPerMonth = (points: SeriesPoint[]): SeriesPoint[] => {
    const byMonth = new Map<string, SeriesPoint>();
    [...points].sort((a, b) => a.date.localeCompare(b.date)).forEach(p => byMonth.set(p.date.slice(0, 7), p));
    return Array.from(byMonth.values());
};

/** Ponto mais recente com data menor ou igual à informada. */
export const pointOnOrBefore = (points: SeriesPoint[], date: string): SeriesPoint | undefined =>
    [...points].filter(p => p.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];

/** AAAA-MM-DD deslocado em dias (UTC, sem efeito de fuso). */
export const shiftIsoDate = (iso: string, days: number): string => {
    const date = new Date(`${iso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

/**
 * Expectativa mais recente de cada (indicador, ano) do Focus.
 * Os registros devem vir da base de cálculo dos últimos 30 dias (baseCalculo = 0).
 */
export const latestFocusExpectations = (rows: FocusExpectation[]): FocusExpectation[] => {
    const latest = new Map<string, FocusExpectation>();
    rows.forEach(row => {
        const key = `${row.indicator}|${row.year}`;
        const current = latest.get(key);
        if (!current || row.date > current.date) latest.set(key, row);
    });
    return Array.from(latest.values());
};

// ─── Formatação ──────────────────────────────────────────────────────────────

const number = (value: number, digits: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatIndicatorValue = (value: number, format: IndicatorFormat): string => {
    if (format === 'currency') return `R$ ${number(value, 4)}`;
    if (format === 'percentYear') return `${number(value, 2)}% a.a.`;
    return `${number(value, 2)}%`;
};

/** Variação com sinal: "+0,25 p.p.", "−1,20%". */
export const formatChange = (value: number, unit: 'pp' | '%'): string => {
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${sign}${number(Math.abs(value), 2)}${unit === 'pp' ? ' p.p.' : '%'}`;
};

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-09-01" → "set/2026" (mensal) ou "30/10/2026" (diário). */
export const formatReference = (iso: string, granularity: 'month' | 'day' | 'quarter'): string => {
    const [year, month, day] = iso.split('-');
    if (granularity === 'day') return `${day}/${month}/${year}`;
    if (granularity === 'quarter') return `${Math.ceil(Number(month) / 3)}º tri/${year}`;
    return `${MONTHS[Number(month) - 1]}/${year}`;
};

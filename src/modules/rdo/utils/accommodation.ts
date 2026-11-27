/** Cálculos dos alojamentos (hotéis e casas) de uma obra. Funções puras. */
import { Accommodation } from '../types';

const parseIso = (iso?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};

/**
 * Meses de contrato entre início e término (inclusive), em meses de calendário:
 * 01/01 a 31/12 = 12; 01/03 a 31/05 = 3; 15/01 a 14/02 = 1. Null se as datas faltarem ou estiverem invertidas.
 */
export const contractMonths = (start?: string, end?: string): number | null => {
  const s = parseIso(start);
  const e = parseIso(end);
  if (!s || !e || `${end}` < `${start}`) return null;
  const daysInEndMonth = new Date(e.y, e.m, 0).getDate();
  const months = (e.y - s.y) * 12 + (e.m - s.m) + (e.d - s.d + 1) / daysInEndMonth;
  return Math.round(months * 100) / 100;
};

/** Valor total: valor mensal × meses do contrato, ou diárias × valor da diária. */
export const accommodationTotal = (a: Accommodation): number => {
  if (a.billing === 'DIARIAS') return (a.stays ?? 0) * (a.dailyValue ?? 0);
  return (contractMonths(a.startDate, a.endDate) ?? 0) * (a.monthlyValue ?? 0);
};

export type AccommodationStatus = 'VIGENTE' | 'A_INICIAR' | 'ENCERRADO' | 'SEM_PERIODO';

/** Situação do contrato na data de hoje (só para contrato por período). */
export const accommodationStatus = (a: Accommodation, today: Date = new Date()): AccommodationStatus => {
  if (a.billing !== 'CONTRATO' || !a.startDate || !a.endDate) return 'SEM_PERIODO';
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (t < a.startDate) return 'A_INICIAR';
  if (t > a.endDate) return 'ENCERRADO';
  return 'VIGENTE';
};

export interface AccommodationSummary {
  count: number;
  people: number;
  total: number;
}

export const summarizeAccommodations = (list: Accommodation[]): AccommodationSummary => ({
  count: list.length,
  people: list.reduce((s, a) => s + (a.people || 0), 0),
  total: list.reduce((s, a) => s + accommodationTotal(a), 0),
});

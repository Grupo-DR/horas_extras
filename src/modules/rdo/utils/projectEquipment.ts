/**
 * Cálculos de itens da obra com período e valor: equipamentos e custos de Adm Local, Canteiro de Obras
 * e Frente Avançada. Funções puras.
 */
import { EquipmentValueBasis, ProjectEquipment } from '../types';
import { contractMonths } from './accommodation';

/** O que o cálculo precisa: período (fim vazio = em andamento) e valor mensal ou fechado. */
export interface PeriodCost {
  startDate: string;
  endDate?: string;
  value: number;
  valueBasis: EquipmentValueBasis;
}

const isoHoje = (hoje: Date) =>
  `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

/** Meses do período: do início ao fim, ou até hoje se ainda não tem fim. */
export const periodMonths = (e: PeriodCost, hoje: Date = new Date()): number | null =>
  contractMonths(e.startDate, e.endDate || isoHoje(hoje));

/** Valor total: mensal × meses (até hoje, se em andamento) ou o valor fechado do período. */
export const periodTotal = (e: PeriodCost, hoje: Date = new Date()): number =>
  e.valueBasis === 'TOTAL' ? e.value || 0 : (periodMonths(e, hoje) ?? 0) * (e.value || 0);

export type PeriodStatus = 'ATIVO' | 'A_INICIAR' | 'ENCERRADO';

export const periodStatus = (e: PeriodCost, hoje: Date = new Date()): PeriodStatus => {
  const t = isoHoje(hoje);
  if (e.startDate && t < e.startDate) return 'A_INICIAR';
  if (e.endDate && t > e.endDate) return 'ENCERRADO';
  return 'ATIVO';
};

export const summarizePeriodCosts = (list: PeriodCost[], hoje: Date = new Date()) => ({
  count: list.length,
  active: list.filter(e => periodStatus(e, hoje) === 'ATIVO').length,
  monthlyActive: list
    .filter(e => e.valueBasis === 'MENSAL' && periodStatus(e, hoje) === 'ATIVO')
    .reduce((s, e) => s + (e.value || 0), 0),
  total: list.reduce((s, e) => s + periodTotal(e, hoje), 0),
});

// ─── Equipamentos (mesmo cálculo, nomes da tela de equipamentos) ───────────────

export const equipmentMonths = (e: ProjectEquipment, hoje?: Date) => periodMonths(e, hoje);
export const equipmentTotal = (e: ProjectEquipment, hoje?: Date) => periodTotal(e, hoje);

export type EquipmentStatus = 'NA_OBRA' | 'A_MOBILIZAR' | 'DESMOBILIZADO';
const STATUS_EQUIP: Record<PeriodStatus, EquipmentStatus> = { ATIVO: 'NA_OBRA', A_INICIAR: 'A_MOBILIZAR', ENCERRADO: 'DESMOBILIZADO' };
export const equipmentStatus = (e: ProjectEquipment, hoje?: Date): EquipmentStatus => STATUS_EQUIP[periodStatus(e, hoje)];

export const summarizeEquipment = (list: ProjectEquipment[], hoje?: Date) => {
  const r = summarizePeriodCosts(list, hoje);
  return { count: r.count, onSite: r.active, monthlyOnSite: r.monthlyActive, total: r.total };
};

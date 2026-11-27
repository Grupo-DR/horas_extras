import { describe, expect, it } from 'vitest';
import { ProjectEquipment } from '../types';
import { equipmentMonths, equipmentStatus, equipmentTotal, summarizeEquipment } from './projectEquipment';

const eq = (extra: Partial<ProjectEquipment>): ProjectEquipment => ({
  id: '1', type: 'Caminhão munck', code: 'ABC1D23', startDate: '2026-03-01', endDate: '2026-05-31',
  value: 15000, valueBasis: 'MENSAL', createdAt: '', updatedAt: '', ...extra,
});
const hoje = new Date(2026, 3, 30); // 30/04/2026

describe('equipamentos da obra', () => {
  it('mensal: valor × meses do período', () => {
    expect(equipmentTotal(eq({}), hoje)).toBe(45000);
  });
  it('sem término: conta até hoje', () => {
    const e = eq({ endDate: undefined });
    expect(equipmentMonths(e, hoje)).toBe(2);
    expect(equipmentTotal(e, hoje)).toBe(30000);
  });
  it('valor fechado: usa o valor como está', () => {
    expect(equipmentTotal(eq({ valueBasis: 'TOTAL', value: 8000 }), hoje)).toBe(8000);
  });
  it('situação na data', () => {
    expect(equipmentStatus(eq({}), hoje)).toBe('NA_OBRA');
    expect(equipmentStatus(eq({ startDate: '2026-05-10' }), hoje)).toBe('A_MOBILIZAR');
    expect(equipmentStatus(eq({ endDate: '2026-04-10' }), hoje)).toBe('DESMOBILIZADO');
  });
  it('resumo: na obra, custo mensal atual e total', () => {
    const r = summarizeEquipment([eq({}), eq({ id: '2', endDate: '2026-04-10', value: 9000 })], hoje);
    expect(r).toMatchObject({ count: 2, onSite: 1, monthlyOnSite: 15000 });
    // 01/03 a 10/04 = 1,33 mês (meses arredondados em 2 casas).
    expect(r.total).toBeCloseTo(45000 + 9000 * 1.33, 2);
  });
});

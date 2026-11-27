import { describe, expect, it } from 'vitest';
import { Accommodation } from '../types';
import { accommodationStatus, accommodationTotal, contractMonths, summarizeAccommodations } from './accommodation';

const base: Accommodation = {
  id: '1', type: 'CASA', name: 'Casa 1', address: 'Rua A', people: 6, billing: 'CONTRATO',
  createdAt: '', updatedAt: '',
};

describe('contractMonths', () => {
  it('conta meses de calendário, inclusive', () => {
    expect(contractMonths('2026-01-01', '2026-12-31')).toBe(12);
    expect(contractMonths('2026-03-01', '2026-05-31')).toBe(3);
    expect(contractMonths('2026-01-15', '2026-02-14')).toBe(1);
    expect(contractMonths('2026-06-01', '2026-06-15')).toBe(0.5);
  });
  it('null com data faltando ou invertida', () => {
    expect(contractMonths('2026-06-01', undefined)).toBeNull();
    expect(contractMonths('2026-06-01', '2026-05-01')).toBeNull();
  });
});

describe('accommodationTotal', () => {
  it('contrato: valor mensal × meses', () => {
    expect(accommodationTotal({ ...base, startDate: '2026-03-01', endDate: '2026-05-31', monthlyValue: 4000 })).toBe(12000);
  });
  it('diárias: quantidade × valor da diária', () => {
    expect(accommodationTotal({ ...base, type: 'HOTEL', billing: 'DIARIAS', stays: 30, dailyValue: 180 })).toBe(5400);
  });
  it('sem dados, zero', () => {
    expect(accommodationTotal(base)).toBe(0);
  });
});

describe('accommodationStatus e resumo', () => {
  const contrato = { ...base, startDate: '2026-03-01', endDate: '2026-05-31', monthlyValue: 4000 };
  it('situação do contrato na data', () => {
    expect(accommodationStatus(contrato, new Date(2026, 1, 10))).toBe('A_INICIAR');
    expect(accommodationStatus(contrato, new Date(2026, 3, 10))).toBe('VIGENTE');
    expect(accommodationStatus(contrato, new Date(2026, 6, 10))).toBe('ENCERRADO');
    expect(accommodationStatus({ ...base, billing: 'DIARIAS' })).toBe('SEM_PERIODO');
  });
  it('soma locais, pessoas e valor total', () => {
    const hotel: Accommodation = { ...base, id: '2', type: 'HOTEL', people: 4, billing: 'DIARIAS', stays: 10, dailyValue: 200 };
    expect(summarizeAccommodations([contrato, hotel])).toEqual({ count: 2, people: 10, total: 14000 });
  });
});

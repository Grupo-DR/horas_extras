import { describe, it, expect, beforeEach } from 'vitest';
import { 
  normalizeAbsenteeismEvent, 
  isAbsenceEvent, 
  isDelayEvent, 
  isAbsenteeismEvent,
  calculateAvailableHours,
  calculateHourlyCost,
  buildAbsenteeismFacts,
  calculateAbsenteeismSummary,
  calculateAbsenteeismByRegional,
  calculateAbsenteeismByCostCenter,
  calculateAbsenteeismByFunction,
  calculateAbsenteeismByEmployee,
  calculateAbsenteeismMonthlyEvolution
} from './absenteeism';
import { HeadcountRecord, OvertimeRecord } from '../types';
import { DEFAULT_ABSENTEEISM_TARGETS } from './absenteeismTypes';

describe('Absenteeism Domain', () => {
  
  describe('Event Normalization', () => {
    it('should identify absence events', () => {
      expect(normalizeAbsenteeismEvent('FALTA')).toBe('ABSENCE');
      expect(normalizeAbsenteeismEvent('FALTAS')).toBe('ABSENCE');
      expect(normalizeAbsenteeismEvent('DESCONTO FALTAS')).toBe('ABSENCE');
      expect(normalizeAbsenteeismEvent('DESCONTO_FALTAS')).toBe('ABSENCE');
      expect(normalizeAbsenteeismEvent(' Falta ')).toBe('ABSENCE');
      expect(isAbsenceEvent('FALTA')).toBe(true);
    });

    it('should identify delay events', () => {
      expect(normalizeAbsenteeismEvent('ATRASO')).toBe('DELAY');
      expect(normalizeAbsenteeismEvent('ATRASOS')).toBe('DELAY');
      expect(normalizeAbsenteeismEvent('DESCONTO ATRASOS')).toBe('DELAY');
      expect(normalizeAbsenteeismEvent('DESCONTO_ATRASOS')).toBe('DELAY');
      expect(normalizeAbsenteeismEvent(' atraso ')).toBe('DELAY');
      expect(isDelayEvent('ATRASO')).toBe(true);
    });

    it('should ignore non-absenteeism events', () => {
      expect(normalizeAbsenteeismEvent('HE 60%')).toBeNull();
      expect(normalizeAbsenteeismEvent('INTERJORNADA')).toBeNull();
      expect(normalizeAbsenteeismEvent('')).toBeNull();
      expect(isAbsenteeismEvent('HE 60%')).toBe(false);
    });
  });

  describe('Hours & Cost Calculations', () => {
    it('should calculate available hours considering allocation distribution', () => {
      const hc: HeadcountRecord[] = [
        { chapa: '123', centroCusto: 'CC1', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31' },
        { chapa: '456', centroCusto: 'CC1', distribuicao: 0.5, dataInicio: '2024-01-01', dataFim: '2024-01-31' }
      ];
      
      expect(calculateAvailableHours(hc, '123', 'CC1')).toBe(176);
      expect(calculateAvailableHours(hc, '456', 'CC1')).toBe(88);
      expect(calculateAvailableHours(hc, '999', 'CC1')).toBe(0);
    });

    it('should calculate hourly cost correctly', () => {
      expect(calculateHourlyCost(1760, 176)).toBe(10);
    });

    it('should return 0 hourly cost when salary is missing or zero', () => {
      expect(calculateHourlyCost(0, 176)).toBe(0);
      expect(calculateHourlyCost(undefined as any, 176)).toBe(0);
      expect(calculateHourlyCost(1000, 0)).toBe(0);
    });
  });

  describe('Fact Building & Summary Calculation', () => {
    const mockOvertime: OvertimeRecord[] = [
      { CHAPA: '1', NOME: 'A', FUNCAO: 'F1', DATA: '2024-01-10', CODCCUSTO: '10101', SECAO: 'S', EVENTO: 'FALTA', HORAS: 8, VALOR: 0 },
      { CHAPA: '2', NOME: 'B', FUNCAO: 'F2', DATA: '2024-01-12', CODCCUSTO: '10101', SECAO: 'S', EVENTO: 'ATRASO', HORAS: 2, VALOR: 0 },
      { CHAPA: '1', NOME: 'A', FUNCAO: 'F1', DATA: '2024-01-15', CODCCUSTO: '10101', SECAO: 'S', EVENTO: 'HE 60%', HORAS: 5, VALOR: 0 } // ignored
    ];

    const mockHC: HeadcountRecord[] = [
      { chapa: '1', centroCusto: '10101', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31', salario: 1760 },
      { chapa: '2', centroCusto: '10101', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31' } // No salary
    ];

    it('should build facts ignoring non-absenteeism events and assigning costs', () => {
      const facts = buildAbsenteeismFacts(mockOvertime, mockHC);
      expect(facts).toHaveLength(2);
      
      const fact1 = facts.find(f => f.chapa === '1')!;
      expect(fact1.eventType).toBe('ABSENCE');
      expect(fact1.hours).toBe(8);
      expect(fact1.hourlyCost).toBe(10);
      expect(fact1.estimatedCost).toBe(80);
      
      const fact2 = facts.find(f => f.chapa === '2')!;
      expect(fact2.eventType).toBe('DELAY');
      expect(fact2.hours).toBe(2);
      expect(fact2.salary).toBe(0);
      expect(fact2.estimatedCost).toBe(0);
    });

    it('should calculate global summary correctly', () => {
      const facts = buildAbsenteeismFacts(mockOvertime, mockHC);
      const summary = calculateAbsenteeismSummary(facts, mockHC);
      
      expect(summary.absenceHours).toBe(8);
      expect(summary.delayHours).toBe(2);
      expect(summary.totalHours).toBe(10);
      expect(summary.equivalentDays).toBe(10 / 8);
      expect(summary.availableHours).toBe(176 * 2); // 2 employees with 1 allocation each
      expect(summary.absenteeismRate).toBe(10 / (176 * 2));
      expect(summary.workforceAvailabilityRate).toBe(1 - (10 / (176 * 2)));
      expect(summary.estimatedCost).toBe(80); // only employee 1 has salary
      expect(summary.headcount).toBe(2);
    });
  });

  describe('Status Classification', () => {
    it('should classify status as OK when rate <= target', () => {
      const facts = buildAbsenteeismFacts([{ CHAPA: '1', NOME: 'A', FUNCAO: 'F1', DATA: '2024-01-10', CODCCUSTO: '10101', SECAO: 'S', EVENTO: 'FALTA', HORAS: 5, VALOR: 0 }], 
        [{ chapa: '1', centroCusto: '10101', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31' }]
      );
      // rate = 5 / 176 = 0.0284 < 0.03
      const grouped = calculateAbsenteeismByRegional(facts, [{ chapa: '1', centroCusto: '10101', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31' }]);
      const g = grouped.find(x => x.regional === 'Sede')!;
      expect(g.status).toBe('OK');
    });

    it('should classify status as ATTENTION when target < rate <= target * 1.25', () => {
      const facts = buildAbsenteeismFacts([{ CHAPA: '1', NOME: 'A', FUNCAO: 'F1', DATA: '2024-01-10', CODCCUSTO: '10101', SECAO: 'S', EVENTO: 'FALTA', HORAS: 6, VALOR: 0 }], 
        [{ chapa: '1', centroCusto: '10101', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31' }]
      );
      // rate = 6 / 176 = 0.034. target = 0.03. 1.25 * 0.03 = 0.0375. So ATTENTION.
      const grouped = calculateAbsenteeismByRegional(facts, [{ chapa: '1', centroCusto: '10101', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31' }]);
      const g = grouped.find(x => x.regional === 'Sede')!;
      expect(g.status).toBe('ATTENTION');
    });

    it('should classify status as CRITICAL when rate > target * 1.25', () => {
      const facts = buildAbsenteeismFacts([{ CHAPA: '1', NOME: 'A', FUNCAO: 'F1', DATA: '2024-01-10', CODCCUSTO: '10101', SECAO: 'S', EVENTO: 'FALTA', HORAS: 10, VALOR: 0 }], 
        [{ chapa: '1', centroCusto: '10101', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31' }]
      );
      // rate = 10 / 176 = 0.056 > 0.0375. So CRITICAL.
      const grouped = calculateAbsenteeismByRegional(facts, [{ chapa: '1', centroCusto: '10101', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31' }]);
      const g = grouped.find(x => x.regional === 'Sede')!;
      expect(g.status).toBe('CRITICAL');
    });
  });

  describe('Groupings', () => {
    const mockOvertime: OvertimeRecord[] = [
      { CHAPA: '1', NOME: 'A', FUNCAO: 'F1', DATA: '2024-01-10', CODCCUSTO: '10101', SECAO: 'S', EVENTO: 'FALTA', HORAS: 8, VALOR: 0 },
      { CHAPA: '2', NOME: 'B', FUNCAO: 'F2', DATA: '2024-01-12', CODCCUSTO: '301502', SECAO: 'S', EVENTO: 'FALTA', HORAS: 20, VALOR: 0 },
    ];

    const mockHC: HeadcountRecord[] = [
      { chapa: '1', centroCusto: '10101', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31' },
      { chapa: '2', centroCusto: '301502', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31' },
      { chapa: '3', centroCusto: '10101', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31' } // no faults
    ];

    let facts: any;
    
    beforeEach(() => {
        facts = buildAbsenteeismFacts(mockOvertime, mockHC);
    });

    it('should group by regional', () => {
      const grouped = calculateAbsenteeismByRegional(facts, mockHC);
      expect(grouped.length).toBeGreaterThan(0);
      
      const sede = grouped.find(g => g.id === 'Sede')!;
      expect(sede.absenceHours).toBe(8);
      // Sede has chapa 1 and 3 => 2 * 176 available hours
      expect(sede.availableHours).toBe(352); 

      const reg1 = grouped.find(g => g.id === 'Regional 01')!;
      expect(reg1.absenceHours).toBe(20);
      // Reg 01 has chapa 2 => 176 available hours
      expect(reg1.availableHours).toBe(176); 
    });

    it('should group by cost center', () => {
      const grouped = calculateAbsenteeismByCostCenter(facts, mockHC);
      expect(grouped.find(g => g.id === '10101')?.absenceHours).toBe(8);
      expect(grouped.find(g => g.id === '301502')?.absenceHours).toBe(20);
    });

    it('should group by function', () => {
      const grouped = calculateAbsenteeismByFunction(facts, mockHC);
      expect(grouped.find(g => g.id === 'F1')?.absenceHours).toBe(8);
      expect(grouped.find(g => g.id === 'F2')?.absenceHours).toBe(20);
    });

    it('should group by employee', () => {
      const grouped = calculateAbsenteeismByEmployee(facts, mockHC);
      expect(grouped.find(g => g.id === '1')?.absenceHours).toBe(8);
      expect(grouped.find(g => g.id === '2')?.absenceHours).toBe(20);
      expect(grouped.find(g => g.id === '3')?.absenceHours).toBe(0); // included via headcount
    });
  });

  describe('Monthly Evolution', () => {
    it('should group by month correctly', () => {
      const mockOvertime: OvertimeRecord[] = [
        { CHAPA: '1', NOME: 'A', FUNCAO: 'F1', DATA: '2024-01-10', CODCCUSTO: '10101', SECAO: 'S', EVENTO: 'FALTA', HORAS: 8, VALOR: 0 },
        { CHAPA: '1', NOME: 'A', FUNCAO: 'F1', DATA: '2024-02-12', CODCCUSTO: '10101', SECAO: 'S', EVENTO: 'FALTA', HORAS: 10, VALOR: 0 },
      ];
  
      const mockHC: HeadcountRecord[] = [
        { chapa: '1', centroCusto: '10101', distribuicao: 1, dataInicio: '2024-01-01', dataFim: '2024-01-31' },
      ];
      
      const facts = buildAbsenteeismFacts(mockOvertime, mockHC);
      const evolution = calculateAbsenteeismMonthlyEvolution(facts, mockHC);
      
      expect(evolution).toHaveLength(2); // Jan and Feb
      expect(evolution.find(e => e.id.includes('2024-01'))?.absenceHours).toBe(8);
      expect(evolution.find(e => e.id.includes('2024-02'))?.absenceHours).toBe(10);
    });
  });

});

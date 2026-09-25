import { describe, expect, it } from 'vitest';
import { HeadcountRecord } from '../types';
import { buildSalaryAllocationsFromHeadcount, getSalaryCompetenciesToReplace } from './headcountSalary';

const hc = (partial: Partial<HeadcountRecord>): HeadcountRecord => ({
    dataInicio: '2026-08-21',
    dataFim: '2026-09-20',
    chapa: '1',
    centroCusto: '302801',
    distribuicao: 1,
    salario: 3000,
    ...partial
});

describe('salários gerados pelo upload do headcount', () => {
    it('registra o salário na competência da data final da vigência', () => {
        const [allocation] = buildSalaryAllocationsFromHeadcount([hc({})]);
        expect(allocation.monthKey).toBe('2026-09');
        expect(allocation.salary).toBe(3000);
    });

    it('upload de setembro substitui só setembro e preserva agosto e julho', () => {
        // Antes, a vigência 21/08 a 20/09 também apagava a competência de agosto
        // (mês de calendário da data inicial) sem recriá-la.
        const allocations = buildSalaryAllocationsFromHeadcount([hc({}), hc({ chapa: '2' })]);
        expect(getSalaryCompetenciesToReplace(allocations)).toEqual(['2026-09']);
    });

    it('arquivo sem coluna de salário não apaga nenhuma competência', () => {
        const allocations = buildSalaryAllocationsFromHeadcount([hc({ salario: undefined }), hc({ chapa: '2', salario: 0 })]);
        expect(allocations).toEqual([]);
        expect(getSalaryCompetenciesToReplace(allocations)).toEqual([]);
    });

    it('arquivo com várias competências substitui exatamente as que ele traz', () => {
        const allocations = buildSalaryAllocationsFromHeadcount([
            hc({ dataInicio: '2026-06-21', dataFim: '2026-07-20' }),
            hc({ dataInicio: '2026-08-21', dataFim: '2026-09-20', chapa: '2' })
        ]);
        expect(getSalaryCompetenciesToReplace(allocations)).toEqual(['2026-07', '2026-09']);
    });
});

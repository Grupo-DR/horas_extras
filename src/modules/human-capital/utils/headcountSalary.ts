import { HeadcountRecord, SalaryAllocation } from '../types';
import { getPayrollCompetencyMonthKey } from './overtime';

export const getSalaryAllocationId = (salary: Pick<SalaryAllocation, 'monthKey' | 'chapa' | 'costCenter'>): string =>
    `${salary.monthKey}__${salary.chapa}__${salary.costCenter}`;

/** Competência da folha (21 a 20) em que o salário de uma linha do headcount é registrado. */
export const getHeadcountSalaryCompetency = (record: Pick<HeadcountRecord, 'dataInicio' | 'dataFim'>): string =>
    getPayrollCompetencyMonthKey(record.dataFim) ||
    getPayrollCompetencyMonthKey(record.dataInicio) ||
    record.dataFim?.substring(0, 7) ||
    record.dataInicio?.substring(0, 7) ||
    '';

/** Gera as alocações salariais a partir das linhas do headcount que têm salário. */
export const buildSalaryAllocationsFromHeadcount = (records: HeadcountRecord[]): SalaryAllocation[] => {
    const allocations = new Map<string, SalaryAllocation>();

    records.forEach(record => {
        if (!record.salario || record.salario <= 0) return;

        // O salário cai em uma única competência de folha: a da data final da vigência.
        const monthKey = getHeadcountSalaryCompetency(record);
        if (!monthKey) return;

        const allocation: SalaryAllocation = {
            monthKey,
            chapa: record.chapa,
            salary: record.salario,
            allocation: record.distribuicao || 1,
            costCenter: record.centroCusto,
            status: 'A'
        };

        allocations.set(getSalaryAllocationId(allocation), allocation);
    });

    return Array.from(allocations.values());
};

/**
 * Competências cujos salários devem ser substituídos por um novo upload de headcount.
 *
 * São SOMENTE as competências para as quais o arquivo traz salários. Antes, a lista
 * incluía também os meses de calendário das datas de vigência: um headcount de
 * 21/08 a 20/09 apagava os salários da competência de agosto sem recriá-los, e um
 * arquivo sem a coluna de salário apagava tudo sem recriar nada. Com isso, a
 * pendência de julho ficava sem o salário de julho.
 */
export const getSalaryCompetenciesToReplace = (allocations: SalaryAllocation[]): string[] =>
    Array.from(new Set(allocations.map(a => a.monthKey).filter(Boolean))).sort();

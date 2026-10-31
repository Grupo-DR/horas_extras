import { describe, it, expect } from 'vitest';
import { buildRmDirectory, matchRmEmployee, normalizePersonName, RmEmployeeRecord } from './rmEmployees';
import { auditPunches, summarizeAudit } from './clockinAudit';
import { makePunch } from './clockinTestUtils';
import { HeadcountRecord } from '../../types';

const hc = (overrides: Partial<HeadcountRecord>): HeadcountRecord => ({
    dataInicio: '2026-01-01',
    dataFim: '2026-12-31',
    chapa: '100',
    centroCusto: '3019.03',
    distribuicao: 1,
    nome: 'Fulano de Tal',
    ...overrides
});

const rmEmp = (overrides: Partial<RmEmployeeRecord>): RmEmployeeRecord => ({
    chapa: '1533',
    nome: 'FULANO DE TAL',
    cpf: '11111111111',
    funcao: 'Oficial',
    codCCusto: '2018',
    dataAdmissao: '2020-01-01',
    dataDemissao: null,
    ...overrides
});

const codes = (p: { alerts: Array<{ code: string }> }) => p.alerts.map(a => a.code);

describe('rmEmployees', () => {
    it('normaliza nomes sem acento, caixa e partículas', () => {
        expect(normalizePersonName('José  da Silva Júnior')).toBe('jose silva junior');
        expect(normalizePersonName('JOSE SILVA JUNIOR')).toBe('jose silva junior');
    });

    it('prefere o headcount vigente com maior alocação', () => {
        const directory = buildRmDirectory([
            hc({ centroCusto: '3018.06', distribuicao: 0.3 }),
            hc({ centroCusto: '3019.03', distribuicao: 0.7 }),
            hc({ centroCusto: '3044.01', dataInicio: '2025-01-01', dataFim: '2025-12-31' })
        ], [], '2026-10-15');
        expect(matchRmEmployee({ cpf: '9', name: 'Fulano De Tal' }, directory)).toMatchObject({
            status: 'MATCHED',
            by: 'NOME',
            employee: { chapa: '100', costCenter: '301903', source: 'HEADCOUNT' }
        });
    });

    it('completa com o cadastro global e marca homônimos', () => {
        const directory = buildRmDirectory([], [
            { chapa: '1', nome: 'Maria Souza', funcao: 'Ajudante', costCenter: '301806' },
            { chapa: '2', nome: 'MARIA SOUZA', funcao: 'Oficial', costCenter: '301903' },
            { chapa: '3', nome: 'Joao Lima', funcao: 'Motorista', costCenter: '301903' }
        ], '2026-10-15');
        expect(matchRmEmployee({ cpf: '', name: 'Maria Souza' }, directory)).toEqual({ status: 'AMBIGUOUS', candidates: 2 });
        expect(matchRmEmployee({ cpf: '', name: 'João Lima' }, directory).employee).toMatchObject({ chapa: '3', source: 'CADASTRO' });
        expect(matchRmEmployee({ cpf: '', name: 'Ninguém' }, directory).status).toBe('NOT_FOUND');
    });

    it('cruza pelo CPF antes do nome e escolhe a chapa ativa em readmissões', () => {
        const directory = buildRmDirectory([], [{ chapa: '999', nome: 'Fulano de Tal', funcao: 'X', costCenter: '301806' }], '2026-10-15', [
            rmEmp({ chapa: '800', dataDemissao: '2022-03-01' }),
            rmEmp({ chapa: '1533', dataDemissao: null })
        ]);
        expect(matchRmEmployee({ cpf: '11111111111', name: 'Outro Nome' }, directory)).toMatchObject({
            status: 'MATCHED',
            by: 'CPF',
            employee: { chapa: '1533', source: 'RM', costCenter: '2018' }
        });
    });

    it('acusa CC da Carol diferente do RM, respeitando o 1001 e o código antigo 20xx', () => {
        const directory = buildRmDirectory([], [
            { chapa: '1', nome: 'Fulano de Tal', funcao: 'Oficial', costCenter: '3019.03' },
            { chapa: '2', nome: 'Beltrano', funcao: 'Analista', costCenter: '106.01' }
        ], '2026-10-15', [rmEmp({ cpf: '33333333333', nome: 'Ciclano', codCCusto: '2019' })]);

        const [diverge] = auditPunches([makePunch({ costCenter: '301806', carolCostCenter: '301806' })], { rmDirectory: directory });
        expect(codes(diverge)).toContain('COST_CENTER_MISMATCH');

        const [grouped] = auditPunches([makePunch({ name: 'Beltrano', cpf: '2', costCenter: '1001', carolCostCenter: '1001' })], { rmDirectory: directory });
        expect(codes(grouped)).not.toContain('COST_CENTER_MISMATCH');

        const [oldCode] = auditPunches([makePunch({ name: 'Ciclano', cpf: '33333333333', costCenter: '301903', carolCostCenter: '301903' })], { rmDirectory: directory });
        expect(codes(oldCode)).not.toContain('COST_CENTER_MISMATCH');
        expect(codes(oldCode)).not.toContain('NOT_IN_RM');

        expect(summarizeAudit([diverge, grouped, oldCode]).rmCoverage).toMatchObject({ matched: 3, matchedByCpf: 1, mismatched: 1 });
    });

    it('compara cada batida com o headcount vigente na data, aceitando qualquer CC do rateio', () => {
        // Pessoa achada pelo CPF no RM (CC atual 2044 = Pera Férrea), mas que em setembro estava
        // rateada entre 3019.03 e 3018.06 e em outubro passou para 3044.01.
        const directory = buildRmDirectory([
            hc({ chapa: '1533', centroCusto: '3019.03', distribuicao: 0.7, dataInicio: '2026-09-01', dataFim: '2026-09-30' }),
            hc({ chapa: '1533', centroCusto: '3018.06', distribuicao: 0.3, dataInicio: '2026-09-01', dataFim: '2026-09-30' }),
            hc({ chapa: '1533', centroCusto: '3044.01', distribuicao: 1, dataInicio: '2026-10-01', dataFim: '2026-12-31' })
        ], [], '2026-10-15', [rmEmp({ codCCusto: '2044' })]);

        const [sepMain, sepShared, sepOther, octMoved, octOld] = auditPunches([
            makePunch({ costCenter: '301903', carolCostCenter: '301903', punchedAt: '2026-09-10T07:00' }),
            makePunch({ costCenter: '301806', carolCostCenter: '301806', punchedAt: '2026-09-11T07:00' }),
            makePunch({ costCenter: '304701', carolCostCenter: '304701', punchedAt: '2026-09-12T07:00' }),
            makePunch({ costCenter: '304401', carolCostCenter: '304401', punchedAt: '2026-10-05T07:00' }),
            makePunch({ costCenter: '301903', carolCostCenter: '301903', punchedAt: '2026-10-06T07:00' })
        ], { rmDirectory: directory });

        expect(codes(sepMain)).not.toContain('COST_CENTER_MISMATCH');
        expect(codes(sepShared)).not.toContain('COST_CENTER_MISMATCH');
        expect(sepMain.expectedCostCenters).toEqual({
            source: 'HEADCOUNT',
            allocations: [{ costCenter: '301903', share: 0.7 }, { costCenter: '301806', share: 0.3 }]
        });
        expect(codes(sepOther)).toContain('COST_CENTER_MISMATCH');
        expect(sepOther.alerts.find(a => a.code === 'COST_CENTER_MISMATCH')!.detail).toContain('headcount em 12/09/2026');
        // Em outubro o headcount diz 3044.01: bate na nova obra, diverge na antiga.
        expect(codes(octMoved)).not.toContain('COST_CENTER_MISMATCH');
        expect(codes(octOld)).toContain('COST_CENTER_MISMATCH');
    });

    it('sem headcount na data, usa o CC atual do RM e avisa a fonte', () => {
        const directory = buildRmDirectory([], [], '2026-10-15', [rmEmp({ codCCusto: '301806' })]);
        const [punch] = auditPunches([makePunch({ costCenter: '301903', carolCostCenter: '301903' })], { rmDirectory: directory });
        expect(punch.expectedCostCenters?.source).toBe('RM_ATUAL');
        expect(punch.alerts.find(a => a.code === 'COST_CENTER_MISMATCH')!.detail).toContain('CC atual no RM (sem headcount na data)');
    });

    it('acusa batida após a demissão e CPF fora do RM', () => {
        const directory = buildRmDirectory([], [], '2026-10-15', [
            rmEmp({ cpf: '11111111111', codCCusto: '301806', dataDemissao: '2026-09-30' })
        ]);
        const [dismissed, missing] = auditPunches([
            makePunch({ cpf: '11111111111', punchedAt: '2026-10-01T07:00' }),
            makePunch({ cpf: '22222222222', name: 'Desconhecido', punchedAt: '2026-10-01T07:00' })
        ], { rmDirectory: directory });
        expect(codes(dismissed)).toContain('DISMISSED_EMPLOYEE');
        expect(dismissed.worstSeverity).toBe('high');
        expect(codes(missing)).toContain('NOT_IN_RM');
    });
});

import { describe, expect, it } from 'vitest';
import { PlanningRecord } from '../types';
import {
    buildPlanningQueue,
    buildSalaryByCompetency,
    estimateOvertimeCost,
    estimateQueueCost,
    formatCompetencyLabel,
    getCompetencyRange,
    getCompetencyTiming,
    getPlanningCompetency,
    getPlanningWorkflowCapabilities,
    isPlanningStatusEditable,
    normalizePlanningStatus,
    resolveStatusAfterEdit
} from './planningWorkflow';

const rec = (partial: Partial<PlanningRecord>): PlanningRecord => ({
    id: `${partial.chapa || '1'}_${partial.costCenter || 'CC'}_DAILY_${partial.date || '2026-09-01'}`,
    chapa: '1',
    nome: 'Fulano',
    costCenter: 'CC',
    date: '2026-09-01',
    type: 'DAILY',
    plannedHours: 2,
    status: 'draft',
    ...partial
});

describe('papéis do fluxo', () => {
    it('engenheiro só salva: não envia nem aprova', () => {
        const caps = getPlanningWorkflowCapabilities('CH_COSTCENTER_PLANNER');
        expect(caps).toEqual({ canEditOpen: true, canSubmitToDirector: false, canApprove: false, canOverrideLock: false });
    });

    it('gerente regional edita e envia ao diretor, mas não aprova', () => {
        const caps = getPlanningWorkflowCapabilities('CH_MANAGER');
        expect(caps.canEditOpen).toBe(true);
        expect(caps.canSubmitToDirector).toBe(true);
        expect(caps.canApprove).toBe(false);
    });

    it('diretor aprova e não envia em nome do gerente', () => {
        const caps = getPlanningWorkflowCapabilities('CH_APPROVER');
        expect(caps.canApprove).toBe(true);
        expect(caps.canSubmitToDirector).toBe(false);
    });

    it('aceita papéis legados HC_* e superadmin', () => {
        expect(getPlanningWorkflowCapabilities('HC_MANAGER').canSubmitToDirector).toBe(true);
        expect(getPlanningWorkflowCapabilities('CH_AUDITOR_VIEWER', true).canApprove).toBe(true);
        expect(getPlanningWorkflowCapabilities('CH_AUDITOR_VIEWER').canEditOpen).toBe(false);
    });
});

describe('edição por status', () => {
    const engineer = getPlanningWorkflowCapabilities('CH_COSTCENTER_PLANNER');
    const director = getPlanningWorkflowCapabilities('CH_APPROVER');

    it('engenheiro edita aguardando gerente e devolvido', () => {
        expect(isPlanningStatusEditable('draft', engineer)).toBe(true);
        expect(isPlanningStatusEditable('rejected', engineer)).toBe(true);
        expect(isPlanningStatusEditable(undefined, engineer)).toBe(true);
    });

    it('engenheiro não edita o que foi enviado ou aprovado', () => {
        expect(isPlanningStatusEditable('pending', engineer)).toBe(false);
        expect(isPlanningStatusEditable('approved', engineer)).toBe(false);
    });

    it('diretor pode sobrepor o bloqueio', () => {
        expect(isPlanningStatusEditable('approved', director)).toBe(true);
    });

    it('devolvido corrigido volta para o gerente; enviado/aprovado mantêm status', () => {
        expect(resolveStatusAfterEdit('rejected')).toBe('draft');
        expect(resolveStatusAfterEdit('draft')).toBe('draft');
        expect(resolveStatusAfterEdit(undefined)).toBe('draft');
        expect(resolveStatusAfterEdit('pending')).toBe('pending');
        expect(resolveStatusAfterEdit('approved')).toBe('approved');
    });

    it('status desconhecido ou ausente é tratado como aguardando gerente, nunca como aprovado', () => {
        expect(normalizePlanningStatus(undefined)).toBe('draft');
        expect(normalizePlanningStatus('')).toBe('draft');
        expect(normalizePlanningStatus('xyz')).toBe('draft');
        expect(normalizePlanningStatus('APPROVED')).toBe('approved');
    });
});

describe('fila por obra e competência da folha', () => {
    it('agrupa por centro de custo na mesma competência e ignora zeros', () => {
        const groups = buildPlanningQueue([
            rec({ costCenter: 'B', date: '2026-09-10', plannedHours: 2 }),
            rec({ costCenter: 'A', date: '2026-09-15', plannedHours: 3, chapa: '1' }),
            rec({ costCenter: 'A', date: '2026-09-16', plannedHours: 1, chapa: '2' }),
            rec({ costCenter: 'C', date: '2026-09-01', plannedHours: 0 })
        ]);

        expect(groups.map(g => g.key)).toEqual(['A|2026-09', 'B|2026-09']);
        expect(groups[0].totalHours).toBe(4);
        expect(groups[0].employeeCount).toBe(2);
        expect(groups[0].firstDate).toBe('2026-09-15');
        expect(groups[0].lastDate).toBe('2026-09-16');
    });

    it('nunca mistura competências: uma obra com lançamentos de junho a setembro vira um cartão por folha', () => {
        const groups = buildPlanningQueue([
            rec({ costCenter: '302801', date: '2026-06-22' }), // folha de julho (21/06 a 20/07)
            rec({ costCenter: '302801', date: '2026-07-20' }), // ainda julho
            rec({ costCenter: '302801', date: '2026-07-21' }), // folha de agosto
            rec({ costCenter: '302801', date: '2026-09-18' })  // folha de setembro
        ]);

        expect(groups.map(g => g.competency)).toEqual(['2026-07', '2026-08', '2026-09']);
        expect(groups[0].records).toHaveLength(2);
        expect(groups[0].competencyStart).toBe('2026-06-21');
        expect(groups[0].competencyEnd).toBe('2026-07-20');
    });

    it('trata a virada de ano na competência de janeiro', () => {
        expect(getPlanningCompetency('2025-12-21')).toBe('2026-01');
        expect(getCompetencyRange('2026-01')).toEqual({ start: '2025-12-21', end: '2026-01-20' });
        expect(formatCompetencyLabel('2026-07')).toBe('Julho/2026');
    });

    it('classifica a competência como encerrada, em andamento ou futura', () => {
        expect(getCompetencyTiming('2026-07', '2026-09-24')).toBe('closed');
        expect(getCompetencyTiming('2026-10', '2026-09-24')).toBe('open');
        expect(getCompetencyTiming('2026-11', '2026-09-24')).toBe('future');
    });

    it('mantém a mesma pessoa em obras diferentes separada (sem misturar CCs)', () => {
        const groups = buildPlanningQueue([
            rec({ chapa: '2201', costCenter: '301804', plannedHours: 2 }),
            rec({ chapa: '2201', costCenter: '301806', plannedHours: 5 })
        ]);
        const byCc = Object.fromEntries(groups.map(g => [g.costCenter, g.totalHours]));
        expect(byCc).toEqual({ '301804': 2, '301806': 5 });
    });

    it('expõe o motivo da devolução mais recente', () => {
        const [group] = buildPlanningQueue([
            rec({ status: 'rejected', rejectionReason: 'antigo', rejectedAt: '2026-09-01T10:00:00Z' }),
            rec({ date: '2026-09-02', status: 'rejected', rejectionReason: 'recente', rejectedAt: '2026-09-02T10:00:00Z' })
        ]);
        expect(group.lastRejectionReason).toBe('recente');
    });
});

describe('custo pelo salário da competência', () => {
    const salaries = buildSalaryByCompetency([
        { monthKey: '2026-07', chapa: '1', salary: 2200 },
        { monthKey: '2026-09', chapa: '1', salary: 4400 },
        { monthKey: '2026-09', chapa: '1', salary: 3000 } // segunda alocação: vale o maior
    ]);

    it('pendência de julho usa o salário de julho, mesmo existindo salário de setembro', () => {
        // 2026-07-06 é segunda-feira: 1h × 2200/220 × 1,6 = 16
        const { cost, missingSalaryChapas } = estimateQueueCost([rec({ chapa: '1', date: '2026-07-06', plannedHours: 1 })], salaries);
        expect(cost).toBeCloseTo(16);
        expect(missingSalaryChapas).toEqual([]);
    });

    it('usa o maior salário quando a pessoa tem mais de uma alocação na competência', () => {
        expect(salaries['2026-09']['1']).toBe(4400);
    });

    it('quem não tem salário na competência fica fora do custo e é informado, não vira zero silencioso', () => {
        const result = estimateQueueCost([
            rec({ chapa: '1', date: '2026-07-06', plannedHours: 1 }),
            rec({ chapa: '2', date: '2026-07-07', plannedHours: 3 })
        ], salaries);
        expect(result.cost).toBeCloseTo(16);
        expect(result.missingSalaryChapas).toEqual(['2']);
        expect(result.missingSalaryHours).toBe(3);
    });
});

describe('custo estimado', () => {
    it('usa 60% em dia comum e 100% no domingo', () => {
        // 2026-09-14 é segunda; 2026-09-13 é domingo.
        expect(estimateOvertimeCost(1, 2200, '2026-09-14')).toBeCloseTo(16);
        expect(estimateOvertimeCost(1, 2200, '2026-09-13')).toBeCloseTo(20);
        expect(estimateOvertimeCost(1, undefined, '2026-09-14')).toBe(0);
    });
});

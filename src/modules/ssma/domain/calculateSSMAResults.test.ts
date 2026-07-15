import { describe, expect, it } from 'vitest';
import {
    calculateCollectiveMonthlyResult,
    calculatePersonMonthlyResult,
    getCompetenceFromDate,
    mapRoleToFunctionGroup
} from './calculateSSMAResults';
import { SSMAEmployee, SSMAInspectionEvent, SSMAMonthlyTarget } from '../types';

const baseEmployee: SSMAEmployee = {
    id: 'u-tst',
    uid: 'u-tst',
    name: 'Tecnico SSMA',
    email: 'tecnico@example.com',
    functionGroup: 'TECHNICIAN',
    roleSnapshot: 'SSMA_TECHNICIAN',
    active: true
};

const event = (overrides: Partial<SSMAInspectionEvent>): SSMAInspectionEvent => ({
    id: overrides.id || `event-${Math.random()}`,
    competence: '2026-07',
    date: '2026-07-10',
    inspectionType: 'IFS',
    regionalId: 'reg-1',
    regionalNameSnapshot: 'Regional 1',
    costCenterId: 'cc-1',
    costCenterCodeSnapshot: 'CC1',
    costCenterNameSnapshot: 'Obra 1',
    executorUid: 'u-tst',
    executorNameSnapshot: 'Tecnico SSMA',
    executorEmailSnapshot: 'tecnico@example.com',
    executorFunctionGroup: 'TST',
    executorRoleSnapshot: 'SSMA_TECHNICIAN',
    status: 'VALID',
    ...overrides
});

const target = (overrides: Partial<SSMAMonthlyTarget>): SSMAMonthlyTarget => ({
    id: '2026-07_u-tst',
    competence: '2026-07',
    employeeUid: 'u-tst',
    employeeNameSnapshot: 'Tecnico SSMA',
    employeeEmailSnapshot: 'tecnico@example.com',
    functionGroup: 'TST',
    roleSnapshot: 'SSMA_TECHNICIAN',
    metaIFS: 1,
    metaAlojamento: 1,
    metaHotel: 1,
    active: true,
    ...overrides
});

describe('calculateSSMAResults', () => {
    it('maps IAM roles to SSMA target groups', () => {
        expect(mapRoleToFunctionGroup('SSMA_REGIONAL_MANAGER')).toBe('GREG');
        expect(mapRoleToFunctionGroup('SSMA_SITE_MANAGER')).toBe('GESTOR');
        expect(mapRoleToFunctionGroup('SSMA_SUPERVISOR')).toBe('SUPSSMA');
        expect(mapRoleToFunctionGroup('SSMA_TECHNICIAN')).toBe('TST');
        expect(mapRoleToFunctionGroup('SSMA_FOREMAN')).toBe('ENCARREGADO');
    });

    it('extracts competence from ISO date', () => {
        expect(getCompetenceFromDate('2026-07-15')).toBe('2026-07');
    });

    it('calculates individual result by employeeUid', () => {
        const result = calculatePersonMonthlyResult(baseEmployee, [
            event({ id: '1', inspectionType: 'IFS' }),
            event({ id: '2', inspectionType: 'ALOJAMENTO' }),
            event({ id: '3', executorUid: 'other-user' })
        ], target({ metaIFS: 1, metaAlojamento: 1 }));

        expect(result.realIFS).toBe(1);
        expect(result.realAlojamento).toBe(1);
        expect(result.resultadoIndividual).toBe(1);
        expect(result.status).toBe('ATENDE');
    });

    it('handles zero target with no real events as SEM_META', () => {
        const result = calculatePersonMonthlyResult(baseEmployee, [], target({ metaIFS: 0, metaAlojamento: 0 }));

        expect(result.resultadoIndividual).toBeNull();
        expect(result.status).toBe('SEM_META');
    });

    it('handles zero target with real events as REALIZADO_SEM_META', () => {
        const result = calculatePersonMonthlyResult(baseEmployee, [
            event({ id: '1', inspectionType: 'IFS' })
        ], target({ metaIFS: 0, metaAlojamento: 0 }));

        expect(result.resultadoIndividual).toBeNull();
        expect(result.status).toBe('REALIZADO_SEM_META');
    });

    it('allows result above 100 percent', () => {
        const result = calculatePersonMonthlyResult(baseEmployee, [
            event({ id: '1' }),
            event({ id: '2' })
        ], target({ metaIFS: 1, metaAlojamento: 0 }));

        expect(result.resultadoIndividual).toBe(2);
    });

    it('includes GREG in collective result', () => {
        const collective = calculateCollectiveMonthlyResult([
            event({ id: 'greg-1', executorUid: 'u-greg', executorFunctionGroup: 'GREG', inspectionType: 'IFS' }),
            event({ id: 'tst-1', executorUid: 'u-tst', executorFunctionGroup: 'TST', inspectionType: 'ALOJAMENTO' })
        ], [
            target({ id: '2026-07_u-greg', employeeUid: 'u-greg', functionGroup: 'GREG', metaIFS: 1, metaAlojamento: 0 }),
            target({ id: '2026-07_u-tst', employeeUid: 'u-tst', functionGroup: 'TST', metaIFS: 0, metaAlojamento: 1 })
        ], { competence: '2026-07' });

        expect(collective.realIFS_GREG).toBe(1);
        expect(collective.metaIFS_GREG).toBe(1);
        expect(collective.totalRealizado).toBe(2);
        expect(collective.resultadoColetivo).toBe(1);
    });

    it('ignores CANCELLED events in realized totals', () => {
        const result = calculatePersonMonthlyResult(baseEmployee, [
            event({ id: 'valid-1', status: 'VALID' }),
            event({ id: 'cancelled-1', status: 'CANCELLED' })
        ], target({ metaIFS: 1, metaAlojamento: 0 }));

        expect(result.realTotal).toBe(1);
        expect(result.resultadoIndividual).toBe(1);
    });
});

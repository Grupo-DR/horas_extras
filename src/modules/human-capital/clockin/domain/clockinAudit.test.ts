import { describe, it, expect } from 'vitest';
import {
    auditPunches,
    buildCarolFenceHealth,
    groupShifts,
    haversineMeters,
    suggestSitesFromPunches,
    summarizeAudit
} from './clockinAudit';
import { makePunch } from './clockinTestUtils';

const codes = (p: { alerts: Array<{ code: string }> }) => p.alerts.map(a => a.code);

/** Entrada e saída limpas no mesmo dia. */
const pair = (cpf = '11111111111', date = '2026-10-01') => [
    makePunch({ cpf, punchedAt: `${date}T07:00` }),
    makePunch({ cpf, punchedAt: `${date}T17:00` })
];

describe('clockinAudit', () => {
    it('calcula distância haversine', () => {
        expect(haversineMeters(-23.5737, -47.0558, -23.5737, -47.0558)).toBe(0);
        expect(haversineMeters(-23.5737, -47.0558, -23.9111, -46.6904)).toBeGreaterThan(52_000);
        expect(haversineMeters(-23.5737, -47.0558, -23.9111, -46.6904)).toBeLessThan(54_000);
    });

    it('não gera alerta para batidas limpas', () => {
        const audited = auditPunches(pair());
        expect(audited.every(p => p.alerts.length === 0)).toBe(true);
        expect(audited[0].worstSeverity).toBeNull();
    });

    it('detecta hora alterada, envio tardio, foto aprovada e falta de recibo', () => {
        const [entry, exit] = pair();
        const audited = auditPunches([
            { ...entry, autoDateTime: false, firstSyncDelayMin: 300 },
            { ...exit, mode: 'PHOTO_APPROVED', faceScore: 0, receiptMethod: 'Nothing' }
        ]);
        expect(codes(audited[0])).toEqual(expect.arrayContaining(['TIME_TAMPER', 'LATE_SYNC']));
        expect(audited[0].worstSeverity).toBe('high');
        expect(codes(audited[1])).toEqual(expect.arrayContaining(['PHOTO_APPROVED', 'NO_RECEIPT']));
        expect(audited[1].worstSeverity).toBe('medium');
    });

    it('detecta fuso diferente do usado no local', () => {
        const punches = [...pair('1'), ...pair('2'), ...pair('3')];
        punches[0] = { ...punches[0], gmt: '-04:00' };
        expect(codes(auditPunches(punches)[0])).toContain('TIMEZONE_MISMATCH');
    });

    it('acusa jornada com batida ímpar, inclusive em turno que vira a meia-noite', () => {
        const night = [
            makePunch({ punchedAt: '2026-10-01T22:00' }),
            makePunch({ punchedAt: '2026-10-02T06:00' }),
            makePunch({ punchedAt: '2026-10-02T22:00' })
        ];
        expect(groupShifts(night).map(s => s.punches.length)).toEqual([2, 1]);
        const audited = auditPunches(night);
        expect(codes(audited[0])).not.toContain('ODD_PUNCHES');
        expect(codes(audited[2])).toContain('ODD_PUNCHES');
    });

    it('não separa jornada de 12 h sem batida de almoço', () => {
        const shifts = groupShifts([
            makePunch({ punchedAt: '2026-10-01T06:00' }),
            makePunch({ punchedAt: '2026-10-01T18:30' }),
            makePunch({ punchedAt: '2026-10-02T06:00' }),
            makePunch({ punchedAt: '2026-10-02T18:30' })
        ]);
        expect(shifts.map(s => s.punches.length)).toEqual([2, 2]);
    });

    it('acusa batida repetida em poucos minutos', () => {
        const punches = [...pair(), makePunch({ punchedAt: '2026-10-01T17:03' }), makePunch({ punchedAt: '2026-10-01T12:00' })];
        const audited = auditPunches(punches);
        const repeated = audited.find(p => p.punchedAt === '2026-10-01T17:03')!;
        expect(codes(repeated)).toContain('REPEATED_PUNCH');
    });

    it('usa o status da Carol quando a cerca do local é confiável', () => {
        const [entry, exit] = pair();
        const audited = auditPunches([
            entry,
            { ...exit, fenceStatus: 'OUTSIDE', fenceCheck: { centerLat: -23.5737, centerLon: -47.0558, radius: 35, distance: 800 } }
        ]);
        expect(audited[1].effectiveFence).toBe('OUTSIDE');
        expect(audited[1].fenceSource).toBe('CAROL');
        expect(codes(audited[1])).toContain('OUTSIDE_FENCE');
    });

    it('não culpa o colaborador quando a cerca da Carol está mal configurada', () => {
        const broken = { centerLat: -21.8, centerLon: -48.15, radius: 0, distance: 85_000 };
        const punches = pair().map(p => ({ ...p, fenceStatus: 'OUTSIDE' as const, fenceCheck: broken, locationCode: '013' }));
        const health = buildCarolFenceHealth(punches);
        expect(health[0].problems).toContain('RADIUS_ZERO');
        const audited = auditPunches(punches, { fenceHealth: health });
        expect(audited[0].fenceSource).toBe('CAROL_MISCONFIGURED');
        expect(codes(audited[0])).not.toContain('OUTSIDE_FENCE');
    });

    it('detecta centro em coordenada padrão e local sem cerca', () => {
        const health = buildCarolFenceHealth([
            makePunch({ locationCode: '014', fenceCheck: { centerLat: -23.55045, centerLon: -46.63391, radius: 0, distance: 1e6 } }),
            makePunch({ locationCode: '07', fenceCheck: null })
        ]);
        expect(health.find(h => h.key === '014')!.problems).toEqual(expect.arrayContaining(['DEFAULT_CENTER', 'RADIUS_ZERO']));
        expect(health.find(h => h.key === '07')!.problems).toEqual(['NO_FENCE_DATA']);
    });

    it('prioriza a cerca da obra cadastrada no portal', () => {
        const [entry, exit] = pair();
        const far = { ...exit, lat: -23.9111, lon: -46.6904, fenceStatus: 'INSIDE' as const };
        const siteFences = [{ costCenter: '301806', regional: 'Regional 02', sites: [{ name: 'Obra', lat: -23.5737, lon: -47.0558, radius: 200 }] }];
        const audited = auditPunches([entry, far], { siteFences });
        expect(audited[0].effectiveFence).toBe('INSIDE');
        expect(audited[1].effectiveFence).toBe('OUTSIDE');
        expect(audited[1].fenceSource).toBe('SITE');
        expect(codes(audited[1])).toContain('OUTSIDE_FENCE');
    });

    it('dá folga da precisão do GPS (até 100 m) na cerca da obra', () => {
        const siteFences = [{ costCenter: '301806', regional: 'Regional 02', sites: [{ name: 'Obra', lat: 0, lon: 0, radius: 100 }] }];
        // ~150 m ao norte do centro
        const punch = makePunch({ lat: 0.00135, lon: 0, accuracyM: 60 });
        expect(auditPunches([punch], { siteFences })[0].effectiveFence).toBe('INSIDE');
        expect(auditPunches([{ ...punch, accuracyM: 5 }], { siteFences })[0].effectiveFence).toBe('OUTSIDE');
    });

    it('sugere cercas pelos pontos de concentração das batidas', () => {
        const near = (lat: number, lon: number, n: number) =>
            Array.from({ length: n }, (_, i) => makePunch({ lat: lat + i * 0.00001, lon, punchedAt: `2026-10-01T07:${String(i % 60).padStart(2, '0')}` }));
        const sites = suggestSitesFromPunches([...near(-23.5, -47.0, 30), ...near(-23.9, -46.7, 20)]);
        expect(sites).toHaveLength(2);
        expect(sites[0].sample).toBe(30);
        expect(sites[0].lat).toBeCloseTo(-23.5, 2);
        expect(sites[1].lon).toBeCloseTo(-46.7, 2);
    });

    it('acusa CC que não existe no TOTVS', () => {
        const audited = auditPunches(pair().map(p => ({ ...p, costCenter: '9999', carolCostCenter: '9999' })));
        expect(codes(audited[0])).toContain('UNKNOWN_COST_CENTER');
        expect(codes(auditPunches(pair())[0])).not.toContain('UNKNOWN_COST_CENTER');
    });

    it('resume a auditoria', () => {
        const [entry, exit] = pair();
        const summary = summarizeAudit(auditPunches([entry, { ...exit, mode: 'PHOTO_APPROVED', faceScore: 0 }]));
        expect(summary.punchCount).toBe(2);
        expect(summary.employeeCount).toBe(1);
        expect(summary.punchesWithAlert).toBe(1);
        expect(summary.byCode.PHOTO_APPROVED).toBe(1);
        expect(summary.avgFaceScore).toBe(10);
    });
});

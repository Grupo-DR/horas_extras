import { ClockinPunch } from './clockinTypes';

/** Batida "limpa" para testes — sobrescreva só o que importa ao caso. */
export const makePunch = (overrides: Partial<ClockinPunch> = {}): ClockinPunch => {
    const punchedAt = overrides.punchedAt ?? '2026-10-01T07:00';
    return {
        id: overrides.id ?? `${overrides.cpf ?? '11111111111'}_${punchedAt}`,
        imageUrl: 'https://grupodr.carol.ai/grupodr/go/abc',
        name: 'Fulano de Tal',
        cpf: '11111111111',
        supervisorName: 'Supervisor',
        supervisorCode: 'sup@dr.com',
        deviceId: 'dev1',
        deviceDescription: 'FULANO DE TAL',
        mode: 'FACIAL',
        faceScore: 10,
        selfPunch: true,
        locationCode: '01',
        locationName: 'São Roque',
        date: punchedAt.slice(0, 10),
        gmt: '-03:00',
        syncedAtMs: 1,
        nsr: '10',
        nsrProcessedAt: '2026-10-01T08:00',
        lat: -23.5737,
        lon: -47.0558,
        accuracyM: 5,
        gpsLowAccuracy: false,
        fenceStatus: 'INSIDE',
        fenceCheck: { centerLat: -23.5737, centerLon: -47.0558, radius: 35, distance: 3 },
        timezoneMode: 'ENABLED',
        autoDateTime: true,
        dateDiffersFromGps: false,
        timeProvider: 'web',
        receiptSentAt: '2026-10-01T07:01',
        receiptMethod: 'E-mail',
        firstSyncDelayMin: 0,
        section: '01.07.40',
        costCenter: '301806',
        carolCostCenter: '301806',
        regional: 'Regional 02',
        ...overrides,
        punchedAt
    };
};

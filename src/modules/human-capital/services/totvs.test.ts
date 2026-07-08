import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    convertTotvsHourToDecimal,
    fetchOvertimeData,
    fetchOvertimeDataWithMeta,
    TotvsIntegrationError,
} from './totvs';
import { ApiConfig } from '../types';

const config: ApiConfig = {
    url: 'https://totvs.example.test/api',
    username: 'user',
    password: 'pass',
    startDate: '01/01/2026',
    endDate: '31/01/2026',
};

const rawRecord = {
    CHAPA: '1001',
    NOME: 'Pessoa Teste',
    FUNCAO: 'Operador',
    CODCCUSTO: '301502',
    DESCRICAO: 'Centro Teste',
    DATA: '2026-01-10T00:00:00-03:00',
    HORA_EXTRA_60: 2.15,
};

const mockFetch = (body: unknown, init?: { ok?: boolean; status?: number }) => {
    const response = {
        ok: init?.ok ?? true,
        status: init?.status ?? 200,
        json: vi.fn().mockResolvedValue(body),
    } as unknown as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
};

describe('TOTVS overtime service', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('processes a valid array response', async () => {
        mockFetch([rawRecord]);

        const result = await fetchOvertimeDataWithMeta(config);

        expect(result.meta.status).toBe('SUCCESS');
        expect(result.meta.source).toBe('TOTVS_API');
        expect(result.meta.recordCount).toBe(1);
        expect(result.meta.parsedRecordCount).toBe(1);
        expect(result.data).toEqual([
            expect.objectContaining({
                CHAPA: '1001',
                NOME: 'Pessoa Teste',
                CODCCUSTO: '301502',
                EVENTO: 'HORA EXTRA 60',
                HORAS: 2.25,
            }),
        ]);
    });

    it('processes a valid response wrapped in Items', async () => {
        mockFetch({ Items: [rawRecord] });

        const data = await fetchOvertimeData(config);

        expect(data).toHaveLength(1);
        expect(data[0].HORAS).toBe(2.25);
    });

    it('processes a valid response wrapped in items', async () => {
        mockFetch({ items: [rawRecord] });

        const data = await fetchOvertimeData(config);

        expect(data).toHaveLength(1);
        expect(data[0].CHAPA).toBe('1001');
    });

    it('returns an empty result for a valid empty response', async () => {
        mockFetch([]);

        const result = await fetchOvertimeDataWithMeta(config);

        expect(result.data).toEqual([]);
        expect(result.meta.status).toBe('EMPTY');
        expect(result.meta.recordCount).toBe(0);
        expect(result.meta.parsedRecordCount).toBe(0);
    });

    it.each([
        [401, 'HTTP_UNAUTHORIZED'],
        [403, 'HTTP_FORBIDDEN'],
    ] as const)('throws a clear auth error for HTTP %s', async (status, code) => {
        mockFetch({ message: 'denied' }, { ok: false, status });

        await expect(fetchOvertimeData(config)).rejects.toMatchObject({
            name: 'TotvsIntegrationError',
            code,
            httpStatus: status,
        });
    });

    it('throws a clear API error for HTTP 500', async () => {
        mockFetch({ message: 'server error' }, { ok: false, status: 500 });

        await expect(fetchOvertimeData(config)).rejects.toMatchObject({
            name: 'TotvsIntegrationError',
            code: 'HTTP_ERROR',
            httpStatus: 500,
        });
    });

    it('throws on an unexpected response format', async () => {
        mockFetch({ value: 'not an array' });

        await expect(fetchOvertimeData(config)).rejects.toMatchObject({
            name: 'TotvsIntegrationError',
            code: 'UNEXPECTED_FORMAT',
        });
    });

    it('throws on network failures', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

        await expect(fetchOvertimeData(config)).rejects.toMatchObject({
            name: 'TotvsIntegrationError',
            code: 'NETWORK_ERROR',
        });
    });

    it('never returns simulated data when the integration fails', async () => {
        mockFetch({ invalid: true });

        let error: unknown;
        try {
            await fetchOvertimeData(config);
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(TotvsIntegrationError);
        expect(error).toMatchObject({ code: 'UNEXPECTED_FORMAT' });
    });

    it('converts TOTVS hour values to decimal hours', () => {
        expect(convertTotvsHourToDecimal(0.45)).toBe(0.75);
        expect(convertTotvsHourToDecimal(2.15)).toBe(2.25);
        expect(convertTotvsHourToDecimal('10.30')).toBe(10.5);
        expect(convertTotvsHourToDecimal(-1.15)).toBe(-1.25);
        expect(convertTotvsHourToDecimal(8)).toBe(8);
    });
});

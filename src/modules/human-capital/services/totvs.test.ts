import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    convertTotvsHourToDecimal,
    fetchOvertimeData,
    fetchOvertimeDataWithMeta,
    TotvsIntegrationError,
    TotvsTransport,
} from './totvs';
import { ApiConfig } from '../types';

const config: ApiConfig = {
    startDate: '01/01/2026',
    endDate: '01/31/2026',
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

/** Simula a Cloud Function hcFetchOvertime devolvendo o payload informado. */
const transportReturning = (body: unknown): TotvsTransport => vi.fn().mockResolvedValue(body);

/** Simula um erro da Cloud Function, no formato do SDK do Firebase. */
const transportFailing = (error: unknown): TotvsTransport => vi.fn().mockRejectedValue(error);

const callableError = (code: string, details?: Record<string, unknown>) =>
    Object.assign(new Error('callable error'), { code, details });

describe('TOTVS overtime service', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('processes a valid array response', async () => {
        const result = await fetchOvertimeDataWithMeta(config, transportReturning([rawRecord]));

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

    it('sends only the period to the server, never credentials', async () => {
        const transport = transportReturning([]);

        await fetchOvertimeDataWithMeta(config, transport);

        expect(transport).toHaveBeenCalledWith({ startDate: '01/01/2026', endDate: '01/31/2026' });
    });

    it('processes a valid response wrapped in Items', async () => {
        const data = await fetchOvertimeData(config, transportReturning({ Items: [rawRecord] }));

        expect(data).toHaveLength(1);
        expect(data[0].HORAS).toBe(2.25);
    });

    it('processes a valid response wrapped in items', async () => {
        const data = await fetchOvertimeData(config, transportReturning({ items: [rawRecord] }));

        expect(data).toHaveLength(1);
        expect(data[0].CHAPA).toBe('1001');
    });

    it('returns an empty result for a valid empty response', async () => {
        const result = await fetchOvertimeDataWithMeta(config, transportReturning([]));

        expect(result.data).toEqual([]);
        expect(result.meta.status).toBe('EMPTY');
        expect(result.meta.recordCount).toBe(0);
        expect(result.meta.parsedRecordCount).toBe(0);
    });

    it.each([
        [401, 'HTTP_UNAUTHORIZED'],
        [403, 'HTTP_FORBIDDEN'],
    ] as const)('throws a clear auth error when TOTVS answers HTTP %s', async (status, code) => {
        const transport = transportFailing(callableError('functions/unavailable', { totvsCode: code, httpStatus: status }));

        await expect(fetchOvertimeData(config, transport)).rejects.toMatchObject({
            name: 'TotvsIntegrationError',
            code,
            httpStatus: status,
        });
    });

    it('throws a clear API error when TOTVS answers HTTP 500', async () => {
        const transport = transportFailing(callableError('functions/unavailable', { totvsCode: 'HTTP_ERROR', httpStatus: 500 }));

        await expect(fetchOvertimeData(config, transport)).rejects.toMatchObject({
            name: 'TotvsIntegrationError',
            code: 'HTTP_ERROR',
            httpStatus: 500,
        });
    });

    it('reports access denied when the user has no Capital Humano access', async () => {
        const transport = transportFailing(callableError('functions/permission-denied'));

        await expect(fetchOvertimeData(config, transport)).rejects.toMatchObject({
            name: 'TotvsIntegrationError',
            code: 'HTTP_FORBIDDEN',
            userMessage: 'Seu perfil não tem acesso aos dados da TOTVS.',
        });
    });

    it('throws on an unexpected response format', async () => {
        await expect(fetchOvertimeData(config, transportReturning({ value: 'not an array' }))).rejects.toMatchObject({
            name: 'TotvsIntegrationError',
            code: 'UNEXPECTED_FORMAT',
        });
    });

    it('throws on network failures', async () => {
        const transport = transportFailing(new TypeError('network down'));

        await expect(fetchOvertimeData(config, transport)).rejects.toMatchObject({
            name: 'TotvsIntegrationError',
            code: 'NETWORK_ERROR',
        });
    });

    it('never returns simulated data when the integration fails', async () => {
        let error: unknown;
        try {
            await fetchOvertimeData(config, transportReturning({ invalid: true }));
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

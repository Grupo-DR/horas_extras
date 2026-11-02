import { describe, expect, it } from 'vitest';
import {
    accumulateRates,
    formatChange,
    formatIndicatorValue,
    formatReference,
    lastPointPerMonth,
    latestFocusExpectations,
    parseBrDate,
    pointOnOrBefore,
    shiftIsoDate
} from './marketIndicators';
import { sidraQuarterToIso } from './marketSources';

describe('cálculos dos indicadores', () => {
    it('converte datas do SGS e do SIDRA', () => {
        expect(parseBrDate('05/11/2026')).toBe('2026-11-05');
        expect(sidraQuarterToIso('202602')).toBe('2026-04-01');
        expect(sidraQuarterToIso('202604')).toBe('2026-10-01');
    });

    it('acumula taxas mensais de forma composta', () => {
        expect(accumulateRates([1, 1])).toBeCloseTo(2.01, 10);
        expect(accumulateRates([0.5, -0.32, 0.82])).toBeCloseTo((1.005 * 0.9968 * 1.0082 - 1) * 100, 10);
        expect(accumulateRates([])).toBe(0);
    });

    it('amostra o último ponto de cada mês, em ordem', () => {
        const points = [
            { date: '2026-10-31', value: 3 },
            { date: '2026-09-02', value: 1 },
            { date: '2026-09-30', value: 2 }
        ];
        expect(lastPointPerMonth(points)).toEqual([{ date: '2026-09-30', value: 2 }, { date: '2026-10-31', value: 3 }]);
    });

    it('acha o ponto mais recente até uma data e desloca datas', () => {
        const points = [{ date: '2025-10-01', value: 10 }, { date: '2025-11-03', value: 11 }];
        expect(pointOnOrBefore(points, '2025-11-02')).toEqual({ date: '2025-10-01', value: 10 });
        expect(pointOnOrBefore(points, '2025-09-01')).toBeUndefined();
        expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');
        expect(shiftIsoDate('2026-11-04', -365)).toBe('2025-11-04');
    });

    it('mantém só a expectativa Focus mais recente de cada indicador e ano', () => {
        const rows = [
            { indicator: 'Selic', year: '2027', median: 11.5, date: '2026-10-16' },
            { indicator: 'Selic', year: '2027', median: 11.75, date: '2026-10-23' },
            { indicator: 'IPCA', year: '2027', median: 4.34, date: '2026-10-23' }
        ];
        expect(latestFocusExpectations(rows)).toEqual([
            { indicator: 'Selic', year: '2027', median: 11.75, date: '2026-10-23' },
            { indicator: 'IPCA', year: '2027', median: 4.34, date: '2026-10-23' }
        ]);
    });
});

describe('formatação', () => {
    it('valores, variações e referências', () => {
        expect(formatIndicatorValue(13.75, 'percentYear')).toBe('13,75% a.a.');
        expect(formatIndicatorValue(0.35, 'percent')).toBe('0,35%');
        expect(formatIndicatorValue(5.4212, 'currency')).toBe('R$ 5,4212');
        expect(formatChange(0.25, 'pp')).toBe('+0,25 p.p.');
        expect(formatChange(-1.2, '%')).toBe('−1,20%');
        expect(formatChange(0, 'pp')).toBe('0,00 p.p.');
        expect(formatReference('2026-09-01', 'month')).toBe('set/2026');
        expect(formatReference('2026-10-30', 'day')).toBe('30/10/2026');
        expect(formatReference('2026-04-01', 'quarter')).toBe('2º tri/2026');
    });
});

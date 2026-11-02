import { describe, expect, it } from 'vitest';
import { SECTOR_EVENTS, SectorEvent, formatEventDates, hasUpcomingDate, sortSectorEvents } from './sectorEvents';

const ev = (partial: Partial<SectorEvent>): SectorEvent => ({
    id: partial.id || partial.name || 'x',
    name: 'Evento',
    category: 'construcao',
    location: 'SP',
    url: 'https://exemplo.com',
    comment: '',
    ...partial
});

describe('formatEventDates', () => {
    it('mesmo mês, meses diferentes, anos diferentes e dia único', () => {
        expect(formatEventDates('2027-04-06', '2027-04-09')).toBe('06–09 abr 2027');
        expect(formatEventDates('2027-06-30', '2027-07-02')).toBe('30 jun – 02 jul 2027');
        expect(formatEventDates('2026-12-28', '2027-01-02')).toBe('28 dez 2026 – 02 jan 2027');
        expect(formatEventDates('2027-03-10')).toBe('10 mar 2027');
    });
});

describe('agenda do setor', () => {
    const today = '2026-11-02';

    it('evento em andamento continua como próximo; encerrado não', () => {
        expect(hasUpcomingDate(ev({ start: '2026-11-01', end: '2026-11-03' }), today)).toBe(true);
        expect(hasUpcomingDate(ev({ start: '2026-10-01', end: '2026-10-03' }), today)).toBe(false);
        expect(hasUpcomingDate(ev({}), today)).toBe(false);
    });

    it('datados primeiro por data; depois sem data pelo mês habitual mais próximo', () => {
        const sorted = sortSectorEvents([
            ev({ name: 'Sem data, agosto', usualMonth: 8 }),
            ev({ name: 'Abril 2027', start: '2027-04-06', end: '2027-04-09' }),
            ev({ name: 'Sem data, dezembro', usualMonth: 12 }),
            ev({ name: 'Novembro 2026', start: '2026-11-24', end: '2026-11-26' }),
            ev({ name: 'Sem mês' })
        ], today);
        expect(sorted.map(e => e.name)).toEqual([
            'Novembro 2026', 'Abril 2027', 'Sem data, dezembro', 'Sem data, agosto', 'Sem mês'
        ]);
    });

    it('lista cadastrada é consistente', () => {
        const ids = SECTOR_EVENTS.map(e => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        SECTOR_EVENTS.forEach(e => {
            expect(e.url).toMatch(/^https:\/\//);
            if (e.start) {
                expect(e.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                expect((e.end || e.start) >= e.start).toBe(true);
                expect(e.dateSource).toBeDefined();
            } else {
                expect(e.lastEdition).toBeTruthy();
            }
        });
    });
});

import { describe, expect, it } from 'vitest';
import { normalizeScopeCostCenters } from './types';

describe('normalizeScopeCostCenters', () => {
    it('grava os CCs no formato dos lançamentos, sem pontos', () => {
        expect(normalizeScopeCostCenters(['3028.01', '103.01'])).toEqual(['302801', '10301']);
    });

    it('remove espaços, vazios e repetidos e preserva códigos já corretos', () => {
        expect(normalizeScopeCostCenters([' 302801 ', '', '3028.01', '10301', ' '])).toEqual(['302801', '10301']);
    });
});

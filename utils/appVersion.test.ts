import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatBuildDate, formatVersionLabel } from './appVersion';

const ROOT = path.resolve(__dirname, '..');
const SEMVER = /^\d+\.\d+\.\d+$/;

describe('selo de versão', () => {
    const info = { version: '1.2.3', commit: 'abc1234', builtAt: '2026-10-31T18:41:00Z' };

    it('mostra versão e commit em produção', () => {
        expect(formatVersionLabel({ ...info, environment: 'production' })).toBe('v1.2.3 · abc1234');
    });

    it('identifica ambientes fora de produção', () => {
        expect(formatVersionLabel({ ...info, environment: 'preview' })).toBe('v1.2.3 · abc1234 · homologação');
        expect(formatVersionLabel({ ...info, environment: 'development' })).toBe('v1.2.3 · abc1234 · local');
    });

    it('não quebra com data inválida', () => {
        expect(formatBuildDate('sem-data')).toBe('sem-data');
    });
});

// Regra de versionamento (README.md, seção "Versionamento"): toda versão do
// package.json precisa de uma entrada correspondente no CHANGELOG.md.
describe('regra de versionamento', () => {
    const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

    it('package.json usa SemVer (MAIOR.MENOR.CORREÇÃO)', () => {
        expect(version).toMatch(SEMVER);
    });

    it('CHANGELOG.md tem a entrada da versão atual', () => {
        const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
        expect(changelog).toContain(`## [${version}]`);
    });
});

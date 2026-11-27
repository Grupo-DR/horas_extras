import { describe, expect, it } from 'vitest';
import { Project, RDOData } from '../types';
import { classificarFuncao, mesMaisRecente, montarMes } from './rdoCalendar';

const rdo = (date: string, extra: Partial<RDOData> = {}): RDOData => ({
  id: `${date}-${extra.teamId ?? 't1'}`, teamId: 't1', date,
  workforce: [], equipment: [], activities: [], occurrences: [], ...extra,
});

const project: Project = {
  id: 'p1', name: '3018.05', createdAt: '2026-01-01',
  services: [{ code: '1.1', scope: 'Dormente', unit: 'un', value: 100 }],
};

describe('classificarFuncao', () => {
  it('usa a tabela de dimensões quando a função está lá', () => {
    const dims = [{ name: 'Encarregado', normalizedName: 'ENCARREGADO', group: 'MOD' }] as never;
    expect(classificarFuncao('Encarregado', dims)).toBe('MOD');
  });
  it('sem dimensões, supervisão e apoio são MOI e o resto MOD', () => {
    expect(classificarFuncao('Encarregado de turma')).toBe('MOI');
    expect(classificarFuncao('Técnico de Segurança')).toBe('MOI');
    expect(classificarFuncao('Oficial de via')).toBe('MOD');
    expect(classificarFuncao('Ajudante')).toBe('MOD');
  });
});

describe('montarMes', () => {
  it('monta semanas de segunda a domingo cobrindo o mês inteiro', () => {
    const m = montarMes(2026, 11, [], project);
    // 01/11/2026 é domingo: a primeira semana começa na segunda 26/10.
    expect(m.semanas[0][0].iso).toBe('2026-10-26');
    expect(m.semanas[0][6].iso).toBe('2026-11-01');
    expect(m.semanas.every(s => s.length === 7)).toBe(true);
    expect(m.semanas.at(-1)!.at(-1)!.iso).toBe('2026-12-06');
    expect(m.semanas[0][0].doMes).toBe(false);
  });

  it('soma os RDOs do dia: produção, MOD/MOI, equipamentos, ocorrências e pior clima', () => {
    const m = montarMes(2026, 11, [
      rdo('26/11/2026', {
        weatherMorning: 'Ensolarado',
        activities: [{ description: 'x', status: 'DONE', code: '1.1', quantity: 3 }],
        workforce: [{ role: 'Oficial de via', count: 12 }, { role: 'Encarregado', count: 2 }],
        equipment: [{ name: 'Caminhão', count: 3 }],
      }),
      rdo('26/11/2026', {
        teamId: 't2', weatherAfternoon: 'Chuva forte',
        workforce: [{ role: 'Ajudante', count: 8 }],
        equipment: [{ name: 'Escavadeira', count: 1 }],
        occurrences: [{ description: 'Interdição da via' }],
      }),
      rdo('03/12/2026'),
    ], project);
    const dia = m.semanas.flat().find(d => d.iso === '2026-11-26')!;
    expect(dia).toMatchObject({ producao: 300, mod: 20, moi: 2, equip: 4, ocorrencias: 1, clima: 'CHUVOSO' });
    expect(dia.rdos).toHaveLength(2);
    // RDO de dezembro não entra, mesmo aparecendo na última semana da grade.
    expect(m.semanas.flat().find(d => d.iso === '2026-12-03')!.rdos).toHaveLength(0);
    expect(m.totais).toEqual({ rdos: 2, dias: 1, producao: 300, diasComOcorrencia: 1 });
  });
});

describe('mesMaisRecente', () => {
  it('abre no mês do último RDO', () => {
    expect(mesMaisRecente([rdo('20/09/2026'), rdo('20/11/2026'), rdo('xx')])).toEqual({ ano: 2026, mes: 11 });
  });
  it('sem RDO, usa o mês atual', () => {
    expect(mesMaisRecente([], new Date(2026, 4, 10))).toEqual({ ano: 2026, mes: 5 });
  });
});

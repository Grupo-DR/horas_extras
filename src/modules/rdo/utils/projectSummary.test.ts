import { describe, expect, it } from 'vitest';
import { Project, RDOData, Team } from '../types';
import {
  clientOf, headcount, lastRdoInfo, pendingReviewCount, splitProjectName, summarizeProjects, summarizeTeams,
} from './projectSummary';
import { compareValues } from '../components/ui';

const today = new Date(2026, 10, 17); // 17/11/2026

const project = (id: string, name: string, services: Project['services'] = []): Project =>
  ({ id, name, createdAt: '', services, regional: 'REGIONAL 02' });
const team = (id: string, projectId: string, name = id): Team => ({ id, projectId, name } as Team);
const rdo = (id: string, teamId: string, date: string, extra: Partial<RDOData> = {}): RDOData =>
  ({ id, teamId, date, workforce: [], equipment: [], activities: [], occurrences: [], ...extra });

describe('splitProjectName', () => {
  it('separa centro de custo e contrato', () => {
    expect(splitProjectName('3044.02 - CW64111')).toEqual({ code: '3044.02', detail: 'CW64111' });
    expect(splitProjectName('3018.05 - CW58778/CW58773')).toEqual({ code: '3018.05', detail: 'CW58778/CW58773' });
  });

  it('mantém o nome inteiro quando não há separador', () => {
    expect(splitProjectName('Obra Teste')).toEqual({ code: 'Obra Teste', detail: '' });
  });
});

describe('lastRdoInfo', () => {
  it('acha o RDO mais recente e os dias desde ele, ignorando datas inválidas', () => {
    const info = lastRdoInfo([rdo('a', 't', '01/11/2026'), rdo('b', 't', '10/11/2026'), rdo('c', 't', 'sem data')], today);
    expect(info).toMatchObject({ lastDate: '10/11/2026', daysSince: 7 });
    expect(info.lastTime).toBe(new Date(2026, 10, 10).getTime());
  });

  it('sem RDO, devolve vazio', () => {
    expect(lastRdoInfo([], today)).toEqual({ lastDate: null, lastTime: null, daysSince: null });
  });
});

describe('summarizeProjects', () => {
  const projects = [project('p2', '3044.03 - CW74817'), project('p1', '3019.03 - CW61180', [{ code: 'X', scope: 'x', unit: 'm', value: 1 }])];
  const teams = [team('t1', 'p1'), team('t2', 'p1'), team('t3', 'p2')];
  const rdos = [rdo('r1', 't1', '01/11/2026'), rdo('r2', 't2', '15/11/2026'), rdo('r3', 't3', '20/10/2026')];

  it('conta turmas, RDOs e itens da tabela por obra, ordenando pelo centro de custo', () => {
    const [first, second] = summarizeProjects(projects, teams, rdos, today);
    expect(first).toMatchObject({ code: '3019.03', detail: 'CW61180', teamCount: 2, rdoCount: 2, serviceCount: 1, lastDate: '15/11/2026', daysSince: 2 });
    expect(second).toMatchObject({ code: '3044.03', teamCount: 1, rdoCount: 1, serviceCount: 0, daysSince: 28 });
  });
});

describe('summarizeTeams', () => {
  it('resume as turmas da obra com período e produção', () => {
    const obra = project('p1', '3019.03 - CW61180', [{ code: 'ROC', scope: 'Roçada', unit: 'm²', value: 2 }]);
    const rdos = [
      rdo('r1', 't1', '03/11/2026', { activities: [{ description: 'Roçada', code: 'ROC', quantity: 100, status: 'Concluído' }] }),
      rdo('r2', 't1', '05/11/2026', { activities: [{ description: 'Roçada', code: 'ROC', quantity: 50, status: 'Concluído' }] }),
      rdo('r3', 'outra', '05/11/2026'),
    ];
    const [summary] = summarizeTeams(obra, [team('t1', 'p1', 'Turma A'), team('t9', 'p9')], rdos, today);
    expect(summary).toMatchObject({ rdoCount: 2, firstDate: '03/11/2026', lastDate: '05/11/2026', production: 300 });
  });

  it('sem obra selecionada, não há turmas', () => {
    expect(summarizeTeams(null, [team('t1', 'p1')], [], today)).toEqual([]);
  });
});

describe('indicadores do RDO', () => {
  it('soma o efetivo e conta atividades a revisar', () => {
    const r = rdo('r', 't', '01/11/2026', {
      workforce: [{ role: 'Servente', count: 13 }, { role: 'Oficial', count: 5 }],
      activities: [
        { description: 'a', status: 'Revisar' },
        { description: 'b', status: 'Concluído' },
      ],
    });
    expect(headcount(r)).toBe(18);
    expect(pendingReviewCount(r)).toBe(1);
  });
});

describe('clientOf', () => {
  it('usa o cliente cadastrado na obra', () => {
    expect(clientOf({ ...project('p', '3047.01 - Manutenção'), client: 'Rumo' })).toBe('Rumo');
  });

  it('reconhece Vale, VLI ou Rumo no nome quando o cliente não foi cadastrado', () => {
    expect(clientOf(project('p', '3047.01 - VALE - MANUTENCAO DE ATIVOS'))).toBe('Vale');
    expect(clientOf(project('p', '3047.01 - Manutenção de Infraestrutura (VLI)'))).toBe('VLI');
    expect(clientOf(project('p', '3018.05 - CW58778/CW58773'))).toBe('');
  });

  it('não confunde palavras que só contêm o nome (ex.: "Valença")', () => {
    expect(clientOf(project('p', '3050.01 - Obra Valença'))).toBe('');
  });

  it('obra no modelo de RDO Vale é da Vale', () => {
    expect(clientOf({ ...project('p', '3047.01 - Manutenção'), rdoModel: 'VALE_NOVAS_FERROVIAS' })).toBe('Vale');
  });
});

describe('compareValues', () => {
  it('ordena números e textos com números, deixando vazios no fim', () => {
    const codes = ['3044.03', '3018.05', '', '3019.03'];
    expect([...codes].sort((a, b) => compareValues(a, b, 'asc'))).toEqual(['3018.05', '3019.03', '3044.03', '']);
    expect([...codes].sort((a, b) => compareValues(a, b, 'desc'))).toEqual(['3044.03', '3019.03', '3018.05', '']);
    expect([5, null, 99, 0].sort((a, b) => compareValues(a, b, 'desc'))).toEqual([99, 5, 0, null]);
  });
});

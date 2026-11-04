import { describe, expect, it } from 'vitest';
import { ContractData, DailyPlan } from '../types';
import { LocalSnapshot, RemoteSnapshot, countPending, findPendingLocalData } from './localRecoveryService';

const plan = (id: string, value: number, updatedAt: string, projectId = 'p1'): DailyPlan =>
  ({ id, projectId, teamId: 't1', date: '2026-10-20', value, updatedAt });

const contract = (value: number, updatedAt: string, projectId = 'p1'): ContractData => ({
  projectId,
  contractValue: value,
  contractStartDate: '2026-01-01',
  contractEndDate: '2026-12-31',
  monthlyEntries: [],
  addenda: [],
  updatedAt,
});

const emptyLocal = (): LocalSnapshot => ({ dailyPlans: [], contracts: {}, dimensions: {}, compositions: {}, histograms: {} });
const emptyRemote = (): RemoteSnapshot => ({ dailyPlans: [], contracts: {}, dimensions: {}, compositions: {}, histogramCounts: {} });
const projects = new Set(['p1']);

describe('findPendingLocalData', () => {
  it('oferece planejamento que só existe no navegador', () => {
    const local = { ...emptyLocal(), dailyPlans: [plan('a', 1000, '2026-10-20T10:00:00Z'), plan('zero', 0, '2026-10-20T10:00:00Z')] };
    const pending = findPendingLocalData(local, emptyRemote(), projects);
    expect(pending.dailyPlans.map((p) => p.id)).toEqual(['a']);
  });

  it('não oferece planejamento igual ou mais antigo que o do banco', () => {
    const local = { ...emptyLocal(), dailyPlans: [plan('a', 1000, '2026-10-20T10:00:00Z'), plan('b', 500, '2026-10-01T10:00:00Z')] };
    const remote = { ...emptyRemote(), dailyPlans: [plan('a', 1000, '2026-10-20T10:00:00Z'), plan('b', 900, '2026-10-15T10:00:00Z')] };
    expect(findPendingLocalData(local, remote, projects).dailyPlans).toEqual([]);
  });

  it('oferece planejamento mais novo e diferente do banco', () => {
    const local = { ...emptyLocal(), dailyPlans: [plan('a', 2000, '2026-10-25T10:00:00Z')] };
    const remote = { ...emptyRemote(), dailyPlans: [plan('a', 1000, '2026-10-20T10:00:00Z')] };
    expect(findPendingLocalData(local, remote, projects).dailyPlans).toHaveLength(1);
  });

  it('ignora cópia de contrato igual ao banco mesmo com data de gravação diferente', () => {
    const local = { ...emptyLocal(), contracts: { p1: contract(100, '2026-10-20T10:00:00.050Z') } };
    const remote = { ...emptyRemote(), contracts: { p1: contract(100, '2026-10-20T10:00:00.000Z') } };
    expect(findPendingLocalData(local, remote, projects).contracts).toEqual([]);
  });

  it('oferece contrato alterado depois da última gravação no banco', () => {
    const local = { ...emptyLocal(), contracts: { p1: contract(200, '2026-10-25T10:00:00Z') } };
    const remote = { ...emptyRemote(), contracts: { p1: contract(100, '2026-10-20T10:00:00Z') } };
    expect(findPendingLocalData(local, remote, projects).contracts).toHaveLength(1);
  });

  it('só oferece histograma quando o banco não tem nenhum item da obra', () => {
    const items = [{ id: 'h1', projectId: 'p1' }] as never[];
    const local = { ...emptyLocal(), histograms: { p1: items } };
    expect(findPendingLocalData(local, { ...emptyRemote(), histogramCounts: { p1: 3 } }, projects).histograms).toEqual([]);
    expect(findPendingLocalData(local, emptyRemote(), projects).histograms).toHaveLength(1);
  });

  it('ignora dados de obras que não existem mais', () => {
    const local = {
      ...emptyLocal(),
      dailyPlans: [plan('x', 1000, '2026-10-20T10:00:00Z', 'apagada')],
      contracts: { apagada: contract(100, '2026-10-20T10:00:00Z', 'apagada') },
    };
    expect(countPending(findPendingLocalData(local, emptyRemote(), projects))).toBe(0);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { DailyPlan } from '../types';

vi.mock('./firebase', () => ({ db: {} }));

const { diffDailyPlans } = await import('./dailyPlanService');

const plan = (id: string, value: number): DailyPlan =>
  ({ id, projectId: 'p1', teamId: 't1', date: id, value, updatedAt: '2026-11-04T00:00:00Z' });

describe('diffDailyPlans', () => {
  it('grava só os dias novos ou alterados', () => {
    const previous = [plan('2026-11-01', 100), plan('2026-11-02', 200)];
    const next = [plan('2026-11-01', 100), plan('2026-11-02', 250), plan('2026-11-03', 300)];
    const { upserts, deletes } = diffDailyPlans(previous, next);
    expect(upserts.map((p) => p.id)).toEqual(['2026-11-02', '2026-11-03']);
    expect(deletes).toEqual([]);
  });

  it('apaga do banco os dias removidos da lista', () => {
    const { upserts, deletes } = diffDailyPlans([plan('2026-11-01', 100)], []);
    expect(upserts).toEqual([]);
    expect(deletes).toEqual(['2026-11-01']);
  });

  it('não grava nada quando não houve mudança', () => {
    const plans = [plan('2026-11-01', 100)];
    expect(diffDailyPlans(plans, [...plans])).toEqual({ upserts: [], deletes: [] });
  });
});

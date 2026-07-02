import { DailyPlan } from '../types';

const LS_KEY = 'daily_plans';

/** Gera um ID determinístico para uma entrada dia/equipe — evita duplicatas */
export const makePlanId = (projectId: string, teamId: string, date: string): string =>
  `${projectId}_${teamId}_${date}`;

export const getDailyPlans = (): DailyPlan[] => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as DailyPlan[]) : [];
  } catch {
    return [];
  }
};

export const saveDailyPlans = (plans: DailyPlan[]): void => {
  localStorage.setItem(LS_KEY, JSON.stringify(plans));
};

/**
 * Upsert de um único plano diário.
 * Se já existir um registro com o mesmo id, ele é substituído.
 */
export const upsertDailyPlan = (plan: DailyPlan): DailyPlan[] => {
  const all = getDailyPlans();
  const idx = all.findIndex(p => p.id === plan.id);
  const updated = { ...plan, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.push(updated);
  }
  saveDailyPlans(all);
  return all;
};

export const deleteDailyPlan = (id: string): DailyPlan[] => {
  const plans = getDailyPlans().filter(p => p.id !== id);
  saveDailyPlans(plans);
  return plans;
};

// ─── Aggregation helpers used by FinancialTable ───────────────────────────────

/**
 * Retorna a soma dos DailyPlans de uma equipe para um mês/ano específico.
 */
export const sumPlansForTeamMonth = (
  plans: DailyPlan[],
  teamId: string,
  year: number,
  month: number          // 0-indexed (JS Date style)
): number =>
  plans
    .filter(p => {
      if (p.teamId !== teamId || p.value === 0) return false;
      const [y, m] = p.date.split('-').map(Number);
      return y === year && m - 1 === month;
    })
    .reduce((s, p) => s + p.value, 0);

/**
 * Retorna a soma dos DailyPlans de uma equipe dentro de um intervalo de datas (inclusive).
 * startISO e endISO no formato "YYYY-MM-DD".
 */
export const sumPlansForTeamPeriod = (
  plans: DailyPlan[],
  teamId: string,
  startISO: string,
  endISO: string
): number =>
  plans
    .filter(p => {
      if (p.teamId !== teamId || p.value === 0) return false;
      return p.date >= startISO && p.date <= endISO;
    })
    .reduce((s, p) => s + p.value, 0);

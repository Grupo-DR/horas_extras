import { collection, doc, getDocs, writeBatch, WriteBatch } from 'firebase/firestore';
import { db } from './firebase';
import { withFirestoreError } from './firestoreErrors';
import { COLLECTIONS } from '../src/constants/firestoreCollections';
import { DailyPlan } from '../types';

/**
 * Planejamento diário por equipe (coleção construction_daily_plans, Document ID = makePlanId).
 * Até a versão 1.4.2 ficava só no localStorage de cada navegador; cópias antigas são
 * enviadas ao banco por services/localRecoveryService.ts.
 */

/** Gera um ID determinístico para uma entrada dia/equipe — evita duplicatas */
export const makePlanId = (projectId: string, teamId: string, date: string): string =>
  `${projectId}_${teamId}_${date}`;

export const getDailyPlans = async (): Promise<DailyPlan[]> =>
  withFirestoreError('carregar o planejamento diário', async () => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.DAILY_PLANS));
    return snapshot.docs.map((d) => d.data() as DailyPlan);
  });

export interface DailyPlanChanges {
  upserts: DailyPlan[];
  deletes: string[];
}

/** O que mudou entre o planejamento gravado e o novo: só isso vai ao banco. */
export const diffDailyPlans = (previous: DailyPlan[], next: DailyPlan[]): DailyPlanChanges => {
  const before = new Map(previous.map((p) => [p.id, p]));
  const after = new Set(next.map((p) => p.id));
  return {
    upserts: next.filter((p) => {
      const old = before.get(p.id);
      return !old || old.value !== p.value || old.projectId !== p.projectId ||
        old.teamId !== p.teamId || old.date !== p.date;
    }),
    deletes: previous.filter((p) => !after.has(p.id)).map((p) => p.id),
  };
};

const BATCH_LIMIT = 500;

/** Grava as mudanças em lotes de até 500 operações. */
export const applyDailyPlanChanges = async ({ upserts, deletes }: DailyPlanChanges): Promise<void> =>
  withFirestoreError('salvar o planejamento diário', async () => {
    const ops = [
      ...upserts.map((p) => (b: WriteBatch) => b.set(doc(db, COLLECTIONS.DAILY_PLANS, p.id), p)),
      ...deletes.map((id) => (b: WriteBatch) => b.delete(doc(db, COLLECTIONS.DAILY_PLANS, id))),
    ];
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
      await batch.commit();
    }
  });

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

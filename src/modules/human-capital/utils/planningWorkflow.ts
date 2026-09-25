import { PlanningRecord } from '../types';
import { getPayrollCompetencyMonthKey } from './overtime';

/**
 * Fluxo de aprovação do planejamento de horas extras.
 *
 *   Engenheiro salva ──► draft    ("Aguardando gerente")
 *   Gerente envia    ──► pending  ("Aguardando diretor")
 *   Diretor aprova   ──► approved ("Aprovado")
 *   Diretor devolve  ──► rejected ("Devolvido ao engenheiro", com motivo)
 *   Engenheiro/gerente corrige um devolvido ──► draft (volta ao gerente)
 *
 * O engenheiro lança aos poucos (1 a 2 semanas por vez); por isso as filas
 * não dependem da competência selecionada na tela.
 */

export type PlanningStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export const PLANNING_STATUS_LABELS: Record<PlanningStatus, string> = {
    draft: 'Aguardando gerente',
    pending: 'Aguardando diretor',
    approved: 'Aprovado',
    rejected: 'Devolvido ao engenheiro'
};

export const PLANNING_STATUS_SHORT_LABELS: Record<PlanningStatus, string> = {
    draft: 'Ag. gerente',
    pending: 'Ag. diretor',
    approved: 'Aprovado',
    rejected: 'Devolvido'
};

export const normalizePlanningStatus = (status?: string | null): PlanningStatus => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'pending' || normalized === 'approved' || normalized === 'rejected') {
        return normalized;
    }
    return 'draft';
};

export interface PlanningWorkflowCapabilities {
    /** Pode lançar/editar horas que ainda não foram enviadas ao diretor (draft/rejected). */
    canEditOpen: boolean;
    /** Pode enviar horas ao diretor (papel do gerente regional). */
    canSubmitToDirector: boolean;
    /** Pode aprovar e devolver (papel do diretor). */
    canApprove: boolean;
    /** Pode editar horas já enviadas ou aprovadas. */
    canOverrideLock: boolean;
}

const normalizeRole = (role?: string): string => {
    if (!role) return '';
    return role.startsWith('HC_') ? role.replace('HC_', 'CH_') : role;
};

export const getPlanningWorkflowCapabilities = (
    role?: string,
    isSuperAdmin?: boolean
): PlanningWorkflowCapabilities => {
    const normalized = isSuperAdmin ? 'CH_ADMIN' : normalizeRole(role);

    switch (normalized) {
        case 'CH_ADMIN':
            return { canEditOpen: true, canSubmitToDirector: true, canApprove: true, canOverrideLock: true };
        case 'CH_APPROVER':
            return { canEditOpen: true, canSubmitToDirector: false, canApprove: true, canOverrideLock: true };
        case 'CH_MANAGER':
            return { canEditOpen: true, canSubmitToDirector: true, canApprove: false, canOverrideLock: false };
        case 'CH_COSTCENTER_PLANNER':
            return { canEditOpen: true, canSubmitToDirector: false, canApprove: false, canOverrideLock: false };
        default:
            return { canEditOpen: false, canSubmitToDirector: false, canApprove: false, canOverrideLock: false };
    }
};

/** Indica se um dia com o status informado pode ser editado pelo usuário. */
export const isPlanningStatusEditable = (
    status: string | undefined,
    caps: PlanningWorkflowCapabilities
): boolean => {
    const normalized = normalizePlanningStatus(status);
    if (normalized === 'pending' || normalized === 'approved') return caps.canOverrideLock;
    return caps.canEditOpen;
};

/**
 * Status resultante quando um planejador salva horas alteradas.
 * - draft/rejected viram draft: a correção volta para a avaliação do gerente.
 * - pending/approved só chegam aqui por quem pode sobrepor o bloqueio e mantêm o status.
 */
export const resolveStatusAfterEdit = (original: string | undefined): PlanningStatus => {
    const normalized = normalizePlanningStatus(original);
    if (normalized === 'pending' || normalized === 'approved') return normalized;
    return 'draft';
};

export const getPlanningHours = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Number(value.replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

export const isDateInRange = (dateKey: string, start?: string, end?: string): boolean => {
    if (start && dateKey < start) return false;
    if (end && dateKey > end) return false;
    return true;
};

/** Custo estimado da hora extra: salário/220 × 1,6 (dia comum) ou × 2,0 (domingo). */
export const estimateOvertimeCost = (hours: number, salary: number | undefined, dateKey: string): number => {
    if (!salary || hours <= 0) return 0;
    const [year, month, day] = dateKey.split('-').map(Number);
    const isSunday = new Date(year, (month || 1) - 1, day || 1, 12).getDay() === 0;
    return (salary / 220) * (isSunday ? 2.0 : 1.6) * hours;
};

const MONTH_LABELS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/** Competência da folha (AAAA-MM) de uma data: do dia 21 do mês anterior ao dia 20. */
export const getPlanningCompetency = (dateKey: string): string => getPayrollCompetencyMonthKey(dateKey);

/** Intervalo da competência AAAA-MM: 21 do mês anterior a 20 do próprio mês. */
export const getCompetencyRange = (competency: string): { start: string; end: string } => {
    const [year, month] = competency.split('-').map(Number);
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    return {
        start: `${prevYear}-${String(prevMonth).padStart(2, '0')}-21`,
        end: `${year}-${String(month).padStart(2, '0')}-20`
    };
};

/** Rótulo da competência, ex.: "Julho/2026". */
export const formatCompetencyLabel = (competency: string): string => {
    const [year, month] = competency.split('-').map(Number);
    return MONTH_LABELS[(month || 1) - 1] ? `${MONTH_LABELS[month - 1]}/${year}` : competency;
};

export type CompetencyTiming = 'future' | 'open' | 'closed';

/** Situação da competência em relação a hoje (AAAA-MM-DD). */
export const getCompetencyTiming = (competency: string, todayKey: string): CompetencyTiming => {
    const { start, end } = getCompetencyRange(competency);
    if (todayKey < start) return 'future';
    if (todayKey > end) return 'closed';
    return 'open';
};

export interface PlanningQueueGroup {
    /** Chave única do cartão: CC + competência. */
    key: string;
    costCenter: string;
    /** Competência da folha AAAA-MM (21 do mês anterior a 20 do mês). */
    competency: string;
    competencyStart: string;
    competencyEnd: string;
    records: PlanningRecord[];
    totalHours: number;
    employeeCount: number;
    firstDate: string;
    lastDate: string;
    /** Motivo da devolução mais recente, quando o grupo contém devolvidos. */
    lastRejectionReason?: string;
}

/**
 * Agrupa registros com horas por centro de custo E competência da folha:
 * um cartão por obra por competência, sem misturar meses. Ordena da
 * competência mais antiga para a mais nova.
 * Registros sem horas são ignorados (resíduos de gravações antigas de grade completa).
 */
export const buildPlanningQueue = (records: PlanningRecord[]): PlanningQueueGroup[] => {
    const groups = new Map<string, { costCenter: string; competency: string; items: PlanningRecord[] }>();

    records.forEach(record => {
        if (getPlanningHours(record.plannedHours) <= 0) return;
        const competency = getPlanningCompetency(record.date);
        if (!competency) return;
        const costCenter = record.costCenter || 'S/ CC';
        const key = `${costCenter}|${competency}`;
        if (!groups.has(key)) groups.set(key, { costCenter, competency, items: [] });
        groups.get(key)!.items.push(record);
    });

    return Array.from(groups.entries())
        .map(([key, { costCenter, competency, items }]) => {
            const sorted = [...items].sort((a, b) =>
                a.date === b.date ? (a.nome || '').localeCompare(b.nome || '') : a.date.localeCompare(b.date)
            );
            const lastRejected = [...sorted]
                .filter(r => r.rejectionReason)
                .sort((a, b) => String(b.rejectedAt || '').localeCompare(String(a.rejectedAt || '')))[0];
            const range = getCompetencyRange(competency);

            return {
                key,
                costCenter,
                competency,
                competencyStart: range.start,
                competencyEnd: range.end,
                records: sorted,
                totalHours: sorted.reduce((sum, r) => sum + getPlanningHours(r.plannedHours), 0),
                employeeCount: new Set(sorted.map(r => r.chapa)).size,
                firstDate: sorted[0].date,
                lastDate: sorted[sorted.length - 1].date,
                lastRejectionReason: lastRejected?.rejectionReason
            };
        })
        .sort((a, b) => a.competency.localeCompare(b.competency) || a.costCenter.localeCompare(b.costCenter));
};

/** Mapa competência → chapa → salário (maior valor quando há mais de uma alocação). */
export type SalaryByCompetency = Record<string, Record<string, number>>;

export const buildSalaryByCompetency = (
    rows: Array<{ monthKey: string; chapa: string; salary: number }>
): SalaryByCompetency => {
    const map: SalaryByCompetency = {};
    rows.forEach(row => {
        if (!row.monthKey || !row.chapa || !(row.salary > 0)) return;
        const byChapa = map[row.monthKey] || (map[row.monthKey] = {});
        if (!byChapa[row.chapa] || row.salary > byChapa[row.chapa]) byChapa[row.chapa] = row.salary;
    });
    return map;
};

/**
 * Custo de um conjunto de lançamentos usando o salário da competência de CADA
 * lançamento. Uma pendência de julho usa o salário de julho, mesmo em setembro.
 * Quem não tem salário na competência é contado à parte, nunca como custo zero silencioso.
 */
export const estimateQueueCost = (
    records: PlanningRecord[],
    salaries: SalaryByCompetency
): { cost: number; missingSalaryChapas: string[]; missingSalaryHours: number } => {
    let cost = 0;
    let missingSalaryHours = 0;
    const missing = new Set<string>();

    records.forEach(record => {
        const hours = getPlanningHours(record.plannedHours);
        const salary = salaries[getPlanningCompetency(record.date)]?.[record.chapa];
        if (!salary) {
            if (hours > 0) {
                missing.add(record.chapa);
                missingSalaryHours += hours;
            }
            return;
        }
        cost += estimateOvertimeCost(hours, salary, record.date);
    });

    return { cost, missingSalaryChapas: Array.from(missing), missingSalaryHours };
};

/** Gera a chave usada nos mapas da tela: chapa_cc_data. */
export const planningKey = (record: Pick<PlanningRecord, 'chapa' | 'costCenter' | 'date'>): string =>
    `${record.chapa}_${record.costCenter}_${record.date}`;

/** ID determinístico do documento diário (mesmo formato usado pela grade). */
export const planningDocId = (chapa: string, costCenter: string, dateKey: string): string =>
    `${chapa}_${costCenter}_DAILY_${dateKey}`;

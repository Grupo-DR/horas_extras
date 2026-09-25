import { PlanningRecord } from '../types';

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

export interface PlanningQueueGroup {
    costCenter: string;
    records: PlanningRecord[];
    totalHours: number;
    employeeCount: number;
    firstDate: string;
    lastDate: string;
    /** Motivo da devolução mais recente, quando o grupo contém devolvidos. */
    lastRejectionReason?: string;
}

/**
 * Agrupa registros com horas por centro de custo, do mais antigo para o mais novo.
 * Registros sem horas são ignorados (resíduos de gravações antigas de grade completa).
 */
export const buildPlanningQueue = (records: PlanningRecord[]): PlanningQueueGroup[] => {
    const groups = new Map<string, PlanningRecord[]>();

    records.forEach(record => {
        if (getPlanningHours(record.plannedHours) <= 0) return;
        const cc = record.costCenter || 'S/ CC';
        if (!groups.has(cc)) groups.set(cc, []);
        groups.get(cc)!.push(record);
    });

    return Array.from(groups.entries())
        .map(([costCenter, items]) => {
            const sorted = [...items].sort((a, b) =>
                a.date === b.date ? (a.nome || '').localeCompare(b.nome || '') : a.date.localeCompare(b.date)
            );
            const lastRejected = [...sorted]
                .filter(r => r.rejectionReason)
                .sort((a, b) => String(b.rejectedAt || '').localeCompare(String(a.rejectedAt || '')))[0];

            return {
                costCenter,
                records: sorted,
                totalHours: sorted.reduce((sum, r) => sum + getPlanningHours(r.plannedHours), 0),
                employeeCount: new Set(sorted.map(r => r.chapa)).size,
                firstDate: sorted[0].date,
                lastDate: sorted[sorted.length - 1].date,
                lastRejectionReason: lastRejected?.rejectionReason
            };
        })
        .sort((a, b) => a.firstDate.localeCompare(b.firstDate) || a.costCenter.localeCompare(b.costCenter));
};

/** Gera a chave usada nos mapas da tela: chapa_cc_data. */
export const planningKey = (record: Pick<PlanningRecord, 'chapa' | 'costCenter' | 'date'>): string =>
    `${record.chapa}_${record.costCenter}_${record.date}`;

/** ID determinístico do documento diário (mesmo formato usado pela grade). */
export const planningDocId = (chapa: string, costCenter: string, dateKey: string): string =>
    `${chapa}_${costCenter}_DAILY_${dateKey}`;

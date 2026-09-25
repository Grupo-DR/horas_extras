
import { db } from '@/services/firebaseConfig';
import { collection, doc, writeBatch, query, where, getDocs, addDoc, Timestamp, getDoc, setDoc, deleteDoc, QueryConstraint } from 'firebase/firestore';
import { BudgetRecord, SalaryAllocation, PlanningRecord, UserProfile, ManualEmployee, HeadcountRecord, HeadcountUploadMeta } from '../types';
import { Scope } from '../../iam/types';
import { isCostCenterInHumanCapitalScope } from '../utils/scopeFilters';
import { getCCRegional } from '../data/ccMaster';

const COL_BUDGETS = 'hc_budgets';
const COL_SALARIES = 'hc_salary_allocations';
const COL_PLANNING = 'hc_planning_records';
const COL_AUDIT = 'hc_audit_logs';
const COL_HEADCOUNT = 'hc_headcount';

interface LegacyWorkTeam {
    id: string;
    name: string;
    costCenter: string;
    managerName?: string;
    memberChapas?: string[];
}

interface LegacyTeamAllocation {
    id: string;
    teamId: string;
    monthKey: string;
    chapas: string[];
}

// --- BUDGETS ---

// --- HELPERS ---

const safeNumber = (v: any): number => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};

const clean = (obj: any): any => {
    if (!obj) return obj;
    const res: any = {};
    Object.keys(obj).forEach(key => {
        const val = obj[key];
        if (val !== undefined) {
            res[key] = val;
        }
    });
    return res;
};

const FIRESTORE_IN_LIMIT = 10;

const chunk = <T,>(items: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

const getScopedConstraintGroups = (
    scope: Scope | undefined,
    costCenterField: string
): QueryConstraint[][] => {
    if (!scope || scope.type === 'ALL') return [[]];

    if (scope.type === 'COST_CENTER') {
        const costCenters = Array.from(new Set((scope.costCenters || []).filter(Boolean)));
        return chunk(costCenters, FIRESTORE_IN_LIMIT).map(values => [where(costCenterField, 'in', values)]);
    }

    if (scope.type === 'REGIONAL') {
        const regionals = Array.from(new Set((scope.regionals || []).filter(Boolean)));
        return chunk(regionals, FIRESTORE_IN_LIMIT).map(values => [where('regional', 'in', values)]);
    }

    return [];
};

const getScopedDocs = async <T,>(
    collectionName: string,
    scope: Scope | undefined,
    costCenterField = 'costCenter',
    baseConstraints: QueryConstraint[] = []
): Promise<T[]> => {
    const scopedGroups = getScopedConstraintGroups(scope, costCenterField);
    if (scopedGroups.length === 0) return [];

    const snapshots = await Promise.all(
        scopedGroups.map(group =>
            getDocs(query(collection(db, collectionName), ...baseConstraints, ...group))
        )
    );

    const docs = new Map<string, T>();
    snapshots.forEach(snapshot => {
        snapshot.docs.forEach(document => docs.set(document.id, document.data() as T));
    });
    return Array.from(docs.values());
};

// --- BUDGETS ---

export const upsertBudgets = async (budgets: BudgetRecord[], user: UserProfile) => {
    const batch = writeBatch(db);
    budgets.forEach(b => {
        // ID: budget_YYYY-MM_CC_normalized
        if (!b.monthKey) return; // Guard clause
        const id = `budget_${b.monthKey}_${b.costCenter}`;
        const ref = doc(db, COL_BUDGETS, id);

        const data = clean({
            ...b,
            value: safeNumber(b.value),
            regional: getCCRegional(b.costCenter || '')
        });

        batch.set(ref, {
            ...data,
            updatedAt: Timestamp.now(),
            updatedBy: user.email
        }, { merge: true });
    });
    await batch.commit();
};

export const getBudgetsByMonthKey = async (monthKey: string, scope?: Scope) => {
    if (!monthKey) return [];
    const rows = await getScopedDocs<BudgetRecord>(COL_BUDGETS, scope, 'costCenter', [where('monthKey', '==', monthKey)]);
    return rows
        .filter(b => isCostCenterInHumanCapitalScope(scope, b.costCenter || ''));
};

export const getAllBudgets = async (scope?: Scope): Promise<BudgetRecord[]> => {
    const rows = await getScopedDocs<BudgetRecord>(COL_BUDGETS, scope);
    return rows
        .filter(b => isCostCenterInHumanCapitalScope(scope, b.costCenter || ''));
};

export const deleteBudgetsByMonthKey = async (monthKey: string): Promise<void> => {
    if (!monthKey) return;
    const q = query(collection(db, COL_BUDGETS), where('monthKey', '==', monthKey));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
};

export const deleteAllBudgets = async (): Promise<void> => {
    const snapshot = await getDocs(collection(db, COL_BUDGETS));
    // Firestore batch limit is 500; chunk if needed
    const CHUNK = 400;
    for (let i = 0; i < snapshot.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        snapshot.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
};

// --- SALARIES ---

export const upsertSalaryAllocations = async (allocations: SalaryAllocation[], user: UserProfile) => {
    // Batches limited to 500. Assuming import isn't huge, or we slice.
    // For now, let's slice just in case.
    const chunks = [];
    for (let i = 0; i < allocations.length; i += 400) {
        chunks.push(allocations.slice(i, i + 400));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(s => {
            // ID: salary_YYYY-MM_CHAPA_CC
            if (!s.monthKey || !s.chapa) return; // Guard
            const id = `salary_${s.monthKey}_${s.chapa}_${s.costCenter}`;
            const ref = doc(db, COL_SALARIES, id);

            const data = clean({
                ...s,
                salary: safeNumber(s.salary),
                allocation: safeNumber(s.allocation),
                regional: getCCRegional(s.costCenter || '')
            });

            batch.set(ref, {
                ...data,
                updatedAt: Timestamp.now(),
                updatedBy: user.email
            }, { merge: true });
        });
        await batch.commit();
    }
};

export const getSalaryAllocationsByMonthKey = async (monthKey: string, scope?: Scope) => {
    if (!monthKey) return [];
    const rows = await getScopedDocs<SalaryAllocation>(COL_SALARIES, scope, 'costCenter', [where('monthKey', '==', monthKey)]);
    return rows
        .filter(s => isCostCenterInHumanCapitalScope(scope, s.costCenter || ''));
};

export const deleteSalaryAllocationsByMonthKeys = async (monthKeys: string[]): Promise<void> => {
    const keys = Array.from(new Set((monthKeys || []).filter(Boolean)));
    if (keys.length === 0) return;

    for (const monthKey of keys) {
        const q = query(collection(db, COL_SALARIES), where('monthKey', '==', monthKey));
        const snapshot = await getDocs(q);
        const CHUNK = 400;

        for (let i = 0; i < snapshot.docs.length; i += CHUNK) {
            const batch = writeBatch(db);
            snapshot.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
    }
};

// --- PLANNING ---

export const upsertPlanningRecords = async (records: PlanningRecord[], user: UserProfile) => {
    const valid = records.filter(r => !!r.date && !!r.chapa);
    // Lotes de 400, mesmo padrão de salários e colaboradores.
    for (const part of chunk(valid, 400)) {
        const batch = writeBatch(db);
        part.forEach(r => {
            // ID: Use r.id if present, or construct
            // ID: plan_YYYY-MM-DD_CHAPA_CC_TYPE
            const id = r.id || `plan_${r.date}_${r.chapa}_${r.costCenter}_${r.type}`;
            const ref = doc(db, COL_PLANNING, id);

            const data = clean({
                ...r,
                plannedHours: safeNumber(r.plannedHours),
                regional: getCCRegional(r.costCenter || '')
            });

            batch.set(ref, {
                ...data,
                id, // ensure ID is saved
                updatedAt: Timestamp.now(),
                updatedBy: user.email
            }, { merge: true });
        });
        await batch.commit();
    }
};

export type PlanningStatusPatch = Pick<
    PlanningRecord,
    'status' | 'approvedBy' | 'approvedAt' | 'submittedBy' | 'submittedAt' | 'rejectedBy' | 'rejectedAt' | 'rejectionReason'
>;

/**
 * Altera apenas o status (e metadados da transição) de documentos existentes.
 * Não regrava horas: enviar, aprovar ou devolver nunca sobrescreve uma edição
 * de horas feita por outra pessoa depois que a fila foi carregada.
 * Usa update (e não set) para falhar se o documento não existir.
 */
export const updatePlanningStatus = async (
    ids: string[],
    patch: PlanningStatusPatch,
    user: UserProfile
) => {
    const data = clean(patch);
    for (const part of chunk(Array.from(new Set(ids.filter(Boolean))), 400)) {
        const batch = writeBatch(db);
        part.forEach(id => {
            batch.update(doc(db, COL_PLANNING, id), {
                ...data,
                updatedAt: Timestamp.now(),
                updatedBy: user.email
            });
        });
        await batch.commit();
    }
};

/**
 * Registros diários APROVADOS do mês de calendário (AAAA-MM).
 * Usada pela Visão Geral e pela Análise, que só consomem aprovados: evita baixar
 * os milhares de rascunhos sem horas do mês. Requer os índices (status, date).
 */
export const getApprovedPlanningRecords = async (monthKey: string, scope?: Scope): Promise<PlanningRecord[]> => {
    const rows = await getScopedDocs<PlanningRecord>(COL_PLANNING, scope, 'costCenter', [
        where('status', '==', 'approved'),
        where('date', '>=', monthKey),
        where('date', '<=', monthKey + '')
    ]);
    return rows.filter(r => r.type === 'DAILY' && isCostCenterInHumanCapitalScope(scope, r.costCenter || ''));
};

export const getPlanningRecords = async (monthKey: string, type: 'DAILY' | 'MONTHLY', scope?: Scope) => {
    // Note: We need to filter by month start.
    // 'date' field is string 'YYYY-MM-DD' or 'YYYY-MM'.
    // Firestore string prefix matching usually via >= and <=
    const start = monthKey;
    const end = monthKey + '\uf8ff';

    const rows = await getScopedDocs<PlanningRecord>(COL_PLANNING, scope, 'costCenter', [
        where('date', '>=', start),
        where('date', '<=', end)
    ]);
    return rows.filter(r => r.type === type && isCostCenterInHumanCapitalScope(scope, r.costCenter || ''));
};

// --- AUDIT ---

export const writeAudit = async (action: string, meta: any, user: UserProfile) => {
    try {
        await addDoc(collection(db, COL_AUDIT), {
            action,
            metadata: meta,
            userEmail: user.email,
            timestamp: Timestamp.now()
        });
    } catch (e) {
        console.error("Audit Log Failed", e);
    }
};
// --- TEAMS ---

const COL_TEAMS = 'hc_teams';

export const upsertTeams = async (teams: LegacyWorkTeam[], user: UserProfile) => {
    const batch = writeBatch(db);
    teams.forEach(t => {
        if (!t.id) return;
        const ref = doc(db, COL_TEAMS, t.id);

        batch.set(ref, {
            ...t,
            regional: getCCRegional(t.costCenter || ''),
            updatedAt: Timestamp.now(),
            updatedBy: user.email
        }, { merge: true });
    });
    await batch.commit();
};

export const getTeams = async (scope?: Scope) => {
    const rows = await getScopedDocs<LegacyWorkTeam>(COL_TEAMS, scope);
    return rows.filter(t => isCostCenterInHumanCapitalScope(scope, t.costCenter || ''));
};

export const deleteTeam = async (teamId: string) => {
    if (!teamId) return;
    await deleteDoc(doc(db, COL_TEAMS, teamId));
};

// --- TEAM ALLOCATIONS ---

const COL_TEAM_ALLOCATIONS = 'hc_team_allocations';

export const upsertTeamAllocation = async (allocation: LegacyTeamAllocation, user: UserProfile) => {
    if (!allocation.id) return;
    const ref = doc(db, COL_TEAM_ALLOCATIONS, allocation.id);
    await setDoc(ref, {
        ...allocation,
        updatedAt: Timestamp.now(),
        updatedBy: user.email
    }, { merge: true });
};

export const getTeamAllocationsByMonthKey = async (monthKey: string, scope?: Scope) => {
    if (!monthKey) return [];
    // Team allocation docs do not denormalize costCenter/regional; scoped users cannot be queried safely.
    if (scope && scope.type !== 'ALL') return [];
    const q = query(collection(db, COL_TEAM_ALLOCATIONS), where('monthKey', '==', monthKey));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as LegacyTeamAllocation);
};

export const getAllTeamAllocations = async () => {
    const q = query(collection(db, COL_TEAM_ALLOCATIONS));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as LegacyTeamAllocation);
};

// --- MANUAL EMPLOYEES ---

const COL_MANUAL_EMPLOYEES = 'hc_manual_employees';

export const upsertManualEmployee = async (employee: ManualEmployee, user: UserProfile) => {
    if (!employee.id) return;
    const ref = doc(db, COL_MANUAL_EMPLOYEES, employee.id);
    await setDoc(ref, {
        ...employee,
        regional: getCCRegional(employee.costCenter || ''),
        updatedAt: Timestamp.now(),
        updatedBy: user.email
    }, { merge: true });
};

export const getManualEmployees = async (scope?: Scope) => {
    const rows = await getScopedDocs<ManualEmployee>(COL_MANUAL_EMPLOYEES, scope);
    return rows.filter(employee => isCostCenterInHumanCapitalScope(scope, employee.costCenter || ''));
};

// --- GLOBAL EMPLOYEES (DICTIONARY) ---

const COL_GLOBAL_EMPLOYEES = 'hc_global_employees';

export const upsertGlobalEmployees = async (employees: import('../types').GlobalEmployee[], user: UserProfile) => {
    // Batches limited to 500.
    const chunks = [];
    for (let i = 0; i < employees.length; i += 400) {
        chunks.push(employees.slice(i, i + 400));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(emp => {
            if (!emp.chapa) return;
            const ref = doc(db, COL_GLOBAL_EMPLOYEES, emp.chapa);
            batch.set(ref, {
                ...emp,
                regional: getCCRegional(emp.costCenter || ''),
                updatedAt: Timestamp.now(),
                updatedBy: user.email
            }, { merge: true });
        });
        await batch.commit();
    }
};

export const getGlobalEmployees = async (scope?: Scope) => {
    const rows = await getScopedDocs<import('../types').GlobalEmployee>(COL_GLOBAL_EMPLOYEES, scope);
    return rows.filter(employee => isCostCenterInHumanCapitalScope(scope, employee.costCenter || ''));
};

// --- HEADCOUNT ---

/**
 * Salva (upsert) registros de headcount no Firestore.
 * ID composto: hc_{uploadId}_{chapa}_{centroCusto}_{dataInicio}
 */
export const upsertHeadcountRecords = async (
    records: HeadcountRecord[],
    meta: HeadcountUploadMeta,
    user: UserProfile
): Promise<void> => {
    const CHUNK = 400;
    for (let i = 0; i < records.length; i += CHUNK) {
        const batch = writeBatch(db);
        records.slice(i, i + CHUNK).forEach(r => {
            const id = `hc_${meta.uploadId}_${r.chapa}_${r.centroCusto}_${r.dataInicio}`;
            const ref = doc(db, COL_HEADCOUNT, id);
            batch.set(ref, {
                ...r,
                regional: getCCRegional(r.centroCusto || ''),
                uploadId: meta.uploadId,
                uploadedAt: meta.uploadedAt,
                updatedAt: Timestamp.now(),
                updatedBy: user.email,
            }, { merge: true });
        });
        await batch.commit();
    }
    await writeAudit('HEADCOUNT_UPLOAD', {
        uploadId: meta.uploadId,
        recordCount: meta.recordCount,
        uploadedAt: meta.uploadedAt,
    }, user);
};

/**
 * Retorna todos os registros de headcount.
 * Se dateRef for fornecido, filtra pelos registros vigentes naquela data.
 */
export const getHeadcountRecords = async (dateRef?: string, scope?: Scope): Promise<HeadcountRecord[]> => {
    const all = await getScopedDocs<HeadcountRecord & { uploadId?: string }>(COL_HEADCOUNT, scope, 'centroCusto');
    if (!dateRef) return all;
    return all.filter(r => r.dataInicio <= dateRef && r.dataFim >= dateRef);
};

/**
 * Remove todos os registros de headcount de um uploadId específico.
 */
export const deleteHeadcountByUploadId = async (uploadId: string): Promise<void> => {
    const q = query(collection(db, COL_HEADCOUNT), where('uploadId', '==', uploadId));
    const snapshot = await getDocs(q);
    const CHUNK = 400;
    for (let i = 0; i < snapshot.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        snapshot.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
};

/**
 * [REPLACE MODE - ETAPA A]
 * Remove TODOS os registros de headcount da colecao hc_headcount, sem filtro por uploadId.
 * Garante que nenhum headcount residual de uploads anteriores permaneca ativo.
 */
export const clearAllHeadcountRecords = async (): Promise<void> => {
    const snapshot = await getDocs(collection(db, COL_HEADCOUNT));
    if (snapshot.empty) return;
    const CHUNK = 400;
    for (let i = 0; i < snapshot.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        snapshot.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
};

/**
 * [REPLACE MODE - OPERACAO PRINCIPAL]
 * Substitui COMPLETAMENTE o headcount no Firestore.
 *
 * Etapa A - Remove todos os registros existentes (clearAllHeadcountRecords).
 * Etapa B - Insere os novos registros em batch sem merge (escrita limpa).
 * Etapa C - Grava log de auditoria com action 'HEADCOUNT_REPLACE'.
 *
 * IDs de documento nao incluem uploadId para evitar acumulo entre uploads.
 * Nunca ha dois conjuntos de headcount coexistentes apos esta operacao.
 */
export const replaceHeadcountRecords = async (
    records: HeadcountRecord[],
    meta: HeadcountUploadMeta,
    user: UserProfile
): Promise<void> => {
    // Etapa A: remocao total
    await clearAllHeadcountRecords();

    // Etapa B: insercao do novo lote sem merge
    const CHUNK = 400;
    for (let i = 0; i < records.length; i += CHUNK) {
        const batch = writeBatch(db);
        records.slice(i, i + CHUNK).forEach(r => {
            // ID deterministico sem prefixo de uploadId para evitar acumulo
            const id = `hc_${r.chapa}_${r.centroCusto}_${r.dataInicio}`;
            const ref = doc(db, COL_HEADCOUNT, id);
            batch.set(ref, {
                ...r,
                regional: getCCRegional(r.centroCusto || ''),
                uploadId: meta.uploadId,
                uploadedAt: meta.uploadedAt,
                updatedAt: Timestamp.now(),
                updatedBy: user.email,
            });
        });
        await batch.commit();
    }

    // Etapa C: auditoria
    await writeAudit('HEADCOUNT_REPLACE', {
        uploadId: meta.uploadId,
        recordCount: meta.recordCount,
        uploadedAt: meta.uploadedAt,
        replacedAt: new Date().toISOString(),
    }, user);
};

/**
 * Busca registros diários com horas (> 0) em um status, em qualquer data.
 * Usada pelas filas do gerente e do diretor, que não dependem da competência da tela.
 * Requer os índices compostos (status, plannedHours) de firestore.indexes.json.
 */
export const getPlanningRecordsByStatus = async (
    status: 'draft' | 'pending' | 'approved' | 'rejected',
    scope?: Scope
): Promise<PlanningRecord[]> => {
    const rows = await getScopedDocs<PlanningRecord>(COL_PLANNING, scope, 'costCenter', [
        where('status', '==', status),
        where('plannedHours', '>', 0)
    ]);
    return rows.filter(r => r.type === 'DAILY' && isCostCenterInHumanCapitalScope(scope, r.costCenter || ''));
};

/**
 * Busca todos os documentos da coleção `hc_planning_records` do Firestore,
 * sem filtros ou limites, preservando todos os campos originais.
 */
export const getAllPlanningRecordsFromFirestore = async (): Promise<any[]> => {
    const snapshot = await getDocs(collection(db, COL_PLANNING));
    return snapshot.docs.map(d => d.data());
};

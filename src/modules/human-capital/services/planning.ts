
import { PlanningRecord, BudgetRecord, SalaryAllocation, UserProfile, HeadcountRecord, HeadcountUploadMeta } from '../types';
import * as FirestoreService from './firestoreCH';
import { isCostCenterInHumanCapitalScope } from '../utils/scopeFilters';
import {
    buildSalaryAllocationsFromHeadcount,
    getSalaryAllocationId,
    getSalaryCompetenciesToReplace
} from '../utils/headcountSalary';

// Helper to check if online (rudimentary)
const isOnline = () => navigator.onLine;

const SALARY_CACHE_KEY = 'employee_salaries_v2';

const normalizeMonthKeys = (monthKeys?: string | string[]): string[] => {
    if (!monthKeys) return [];
    const keys = Array.isArray(monthKeys) ? monthKeys : [monthKeys];
    return Array.from(new Set(keys.filter(Boolean)));
};

const readSalaryCache = (): SalaryAllocation[] => {
    try {
        const data = localStorage.getItem(SALARY_CACHE_KEY);
        if (data) return (JSON.parse(data) || []) as SalaryAllocation[];
    } catch (e) {
        console.error("Error reading local salaries:", e);
    }
    return [];
};

const writeSalaryCache = (salaries: SalaryAllocation[], replaceMonthKeys?: string[]) => {
    const replaceSet = new Set(normalizeMonthKeys(replaceMonthKeys));
    const retained = replaceSet.size > 0
        ? readSalaryCache().filter(s => !replaceSet.has(s.monthKey))
        : readSalaryCache();

    const merged = new Map<string, SalaryAllocation>();
    retained.forEach(s => merged.set(getSalaryAllocationId(s), s));
    salaries.forEach(s => merged.set(getSalaryAllocationId(s), s));

    localStorage.setItem(SALARY_CACHE_KEY, JSON.stringify(Array.from(merged.values())));
};

// --- PLANNING ---

export const savePlanning = async (plans: PlanningRecord[], user: UserProfile): Promise<void> => {
    // INVARIANT: Registros com status 'approved' são imutáveis fora do fluxo
    // de aprovação/rejeição explícito. Nunca sobrescrever horas de um registro
    // aprovado com plannedHours <= 0 — isso indica dado residual ou bug no caller.
    const safeRecords = plans.filter(r => {
        if (r.status === 'approved' && (r.plannedHours ?? 0) <= 0) {
            console.warn(
                `[savePlanning] BLOQUEADO: tentativa de zerar horas de registro aprovado.`,
                `ID: ${r.id} | Chapa: ${r.chapa} | Data: ${r.date} | CC: ${r.costCenter}`
            );
            return false;
        }
        return true;
    });

    if (safeRecords.length === 0) return;

    // A gravação só é considerada concluída após confirmação do Firestore.
    // Antes, falhas (sem conexão, permissão negada) eram engolidas e a tela
    // mostrava "submetido" sem que o aprovador recebesse nada.
    if (!isOnline()) {
        throw new Error('Sem conexão com a internet. Nada foi gravado; tente novamente quando estiver online.');
    }

    try {
        await FirestoreService.upsertPlanningRecords(safeRecords, user);
    } catch (error: any) {
        console.error("Save Planning Failed:", error);
        const code = error?.code ? ` (${error.code})` : '';
        throw new Error(
            error?.code === 'permission-denied'
                ? 'Permissão negada pelo servidor: seu perfil não pode fazer esta alteração.'
                : `Falha ao gravar no servidor${code}. Nada foi confirmado; tente novamente.`
        );
    }

    updateLocalPlanningCache(safeRecords);
    invalidateApprovedPlanning();
};

/**
 * Aplica uma transição de status (enviar, aprovar, devolver) nos registros informados.
 * Lança erro se não houver conexão ou se o servidor recusar; só então a tela confirma.
 */
export const transitionPlanningStatus = async (
    records: PlanningRecord[],
    patch: FirestoreService.PlanningStatusPatch,
    user: UserProfile
): Promise<void> => {
    if (records.length === 0) return;
    if (!isOnline()) {
        throw new Error('Sem conexão com a internet. Nada foi alterado; tente novamente quando estiver online.');
    }

    try {
        await FirestoreService.updatePlanningStatus(
            records.map(r => r.id || `${r.chapa}_${r.costCenter}_${r.type || 'DAILY'}_${r.date}`),
            patch,
            user
        );
    } catch (error: any) {
        console.error('Transition Planning Failed:', error);
        const code = error?.code ? ` (${error.code})` : '';
        throw new Error(
            error?.code === 'permission-denied'
                ? 'Permissão negada pelo servidor: seu perfil não pode fazer esta alteração.'
                : `Falha ao gravar no servidor${code}. Nada foi confirmado; tente novamente.`
        );
    }

    updateLocalPlanningCache(records.map(r => ({ ...r, ...patch })));
    invalidateApprovedPlanning();
};

/**
 * Fila de registros com horas em um status, independente da competência.
 * Se a consulta por status falhar (ex.: índice ainda não publicado), usa as
 * competências informadas como alternativa e sinaliza que a fila é parcial.
 */
export const getPlanningQueue = async (
    status: 'draft' | 'pending' | 'rejected',
    user: UserProfile,
    fallbackMonthKeys: string[]
): Promise<{ records: PlanningRecord[]; partial: boolean }> => {
    try {
        if (!isOnline()) throw new Error('Offline');
        const records = await FirestoreService.getPlanningRecordsByStatus(status, user.scope);
        return { records, partial: false };
    } catch (error) {
        console.warn(`[getPlanningQueue] consulta por status '${status}' falhou; usando competências da tela.`, error);
        const chunks = await Promise.all(
            Array.from(new Set(fallbackMonthKeys)).map(monthKey => getPlanning(undefined, monthKey, 'DAILY', user))
        );
        const byId = new Map<string, PlanningRecord>();
        chunks.flat().forEach(r => {
            if ((r.status || 'draft') === status && Number(r.plannedHours) > 0) {
                byId.set(r.id || `${r.chapa}_${r.costCenter}_${r.date}`, r);
            }
        });
        return { records: Array.from(byId.values()), partial: true };
    }
};

// ─── Cache local do planejamento ────────────────────────────────────────────
// Antes: lista com busca linear por registro (custo quadrático, ~1,5 s de tela
// travada por mês consultado) e gravação de TODOS os documentos no localStorage
// a cada consulta, estourando a cota do navegador.
// Agora: mapa por chave, só registros úteis (com horas, enviados ou aprovados)
// e gravação no localStorage agrupada.

const PLANNING_CACHE_KEY = 'hc_planning_records_v2';
const PLANNING_CACHE_MAX = 8000;
const PLANNING_PERSIST_DELAY_MS = 1500;

const planningCacheKey = (p: Pick<PlanningRecord, 'chapa' | 'costCenter' | 'date' | 'type'>): string =>
    `${p.chapa}|${p.costCenter}|${p.date}|${p.type}`;

/** Rascunhos com zero horas são resíduos de gravações antigas: não vale guardar. */
const isWorthCaching = (p: PlanningRecord): boolean =>
    (Number(p.plannedHours) || 0) > 0 || p.status === 'approved' || p.status === 'pending';

let planningCacheMap: Map<string, PlanningRecord> | null = null;
let planningPersistTimer: ReturnType<typeof setTimeout> | null = null;

const hydratePlanningCache = (): Map<string, PlanningRecord> => {
    if (planningCacheMap) return planningCacheMap;
    planningCacheMap = new Map();
    try {
        const data = localStorage.getItem(PLANNING_CACHE_KEY);
        const rows = data ? (JSON.parse(data) || []) as PlanningRecord[] : [];
        rows.forEach(p => {
            if (p && p.date && isWorthCaching(p)) planningCacheMap!.set(planningCacheKey(p), p);
        });
    } catch (e) {
        console.error("Erro ao hidratar cache de planejamento:", e);
    }
    return planningCacheMap;
};

const persistPlanningCache = () => {
    const rows = Array.from(hydratePlanningCache().values());
    try {
        localStorage.setItem(PLANNING_CACHE_KEY, JSON.stringify(rows));
    } catch {
        // Cota do navegador: mantém só os mais recentes.
        try {
            const pruned = [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, PLANNING_CACHE_MAX);
            localStorage.setItem(PLANNING_CACHE_KEY, JSON.stringify(pruned));
        } catch {
            // Sem espaço: o cache em memória continua valendo nesta sessão.
        }
    }
};

const schedulePlanningCachePersist = () => {
    if (planningPersistTimer) return;
    planningPersistTimer = setTimeout(() => {
        planningPersistTimer = null;
        persistPlanningCache();
    }, PLANNING_PERSIST_DELAY_MS);
};

const updateLocalPlanningCache = (plans: PlanningRecord[]) => {
    const map = hydratePlanningCache();
    plans.forEach(plan => {
        if (!plan || !plan.date) return;
        const key = planningCacheKey(plan);
        if (isWorthCaching(plan)) map.set(key, plan);
        else map.delete(key);
    });
    schedulePlanningCachePersist();
};

const readCachedPlanning = (): PlanningRecord[] => Array.from(hydratePlanningCache().values());

export const getPlanning = async (
    costCenter: string | undefined,
    monthKey: string, // YYYY-MM
    type: 'DAILY' | 'MONTHLY',
    user?: UserProfile,
    preferCache = false
): Promise<PlanningRecord[]> => {
    try {
        // Guard against undefined monthKey
        if (!monthKey) return [];

        let records: PlanningRecord[] = [];

        if (isOnline() && !preferCache) {
            records = await FirestoreService.getPlanningRecords(monthKey, type, user?.scope);
            // Refresh local cache with what we found
            updateLocalPlanningCache(records);
        } else {
            // Fallback to local
            records = readCachedPlanning().filter(p => {
                const pMonth = p.date.substring(0, 7);
                return (
                    pMonth === monthKey &&
                    p.type === type &&
                    isCostCenterInHumanCapitalScope(user?.scope, p.costCenter || '')
                );
            });
        }

        // Apply Cost Center filter if specific CC requested (on top of scope)
        if (costCenter) {
            records = records.filter(p => p.costCenter === costCenter);
        }

        return records;

    } catch (error) {
        console.error("Get Planning Failed (using fallback):", error);
        return readCachedPlanning().filter(p => {
            const pMonth = p.date.substring(0, 7);
            return (
                pMonth === monthKey &&
                p.type === type &&
                isCostCenterInHumanCapitalScope(user?.scope, p.costCenter || '') &&
                (!costCenter || p.costCenter === costCenter)
            );
        });
    }
};

// --- SALARIES ---

export const saveSalaries = async (
    salaries: SalaryAllocation[],
    user: UserProfile,
    options?: { replaceMonthKeys?: string[] }
) => {
    const replaceMonthKeys = normalizeMonthKeys(options?.replaceMonthKeys);

    try {
        if (isOnline()) {
            if (replaceMonthKeys.length > 0) {
                await FirestoreService.deleteSalaryAllocationsByMonthKeys(replaceMonthKeys);
            }
            await FirestoreService.upsertSalaryAllocations(salaries, user);
        }
        writeSalaryCache(salaries, replaceMonthKeys);
    } catch (e) {
        console.error("Save Salaries Failed:", e);
        writeSalaryCache(salaries, replaceMonthKeys);
    }
};

export const getSalaries = async (monthKey: string, user?: UserProfile): Promise<SalaryAllocation[]> => {
    // Guard: Require monthKey
    if (!monthKey) return [];

    try {
        if (isOnline()) {
            const rows = await FirestoreService.getSalaryAllocationsByMonthKey(monthKey, user?.scope);
            writeSalaryCache(rows, [monthKey]);
            return rows;
        }
        throw new Error("Offline");
    } catch (error) {
        console.warn("Fetching salaries from Firestore failed or offline, checking local cache", error);
        return readSalaryCache().filter(
            s => s.monthKey === monthKey && isCostCenterInHumanCapitalScope(user?.scope, s.costCenter || '')
        );
    }
};

export const getSalariesForMonthKeys = async (monthKeys: string[], user?: UserProfile): Promise<SalaryAllocation[]> => {
    const keys = normalizeMonthKeys(monthKeys);
    if (keys.length === 0) return [];

    try {
        if (isOnline()) {
            const chunks = await Promise.all(
                keys.map(monthKey => FirestoreService.getSalaryAllocationsByMonthKey(monthKey, user?.scope))
            );
            const rows = chunks.flat();
            writeSalaryCache(rows, keys);
            return rows;
        }
        throw new Error("Offline");
    } catch (error) {
        console.warn("Fetching salaries for multiple monthKeys failed or offline, checking local cache", error);
        const keySet = new Set(keys);
        return readSalaryCache().filter(
            s => keySet.has(s.monthKey) && isCostCenterInHumanCapitalScope(user?.scope, s.costCenter || '')
        );
    }
};

// --- BUDGETS ---

export const saveBudgets = async (budgets: BudgetRecord[], user: UserProfile) => {
    try {
        if (isOnline()) {
            await FirestoreService.upsertBudgets(budgets, user);
        }
        localStorage.setItem('department_budgets_v2', JSON.stringify(budgets));
    } catch (e) {
        console.error("Save Budgets Failed:", e);
        localStorage.setItem('department_budgets_v2', JSON.stringify(budgets));
    }
};

export const getBudgets = async (monthKey: string, user?: UserProfile): Promise<BudgetRecord[]> => {
    if (!monthKey) return [];
    try {
        if (isOnline()) {
            const rows = await FirestoreService.getBudgetsByMonthKey(monthKey, user?.scope);
            localStorage.setItem('department_budgets_v2', JSON.stringify(rows));
            return rows;
        }
        throw new Error("Offline");
    } catch (error) {
        console.warn("Fetching budgets failed/offline, using cache", error);
        const data = localStorage.getItem('department_budgets_v2');
        if (data) {
            const all = JSON.parse(data) as BudgetRecord[];
            return all.filter(
                b => b.monthKey === monthKey && isCostCenterInHumanCapitalScope(user?.scope, b.costCenter || '')
            );
        }
        return [];
    }
};

export const getAllBudgetsAsync = async (user?: UserProfile): Promise<BudgetRecord[]> => {
    try {
        if (isOnline()) {
            const rows = await FirestoreService.getAllBudgets(user?.scope);
            localStorage.setItem('department_budgets_v2', JSON.stringify(rows));
            return rows;
        }
        throw new Error('Offline');
    } catch {
        const data = localStorage.getItem('department_budgets_v2');
        return data
            ? (JSON.parse(data) as BudgetRecord[]).filter(b => isCostCenterInHumanCapitalScope(user?.scope, b.costCenter || ''))
            : [];
    }
};

export const deleteBudgets = async (monthKey: string, user: UserProfile): Promise<void> => {
    try {
        if (isOnline()) {
            await FirestoreService.deleteBudgetsByMonthKey(monthKey);
        }
        // Sync local cache
        const data = localStorage.getItem('department_budgets_v2');
        if (data) {
            const all = JSON.parse(data) as BudgetRecord[];
            localStorage.setItem('department_budgets_v2', JSON.stringify(all.filter(b => b.monthKey !== monthKey)));
        }
    } catch (e) {
        console.error('Delete Budgets Failed:', e);
        throw e;
    }
};

export const deleteAllBudgets = async (user: UserProfile): Promise<void> => {
    try {
        if (isOnline()) {
            await FirestoreService.deleteAllBudgets();
        }
        localStorage.removeItem('department_budgets_v2');
    } catch (e) {
        console.error('Delete All Budgets Failed:', e);
        throw e;
    }
};

// --- MIGRATION ---

export const migrateToFirestore = async (user: UserProfile) => {
    const MIGRATION_KEY = 'hc_migrated_to_firestore_v1';
    if (localStorage.getItem(MIGRATION_KEY) === 'true') return;

    try {
        // 1. Migrate Budgets
        const localBudgets = localStorage.getItem('department_budgets_v2');
        if (localBudgets) {
            const budgets = JSON.parse(localBudgets) as BudgetRecord[];
            const valid = budgets.filter(b => !!b.monthKey);
            if (valid.length > 0) await FirestoreService.upsertBudgets(valid, user);
        }

        // 2. Migrate Salaries
        const localSalaries = localStorage.getItem('employee_salaries_v2');
        if (localSalaries) {
            const salaries = JSON.parse(localSalaries) as SalaryAllocation[];
            const valid = salaries.filter(s => !!s.monthKey);
            if (valid.length > 0) await FirestoreService.upsertSalaryAllocations(valid, user);
        }

        await FirestoreService.writeAudit('MIGRATION', { status: 'COMPLETE' }, user);
        localStorage.setItem(MIGRATION_KEY, 'true');
        console.log("Migration Complete.");

    } catch (error) {
        console.error("Migration Failed:", error);
    }
};

// --- LEGACY SUPPORT ---
// Leitura síncrona do cache (usada para a primeira renderização da Análise).
export const getAllPlanningRecords = (): PlanningRecord[] => readCachedPlanning();

// --- PLANEJAMENTO APROVADO (Visão Geral e Análise) ---

const APPROVED_PLANNING_TTL_MS = 60_000;
const approvedPlanningInFlight = new Map<string, { at: number; promise: Promise<PlanningRecord[]> }>();

const loadApprovedPlanningMonth = async (monthKey: string, user?: UserProfile): Promise<PlanningRecord[]> => {
    if (!isOnline()) {
        return readCachedPlanning().filter(p =>
            p.date.substring(0, 7) === monthKey &&
            p.type === 'DAILY' &&
            p.status === 'approved' &&
            isCostCenterInHumanCapitalScope(user?.scope, p.costCenter || '')
        );
    }
    try {
        // Só aprovados: ~10x menos documentos que o mês inteiro.
        const rows = await FirestoreService.getApprovedPlanningRecords(monthKey, user?.scope);
        updateLocalPlanningCache(rows);
        return rows;
    } catch (error) {
        // Ex.: índice (status, date) ainda não publicado. Mantém o comportamento antigo.
        console.warn(`[getApprovedPlanning] consulta por status falhou para ${monthKey}; usando o mês inteiro.`, error);
        const rows = await getPlanning(undefined, monthKey, 'DAILY', user);
        return rows.filter(p => p.status === 'approved');
    }
};

/**
 * Planejamento aprovado com horas nos meses de calendário informados.
 * Busca os meses em paralelo e compartilha o resultado entre as telas por
 * alguns segundos, para a Visão Geral e a Análise não repetirem a mesma consulta.
 */
export const getApprovedPlanning = (monthKeys: string[], user?: UserProfile): Promise<PlanningRecord[]> => {
    const keys = normalizeMonthKeys(monthKeys).sort();
    const cacheKey = `${user?.id || user?.email || 'anon'}|${JSON.stringify(user?.scope || null)}|${keys.join(',')}`;
    const cached = approvedPlanningInFlight.get(cacheKey);
    if (cached && Date.now() - cached.at < APPROVED_PLANNING_TTL_MS) return cached.promise;

    const promise = Promise.all(keys.map(monthKey => loadApprovedPlanningMonth(monthKey, user)))
        .then(chunks => {
            const dedup = new Map<string, PlanningRecord>();
            chunks.flat().forEach(p => {
                if ((Number(p.plannedHours) || 0) > 0) dedup.set(p.id || planningCacheKey(p), p);
            });
            return Array.from(dedup.values());
        });

    approvedPlanningInFlight.set(cacheKey, { at: Date.now(), promise });
    promise.catch(() => approvedPlanningInFlight.delete(cacheKey));
    return promise;
};

/** Invalida o compartilhamento após aprovar/devolver, para as telas recarregarem. */
const invalidateApprovedPlanning = () => approvedPlanningInFlight.clear();

// --- LEGACY SYNC GETTERS ---
export const getBudgetsSync = (): BudgetRecord[] => {
    try {
        const data = localStorage.getItem('department_budgets_v2');
        if (data) return (JSON.parse(data) || []) as BudgetRecord[];
    } catch (e) {
        console.error("Error reading local budgets:", e);
    }
    return [];
};

export const getSalariesSync = (monthKeys?: string | string[]): SalaryAllocation[] => {
    const keys = normalizeMonthKeys(monthKeys);
    const all = readSalaryCache();
    if (keys.length === 0) return all;

    const keySet = new Set(keys);
    return all.filter(s => keySet.has(s.monthKey));
};

// --- GLOBAL EMPLOYEES (DICTIONARY) ---

const GLOBAL_EMP_CACHE_KEY = 'hc_global_employees_v1';

export const saveGlobalEmployees = async (employees: import('../types').GlobalEmployee[], user: UserProfile) => {
    try {
        if (isOnline()) {
            await FirestoreService.upsertGlobalEmployees(employees, user);
        }

        // Update local cache
        const current = getGlobalEmployeesSync();
        const empMap = new Map(current.map(e => [e.chapa, e]));
        employees.forEach(e => empMap.set(e.chapa, e));
        localStorage.setItem(GLOBAL_EMP_CACHE_KEY, JSON.stringify(Array.from(empMap.values())));
    } catch (e) {
        console.error("Save Global Employees Failed:", e);
        const current = getGlobalEmployeesSync();
        const empMap = new Map(current.map(e => [e.chapa, e]));
        employees.forEach(e => empMap.set(e.chapa, e));
        localStorage.setItem(GLOBAL_EMP_CACHE_KEY, JSON.stringify(Array.from(empMap.values())));
    }
};

export const getGlobalEmployeesSync = (): import('../types').GlobalEmployee[] => {
    try {
        const data = localStorage.getItem(GLOBAL_EMP_CACHE_KEY);
        if (data) return (JSON.parse(data) || []) as import('../types').GlobalEmployee[];
    } catch (e) {
        console.error("Error reading local global employees:", e);
    }
    return [];
};

export const getGlobalEmployeesAsync = async (user?: UserProfile): Promise<import('../types').GlobalEmployee[]> => {
    try {
        if (isOnline()) {
            const rows = await FirestoreService.getGlobalEmployees(user?.scope);
            localStorage.setItem(GLOBAL_EMP_CACHE_KEY, JSON.stringify(rows));
            return rows;
        }
        throw new Error("Offline");
    } catch (error) {
        return getGlobalEmployeesSync();
    }
};

// --- HEADCOUNT ---

const HC_CACHE_KEY = 'hc_headcount_v1';

/** Leitura síncrona do cache local de headcount. */
export const getHeadcountSync = (): HeadcountRecord[] => {
    try {
        const data = localStorage.getItem(HC_CACHE_KEY);
        if (data) return (JSON.parse(data) || []) as HeadcountRecord[];
    } catch (e) {
        console.error('Error reading local headcount cache:', e);
    }
    return [];
};

/** Remove o cache local de headcount. Não altera o Firestore. */
export const clearHeadcountCache = (): void => {
    try {
        localStorage.removeItem(HC_CACHE_KEY);
    } catch (e) {
        console.error('Error clearing local headcount cache:', e);
    }
};

/**
 * Persiste registros de headcount no Firestore e atualiza o cache local.
 * Segue o mesmo padrão de saveBudgets/saveSalaries.
 */
export const saveHeadcount = async (
    records: HeadcountRecord[],
    meta: HeadcountUploadMeta,
    user: UserProfile
): Promise<void> => {
    try {
        if (isOnline()) {
            await FirestoreService.upsertHeadcountRecords(records, meta, user);
        } else {
            console.warn('Offline: headcount salvo somente no cache local.');
        }
        // Cache local: merge por uploadId para evitar duplicatas
        const current = getHeadcountSync() as Array<HeadcountRecord & { _uploadId?: string }>;
        const merged = current.filter(r => r._uploadId !== meta.uploadId);
        const tagged = records.map(r => ({ ...r, _uploadId: meta.uploadId }));
        localStorage.setItem(HC_CACHE_KEY, JSON.stringify([...merged, ...tagged]));
    } catch (e) {
        console.error('Save Headcount Failed:', e);
        // Fallback ao cache local
        const current = getHeadcountSync() as Array<HeadcountRecord & { _uploadId?: string }>;
        const merged = current.filter(r => r._uploadId !== meta.uploadId);
        const tagged = records.map(r => ({ ...r, _uploadId: meta.uploadId }));
        localStorage.setItem(HC_CACHE_KEY, JSON.stringify([...merged, ...tagged]));
        throw e;
    }
};

/**
 * Busca registros de headcount do Firestore com fallback ao cache local.
 * Se dateRef for fornecido, retorna apenas os vigentes naquela data.
 */
export const getHeadcount = async (dateRef?: string, user?: UserProfile): Promise<HeadcountRecord[]> => {
    try {
        if (isOnline()) {
            const rows = await FirestoreService.getHeadcountRecords(dateRef, user?.scope);
            localStorage.setItem(HC_CACHE_KEY, JSON.stringify(rows));
            return rows;
        }
        throw new Error('Offline');
    } catch (error) {
        console.warn('Headcount: usando cache local', error);
        const all = getHeadcountSync();
        if (!dateRef) return all;
        return all.filter(r => r.dataInicio <= dateRef && r.dataFim >= dateRef);
    }
};

// --- HEADCOUNT (REPLACE MODE) ---

/**
 * Substitui COMPLETAMENTE o headcount no Firestore e no cache local.
 *
 * Firestore: chama replaceHeadcountRecords (delete-all -> insert-new -> audit).
 * Cache local: sobrescreve completamente o localStorage sem merge.
 *
 * Use esta funcao em vez de saveHeadcount para todos os fluxos de upload confirmado.
 */
export const replaceHeadcount = async (
    records: HeadcountRecord[],
    meta: HeadcountUploadMeta,
    user: UserProfile
): Promise<void> => {
    if (isOnline()) {
        await FirestoreService.replaceHeadcountRecords(records, meta, user);
    } else {
        console.warn('Offline: headcount substituido somente no cache local.');
    }

    // Substituicao completa do cache local (sem merge)
    const tagged = records.map(r => ({ ...r, _uploadId: meta.uploadId }));
    localStorage.setItem(HC_CACHE_KEY, JSON.stringify(tagged));

    // Salários passam a ter fonte única: upload de headcount com coluna `salario`.
    // Só as competências que o arquivo traz são substituídas; as anteriores
    // (ex.: julho, quando o upload é de setembro) são preservadas.
    const salaryAllocations = buildSalaryAllocationsFromHeadcount(records);
    const replaceMonthKeys = getSalaryCompetenciesToReplace(salaryAllocations);
    if (replaceMonthKeys.length > 0) {
        await saveSalaries(salaryAllocations, user, { replaceMonthKeys });
    }
};

/**
 * Busca todos os registros de planejamento diretamente do Firestore (requer estar online).
 */
export const getAllPlanningRecordsFromFirestore = async (): Promise<any[]> => {
    if (isOnline()) {
        return await FirestoreService.getAllPlanningRecordsFromFirestore();
    }
    throw new Error("Offline: Não é possível buscar registros do Firestore.");
};

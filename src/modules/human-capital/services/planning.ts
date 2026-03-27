
import { PlanningRecord, BudgetRecord, SalaryAllocation, UserProfile, HeadcountRecord, HeadcountUploadMeta } from '../types';
import * as FirestoreService from './firestoreCH';
import { getPayrollCompetencyMonthKey, getPayrollCompetencyMonthKeysForRange } from '../utils/overtime';

// Cache in-memory to avoid excessive reads during session if needed, 
// though we primarily trust Firestore or fallback to localStorage.
let planningCache: PlanningRecord[] = [];

// Helper to check if online (rudimentary)
const isOnline = () => navigator.onLine;

const SALARY_CACHE_KEY = 'employee_salaries_v2';

const normalizeMonthKeys = (monthKeys?: string | string[]): string[] => {
    if (!monthKeys) return [];
    const keys = Array.isArray(monthKeys) ? monthKeys : [monthKeys];
    return Array.from(new Set(keys.filter(Boolean)));
};

const getSalaryAllocationId = (salary: SalaryAllocation): string =>
    `${salary.monthKey}__${salary.chapa}__${salary.costCenter}`;

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

const buildSalaryAllocationsFromHeadcount = (records: HeadcountRecord[]): SalaryAllocation[] => {
    const allocations = new Map<string, SalaryAllocation>();

    records.forEach(record => {
        if (!record.salario || record.salario <= 0) return;

        // Salário do headcount deve cair em uma única competência de folha.
        // A referência mais estável para isso é a data final da vigência do lote.
        const monthKey =
            getPayrollCompetencyMonthKey(record.dataFim) ||
            getPayrollCompetencyMonthKey(record.dataInicio) ||
            record.dataFim.substring(0, 7) ||
            record.dataInicio.substring(0, 7);

        if (!monthKey) return;

        const allocation: SalaryAllocation = {
            monthKey,
            chapa: record.chapa,
            salary: record.salario!,
            allocation: record.distribuicao || 1,
            costCenter: record.centroCusto,
            status: 'A'
        };

        allocations.set(getSalaryAllocationId(allocation), allocation);
    });

    return Array.from(allocations.values());
};

const getSalaryReplaceMonthKeysFromHeadcount = (records: HeadcountRecord[]): string[] => {
    const keys = new Set<string>();

    records.forEach(record => {
        getPayrollCompetencyMonthKeysForRange(record.dataInicio, record.dataFim)
            .forEach(monthKey => keys.add(monthKey));

        [
            getPayrollCompetencyMonthKey(record.dataInicio),
            getPayrollCompetencyMonthKey(record.dataFim),
            record.dataInicio?.substring(0, 7),
            record.dataFim?.substring(0, 7)
        ]
            .filter(Boolean)
            .forEach(monthKey => keys.add(monthKey as string));
    });

    return Array.from(keys);
};

// --- PLANNING ---

export const savePlanning = async (plans: PlanningRecord[], user: UserProfile): Promise<void> => {
    try {
        if (isOnline()) {
            await FirestoreService.upsertPlanningRecords(plans, user);
        } else {
            console.warn("Offline: Saving planning to local cache only.");
        }

        // Also update local cache/storage for fallback
        updateLocalPlanningCache(plans);
    } catch (error) {
        console.error("Save Planning Failed:", error);
        updateLocalPlanningCache(plans); // Fallback
    }
};

const updateLocalPlanningCache = (plans: PlanningRecord[]) => {
    if (planningCache.length === 0) {
        try {
            const data = localStorage.getItem('hc_planning_records_v2');
            if (data) planningCache = JSON.parse(data) || [];
        } catch (e) {
            console.error("Erro ao hidratar cache:", e);
        }
    }
    // Merge into local cache
    plans.forEach(plan => {
        const index = planningCache.findIndex(
            p => p.chapa === plan.chapa && p.date === plan.date && p.type === plan.type && p.costCenter === plan.costCenter
        );
        if (index >= 0) {
            planningCache[index] = plan;
        } else {
            planningCache.push(plan);
        }
    });
    // Persist to localStorage for offline survival
    localStorage.setItem('hc_planning_records_v2', JSON.stringify(planningCache));
};

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
            const data = localStorage.getItem('hc_planning_records_v2');
            if (data) {
                planningCache = JSON.parse(data);
                // Filter locally
                records = planningCache.filter(p => {
                    const pMonth = p.date.substring(0, 7);
                    return pMonth === monthKey && p.type === type;
                });
            }
        }

        // Apply Cost Center filter if specific CC requested (on top of scope)
        if (costCenter) {
            records = records.filter(p => p.costCenter === costCenter);
        }

        return records;

    } catch (error) {
        console.error("Get Planning Failed (using fallback):", error);
        // Fallback
        const data = localStorage.getItem('hc_planning_records_v2');
        if (data) {
            const all = JSON.parse(data) as PlanningRecord[];
            return all.filter(p => {
                const pMonth = p.date.substring(0, 7);
                return pMonth === monthKey && p.type === type && (!costCenter || p.costCenter === costCenter);
            });
        }
        return [];
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
        return readSalaryCache().filter(s => s.monthKey === monthKey);
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
        return readSalaryCache().filter(s => keySet.has(s.monthKey));
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
            return all.filter(b => b.monthKey === monthKey);
        }
        return [];
    }
};

export const getAllBudgetsAsync = async (): Promise<BudgetRecord[]> => {
    try {
        if (isOnline()) {
            const rows = await FirestoreService.getAllBudgets();
            localStorage.setItem('department_budgets_v2', JSON.stringify(rows));
            return rows;
        }
        throw new Error('Offline');
    } catch {
        const data = localStorage.getItem('department_budgets_v2');
        return data ? (JSON.parse(data) as BudgetRecord[]) : [];
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
// Add this to satisfy Dashboard.tsx imports until refactor
// --- LEGACY SUPPORT ---
// Fix: removed async to prevent 'forEach is not a function' crash in legacy Dashboard
// --- LEGACY SUPPORT ---
// Fix: removed async to prevent 'forEach is not a function' crash in legacy Dashboard
export const getAllPlanningRecords = (): PlanningRecord[] => {
    try {
        const data = localStorage.getItem('hc_planning_records_v2');
        if (data) {
            // FIX: Ensure we never return null if parse result is null (which happens for string "null")
            return (JSON.parse(data) || []) as PlanningRecord[];
        }
    } catch (error) {
        console.error("Error reading local planning records:", error);
    }
    return [];
};

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

export const getGlobalEmployeesAsync = async (): Promise<import('../types').GlobalEmployee[]> => {
    try {
        if (isOnline()) {
            const rows = await FirestoreService.getGlobalEmployees();
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
export const getHeadcount = async (dateRef?: string): Promise<HeadcountRecord[]> => {
    try {
        if (isOnline()) {
            const rows = await FirestoreService.getHeadcountRecords(dateRef);
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
    const salaryAllocations = buildSalaryAllocationsFromHeadcount(records);
    const replaceMonthKeys = getSalaryReplaceMonthKeysFromHeadcount(records);
    if (replaceMonthKeys.length > 0) {
        await saveSalaries(salaryAllocations, user, { replaceMonthKeys });
    }
};

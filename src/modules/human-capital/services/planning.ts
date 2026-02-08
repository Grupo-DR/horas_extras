
import { PlanningRecord, SalaryRecord, BudgetRecord, SalaryAllocation, UserProfile } from '../types';
import * as FirestoreService from './firestoreCH';
import { Scope } from '../../iam/types';

// Cache in-memory to avoid excessive reads during session if needed, 
// though we primarily trust Firestore or fallback to localStorage.
let planningCache: PlanningRecord[] = [];

// Helper to check if online (rudimentary)
const isOnline = () => navigator.onLine;

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

export const saveSalaries = async (salaries: SalaryAllocation[], user: UserProfile) => {
    try {
        if (isOnline()) {
            await FirestoreService.upsertSalaryAllocations(salaries, user);
        }
        localStorage.setItem('employee_salaries_v2', JSON.stringify(salaries));
    } catch (e) {
        console.error("Save Salaries Failed:", e);
        localStorage.setItem('employee_salaries_v2', JSON.stringify(salaries));
    }
};

export const getSalaries = async (monthKey: string, user?: UserProfile): Promise<SalaryAllocation[]> => {
    // Guard: Require monthKey
    if (!monthKey) return [];

    try {
        if (isOnline()) {
            const rows = await FirestoreService.getSalaryAllocationsByMonthKey(monthKey, user?.scope);
            localStorage.setItem('employee_salaries_v2', JSON.stringify(rows));
            return rows;
        }
        throw new Error("Offline");
    } catch (error) {
        console.warn("Fetching salaries from Firestore failed or offline, checking local cache", error);
        const data = localStorage.getItem('employee_salaries_v2');
        if (data) {
            const all = JSON.parse(data) as SalaryAllocation[];
            return all.filter(s => s.monthKey === monthKey);
        }
        return [];
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
    // Guard: Require monthKey
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

export const getSalariesSync = (): SalaryAllocation[] => {
    try {
        const data = localStorage.getItem('employee_salaries_v2');
        if (data) return (JSON.parse(data) || []) as SalaryAllocation[];
    } catch (e) {
        console.error("Error reading local salaries:", e);
    }
    return [];
};


import { PlanningRecord, SalaryRecord, BudgetRecord } from '../types';

const KEY = 'hc_planning_records';

const loadStore = (): PlanningRecord[] => {
    try {
        const data = localStorage.getItem(KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error loading planning store', e);
        return [];
    }
};

const saveStore = (records: PlanningRecord[]) => {
    localStorage.setItem(KEY, JSON.stringify(records));
};

export const savePlanning = async (plans: PlanningRecord[]): Promise<void> => {
    const store = loadStore();
    plans.forEach(plan => {
        const index = store.findIndex(
            p => p.chapa === plan.chapa && p.date === plan.date && p.type === plan.type
        );

        if (index >= 0) {
            store[index] = plan;
        } else {
            store.push(plan);
        }
    });
    saveStore(store);
};

export const getAllPlanningRecords = (): PlanningRecord[] => {
    return loadStore();
};

export const getPlanning = async (
    costCenter: string | undefined,
    month: string, // YYYY-MM
    type: 'DAILY' | 'MONTHLY'
): Promise<PlanningRecord[]> => {
    const store = loadStore();
    return store.filter(p => {
        const matchType = p.type === type;
        const matchDate = p.date.startsWith(month);
        const matchCC = costCenter ? p.costCenter === costCenter : true;
        return matchType && matchDate && matchCC;
    });
};

// Salary Management
export const saveSalaries = (salaries: SalaryRecord[]) => {
    localStorage.setItem('employee_salaries', JSON.stringify(salaries));
};

export const getSalaries = (): SalaryRecord[] => {
    const data = localStorage.getItem('employee_salaries');
    return data ? JSON.parse(data) : [];
};

// Budget Management
export const saveBudgets = (budgets: BudgetRecord[]) => {
    localStorage.setItem('department_budgets', JSON.stringify(budgets));
};

export const getBudgets = (): BudgetRecord[] => {
    const data = localStorage.getItem('department_budgets');
    return data ? JSON.parse(data) : [];
};

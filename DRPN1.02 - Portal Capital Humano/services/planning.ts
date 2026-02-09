
import { PlanningRecord, SalaryRecord, BudgetRecord } from '../types';

// In-memory store for demo purposes. 
// In a real app this would be in a DB, but we use a local variable here.
let planningStore: PlanningRecord[] = [];

export const savePlanning = async (plans: PlanningRecord[]): Promise<void> => {
  plans.forEach(plan => {
    const index = planningStore.findIndex(
      p => p.chapa === plan.chapa && p.date === plan.date && p.type === plan.type
    );

    if (index >= 0) {
      planningStore[index] = plan;
    } else {
      planningStore.push(plan);
    }
  });
};

export const getAllPlanningRecords = (): PlanningRecord[] => {
  return [...planningStore];
};

export const getPlanning = async (
  costCenter: string | undefined,
  month: string, // YYYY-MM
  type: 'DAILY' | 'MONTHLY'
): Promise<PlanningRecord[]> => {
  return planningStore.filter(p => {
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

// Manual Employee Management


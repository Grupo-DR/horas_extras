
export interface OvertimeRecord {
  CHAPA: string;
  NOME: string;
  FUNCAO: string;
  DATA: string;
  CODCCUSTO: string;
  SECAO: string;
  EVENTO: string;
  HORAS: number;
  VALOR: number;
}

export interface ApiConfig {
  url: string;
  username: string;
  password?: string;
  startDate: string;
  endDate: string;
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface DashboardMetrics {
  totalSum: number;
  total60: number;
  total100: number;
  percent60: number;
  percent100: number;
  averageTotal: number;
  topDepartment: string;
  employeeCount: number;
}

export type UserRole = 'DEV_MASTER' | 'MASTER' | 'LEVEL_A_01' | 'LEVEL_B_01' | 'LEVEL_C_01';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  chapa?: string;
  costCenter?: string;
  avatar?: string;
}

export interface PlanningRecord {
  id: string;
  chapa: string;
  nome: string;
  costCenter: string;
  date: string;
  type: 'DAILY' | 'MONTHLY';
  plannedHours: number;
}

export interface SalaryRecord {
  chapa: string;
  salary: number;
}

export interface BudgetRecord {
  month: string; // "Janeiro", "Fevereiro", etc.
  costCenter: string;
  value: number;
}




import { CHRole, Scope } from '../iam/types';

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

export type UserRole = CHRole;

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    scope?: Scope;
    chapa?: string;
    costCenter?: string;
    avatar?: string;
    isSuperAdmin?: boolean;
}

export interface PlanningRecord {
    id: string;
    chapa: string;
    nome: string;
    costCenter: string;
    date: string;
    type: 'DAILY' | 'MONTHLY';
    plannedHours: number;
    status?: 'draft' | 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvedAt?: string;
}

export interface SalaryRecord {
    chapa: string;
    salary: number;
}

export interface SalaryAllocation {
    monthKey: string;      // 'YYYY-MM'
    chapa: string;
    status: string;        // 'A' etc
    costCenter: string;    // CC normalizado
    allocation: number;    // 0..1
    salary: number;        // salário cheio
}

export interface BudgetRecord {
    monthKey: string; // 'YYYY-MM' added
    month: string; // "Janeiro", "Fevereiro", etc.
    costCenter: string;
    value: number;
}

export interface WorkTeam {
    id: string;
    name: string;
    costCenter: string;
    managerName?: string;
    memberChapas?: string[]; // Legado, migrando para TeamAllocation
}

export interface TeamAllocation {
    id: string;
    teamId: string;
    monthKey: string; // 'YYYY-MM'
    chapas: string[];
}

export interface ManualEmployee {
    id: string; // UUID
    chapa: string; // Unique identifier (manual: M-UUID or custom)
    name: string;
    costCenter: string;
    role: string;
    status: 'ACTIVE' | 'INACTIVE';
}

export interface GlobalEmployee {
    chapa: string;
    nome: string;
    funcao: string;
    costCenter: string;
    updatedAt?: string | number | any; // To allow for Firebase Timestamps
}

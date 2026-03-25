
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

// ─── Headcount Upload ────────────────────────────────────────────────────────

/**
 * Uma linha normalizada do Excel de headcount.
 * Representa a alocação de um colaborador em um CC por um período de vigência.
 */
export interface HeadcountRecord {
    /** YYYY-MM-DD */
    dataInicio: string;
    /** YYYY-MM-DD */
    dataFim: string;
    chapa: string;
    centroCusto: string;
    /** Percentual de alocação: 0 < distribuicao ≤ 1 */
    distribuicao: number;
    /** Opcional: lido do Excel quando a coluna 'nome' estiver presente */
    nome?: string;
    /** Opcional: lido do Excel quando a coluna 'funcao' estiver presente */
    funcao?: string;
    /** Opcional: lido do Excel quando a coluna 'salario' estiver presente */
    salario?: number;
}

/**
 * Categoria do erro para facilitar filtragem na UI.
 * - 'structural': erros de formato/campo da planilha
 * - 'business': violações de regra de negócio (soma ≠ 1 por chapa+dia)
 */
export type HeadcountErrorKind = 'structural' | 'business';

/** Um erro encontrado durante o parse ou validação do headcount. */
export interface HeadcountValidationError {
    kind: HeadcountErrorKind;
    /** Número da linha no Excel (1-based, incluindo cabeçalho), ou undefined para erros globais */
    row?: number;
    /** Chapa envolvida, quando aplicável */
    chapa?: string;
    /** Data envolvida (YYYY-MM-DD), quando aplicável */
    date?: string;
    message: string;
}

/** Status possíveis durante o fluxo de upload */
export type HeadcountUploadStatus = 'idle' | 'parsing' | 'validating' | 'ready' | 'saving' | 'saved' | 'error';

/** Metadados rastreáveis de um upload confirmado */
export interface HeadcountUploadMeta {
    uploadId: string;     // UUID gerado no momento do upload
    uploadedAt: string;   // ISO 8601
    uploadedBy: string;   // email do usuário
    recordCount: number;  // número de registros salvos com sucesso
}

/** Resultado agregado da pipeline parse → normalizar → validar */
export interface HeadcountUploadResult {
    /** Registros que passaram em todas as validações estruturais */
    validRecords: HeadcountRecord[];
    /** Registros que falharam em validação estrutural (mantidos para exibição de erros) */
    invalidRecords: HeadcountRecord[];
    structuralErrors: HeadcountValidationError[];
    businessErrors: HeadcountValidationError[];
    /** Total de linhas de dados lidas do Excel (excluindo cabeçalho) */
    totalRows: number;
    /** Data mais antiga de data_inicio entre os registros válidos */
    periodStart?: string;
    /** Data mais recente de data_fim entre os registros válidos */
    periodEnd?: string;
    /** Chapas únicas com pelo menos um registro válido */
    uniqueChapas: number;
    /** true se não há nenhum erro de negócio (pode haver linhas estruturalmente inválidas) */
    isBusinessValid: boolean;
}

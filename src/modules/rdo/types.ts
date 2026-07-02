export type MainMenu = 'DASHBOARD' | 'PROJECTS' | 'CONTRACT_INTELLIGENCE' | 'PLANNING';

/**
 * Valor de planejamento inserido pelo engenheiro para uma equipe em uma data específica.
 * Esses valores alimentam as colunas "Planejado Mês", "Planejado Período" e "Projetado"
 * no Painel Geral.
 */
export interface DailyPlan {
  id: string;          // UUID — "<projectId>_<teamId>_<date>"
  projectId: string;   // ID da obra (CC)
  teamId: string;      // ID da equipe
  date: string;        // "YYYY-MM-DD"
  value: number;       // Valor planejado em R$
  updatedAt: string;
}

// ─── Contract Data Types ───────────────────────────────────────────────────────

/** Tipos de aditivo contratual */
export type AddendumType = 'TIME' | 'VALUE' | 'TIME_AND_VALUE';

/** Representa um aditivo contratual (prazo, valor ou ambos) */
export interface ContractAddendum {
  id: string;
  type: AddendumType;
  description: string;
  addedDays?: number;    // Dias adicionados (aditivos de tempo)
  addedValue?: number;   // Valor adicional em R$ (aditivos de valor)
  approvedAt: string;    // "YYYY-MM-DD"
  createdAt: string;
}

/** Período customizado de medição (substitui o conceito de mês calendário fixo) */
export interface MonthlyBudgetEntry {
  id: string;        // UUID
  name: string;      // Nome customizado do período (ex: "Medição 01 - Junho")
  startDate: string; // Data inicial "YYYY-MM-DD"
  endDate: string;   // Data final "YYYY-MM-DD"
  monthKey?: string; // Legacy: mantido apenas para migração de dados antigos
  budget: number;
  forecast: number;
  measured: number;
  teamAllocations?: { teamId: string; budgetPct: number; forecastPct: number; budgetValue?: number; forecastValue?: number }[];
}

/** Dados financeiros e contratuais de uma obra */
export interface ContractData {
  projectId: string;
  contractValue: number;         // Valor original do contrato
  contractStartDate: string;     // "YYYY-MM-DD"
  contractEndDate: string;       // "YYYY-MM-DD" — término original
  monthlyEntries: MonthlyBudgetEntry[];
  addenda: ContractAddendum[];
  updatedAt: string;
}


export interface Project {
  id: string;
  name: string;
  location?: string;
  client?: string;
  startDate?: string;
  endDate?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';
  contractValue?: number;
  regional?: string;
  createdAt: string;
  address?: string;
  services: ServiceItem[];
}

export interface ServiceItem {
  code: string;
  scope: string;
  unit: string;
  value: number;
  startDate?: string;
  endDate?: string;
}

export interface Team {
  id: string;
  projectId: string;
  name: string;
  leader?: string;
  membersCount?: number;
  budgetValue?: number;
  forecastValue?: number;
  budgetPct?: number;
  forecastPct?: number;
  createdAt: string;
}

export interface Workforce {
  role: string;
  count: number;
  totalHours?: number;
}

export interface WorkerGroup {
  role: string;
  count: number;
  totalHours?: number;
}

export interface Equipment {
  name: string;
  count: number;
  hoursOperated?: number;
}

export interface Activity {
  description: string;
  status: 'DONE' | 'IN_PROGRESS' | 'PENDING' | string;
  code?: string;
  quantity?: number;
  progress?: number;
}

export interface Occurrence {
  type?: string;
  category?: string;
  description: string;
  impact?: 'LOW' | 'MEDIUM' | 'HIGH';
  impactTimeMinutes?: number;
}

// Typo fallback for older components
export type Occurence = Occurrence;

export interface RDOData {
  id: string;
  projectId?: string;
  teamId: string;
  date: string;
  reportNumber?: string;
  shift?: 'DAY' | 'NIGHT';
  weather?: string;
  weatherMorning?: string;
  weatherAfternoon?: string;
  rainIndexMm?: number;
  workforce: Workforce[];
  equipment: Equipment[];
  activities: Activity[];
  occurrences: Occurrence[];
  notes?: string;
  comments?: string;
  contractNumber?: string;
  processedAt?: string;
  synced?: boolean;
}

// --- Histogram Analysis Types ---

export type HistogramCategory =
  | 'MAO_OBRA_DIRETA'
  | 'MAO_OBRA_INDIRETA'
  | 'EQUIPAMENTOS';

export type HistogramStatus =
  | 'OK'
  | 'ABAIXO'
  | 'ACIMA'
  | 'NAO_PLANEJADO'
  | 'SEM_APONTAMENTO';

export type HistogramSource =
  | 'RDO_GENERATED'
  | 'MANUAL'
  | 'COMMERCIAL_IMPORT';

export type HistogramSourceGroup =
  | 'WORKFORCE'
  | 'EQUIPMENT'
  | 'MANUAL';

export interface HistogramMonthlyPlan {
  monthKey: string;
  monthLabel: string;
  quantity: number;
}

export interface HistogramItem {
  id: string;
  projectId: string;
  category: HistogramCategory;
  sourceGroup?: HistogramSourceGroup;
  name: string;
  normalizedName: string;
  peakQty: number;
  monthlyPlan: HistogramMonthlyPlan[];
  source?: HistogramSource;
}

export interface HistogramAnalysisRow {
  itemName: string;
  normalizedName: string;
  category: HistogramCategory;
  peakQty: number;
  plannedQty: number;
  actualQty: number;
  deviationQty: number;
  deviationPercent: number;
  status: HistogramStatus;
}

export interface HistogramAnalysisSummary {
  totalItems: number;
  okItems: number;
  belowItems: number;
  aboveItems: number;
  notPlannedItems: number;
  missingItems: number;
  adherencePercent: number;
  directLaborAdherencePercent: number;
  indirectLaborAdherencePercent: number;
  equipmentAdherencePercent: number;
}

export enum TaskStatus {
  PENDING = 'PENDING',       // Pendente
  IN_PROGRESS = 'IN_PROGRESS', // Em Andamento
  COMPLETED = 'COMPLETED',   // Concluído
  LATE = 'LATE',             // Atrasado
}

export interface User {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface HelpChainLevel {
  level: number;
  roleName: string; // e.g., "Gerente Comercial", "Diretor"
  contactEmail: string;
  triggerDaysBefore: number; // Days before deadline to trigger
  triggerWhenLate: boolean;  // Trigger when status becomes LATE
}

export interface HistoryLog {
  id: string;
  taskId: string;
  action: string;
  timestamp: Date;
  details?: string;
  user: string;
}

export interface Notification {
  id: string;
  taskId: string;
  taskTitle: string;
  type: 'START' | 'END' | 'LATE_WARNING' | 'ESCALATION';
  recipient: string;
  subject: string;
  content?: string; // Conteúdo gerado pela IA (e-mail draft)
  sentAt: Date;
}

export enum TaskOutcome {
  SUCCESS = 'SUCCESS',       // Sucesso (Vencemos)
  FAILURE = 'FAILURE',       // Insucesso (Perdemos)
  STUDY = 'STUDY',           // Estudo (Análise)
  WITHDRAWAL = 'WITHDRAWAL'  // Desistência
}


// --- OPPORTUNITY & PIPELINE TYPES ---

export enum PipelineStage {
  LEAD_RECEBIDO = 'LEAD_RECEBIDO',
  DECISAO_PARTICIPACAO = 'DECISAO_PARTICIPACAO',
  ORCAMENTO_PREVIO = 'ORCAMENTO_PREVIO',
  MEMORIA_COMPOSICOES = 'MEMORIA_COMPOSICOES',
  PROPOSTA_TECNICA = 'PROPOSTA_TECNICA',
  PROPOSTA_COMERCIAL = 'PROPOSTA_COMERCIAL',
  REVISAO_FINAL = 'REVISAO_FINAL',
  ENVIO_PROPOSTA = 'ENVIO_PROPOSTA',
  AGUARDANDO_RESULTADO = 'AGUARDANDO_RESULTADO',
  RESULTADO = 'RESULTADO'
}

export enum OpportunityStatus {
  ATIVA = 'ATIVA',
  GANHA = 'GANHA',
  PERDIDA = 'PERDIDA',
  CANCELADA = 'CANCELADA'
}

export interface Opportunity {
  id: string;
  title: string;
  clientName: string;
  estimatedValue: number;
  pipelineStage: PipelineStage;
  probability: number; // Represents % Execution now
  status: OpportunityStatus;
  responsibleId: string;
  responsibleName?: string; // NEW: Denormalized for display
  deadline: Date;
  priority?: 'BAIXA' | 'MÉDIA' | 'ALTA'; // NEW: Priority Field
  createdAt: Date;
  updatedAt: Date;

  // Specific Data for Validation Stages (Optional now mainly)
  description?: string;
  scopeSummary?: string;
  decision?: 'GO' | 'NO_GO';
  result?: TaskOutcome; // NEW: Replaces Decision usage in UI
  preliminaryValue?: number;
  technicalAttachments?: string[];
  proposalVersion?: string;
  finalChecklistDone?: boolean;
  submissionDate?: Date;
}

export type ModuleCategory = 'COMERCIAL' | 'CONTRATOS' | 'DADOS' | 'KPI' | 'GERAL';

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  status: TaskStatus;
  startDate: Date;
  endDate: Date;
  observations: string;
  priority: 'BAIXO' | 'MEDIO' | 'ALTO'; // Changed to Portuguese as requested
  category?: string;
  moduleCategory: ModuleCategory; // NEW: Field for robust filtering
  progress: number;

  // Link to Opportunity & Automation
  opportunityId?: string;
  contractId?: string; // NEW: Link to Contract Module
  solutionId?: string; // NEW: Link to Data Solution
  kpiId?: string; // NEW: Link to KPI
  stageAtCreation?: PipelineStage;
  needsDetails?: boolean;
  outcome?: TaskOutcome;

  // Legacy / Compatibility Fields (may be deprecated or mapped)
  parentId?: string;
  value?: number;
  interestScore?: number;
  proposalName?: string;
  clientName?: string;
  responsibleName?: string;
  contactEmail?: string;
  contactPhone?: string;

}

export enum AppModule {
  COMMERCIAL = 'COMMERCIAL',
  CONTRACTS = 'CONTRACTS',
  DATA_CENTER = 'DATA_CENTER',
  KPI = 'KPI'
}

// --- CONTRACT TYPES ---

export enum ContractStatus {
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
  SUSPENDED = 'SUSPENDED'
}

export enum ContractMeasurementEntity {
  RENTAL = 'RENTAL',
  CONSTRUTORA = 'CONSTRUTORA'
}

// --- AUDIT TYPES ---

export interface ScopeAuditItem {
  codeVLI: string; // Código de serviço conforme LC116
  description: string; // Descrição do serviço/item
  prevAccumulated: number; // Valor financeiro acumulado até ao mês anterior
  currentMonth: number; // Valor financeiro da medição atual - "Do Mês"
  totalAccumulated: number; // Soma do anterior com o atual
  plannedContract: number; // Valor total previsto em contrato para aquele item
  balance: number; // Saldo restante por executar no item
}

export interface ContractMeasurement {
  id: string; // Unique ID (e.g. generated or period-based)

  // Temporal
  period: string; // Ex: "01/10/2024 a 31/10/2024"
  date: Date; // Data de referência da medição

  // Contract Metadata
  contractorName: string; // Nome da entidade contratada
  contractNo: string; // Número do contrato para validação

  /**
   * Regra de negócio: Derivado de uma busca parcial (string match) no campo contractorName.
   * Se contém "RENTAL", classificar como tal.
   */
  entityType: 'RENTAL' | 'CONSTRUTORA';

  // Financials
  contractTotalValue: number; // Valor total global do contrato na data da medição
  measurementValue: number; // Valor da medição atual (soma dos currentMonth da auditMatrix)
  contractBalance: number; // Saldo global remanescente do contrato

  // Metadata
  description: string;
  sourceFileName?: string;
  importedAt?: Date;
  confidence?: number;
  warnings?: string[];

  // Detailed Audit
  auditMatrix: ScopeAuditItem[]; // Array contendo o detalhamento de escopo
}

export interface ScopeItem {
  code: string;
  description: string;
  unit: string;
  unitPrice: number;
  totalQuantity: number;
}

export interface Contract {
  id: string;
  name: string;
  siteName: string; // Nome da Obra
  clientName: string;
  totalValue: number;
  startDate: Date;
  endDate: Date;
  measurements: ContractMeasurement[];
  scopeItems?: ScopeItem[]; // Lista Mestra
  adjustments?: { type: 'ADITIVO' | 'REAJUSTE'; date: Date; value: number; newEndDate?: Date }[]; // NEW
  status: ContractStatus;

  // Timestamps for Metadata
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DataSolution {
  id: string;
  name: string;
  stakeholders: string[]; // List of names
  deadline: Date;
  responsibleId: string; // Link to user
  responsibleName?: string; // Display cache
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'TODO' | 'REVIEW';

  description?: string;
  pmcData?: {
    justificativas: string[];
    objetivoSmart: string[];
    beneficios: string[];
    solucao: string[];
    requisitos: string[];
    stakeholders: string[];
    equipe: string[];
    entregas: string[];
    premissas: string[];
    manutencao: string[]; // Grupos de Entrega / Manutenção? User spec: "Entregas, Premissas, Manutenção"
    riscos: string[];
    cronograma: string[];
    custo: string[];
    contractId?: string; // NEW
    startDate?: Date;   // NEW
    endDate?: Date;     // NEW
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface KPIHistory {
  date?: Date; // Deprecated: Kept for backward compatibility if needed, or remove if migration is forced
  referenceDate: Date;
  value: number;
  updatedBy: string;
}

export interface KPI {
  id: string;
  name: string;
  description: string;
  unit: 'R$' | '%' | 'N' | 'BRL'; // Currency, Percentage, Number
  targetValue: number;
  currentValue: number;
  responsibleId: string;
  responsibleName?: string;

  history: KPIHistory[];

  startDate?: Date;
  endDate?: Date;

  updatedAt?: Date;
}
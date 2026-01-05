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
  deadline: Date;
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

export interface ContractMeasurement {
  id: string;
  date: Date;
  value: number;
  description: string;
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
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';

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
  date: Date;
  value: number;
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

  updatedAt?: Date;
}
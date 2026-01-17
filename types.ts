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

export enum ContractEventType {
  ADITIVO_PRAZO = 'ADITIVO_PRAZO',
  ADITIVO_VALOR = 'ADITIVO_VALOR',
  ADITIVO_MISTO = 'ADITIVO_MISTO',
  REAJUSTE = 'REAJUSTE'
}

export interface ContractEvent {
  id: string;
  contractId: string;
  date: Date;
  type: ContractEventType;
  valueDelta: number;
  termDeltaDays: number;
  description: string;
  createdAt: Date;
  createdBy: string;
}

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
  codeVLI: string;
  description: string;
  prevAccumulated: number;
  currentMonth: number;
  totalAccumulated: number;
  plannedContract: number;
  balance: number;
}

export interface ContractMeasurement {
  id?: string;
  date: Date;
  period: string;
  contractor: string;
  entityType: 'RENTAL' | 'CONSTRUTORA';
  value: number; // Valor desta medição
  contractTotalValue: number;
  contractBalance: number;
  auditMatrix: ScopeAuditItem[];
  importedAt: Date;
  status: 'PROCESSADO' | 'PENDENTE_REVISAO';
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
  // Legacy/Active Fields (Primary Source for List Views)
  totalValue: number;
  startDate: Date;
  endDate: Date;

  // Evolution Events Support
  initialValue: number;
  initialEndDate: Date;

  // Current Status (Calculated/Cached)
  currentValue: number;
  currentEndDate: Date;

  measurements: ContractMeasurement[];
  events: ContractEvent[];      // New: Additives & Readjustments
  scopeItems?: ScopeItem[];     // Master List
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

// --- CRM (RELATIONSHIP MANAGEMENT) TYPES ---

export interface Client {
  id: string;
  name: string;
  document?: string; // CNPJ
  industry?: string;
  status: 'ATIVA' | 'INATIVA' | 'PROSPECT'; // Status cadastral simples
  createdAt?: Date;
  updatedAt?: Date;
}

export type InteractionType = 'REUNIAO' | 'LIGACAO' | 'VISITA' | 'EMAIL' | 'WHATSAPP';

export interface UserSummary {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface Interaction {
  id: string;
  clientId: string;
  contactId?: string;
  bidId?: string;
  type: InteractionType;
  title: string;
  date: Date;
  notes: string;
  nextSteps?: string;
  tags?: string[];
  createdBy: UserSummary;
  createdAt: Date;
}

export type ContactProfile = 'CHAVE' | 'OCASIONAL' | 'SILENCIOSA';

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  // Campos calculados no frontend (não persistidos)
  analytics?: {
    profile: ContactProfile;
    lastInteraction: Date | null;
    totalInteractions90d: number;
    daysSinceLastInteraction: number;
  };
}

export interface Bid {
  id: string;
  clientId: string;
  title: string;
  date: Date; // Data do convite/recebimento
  status: 'ABERTA' | 'EM_ANDAMENTO' | 'DECLINADA' | 'PERDIDA' | 'VENCIDA';
  value?: number;
  description?: string;
  opportunityId?: string; // Link para Pipeline
  createdAt?: Date;
}

export interface ClientHealthMetrics {
  score: number;
  status: 'ATIVA' | 'ATENCAO' | 'EM_RISCO' | 'PERDIDA';
  lastInteraction: Date | null;
  lastBid: Date | null;
  silenceDays: number;
  activeContacts90d: number;
  bidTrend: 'CRESCENTE' | 'ESTAVEL' | 'CAINDO' | 'ZEROU';
}
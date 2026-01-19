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

export enum BidStatus {
  PROCESSANDO = 'PROCESSANDO', // Generic active status
  ABERTA = 'ABERTA',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  DECLINADA = 'DECLINADA',
  PERDIDA = 'PERDIDA',
  VENCIDA = 'VENCIDA',
  CANCELADA = 'CANCELADA'
}

// Deprecated alias for backward compatibility until code is fully cleaned
export enum OpportunityStatus {
  ATIVA = 'ATIVA',
  GANHA = 'GANHA',
  PERDIDA = 'PERDIDA',
  CANCELADA = 'CANCELADA'
}

export interface Bid {
  // Core Identifiers
  id: string;
  clientId: string;
  clientName?: string; // Denormalized for lists/legacy support

  // Basic Info
  title: string;
  description?: string;

  // Pipeline & Status
  pipelineStage: PipelineStage;
  status: BidStatus | OpportunityStatus; // Compatibility union
  probability: number;
  priority?: 'BAIXA' | 'MÉDIA' | 'ALTA';

  // Values & Dates
  estimatedValue?: number; // Canonically 'estimatedValue' OR 'value'. Let's stick to estimatedValue as per request 3.4
  value?: number; // Keep for compatibility if needed, but prefer estimatedValue

  date: Date; // Data do convite/entrada
  deadline?: Date; // Prazo limite
  openedAt?: Date; // Same as date usually?
  closedAt?: Date;
  submissionDate?: Date;

  // Relations
  contactId?: string;
  contactName?: string;
  ownerId?: string;
  ownerName?: string;

  // Outcome
  decision?: 'GO' | 'NO_GO';
  result?: TaskOutcome;

  // Details
  scopeSummary?: string;
  preliminaryValue?: number;
  technicalAttachments?: string[];
  proposalVersion?: string;
  finalChecklistDone?: boolean;

  // Meta
  createdAt: Date;
  updatedAt: Date;

  // Legacy fields
  legacyOpportunityId?: string;
  opportunityId?: string; // Also legacy
}

/**
 * @deprecated Use Bid instead. This is a compatibility alias.
 */
export type Opportunity = Bid;

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
  priority: 'BAIXO' | 'MEDIO' | 'ALTO';
  category?: string;
  moduleCategory: ModuleCategory;
  progress: number;

  // Link to Opportunity/Bid & Automation
  opportunityId?: string; // KEEP for compatibility, points to Bid.id
  bidId?: string; // Canonical reference
  contractId?: string;
  solutionId?: string;
  kpiId?: string;
  stageAtCreation?: PipelineStage;
  needsDetails?: boolean;
  outcome?: TaskOutcome;

  // Legacy / Compatibility Fields
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
  stakeholders: string[];
  deadline: Date;
  responsibleId: string;
  responsibleName?: string;
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
    manutencao: string[];
    riscos: string[];
    cronograma: string[];
    custo: string[];
    contractId?: string;
    startDate?: Date;
    endDate?: Date;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface KPIHistory {
  date?: Date;
  referenceDate: Date;
  value: number;
  updatedBy: string;
}

export interface KPI {
  id: string;
  name: string;
  description: string;
  unit: 'R$' | '%' | 'N' | 'BRL';
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
  corporateName: string; // Razão Social
  tradeName: string; // Nome Fantasia
  cnpj: string;
  segment?: string;
  status: 'ATIVA' | 'INATIVA' | 'PROSPECT';

  // Legacy fields to optionally support or map
  name?: string; // Alias for tradeName?
  document?: string; // Alias for CNPJ?
  industry?: string; // Alias for segment?

  createdAt: Date;
  updatedAt: Date;
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

  createdAt: Date;
  updatedAt: Date;

  // Campos calculados no frontend (não persistidos)
  analytics?: {
    profile: ContactProfile;
    lastInteraction: Date | null;
    totalInteractions90d: number;
    daysSinceLastInteraction: number;
  };
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
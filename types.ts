export enum ContractStatus {
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
  SUSPENDED = 'SUSPENDED'
}

export enum AppModule {
  COMMERCIAL = 'COMMERCIAL',
  CONTRACTS = 'CONTRACTS',
  FINANCIAL = 'FINANCIAL',
  SUPPLIERS = 'SUPPLIERS',
  CRM = 'CRM'
}

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

export type EntityType = 'CONSTRUTORA' | 'RENTAL';

// --- STRICT JSON MODELS (Source of Truth) ---

export interface BMItem {
  item: string;
  codigo: string;
  descricao: string;
  unidade: string;
  preco_unitario: number;

  // Quantities
  qtd_contrato: number;
  qtd_anterior: number;
  qtd_mes: number;
  qtd_acumulado: number;

  // Values
  valor_contrato: number; // Planned Contract Value for item?
  valor_anterior: number;
  valor_mes: number;
  valor_acumulado: number;
  saldo: number;
}

export interface ExtractedBM {
  arquivo: string;
  contrato: string;
  contratada: string;
  data_emissao: string;
  periodo: string;
  valor_medicao_cabecalho: number;
  itens: BMItem[];
  total_extraido: number;

  // Optional mappings for UI convenience if needed, but keeping strict first
  type?: 'BM';
}

export interface RDOClimaPeriodo {
  tempo: string;
  condicao: string;
}

export interface RDOMaoDeObra {
  nome: string;
  funcao: string;
  entrada_saida: string;
  intervalo: string;
  horas: string;
}

export interface RDOAtividade {
  descricao: string;
  unidade: string;
  status: string;
}

export interface RDOEquipamento {
  nome: string;
  descricao: string;
  quantidade: number;
  horario: string;
  tempo: string;
}

export interface ExtractedRDO {
  filename: string;
  relatorio: {
    numero: string;
    data: string;
    dia_semana: string;
    contrato: string;
    obra: string;
    prazo_contratual?: string;
    local?: string;
    prazo_decorrido?: string;
    contratante?: string;
    responsavel?: string;
    prazo_a_vencer?: string;
  };
  horario_trabalho: {
    entrada_saida: string;
    horas_trabalhadas: string;
  };
  clima: {
    manha: RDOClimaPeriodo;
    tarde: RDOClimaPeriodo;
  };
  mao_de_obra: RDOMaoDeObra[];
  equipamentos: (string | RDOEquipamento)[];
  atividades: RDOAtividade[];
  ocorrencias: string[];
  comentarios: string[];

  type?: 'RDO';
}

export type ImportedData = ExtractedBM | ExtractedRDO;

// --- DOMAIN MODELS ---

export interface ScopeAuditItem {
  codeVLI: string;
  description: string;
  unit?: string;
  unitPrice?: number;

  // Quantities
  qtyContract?: number;
  qtyPrev?: number;
  qtyMonth?: number;
  qtyAccumulated?: number;

  // Financial
  prevAccumulated: number;
  currentMonth: number;
  totalAccumulated: number;
  plannedContract: number;
  balance: number;
}

export interface ContractMeasurement {
  id: string;
  date: string; // ISO Date of the measurement input
  period: string; // "01/01/2024 a 31/01/2024"
  value: number; // Total Measured Value

  // Details
  contractTotalValue: number; // Snapshot of contract total at this time/item sum
  contractBalance: number;    // Snapshot of balance

  // Structured Data
  auditMatrix?: ScopeAuditItem[];

  // RDO Specifics stored loosely or structured?
  // For now, if we import RDO, we might want to store it here too?
  // Or RDOs are separate events? User said "Nova Medição" -> "Arraste PDF", implies RDO might be a type of Measurement or Support Doc.
  rdoDetails?: ExtractedRDO;

  entityType?: EntityType;
}

export interface ContractTeam {
  id: string;
  name: string; // "Equipe A", "Frente 1"...
  location: string; // "Trecho/Local"
  leaderName: string; // "Líder da Equipe"
  rdos?: ExtractedRDO[]; // RDOs linked to this team
}

export interface Contract {
  id: string;
  contractNumber: string; // Nº do Contrato
  name: string; // Nome (maybe same as SiteName or internal name)
  status: ContractStatus;

  // Parties
  clientName: string; // Contratante
  contractorName: string; // Contratada
  siteName: string; // Nome da Obra

  // Details
  startDate: string;
  endDate: string;
  totalValue: number;
  description?: string;

  measurements?: ContractMeasurement[];
  events?: ContractEvent[];
  teams?: ContractTeam[]; // Teams working on this contract
}

export enum ContractEventType {
  ADITIVO_PRAZO = 'ADITIVO_PRAZO',
  ADITIVO_VALOR = 'ADITIVO_VALOR',
  REAJUSTE = 'REAJUSTE',
  PARALISACAO = 'PARALISACAO'
}

export interface ContractEvent {
  id: string;
  date: string;
  type: ContractEventType;
  description: string;
  valueDelta: number; // R$ change (+ or -)
  termDeltaDays: number; // Days added/removed
}

// --- COMMERCIAL / CRM MODELS ---

export enum BidStatus {
  ABERTA = 'ABERTA',
  PROCESSANDO = 'PROCESSANDO',
  VENCIDA = 'VENCIDA',
  PERDIDA = 'PERDIDA',
  GANHA = 'GANHA'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  LATE = 'LATE'
}

export enum TaskOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  STUDY = 'STUDY',
  WITHDRAWAL = 'WITHDRAWAL'
}

export enum ModuleCategory {
  COMMERCIAL = 'COMMERCIAL',
  CONTRACTS = 'CONTRACTS',
  FINANCIAL = 'FINANCIAL',
  SUPPLIERS = 'SUPPLIERS',
  CRM = 'CRM'
}

export interface HelpChainLevel {
  level: number;
  roleName: string;
  contactEmail: string;
  triggerDaysBefore: number;
  triggerWhenLate: boolean;
}

export interface Bid {
  id: string;
  clientId: string;
  title: string;
  ownerId?: string;
  contactId?: string; // Add contactId link

  // Pipeline & Status
  status: BidStatus;
  pipelineStage: PipelineStage;
  probability: number; // 0-100
  result?: TaskOutcome | 'SUCCESS' | 'FAILURE'; // Explicit result

  // Financials
  estimatedValue: number;
  value?: number; // Alias often used

  // Important Dates
  date: Date; // Data de recebimento REQUIRED
  deadline?: Date; // Prazo
  openedAt?: Date;
  closedAt?: Date;
  submissionDate?: Date;

  createdAt: Date;
  updatedAt: Date;

  // Denormalized/Optional
  clientName?: string;
  ownerName?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  photoURL?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  parentId?: string; // Add legacy ParentId support

  // Links
  opportunityId?: string; // Legacy
  bidId?: string; // Canonical
  interactionId?: string;

  // Denomalized Context
  clientName?: string;
  proposalName?: string;
  responsibleName?: string;
  contactEmail?: string;
  contactPhone?: string;

  contractId?: string;
  solutionId?: string;
  kpiId?: string;

  // Assignment
  assigneeId: string;

  // State
  status: TaskStatus;
  priority: 'BAIXO' | 'MEDIO' | 'ALTO'; // Fixed typo MEDIA -> MEDIO to match form
  category?: string; // Add category

  // Planning
  startDate: Date;
  endDate: Date;

  // Pipeline Link
  stageAtCreation?: PipelineStage;

  // Progress
  needsDetails?: boolean;
  progress: number;
  observations?: string;

  // Outcome
  outcome?: TaskOutcome; // Add outcome

  // Financials
  value?: number;
  interestScore?: number;

  moduleCategory?: string;

  createdAt: Date;
  updatedAt: Date;
}

// --- ADDED MISSING CRM TYPES ---

export enum InteractionType {
  REUNIAO = 'REUNIAO',
  LIGACAO = 'LIGACAO',
  VISITA = 'VISITA',
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP'
}

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  role: string;
  department?: string;
  email?: string;
  phone?: string;
  address?: {
    city?: string;
    state?: string;
  };
  notes?: string;
}

export interface Interaction {
  id: string;
  clientId: string;
  contactId?: string; // Linked contact
  type: InteractionType;
  title?: string;
  date: Date; // Changed to Date object for strict typing
  description: string;
  notes?: string;
  tags?: string[];
  createdBy: {
    id: string;
    name: string;
  };
  participants?: {
    id: string;
    name: string;
  }[];
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

export type ContactProfile = 'OCASIONAL' | 'SILENCIOSA' | 'CHAVE';

export interface Client {
  id: string;
  tradeName: string;
  corporateName?: string;
  cnpj?: string;
  segment?: string;
  clientType?: string;
  origin?: string;
  website?: string;
  primaryEmail?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  metrics?: ClientHealthMetrics; // Optional as it might be computed
}

// --- PROSPECTING MODELS ---

export type ProspectStage = 'MAPEAR_CONTATO' | 'FAZER_CONTATO' | 'ESTABELECER_RELACAO' | 'DIAGNOSTICO' | 'QUALIFICACAO';

export interface Prospect {
  id: string;
  company: string;
  contactName: string;
  contactRole: string;
  stage: ProspectStage;
  location: string;

  // Dates for Time Tracking
  createdAt: Date;       // For Total Time
  stageStartedAt: Date;  // For Time in Stage

  // Responsibility
  owner: {
    name: string;
    initials: string;
    avatarUrl?: string;
  };

  // Activity
  lastContactDate: Date;
  nextAction: string;
  nextActionDate: Date;
  strategicObservation: string;

  // Metadata
  estimatedValue?: number;
  tags?: string[];
}

export interface HistoryLog {
  id: string;
  taskId: string;
  action: string;
  details?: string;
  timestamp: Date;
  user: string;
}

export interface Notification {
  id: string;
  taskId?: string;
  taskTitle?: string;
  type: string;
  recipient: string;
  subject: string;
  sentAt: Date;
  read?: boolean;
}
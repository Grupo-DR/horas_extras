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
  PROPOSTA_TECNICA_COMERCIAL = 'PROPOSTA_TECNICA_COMERCIAL',
  REVISAO_FINAL = 'REVISAO_FINAL',
  ENVIO_PROPOSTA = 'ENVIO_PROPOSTA',
  AGUARDANDO_RESULTADO = 'AGUARDANDO_RESULTADO'
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
  probability: number; // 0-100
  status: OpportunityStatus;
  responsibleId: string;
  deadline: Date; // Converted from Timestamp
  createdAt: Date; // Converted from Timestamp
  updatedAt: Date; // Converted from Timestamp

  // Specific Data for Validation Stages
  description?: string;
  scopeSummary?: string; // Decisão de Participação
  decision?: 'GO' | 'NO_GO'; // Decisão de Participação
  preliminaryValue?: number; // Orçamento Prévio
  technicalAttachments?: string[]; // Memória/Composições - URLs or references
  proposalVersion?: string; // Proposta Técnica/Comercial
  finalChecklistDone?: boolean; // Revisão Final
  submissionDate?: Date; // Envio da Proposta
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
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category?: string;
  progress: number;

  // Link to Opportunity
  opportunityId?: string;

  // Legacy / Compatibility Fields (may be deprecated or mapped)
  parentId?: string;
  value?: number;
  interestScore?: number;
  proposalName?: string;
  clientName?: string;
  responsibleName?: string;
  contactEmail?: string;
  contactPhone?: string;
  outcome?: TaskOutcome;
}
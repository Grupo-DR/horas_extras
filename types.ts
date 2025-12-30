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
  sentAt: Date;
}

export enum TaskOutcome {
  SUCCESS = 'SUCCESS',       // Sucesso (Vencemos)
  FAILURE = 'FAILURE',       // Insucesso (Perdemos)
  STUDY = 'STUDY',           // Estudo (Análise)
  WITHDRAWAL = 'WITHDRAWAL'  // Desistência
}

export interface Task {
  id: string;
  title: string; // Nome da obra/concorrência
  description: string;
  assigneeId: string;
  status: TaskStatus;
  startDate: Date;
  endDate: Date;
  observations: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category?: string; // Nova categoria
  progress: number; // 0-100

  // New Fields for Hierarchy & Details
  parentId?: string; // ID da Ação Mãe (opcional)
  value?: number; // Valor R$
  interestScore?: number; // Nota da Matriz de Interesse

  // Fields for Mother Action (Ação Mãe)
  proposalName?: string; // Nome da Proposta
  clientName?: string; // Nome do Cliente
  responsibleName?: string; // Nome doResponsável (Texto livre ou diferente do assigneeId?)
  contactEmail?: string; // Email do contato
  contactPhone?: string; // Telefone do contato
  outcome?: TaskOutcome; // Resultado da Concorrência
}
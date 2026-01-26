export enum ContractStatus {
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
  SUSPENDED = 'SUSPENDED'
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
  equipamentos: string[];
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

export interface Contract {
  id: string;
  name: string;
  status: ContractStatus;
  clientName: string;
  siteName: string;
  startDate: string;
  endDate: string;
  totalValue: number;
  description?: string;
  measurements?: ContractMeasurement[];
  events?: ContractEvent[];
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
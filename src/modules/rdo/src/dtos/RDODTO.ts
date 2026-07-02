export interface WorkforceDTO {
  funcao?: string;
  role?: string;
  quantidade?: string | number;
  count?: number;
  horas_trabalhadas?: string | number;
  totalHours?: number;
}

export interface EquipmentDTO {
  nome?: string;
  name?: string;
  quantidade?: string | number;
  count?: number;
  horas_operadas?: string | number;
  hoursOperated?: number;
}

export interface ActivityDTO {
  descricao?: string;
  description?: string;
  status?: string;
  codigo?: string;
  code?: string;
  quantidade?: string | number;
  quantity?: number;
  progresso?: string | number;
  progress?: number;
}

export interface OccurrenceDTO {
  tipo?: string;
  type?: string;
  descricao?: string;
  description?: string;
  impacto?: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  impact?: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  tempo_impacto_minutos?: string | number;
  impactTimeMinutes?: number;
}

export interface RDODTO {
  // Spreadsheet / API fields
  id?: string;
  CC?: string | number;
  projectId?: string;
  teamId?: string;
  id_equipe?: string;
  data?: string | number | Date;
  date?: string | number | Date;
  numero_relatorio?: string;
  reportNumber?: string;
  turno?: 'DAY' | 'NIGHT' | string;
  shift?: 'DAY' | 'NIGHT' | string;
  clima?: string;
  weather?: string;
  clima_manha?: string;
  weatherMorning?: string;
  clima_tarde?: string;
  weatherAfternoon?: string;
  indice_chuva_mm?: string | number;
  rainIndexMm?: number;
  mao_de_obra?: WorkforceDTO[];
  workforce?: WorkforceDTO[];
  equipamentos?: EquipmentDTO[];
  equipment?: EquipmentDTO[];
  atividades?: ActivityDTO[];
  activities?: ActivityDTO[];
  ocorrencias?: OccurrenceDTO[];
  occurrences?: OccurrenceDTO[];
  observacoes?: string;
  notes?: string;
  comentarios?: string;
  comments?: string;
  numero_contrato?: string;
  contractNumber?: string;
  processedAt?: string;
  synced?: boolean;
}


export interface ConstructionRecord {
  data: string;
  frota: string;
  trechoFinal: string;
  item: string;
  producao: number;
  codSapRental: string;
  codSapMobra: string;
  operador?: string;
  horaInicio?: string;
  horaTermino?: string;
}

export interface ServicePrice {
  item: string;
  codigo_sap: string | null;
  descricao: string;
  unidade: string;
  preco_unitario: number | null;
  quantidade: number;
  valor_total: number | null;
  category: 'RENTAL' | 'MOBRA';
}

export interface PlannedService {
  item: string;
  producao: number;
}

export interface PlanningAssignment {
  id: string;
  date: string; // ISO format YYYY-MM-DD
  frota: string;
  services: PlannedService[];
}

export interface UploadMetadata {
  id: string;
  workId: string;
  cycleKey: string;
  fileName: string;
  recordCount: number;
  uploadedAt: any; // Firestore Timestamp
}

export interface UploadDetail extends UploadMetadata {
  records?: ConstructionRecord[]; // Optional, may not exist for large uploads
}

export interface TrechoMapping {
  km_inicial: number;
  km_final: number;
  cidade: string;
  trecho: string;
}

export interface SupervisaoMapping {
  trecho: string;
  supervisao: string;
}

export interface LocationInfo {
  cidade: string;
  trecho: string;
  supervisao: string;
}

export type ViewType = 'dashboard' | 'table' | 'upload' | 'services' | 'planning' | 'history' | 'iam';



export interface ServiceItemDTO {
  codigo?: string | number;
  escopo?: string;
  unidade?: string;
  valor?: string | number;
  
  // API/Nexus names
  code?: string;
  scope?: string;
  unit?: string;
  value?: number;
  startDate?: string;
  endDate?: string;
  DATA_INICIO?: string;
  DATA_FIM?: string;
}

export interface ProjectDTO {
  // Spreadsheet / Excel fields
  CC?: string | number;
  REGIONAL?: string;
  CLIENTE?: string;
  NOME?: string;
  NOME_OBRA?: string;
  LOCALIZACAO?: string;
  VALOR_CONTRATO?: string | number;
  DATA_INICIO?: string | number | Date;
  DATA_FIM?: string | number | Date;
  STATUS?: string;
  ENDERECO?: string;
  SERVICOS?: ServiceItemDTO[];

  // API / Portal DR Nexus fields
  id?: string;
  name?: string;
  regional?: string;
  client?: string;
  location?: string;
  contractValue?: number;
  startDate?: string;
  endDate?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | string;
  address?: string;
  services?: ServiceItemDTO[];
  createdAt?: string;
}

export interface ContractAddendumDTO {
  id?: string;
  tipo?: 'TIME' | 'VALUE' | 'TIME_AND_VALUE' | string;
  type?: 'TIME' | 'VALUE' | 'TIME_AND_VALUE' | string;
  descricao?: string;
  description?: string;
  dias_adicionados?: string | number;
  addedDays?: number;
  valor_adicionado?: string | number;
  addedValue?: number;
  data_aprovacao?: string | number | Date;
  approvedAt?: string | number | Date;
  createdAt?: string;
}

export interface MonthlyBudgetEntryDTO {
  id?: string;
  nome_periodo?: string;
  name?: string;
  data_inicio?: string | number | Date;
  startDate?: string | number | Date;
  data_fim?: string | number | Date;
  endDate?: string | number | Date;
  monthKey?: string;
  orcamento?: string | number;
  budget?: number;
  provisao?: string | number;
  forecast?: number;
  medido?: string | number;
  measured?: number;
  alocacoes_equipe?: { teamId: string; budgetPct?: number; forecastPct?: number }[];
  teamAllocations?: { teamId: string; budgetPct: number; forecastPct: number; budgetValue?: number; forecastValue?: number }[];
}

export interface ContractDTO {
  CC?: string | number;
  projectId?: string;
  valor_original?: string | number;
  contractValue?: number;
  data_inicio_contrato?: string | number | Date;
  contractStartDate?: string | number | Date;
  data_fim_contrato?: string | number | Date;
  contractEndDate?: string | number | Date;
  medicoes?: MonthlyBudgetEntryDTO[];
  monthlyEntries?: MonthlyBudgetEntryDTO[];
  aditivos?: ContractAddendumDTO[];
  addenda?: ContractAddendumDTO[];
  updatedAt?: string;
}

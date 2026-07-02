export interface TeamDTO {
  // Spreadsheet / Excel fields
  ID_EQUIPE?: string;
  CC?: string | number;
  NOME_TURMA?: string;
  NOME_EQUIPE?: string;
  LIDER?: string;
  INTEGRANTES?: string | number;
  VALOR_ORCADO?: string | number;
  VALOR_PROJETADO?: string | number;
  PERCENTUAL_ORCADO?: string | number;
  PERCENTUAL_PROJETADO?: string | number;

  // API / Portal DR Nexus fields
  id?: string;
  projectId?: string;
  name?: string;
  leader?: string;
  membersCount?: number;
  budgetValue?: number;
  forecastValue?: number;
  budgetPct?: number;
  forecastPct?: number;
  createdAt?: string;
}

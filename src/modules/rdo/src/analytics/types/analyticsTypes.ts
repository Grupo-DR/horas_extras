/**
 * analyticsTypes.ts
 * Contract Intelligence – tipos TypeScript para o módulo de análise analítica.
 *
 * Estes tipos são compatíveis com as entidades existentes:
 *   Project, Team, RDOData, HistogramItem, ServiceItem (definidas em types.ts)
 *
 * IMPORTANTE: Este arquivo é somente de leitura para o runtime inicial;
 * não altera nenhuma lógica de negócio existente.
 */

// ---------------------------------------------------------------------------
// Re-exportações de referência (sem importação circular)
// ---------------------------------------------------------------------------
// Os tipos abaixo referenciam as interfaces centrais por nome para manter
// rastreabilidade, mas não as importam diretamente para evitar dependências
// circulares nesta fase inicial.

// ---------------------------------------------------------------------------
// 1. AnalyticsProjectContext
// ---------------------------------------------------------------------------
/**
 * Contexto de projeto enriquecido usado como entrada central para
 * todos os motores analíticos do módulo Contract Intelligence.
 * Espelha Project + dados operacionais associados.
 */
export interface AnalyticsProjectContext {
  /** Identificador único do projeto (= Project.id) */
  projectId: string;
  /** Nome legível do projeto (= Project.name) */
  projectName: string;
  /** Data de início prevista (ISO 8601) */
  startDate: string;
  /** Data de término prevista (ISO 8601) */
  endDate: string;
  /** Valor contratual bruto (= Project.contractValue) */
  contractValue?: number;
  /** Status corrente do projeto */
  status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';
  /** Regional responsável */
  regional?: string;
  /** Cliente contratante */
  client?: string;
  /** Período de análise (mês de referência, formato 'YYYY-MM') */
  referencePeriod?: string;
}

// ---------------------------------------------------------------------------
// 2-A. DimensionGroup  (grupos padronizados da planilha de dimensões)
// ---------------------------------------------------------------------------
/**
 * Grupos reconhecidos na planilha de dimensões de obra.
 * Mapeados a partir da coluna "Grupo" com tolerância a variações.
 */
export type DimensionGroup =
  | 'MOD'        // Mão-de-Obra Direta
  | 'MOI'        // Mão-de-Obra Indireta
  | 'EQUIP'      // Equipamentos
  | 'MATERIAL'   // Materiais
  | 'OTHER';     // Não reconhecido

// ---------------------------------------------------------------------------
// 2-B. DimensionPlanMonth  (entrada do plano mensal por item)
// ---------------------------------------------------------------------------
/**
 * Quantidade planejada de um item de dimensão para um mês específico.
 * Derivada das colunas Qtd_Plan_Mes_1..N usando i_start como âncora.
 */
export interface DimensionPlanMonth {
  /** Chave do mês no formato 'YYYY-MM' */
  monthKey: string;
  /** Rótulo legível (ex.: 'Abr/2026') */
  monthLabel: string;
  /** Quantidade planejada para o mês */
  quantity: number;
}

// ---------------------------------------------------------------------------
// 2. DimensionItem  (item completo importado da planilha)
// ---------------------------------------------------------------------------
/**
 * Representa um item de dimensão importado da planilha de obra.
 * Compatível com ServiceItem (code, unit) e HistogramItem (normalizedName).
 */
export interface DimensionItem {
  /** Nome original conforme planilha (coluna Item_Padrao) */
  name: string;
  /** Nome normalizado para matching (uppercase, sem acentos) */
  normalizedName: string;
  /** Equivalência no RDO (coluna Item_RDO), quando informada */
  rdoEquivalent?: string;
  /** Nome normalizado da equivalência RDO */
  rdoEquivalentNormalized?: string;
  /** Grupo/categoria da planilha */
  group: DimensionGroup;
  /** Custo mensal unitário (coluna Custo_Mensal_Unitario) */
  monthlyUnitCost: number;
  /** Flag: item sem custo informado */
  hasMissingCost: boolean;
  /** Flag: item sem grupo informado */
  hasMissingGroup: boolean;
  /** Plano mensal derivado de Qtd_Plan_Mes_1..N + i_start */
  monthlyPlan: DimensionPlanMonth[];
  /** Data de início do recurso no projeto (i_start, ISO 8601 'YYYY-MM-DD') */
  iStart?: string;
  /** Data de fim do recurso no projeto (i_end, ISO 8601 'YYYY-MM-DD') */
  iEnd?: string;
}

// ---------------------------------------------------------------------------
// 2-C. DimensionImportMetadata  (metadados extraídos da planilha)
// ---------------------------------------------------------------------------
/**
 * Metadados da obra extraídos da planilha de dimensões.
 * Campos opcionais — presentes apenas quando a planilha os contém.
 */
export interface DimensionImportMetadata {
  /** Nome ou número do contrato */
  contrato?: string;
  /** Nome do cliente */
  cliente?: string;
  /** Centro de custo da obra */
  centroCusto?: string;
  /** Nome da obra */
  nomeObra?: string;
  /** Valor contratual total */
  valorContratual?: number;
  /** Data de início global da obra (i_start da planilha) */
  iStart?: string;
  /** Data de término global da obra (i_end da planilha) */
  iEnd?: string;
  /** Outros campos não mapeados explicitamente */
  extra?: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// 3. DimensionImportResult
// ---------------------------------------------------------------------------
/**
 * Resultado completo de uma importação de planilha de dimensões.
 * Retornado por parseDimensionsExcel().
 */
export interface DimensionImportResult {
  /** Itens de dimensão importados (incluindo os com advertências) */
  items: DimensionItem[];
  /** Feriados detectados na planilha (formato 'YYYY-MM-DD') */
  holidays: string[];
  /** Metadados da obra extraídos da planilha */
  metadata: DimensionImportMetadata;
  /** Meses detectados no plano (derivados de i_start + colunas Qtd_Plan_Mes_N) */
  months: { monthKey: string; monthLabel: string }[];
  /** Total de linhas de dados processadas */
  totalRows: number;
  /** Total de itens importados com sucesso (sem erros fatais) */
  successCount: number;
  /** Total de linhas descartadas por erro */
  errorCount: number;
  /** Erros fatais (item descartado) */
  errors: string[];
  /** Advertências não-fatais (item mantido, mas sinalizado) */
  warnings: string[];
  /** Timestamp da importação (ISO 8601) */
  importedAt: string;
}

// ---------------------------------------------------------------------------
// 3-A. DimensionStoredRecord  (shape do item DynamoDB Obras_Dimensions)
// ---------------------------------------------------------------------------
/**
 * Shape do item salvo no DynamoDB para uma obra.
 * Chave primária: projectId (String).
 */
export interface DimensionStoredRecord {
  /** Chave primária = Project.id */
  projectId: string;
  /** Discriminador de tipo para uso futuro em tabelas compartilhadas */
  type: 'DIMENSIONS';
  /** Itens de dimensão importados */
  items: DimensionItem[];
  /** Feriados da obra (formato 'YYYY-MM-DD') */
  holidays: string[];
  /** Metadados da obra */
  metadata: DimensionImportMetadata;
  /** Timestamp da última atualização (ISO 8601) */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 4. CompositionItem
// ---------------------------------------------------------------------------
/**
 * Item de composição de custo unitário.
 * Representa um insumo dentro de uma composição analítica de serviço.
 * Compatível com ServiceItem (code, scope, unit, value).
 */
export interface CompositionItem {
  /** Código do insumo na composição */
  code: string;
  /** Descrição do insumo */
  description: string;
  /** Unidade de medida */
  unit: string;
  /** Coeficiente de consumo por unidade do serviço */
  coefficient: number;
  /** Preço unitário do insumo */
  unitPrice: number;
  /** Valor total = coefficient × unitPrice */
  totalPrice: number;
  /** Tipo do insumo */
  inputType: 'MATERIAL' | 'LABOR' | 'EQUIPMENT' | 'OVERHEAD';
  /** Referência externa (SINAPI, SETOP, etc.) */
  externalRef?: string;
}

// ---------------------------------------------------------------------------
// 4-A. ServiceComposition
// ---------------------------------------------------------------------------
/**
 * Composição de um serviço, agregando custo, preço e produtividade.
 */
export interface ServiceComposition {
  /** Código do serviço */
  code: string;
  /** Descrição do serviço */
  description: string;
  /** Unidade de medida */
  unit: string;
  /** Preço unitário (venda) */
  unitPrice: number;
  /** Custo unitário (teórico) */
  unitCost: number;
  /** Produção da equipe (ex: quantidade por hora) */
  teamProduction?: number;
  /** Insumos da composição */
  items: CompositionItem[];
}

// ---------------------------------------------------------------------------
// 5. CompositionImportResult
// ---------------------------------------------------------------------------
/**
 * Resultado de uma importação de composições analíticas.
 */
export interface CompositionImportResult {
  /** Mapa de código do serviço → Composição do serviço */
  compositionsByService: Record<string, ServiceComposition>;
  /** Total de serviços processados */
  totalServices: number;
  /** Total de serviços com composição completa */
  successCount: number;
  /** Total de serviços com composição incompleta ou com erro */
  errorCount: number;
  /** Problemas encontrados */
  issues: ValidationIssue[];
  /** Timestamp da importação (ISO 8601) */
  importedAt: string;
}

// ---------------------------------------------------------------------------
// 6. ContractAnalyticsResult
// ---------------------------------------------------------------------------
/**
 * Resultado consolidado de uma análise contratual.
 * Agrega métricas financeiras, físicas e de conformidade para um projeto.
 */
export interface ContractAnalyticsResult {
  /** Contexto do projeto analisado */
  context: AnalyticsProjectContext;
  /** Percentual físico executado (0–100) */
  physicalProgressPercent: number;
  /** Percentual financeiro executado (0–100) */
  financialProgressPercent: number;
  /** Valor medido acumulado */
  measuredValue: number;
  /** Valor previsto até a data de referência */
  plannedValue: number;
  /** Desvio financeiro (positivo = adiantado, negativo = atrasado) */
  financialDeviation: number;
  /** Índice de desempenho de custo (CPI = medido / planejado) */
  cpi?: number;
  /** Índice de desempenho de prazo (SPI = progresso real / progresso planejado) */
  spi?: number;
  /** Problemas de conformidade identificados */
  validationIssues: ValidationIssue[];
  /** Data de geração do resultado (ISO 8601) */
  generatedAt: string;
  /** Versão do algoritmo de análise */
  engineVersion: string;
}

// ---------------------------------------------------------------------------
// 7. ValidationIssue
// ---------------------------------------------------------------------------
/**
 * Problema de validação encontrado durante importação ou análise.
 */
export interface ValidationIssue {
  /** Identificador do campo ou entidade com problema */
  field: string;
  /** Código de erro padronizado */
  code: string;
  /** Mensagem legível descrevendo o problema */
  message: string;
  /** Severidade do problema */
  severity: 'ERROR' | 'WARNING' | 'INFO';
  /** Linha de origem (quando aplicável, ex.: importação de Excel) */
  sourceLine?: number;
  /** Valor que causou o problema */
  offendingValue?: string | number;
}

// ---------------------------------------------------------------------------
// 8. MonthlyResourceFact
// ---------------------------------------------------------------------------
/**
 * Fato de recurso mensal: registra a quantidade real de um recurso
 * (mão-de-obra ou equipamento) utilizada em determinado mês.
 * Compatível com HistogramItem.monthlyPlan e dados de RDOData.
 */
export interface MonthlyResourceFact {
  /** ID do projeto */
  projectId: string;
  /** Mês de referência (formato 'YYYY-MM') */
  monthKey: string;
  /** Rótulo legível do mês (ex.: 'Jan/2025') */
  monthLabel: string;
  /** Nome normalizado do recurso (= HistogramItem.normalizedName) */
  resourceNormalizedName: string;
  /** Categoria do recurso */
  resourceCategory: 'MAO_OBRA_DIRETA' | 'MAO_OBRA_INDIRETA' | 'EQUIPAMENTOS';
  /** Quantidade planejada no histograma */
  plannedQuantity: number;
  /** Quantidade real apontada nos RDOs */
  actualQuantity: number;
  /** Desvio = actual − planned */
  deviation: number;
  /** Percentual de desvio */
  deviationPercent: number;
}

// ---------------------------------------------------------------------------
// 9. MeasurementFact
// ---------------------------------------------------------------------------

export type MeasurementStatus =
  | 'ENCONTRADA_COMPOSICAO'
  | 'SEM_COMPOSICAO'
  | 'EQUIVALENCIA_NOME'
  | 'PRECO_SERVICES_FALLBACK'
  | 'UNIDADE_DIVERGENTE';

/**
 * Fato de medição: representa uma atividade executada (RDO) valorada contratualmente.
 */
export interface MeasurementFact {
  /** ID do projeto */
  projectId: string;
  /** Data da execução (do RDO) */
  date: string;
  /** ID do RDO de origem */
  rdoId: string;
  /** ID da equipe que executou */
  teamId: string;
  /** Código da atividade */
  activityCode: string;
  /** Nome oficial do serviço (da composição ou tabela de preços) */
  activityName?: string;
  /** Descrição da atividade (relato do RDO) */
  activityDescription: string;
  /** Unidade de medida */
  unit: string;
  /** Quantidade executada */
  quantity: number;
  /** Preço unitário (venda) */
  unitPrice: number;
  /** Custo unitário (teórico) */
  unitCost: number;
  /** Valor financeiro executado (quantity × unitPrice) */
  measuredValue: number;
  /** Custo teórico total (quantity × unitCost) */
  theoreticalCost: number;
  /** Margem absoluta (measuredValue - theoreticalCost) */
  margin: number;
  /** Margem percentual (margin / measuredValue) */
  marginPercent: number;
  /** Status do casamento com composição */
  status: MeasurementStatus;
}

// ---------------------------------------------------------------------------
// 10. ProductivityFact
// ---------------------------------------------------------------------------

export type ProductivityStatus =
  | 'ACIMA_COMPOSICAO'
  | 'CONFORME_COMPOSICAO'
  | 'ABAIXO_COMPOSICAO'
  | 'SEM_PRODUCAO'
  | 'SEM_BASE';

/**
 * Fato de produtividade: compara produção real vs esperada por atividade.
 */
export interface ProductivityFact {
  /** ID do projeto */
  projectId: string;
  /** Data da execução (do RDO) */
  date: string;
  /** ID da equipe que executou */
  teamId: string;
  /** Código do serviço / atividade */
  activityCode: string;
  /** Descrição da atividade */
  activityDescription: string;
  /** Horas trabalhadas (baseadas no RDO) */
  workedHours: number;
  /** Produção esperada (workedHours × teamProduction) */
  expectedProduction: number;
  /** Produção real apontada */
  actualProduction: number;
  /** Unidade de medida */
  unit: string;
  /** Desvio de produção (actual - expected) */
  productionDeviation: number;
  /** Aderência (actual / expected) */
  adherence: number;
  /** Produtividade real por hora (actual / workedHours) */
  actualProductivityPerHour: number;
  /** Status da aderência */
  status: ProductivityStatus;
}

// ---------------------------------------------------------------------------
// 11. OccurrenceFact
// ---------------------------------------------------------------------------

export type OccurrenceCategory = string;

export type OccurrenceResponsibility =
  | 'CONTRATANTE_OPERACAO'
  | 'CONTRATADA'
  | 'INDETERMINADA'
  | 'CALENDARIO';

export type OccurrenceEligibility =
  | 'POTENCIAL_PLEITO'
  | 'RISCO_CONTRATADA'
  | 'REQUER_ANALISE'
  | 'NAO_ELEGIVEL';

export type OccurrenceStatus =
  | 'DURACAO_CALCULADA'
  | 'SEM_DURACAO_EXPLICITA';

/**
 * Fato de ocorrência: detalha uma ocorrência diária do RDO com classificação contratual.
 */
export interface OccurrenceFact {
  projectId: string;
  rdoId: string;
  occurrenceIndex: number;
  date: string;
  teamId: string;
  description: string;
  category: OccurrenceCategory;
  responsibility: OccurrenceResponsibility;
  eligibility: OccurrenceEligibility;
  impactMinutes: number;
  impactHours: number;
  status: OccurrenceStatus;
}

// ---------------------------------------------------------------------------
// 12. IdlenessFact
// ---------------------------------------------------------------------------
/**
 * Fato de ociosidade: registra o cálculo preliminar de custo improdutivo
 * associado a uma ocorrência de potencial pleito.
 */
export interface IdlenessFact {
  projectId: string;
  rdoId: string;
  date: string;
  teamId: string;
  occurrenceDescription: string;
  impactHours: number;
  workforceCount: number;
  equipmentCount: number;
  workforceValue: number;
  equipmentValue: number;
  totalValue: number;
  calculationMethod: 'CONSERVADOR_BASE_RDO' | 'PRECISO';
}

// ---------------------------------------------------------------------------
// 13. PowerBIModel
// ---------------------------------------------------------------------------
/**
 * Modelo de exportação para Power BI via tabela estrela simplificada.
 * Agrega todos os fatos em um único objeto pronto para serialização
 * como arquivo JSON ou para geração de Excel multi-abas.
 */
export interface PowerBIModel {
  /** Metadados do modelo */
  metadata: {
    /** ID do projeto */
    projectId: string;
    /** Nome do projeto */
    projectName: string;
    /** Data de geração do modelo (ISO 8601) */
    generatedAt: string;
    /** Período coberto – início (YYYY-MM) */
    periodStart: string;
    /** Período coberto – fim (YYYY-MM) */
    periodEnd: string;
    /** Versão do modelo de exportação */
    modelVersion: string;
  };
  /** Tabela de dimensões de insumos/serviços */
  dimItems: DimensionItem[];
  /** Tabela de fatos de recursos mensais (histograma) */
  factMonthlyResources: MonthlyResourceFact[];
  /** Tabela de fatos de medição */
  factMeasurements: MeasurementFact[];
  /** Tabela de fatos de produtividade */
  factProductivity: ProductivityFact[];
  /** Tabela de fatos de ocorrências */
  factOccurrences: OccurrenceFact[];
  /** Tabela de fatos de ociosidade */
  factIdleness: IdlenessFact[];
  /** Resultado consolidado da análise contratual */
  analyticsResult?: ContractAnalyticsResult;
}

// ---------------------------------------------------------------------------
// 12. CompactSummary (AI Input Payload)
// ---------------------------------------------------------------------------

/**
 * Resumo compacto dos dados da obra, projetado especificamente 
 * para ser enviado ao modelo Gemini, sem estourar limite de tokens, 
 * contendo apenas fatos calculados, sem detalhamento de cada RDO.
 */
export interface CompactSummary {
  projectName: string;
  periodLabel: string; // Ex: 'Março/2026' ou 'Todo o período'
  totalRdosProcessed: number;
  
  // KPIs de Medição e Custos
  measuredValue: number;
  theoreticalCost: number;
  absoluteMargin: number;
  marginPercent: number;
  
  // KPIs de Improdutividade e Pleitos Potenciais
  totalOccurrences: number;
  impactedHours: number;
  potentialClaimValue: number;
  
  // Resumo agrupado
  occurrencesByType: { type: string; count: number; impactTimeMinutes: number }[];
  productivityTopIssues: { activity: string; expected: number; actual: number }[]; // piores 5
  
  // Principais avisos de Validação
  validationWarnings: string[];
}

// ---------------------------------------------------------------------------
// 13. AI Composition Extraction (Sprint 3 Revisada)
// ---------------------------------------------------------------------------

export type CompositionType =
  | 'SERVICO_PRODUTIVO'
  | 'MOBILIZACAO'
  | 'ADMINISTRACAO_LOCAL'
  | 'DESMOBILIZACAO'
  | 'IMPRODUTIVIDADE_MO'
  | 'IMPRODUTIVIDADE_EQUIPAMENTO'
  | 'TRANSPORTE'
  | 'OUTRO';

export interface AICompositionItem {
  id: string;
  projectId: string;

  codigoComposicao: string;
  servicoOriginal: string;
  servicoTratado: string;
  unidade: string;

  producaoEquipe?: number;
  custoHorarioEquipamentos?: number;
  custoHorarioMaoObra?: number;
  custoHorarioTotal?: number;

  custoUnitarioExecucao?: number;
  custoMateriais?: number;
  custoTransporte?: number;
  custoUnitarioTotal?: number;

  bonificacaoPercentual?: number;
  bonificacaoValor?: number;
  precoUnitarioTotal?: number;

  tipoComposicao: CompositionType;

  hasBlackoutInOriginal?: boolean;
  isPreferredForCalculation?: boolean;

  paginaOrigem?: number;
  confiancaExtracao?: 'ALTA' | 'MEDIA' | 'BAIXA';
  observacao?: string;
}

export interface CompositionResourceItem {
  id: string;
  projectId: string;
  compositionId: string;
  codigoComposicao: string;
  servicoTratado: string;

  tipoRecurso: 'EQUIPAMENTO' | 'MAO_OBRA' | 'MATERIAL' | 'TRANSPORTE' | 'OUTRO';
  recurso: string;
  unidade?: string;
  quantidade?: number;
  utilizacaoProdutiva?: number;
  utilizacaoImprodutiva?: number;
  custoOperacionalProdutivo?: number;
  custoOperacionalImprodutivo?: number;
  custoUnitario?: number;
  custoHorario?: number;
  custoTotal?: number;

  observacao?: string;
}

export interface CompositionAIExtractionResult {
  projectId: string;
  sourceFileName: string;
  extractedAt: string;

  compositions: AICompositionItem[];
  resources: CompositionResourceItem[];

  errors: string[];
  warnings: string[];
  rawModelNotes?: string;
}

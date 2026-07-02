/**
 * resourcesMonthlyEngine.ts
 * Motor de cálculo de presença média mensal de recursos.
 *
 * ============================================================
 * DIFERENÇA CONCEITUAL CRÍTICA
 * ============================================================
 *
 * REGRA ANTIGA (calculateDailyAverageFromRdos — histogramUtils.ts):
 *   média = soma dos apontamentos no mês / número de RDOs (dias COM relatório)
 *
 *   Problema: se apenas 4 RDOs foram emitidos em março (o restante não foi
 *   registrado), a média é calculada sobre 4, não sobre os 22 dias úteis
 *   reais do mês. Isso superestima artificialmente a presença.
 *
 *   Exemplo: Pedreiro apontado 4 dias em março →
 *     REGRA ANTIGA: 4 / 4 = 1,00 (pedreiro "sempre presente")  ← ERRADO
 *
 * REGRA CORRETA (calculateValidDailyPresenceAverage — este arquivo):
 *   média = apontamentos válidos do item no mês / dias úteis válidos do mês
 *
 *   Exemplo: Pedreiro apontado 4 dias em março (22 dias úteis) →
 *     REGRA NOVA: 4 / 22 = 0,181818  ← CORRETO
 *
 * A regra antiga NÃO foi removida para garantir compatibilidade com
 * o componente HistogramAnalysis.tsx durante esta sprint.
 * ============================================================
 */

import { RDOData } from '../../../types';
import { getMonthKeyFromDateString, countBusinessDaysInMonth } from '../core/calendarRules';
import { getValidDailyPresenceKeys, ResourceSourceGroup, isValidExecutionDay, getRdoWorkingHours } from '../core/contractRules';
import { normalizeItemName, formatAnoMesKey, parseBrazilianDate } from '../core/normalizer';
import {
  DimensionImportResult,
  DimensionItem,
  DimensionGroup,
} from '../types/analyticsTypes';


// ---------------------------------------------------------------------------
// Tipos de entrada / saída
// ---------------------------------------------------------------------------

/**
 * Parâmetros da função calculateValidDailyPresenceAverage.
 */
export interface ValidDailyPresenceParams {
  /** Lista completa de RDOs do projeto (não precisa estar filtrada por mês). */
  rdos: RDOData[];

  /**
   * Mês de referência no formato 'YYYY-MM'.
   * Apenas RDOs cuja data pertencer a este mês serão considerados.
   */
  monthKey: string;

  /**
   * Grupo de recursos a calcular.
   * - 'WORKFORCE': mão-de-obra direta e indireta
   * - 'EQUIPMENT': equipamentos e veículos
   */
  sourceGroup: ResourceSourceGroup;

  /**
   * Lista opcional de feriados no formato 'YYYY-MM-DD'.
   * Quando não informado, apenas fins de semana são excluídos dos dias úteis.
   */
  holidays?: string[];

  /**
   * Sobrescreve o número de dias úteis calculado automaticamente.
   * Use quando a obra adota calendário diferente (ex.: trabalha sábados).
   *
   * Exemplo: para o enunciado "22 dias úteis em março", passe
   * businessDaysOverride = 22.
   */
  businessDaysOverride?: number;
}

/**
 * Resultado detalhado por item para auditoria e debug.
 */
export interface ItemPresenceDetail {
  /** Nome normalizado do recurso */
  normalizedName: string;
  /** Número de dias úteis válidos com apontamento deste item */
  validAppointmentDays: number;
  /** Denominador usado no cálculo (dias úteis do mês) */
  businessDaysInMonth: number;
  /** Média correta: validAppointmentDays / businessDaysInMonth */
  average: number;
}

/**
 * Resultado completo de calculateValidDailyPresenceAverage.
 */
export interface ValidDailyPresenceResult {
  /**
   * Mapa simplificado nome_normalizado → média.
   * Compatível com o retorno de calculateDailyAverageFromRdos.
   */
  averages: Record<string, number>;

  /** Detalhamento por item para auditoria */
  details: ItemPresenceDetail[];

  /** Número total de dias úteis usados como denominador */
  businessDaysInMonth: number;

  /** Mês de referência (passado como entrada) */
  monthKey: string;

  /** Número de RDOs do mês que passaram na validação de dia útil */
  validRdoCount: number;

  /** Número de RDOs do mês descartados (fim de semana, feriado, sem atividade) */
  discardedRdoCount: number;
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Calcula a média diária de presença de recursos usando a REGRA CORRETA:
 *
 *   média(item) = apontamentos válidos no mês / dias úteis válidos do mês
 *
 * Diferente de calculateDailyAverageFromRdos (histogramUtils.ts), que divide
 * pelo número de RDOs existentes no mês (não pelos dias úteis reais).
 *
 * @param params - Veja ValidDailyPresenceParams
 * @returns ValidDailyPresenceResult com médias e detalhamento
 *
 * ─── Exemplo de uso (caso março com 22 dias úteis) ───────────────
 *
 * const result = calculateValidDailyPresenceAverage({
 *   rdos: allRdos,
 *   monthKey: '2025-03',
 *   sourceGroup: 'WORKFORCE',
 *   businessDaysOverride: 22,   // obra trabalha sábados
 * });
 *
 * // Pedreiro apontado em apenas 4 RDOs válidos:
 * result.averages['PEDREIRO'] // → 0.181818 (4 / 22)
 * ─────────────────────────────────────────────────────────────────
 */
export function calculateValidDailyPresenceAverage(
  params: ValidDailyPresenceParams
): ValidDailyPresenceResult {
  const { rdos, monthKey, sourceGroup, holidays, businessDaysOverride } = params;

  // ── 1. Extrair ano e mês do monthKey ─────────────────────────────────────
  const [yearStr, monthStr] = monthKey.split('-');
  const year  = parseInt(yearStr,  10);
  const month = parseInt(monthStr, 10); // 1-indexed

  // ── 2. Determinar denominador (dias úteis do mês) ────────────────────────
  const businessDaysInMonth =
    businessDaysOverride !== undefined && businessDaysOverride > 0
      ? businessDaysOverride
      : countBusinessDaysInMonth(year, month, holidays);

  // ── 3. Filtrar RDOs do mês de referência ─────────────────────────────────
  const monthRdos = rdos.filter(
    rdo => getMonthKeyFromDateString(rdo.date) === monthKey
  );

  // ── 4. Contabilizar apontamentos válidos por item ─────────────────────────
  //
  // Para cada RDO do mês:
  //   - Verifica se é um dia útil válido de execução (contractRules)
  //   - Se válido, adiciona os nomes normalizados dos recursos ao Set do dia
  //
  // Estrutura: Map<normalizedName, Set<dateKey>>
  // → O Set de datas garante que um item conta no máximo 1x por dia
  //   mesmo que haja múltiplos RDOs para a mesma data.
  //
  const appointmentsByItem = new Map<string, Set<string>>();

  let validRdoCount     = 0;
  let discardedRdoCount = 0;

  monthRdos.forEach(rdo => {
    const presenceKeys = getValidDailyPresenceKeys(rdo, sourceGroup, holidays);

    if (presenceKeys.size === 0) {
      // Dia descartado: fim de semana, feriado ou sem atividade
      // (presenceKeys pode ser vazio por ausência de recursos mesmo em dia válido)
      // Conta como descartado apenas se isValidExecutionDay retornou false
      // Para a contagem de validRdoCount, usamos a heurística de presença > 0
      discardedRdoCount++;
      return;
    }

    validRdoCount++;

    presenceKeys.forEach(normalizedName => {
      if (!appointmentsByItem.has(normalizedName)) {
        appointmentsByItem.set(normalizedName, new Set());
      }
      // Usa a data do RDO como chave de deduplicação por dia
      appointmentsByItem.get(normalizedName)!.add(rdo.date);
    });
  });

  // ── 5. Calcular médias ────────────────────────────────────────────────────
  const averages: Record<string, number> = {};
  const details: ItemPresenceDetail[] = [];

  // Denominador seguro: nunca dividir por zero
  const safeDenominator = businessDaysInMonth > 0 ? businessDaysInMonth : 1;

  appointmentsByItem.forEach((dateDays, normalizedName) => {
    const validAppointmentDays = dateDays.size;
    const average = validAppointmentDays / safeDenominator;

    averages[normalizedName] = average;
    details.push({
      normalizedName,
      validAppointmentDays,
      businessDaysInMonth,
      average,
    });
  });

  // Ordena o detalhamento por nome para facilitar leitura
  details.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));

  return {
    averages,
    details,
    businessDaysInMonth,
    monthKey,
    validRdoCount,
    discardedRdoCount,
  };
}

// ---------------------------------------------------------------------------
// Função de compatibilidade: bridge para o formato antigo
// ---------------------------------------------------------------------------

/**
 * Wrapper que retorna apenas o Record<string, number> de médias,
 * no mesmo formato de calculateDailyAverageFromRdos (histogramUtils.ts).
 *
 * Útil para substituição gradual sem quebrar assinaturas existentes.
 *
 * @param rdos                - RDOs do projeto
 * @param monthKey            - 'YYYY-MM'
 * @param sourceGroup         - 'WORKFORCE' | 'EQUIPMENT'
 * @param holidays            - Lista opcional de feriados
 * @param businessDaysOverride - Override do denominador
 *
 * @example
 * // Substitui calculateDailyAverageFromRdos com a regra correta:
 * const averages = getValidPresenceAveragesCompat(rdos, '2025-03', 'WORKFORCE', [], 22);
 * averages['PEDREIRO'] // → 0.181818
 */
export function getValidPresenceAveragesCompat(
  rdos: RDOData[],
  monthKey: string,
  sourceGroup: ResourceSourceGroup,
  holidays?: string[],
  businessDaysOverride?: number
): Record<string, number> {
  const result = calculateValidDailyPresenceAverage({
    rdos,
    monthKey,
    sourceGroup,
    holidays,
    businessDaysOverride,
  });
  return result.averages;
}

// ---------------------------------------------------------------------------
// Função auxiliar: formata resultado para console/log de auditoria
// ---------------------------------------------------------------------------

/**
 * Gera um relatório de texto da análise de presença para fins de debug.
 *
 * @example
 * console.log(formatPresenceReport(result));
 * // → "Mês: 2025-03 | Dias úteis: 22 | RDOs válidos: 4 | Descartados: 0"
 * // → "PEDREIRO: 4 dias / 22 = 0,1818 (18,18%)"
 */
export function formatPresenceReport(result: ValidDailyPresenceResult): string {
  const lines: string[] = [
    `Mês: ${result.monthKey} | Dias úteis: ${result.businessDaysInMonth} | RDOs válidos: ${result.validRdoCount} | Descartados: ${result.discardedRdoCount}`,
    `${'─'.repeat(70)}`,
  ];

  if (result.details.length === 0) {
    lines.push('Nenhum apontamento válido encontrado para este mês.');
  } else {
    result.details.forEach(d => {
      const pct = (d.average * 100).toFixed(2);
      lines.push(
        `${d.normalizedName.padEnd(30)} ${d.validAppointmentDays.toString().padStart(3)} dias / ${d.businessDaysInMonth} = ${d.average.toFixed(6)} (${pct}%)`
      );
    });
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Validação interna (chamada em desenvolvimento para checar resultado)
// ---------------------------------------------------------------------------

/**
 * Valida o caso-base do enunciado:
 *   4 apontamentos / 22 dias úteis = 0,181818...
 *
 * Lança erro se o cálculo estiver errado. Use em ambiente de desenvolvimento.
 *
 * @internal
 */
export function _validateBaseCase(): void {
  const EXPECTED = 4 / 22; // 0.18181818...

  // Cria um RDO mínimo para cada um dos 4 dias válidos
  // Usando datas de segunda a quinta da primeira semana de março/2025
  const mockRdos: RDOData[] = [
    { id: 'rdo-1', teamId: 't1', date: '03/03/2025', workforce: [{ role: 'Pedreiro', count: 2 }], equipment: [], activities: [{ description: 'Alvenaria', status: 'DONE', quantity: 10 }], occurrences: [] },
    { id: 'rdo-2', teamId: 't1', date: '04/03/2025', workforce: [{ role: 'Pedreiro', count: 2 }], equipment: [], activities: [{ description: 'Alvenaria', status: 'DONE', quantity: 8  }], occurrences: [] },
    { id: 'rdo-3', teamId: 't1', date: '05/03/2025', workforce: [{ role: 'Pedreiro', count: 2 }], equipment: [], activities: [{ description: 'Alvenaria', status: 'DONE', quantity: 9  }], occurrences: [] },
    { id: 'rdo-4', teamId: 't1', date: '06/03/2025', workforce: [{ role: 'Pedreiro', count: 2 }], equipment: [], activities: [{ description: 'Alvenaria', status: 'DONE', quantity: 7  }], occurrences: [] },
  ];

  const result = calculateValidDailyPresenceAverage({
    rdos: mockRdos,
    monthKey: '2025-03',
    sourceGroup: 'WORKFORCE',
    businessDaysOverride: 22,
  });

  const actual = result.averages[normalizeItemName('Pedreiro')] ?? -1;
  const tolerance = 1e-9;

  if (Math.abs(actual - EXPECTED) > tolerance) {
    throw new Error(
      `[resourcesMonthlyEngine] Validação falhou!\n` +
      `  Esperado: ${EXPECTED}\n` +
      `  Obtido:   ${actual}`
    );
  }

  console.info(
    `[resourcesMonthlyEngine] ✓ Caso-base válido: PEDREIRO = ${actual.toFixed(6)} ` +
    `(4 / 22 = ${EXPECTED.toFixed(6)})`
  );
}

// =============================================================================
// SPRINT 4 — Motor de análise mensal MOI / MOD / EQUIP
// =============================================================================
// Entradas: RDOData[] + DimensionImportResult + intervalo de meses + feriados
// Saída:    MonthlyResourceFact[]
//
// Regra central (herdada da Sprint 1):
//   realizedAverageQty = apontamentos válidos / dias úteis válidos do mês
//
// Fontes:
//   · Planejado → DimensionItem.monthlyPlan (fonte oficial das dimensões)
//   · Realizado → RDO apontamentos válidos, mapeados via Item_RDO
// =============================================================================


// ---------------------------------------------------------------------------
// Tipos Sprint 4
// ---------------------------------------------------------------------------

/**
 * Status de cruzamento entre planejado (dimensão) e realizado (RDO).
 */
export type MonthlyResourceStatus =
  | 'PLANEJADO_E_REALIZADO'          // item existe na dimensão e teve apontamento no RDO
  | 'PLANEJADO_SEM_REALIZADO'        // item existe na dimensão mas sem apontamento válido
  | 'REALIZADO_FORA_DO_PLANEJAMENTO' // apontamento no RDO sem dimensão correspondente
  | 'SEM_EQUIVALENCIA'               // dimensão sem Item_RDO cadastrado
  | 'SEM_CUSTO_CADASTRADO';          // item encontrado, mas monthlyUnitCost = 0

/**
 * Fato mensal de recurso (MOI / MOD / EQUIP).
 * Um registro por item × mês.
 */
export interface MonthlyResourceFact {
  // ── Identificação ──────────────────────────────────────────────
  projectId:    string;
  group:        DimensionGroup;
  /** Nome original do item na dimensão (Item_Padrao) */
  item:         string;
  /** Nome normalizado do item padrão */
  itemStandard: string;
  /** Nome do item no RDO (Item_RDO da dimensão, quando existir) */
  itemRdo:      string;
  monthKey:     string;   // 'YYYY-MM'
  anoMesKey:    number;   // YYYYMM numérico (para ordenação)

  // ── Calendário ─────────────────────────────────────────────────
  /** Dias úteis válidos do mês (denominador do realizado) */
  validBusinessDays: number;

  // ── Planejado ──────────────────────────────────────────────────
  /** Quantidade planejada para o mês (da dimensão) */
  plannedQty:  number;
  /** HH planejado = plannedQty × 176 (padrão inicial) */
  plannedHH:   number;

  // ── Realizado ──────────────────────────────────────────────────
  /**
   * Quantidade média realizada = apontamentos válidos / dias úteis do mês.
   * Se não houve apontamento válido, = 0.
   */
  realizedAverageQty: number;
  /** HH real = soma de horas dos RDOs válidos onde o item estava presente */
  realHH:             number;

  // ── Custo ──────────────────────────────────────────────────────
  /** Custo mensal unitário (da dimensão) */
  monthlyUnitCost: number;
  /** Custo planejado = plannedQty × monthlyUnitCost */
  plannedCost:     number;
  /** Custo realizado = realizedAverageQty × monthlyUnitCost */
  realizedCost:    number;

  // ── Desvios ────────────────────────────────────────────────────
  /** Desvio de quantidade = realizedAverageQty − plannedQty */
  quantityDeviation:  number;
  /** Desvio financeiro = realizedCost − plannedCost */
  financialDeviation: number;

  // ── Classificação ──────────────────────────────────────────────
  status:      MonthlyResourceStatus;
  observation: string;
}

/**
 * Parâmetros de buildMonthlyResourceFacts.
 */
export interface BuildMonthlyResourceFactsParams {
  /** ID do projeto */
  projectId: string;
  /** Todos os RDOs do projeto (filtrados internamente por mês) */
  rdos: RDOData[];
  /** Resultado importado das dimensões */
  dimensions: DimensionImportResult;
  /**
   * Lista de meses a processar (formato 'YYYY-MM').
   * Se omitida, usa todos os meses detectados nas dimensões.
   */
  monthKeys?: string[];
  /**
   * Override do número de dias úteis por mês.
   * Útil para obras que trabalham sábados.
   * Formato: Record<'YYYY-MM', number>
   */
  businessDaysOverrides?: Record<string, number>;
}

/**
 * Resultado de buildMonthlyResourceFacts.
 */
export interface MonthlyResourceFactsResult {
  facts:    MonthlyResourceFact[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// 1. findDimensionItemForRdoItem
// ---------------------------------------------------------------------------

/**
 * Encontra o DimensionItem correspondente ao nome normalizado de um item de RDO.
 *
 * Estratégia de matching (em ordem de prioridade):
 * 1. rdoEquivalentNormalized === normalizedRdoName  (Item_RDO exato)
 * 2. normalizedName === normalizedRdoName           (Item_Padrao exato)
 *
 * Retorna null se nenhum match for encontrado.
 *
 * @param normalizedRdoName - normalizeItemName(rdo.workforce[i].role)
 * @param dimensionItems    - lista de DimensionItem da obra
 */
export function findDimensionItemForRdoItem(
  normalizedRdoName: string,
  dimensionItems: DimensionItem[]
): DimensionItem | null {
  // 1. Prioridade: Item_RDO
  const byRdo = dimensionItems.find(
    d => d.rdoEquivalentNormalized === normalizedRdoName
  );
  if (byRdo) return byRdo;

  // 2. Fallback: Item_Padrao
  const byStd = dimensionItems.find(
    d => d.normalizedName === normalizedRdoName
  );
  return byStd ?? null;
}

// ---------------------------------------------------------------------------
// 2. calculateRealHH
// ---------------------------------------------------------------------------

/**
 * Calcula o HH real de um item em um mês, somando as horas dos RDOs válidos
 * onde o item estava presente.
 *
 * Regra: para cada dia válido onde o item aparece, soma getRdoWorkingHours(rdo).
 * Se o RDO não informa horas, usa o padrão de 8h (encapsulado em getRdoWorkingHours).
 *
 * @param rdos              - RDOs do mês já filtrados
 * @param normalizedItemName - nome normalizado do item
 * @param sourceGroup       - WORKFORCE ou EQUIPMENT
 * @param holidays          - lista de feriados
 * @param warnings          - array mutável para acumular avisos
 */
export function calculateRealHH(
  rdos: RDOData[],
  normalizedItemName: string,
  sourceGroup: ResourceSourceGroup,
  holidays: string[],
  warnings: string[]
): number {
  let totalHH = 0;
  const countedDates = new Set<string>();

  for (const rdo of rdos) {
    if (!isValidExecutionDay(rdo, holidays)) continue;
    if (countedDates.has(rdo.date)) continue; // deduplicação por dia

    const hasItem = sourceGroup === 'WORKFORCE'
      ? rdo.workforce.some(w => normalizeItemName(w.role) === normalizedItemName && w.count > 0)
      : rdo.equipment.some(e => normalizeItemName(e.name) === normalizedItemName && e.count > 0);

    if (!hasItem) continue;

    const hours = getRdoWorkingHours(rdo);
    if (hours === 0) {
      warnings.push(
        `RDO ${rdo.date}: item '${normalizedItemName}' presente mas sem horas registradas — usando 0h.`
      );
    }

    totalHH += hours;
    countedDates.add(rdo.date);
  }

  return totalHH;
}

// ---------------------------------------------------------------------------
// 3. classifyStatus
// ---------------------------------------------------------------------------

/**
 * Classifica o status do fato mensal conforme as regras de negócio.
 */
function classifyStatus(params: {
  hasDimension:    boolean;
  plannedQty:      number;
  realizedQty:     number;
  hasRdoEquivalent: boolean;
  hasCost:         boolean;
}): { status: MonthlyResourceStatus; observation: string } {
  const { hasDimension, plannedQty, realizedQty, hasRdoEquivalent, hasCost } = params;

  // Sem dimensão → veio apenas dos RDOs
  if (!hasDimension) {
    return {
      status: 'REALIZADO_FORA_DO_PLANEJAMENTO',
      observation: 'Item apontado no RDO sem correspondência na planilha de dimensões.',
    };
  }

  // Sem equivalência RDO cadastrada
  if (!hasRdoEquivalent) {
    return {
      status: 'SEM_EQUIVALENCIA',
      observation: 'Item da dimensão sem coluna Item_RDO cadastrada — não é possível cruzar com RDOs.',
    };
  }

  // Sem custo (mas mantém o item)
  if (!hasCost) {
    const obs = plannedQty > 0 && realizedQty > 0
      ? 'Planejado e realizado, mas sem custo cadastrado na dimensão.'
      : plannedQty > 0
        ? 'Planejado sem realizado e sem custo cadastrado.'
        : 'Realizado sem planejamento e sem custo cadastrado.';
    return { status: 'SEM_CUSTO_CADASTRADO', observation: obs };
  }

  // Planejado e realizado
  if (plannedQty > 0 && realizedQty > 0) {
    return {
      status: 'PLANEJADO_E_REALIZADO',
      observation: '',
    };
  }

  // Planejado sem realizado
  if (plannedQty > 0 && realizedQty === 0) {
    return {
      status: 'PLANEJADO_SEM_REALIZADO',
      observation: 'Nenhum apontamento válido encontrado para este item no mês.',
    };
  }

  // Realizado fora do planejamento (plannedQty === 0 mas houve realizado)
  return {
    status: 'REALIZADO_FORA_DO_PLANEJAMENTO',
    observation: 'Item apontado no RDO mas quantidade planejada é zero para este mês.',
  };
}

// ---------------------------------------------------------------------------
// 4. buildMonthlyResourceFacts  (função principal da Sprint 4)
// ---------------------------------------------------------------------------

/**
 * Gera os fatos mensais de recursos (MOI/MOD/EQUIP) cruzando dimensões com RDOs.
 *
 * Algoritmo por mês:
 * 1. Calcula dias úteis do mês (da dimensão ou calendário).
 * 2. Para cada DimensionItem do mês:
 *    a. Tenta fazer match com apontamentos de RDO via Item_RDO.
 *    b. Calcula realizedAverageQty = apont. válidos / dias úteis.
 *    c. Calcula realHH.
 *    d. Calcula custos e desvios.
 *    e. Classifica status.
 * 3. Para itens de RDO sem match na dimensão → REALIZADO_FORA_DO_PLANEJAMENTO.
 *
 * @param params - Veja BuildMonthlyResourceFactsParams
 */
export function buildMonthlyResourceFacts(
  params: BuildMonthlyResourceFactsParams
): MonthlyResourceFactsResult {
  const {
    projectId,
    rdos,
    dimensions,
    monthKeys,
    businessDaysOverrides = {},
  } = params;

  const holidays = dimensions.holidays ?? [];
  const dimItems = dimensions.items ?? [];
  const warnings: string[] = [];
  const facts: MonthlyResourceFact[] = [];

  // Meses a processar
  const targetMonths = monthKeys?.length
    ? monthKeys
    : dimensions.months.map(m => m.monthKey);

  if (targetMonths.length === 0) {
    warnings.push('Nenhum mês detectado nas dimensões — nenhum fato gerado.');
    return { facts, warnings };
  }

  for (const monthKey of targetMonths) {
    const [yearStr, monthStr] = monthKey.split('-');
    const year  = parseInt(yearStr,  10);
    const month = parseInt(monthStr, 10);

    // Dias úteis do mês
    const validBusinessDays =
      businessDaysOverrides[monthKey] ??
      countBusinessDaysInMonth(year, month, holidays);

    const safeDenominator = validBusinessDays > 0 ? validBusinessDays : 1;

    // RDOs do mês
    const monthRdos = rdos.filter(
      r => getMonthKeyFromDateString(r.date) === monthKey
    );

    // Ano-Mês numérico
    const parsedMonthDate = parseBrazilianDate(`01/${monthStr}/${yearStr}`);
    const anoMesKey = parsedMonthDate ? formatAnoMesKey(parsedMonthDate) : parseInt(`${yearStr}${monthStr}`, 10);

    // ─── Rastreia quais items de RDO já foram cruzados ───────────────────
    // normalizedRdoName → Set<date> (para deduplicação por dia)
    const rdoAppointments = new Map<string, Set<string>>();

    // Preenche rdoAppointments para WORKFORCE e EQUIPMENT
    for (const rdo of monthRdos) {
      if (!isValidExecutionDay(rdo, holidays)) continue;

      for (const w of rdo.workforce) {
        if (w.count <= 0) continue;
        const norm = normalizeItemName(w.role);
        if (!rdoAppointments.has(norm)) rdoAppointments.set(norm, new Set());
        rdoAppointments.get(norm)!.add(rdo.date);
      }
      for (const e of rdo.equipment) {
        if (e.count <= 0) continue;
        const norm = normalizeItemName(e.name);
        if (!rdoAppointments.has(norm)) rdoAppointments.set(norm, new Set());
        rdoAppointments.get(norm)!.add(rdo.date);
      }
    }

    // ─── Fatos a partir das DIMENSÕES ────────────────────────────────────
    const matchedRdoKeys = new Set<string>();

    for (const dimItem of dimItems) {
      const planEntry = dimItem.monthlyPlan.find(p => p.monthKey === monthKey);
      const plannedQty = planEntry?.quantity ?? 0;

      // Custo
      const monthlyUnitCost = dimItem.monthlyUnitCost ?? 0;
      const hasCost = monthlyUnitCost > 0;

      // Equivalência RDO
      const rdoKey = dimItem.rdoEquivalentNormalized ?? dimItem.normalizedName;
      const hasRdoEquivalent = !!dimItem.rdoEquivalentNormalized;

      // Apontamentos válidos
      const appointmentDays = rdoAppointments.get(rdoKey)?.size ?? 0;
      const realizedAverageQty = appointmentDays / safeDenominator;

      if (rdoAppointments.has(rdoKey)) matchedRdoKeys.add(rdoKey);

      // sourceGroup da dimensão
      const sourceGroup: ResourceSourceGroup =
        dimItem.group === 'EQUIP' ? 'EQUIPMENT' : 'WORKFORCE';

      // HH real
      const realHH = calculateRealHH(
        monthRdos, rdoKey, sourceGroup, holidays, warnings
      );

      // HH planejado (padrão 176h/mês)
      const plannedHH = plannedQty * 176;

      // Custos
      const plannedCost  = plannedQty * monthlyUnitCost;
      const realizedCost = realizedAverageQty * monthlyUnitCost;

      // Desvios
      const quantityDeviation  = realizedAverageQty - plannedQty;
      const financialDeviation = realizedCost - plannedCost;

      // Status
      const { status, observation } = classifyStatus({
        hasDimension:    true,
        plannedQty,
        realizedQty:     realizedAverageQty,
        hasRdoEquivalent,
        hasCost,
      });

      facts.push({
        projectId,
        group:        dimItem.group,
        item:         dimItem.name,
        itemStandard: dimItem.normalizedName,
        itemRdo:      dimItem.rdoEquivalent ?? '',
        monthKey,
        anoMesKey,
        validBusinessDays,
        plannedQty,
        plannedHH,
        realizedAverageQty,
        realHH,
        monthlyUnitCost,
        plannedCost,
        realizedCost,
        quantityDeviation,
        financialDeviation,
        status,
        observation,
      });
    }

    // ─── Fatos para itens de RDO SEM match na dimensão ───────────────────
    for (const [normName, dateDays] of rdoAppointments.entries()) {
      if (matchedRdoKeys.has(normName)) continue;

      const realizedAverageQty = dateDays.size / safeDenominator;

      // Tenta detectar o grupo pelo nome (heurística simples)
      const group: DimensionGroup = 'OTHER';

      // HH real
      const sourceGroup: ResourceSourceGroup = 'WORKFORCE'; // default
      const realHH = calculateRealHH(
        monthRdos, normName, sourceGroup, holidays, warnings
      );

      const { status, observation } = classifyStatus({
        hasDimension:     false,
        plannedQty:       0,
        realizedQty:      realizedAverageQty,
        hasRdoEquivalent: false,
        hasCost:          false,
      });

      facts.push({
        projectId,
        group,
        item:         normName,
        itemStandard: normName,
        itemRdo:      normName,
        monthKey,
        anoMesKey,
        validBusinessDays,
        plannedQty:          0,
        plannedHH:           0,
        realizedAverageQty,
        realHH,
        monthlyUnitCost:     0,
        plannedCost:         0,
        realizedCost:        0,
        quantityDeviation:   realizedAverageQty,
        financialDeviation:  0,
        status,
        observation,
      });
    }
  }

  // Ordena: grupo → item → mês
  facts.sort((a, b) => {
    const g = a.group.localeCompare(b.group);
    if (g !== 0) return g;
    const i = a.itemStandard.localeCompare(b.itemStandard);
    if (i !== 0) return i;
    return a.monthKey.localeCompare(b.monthKey);
  });

  return { facts, warnings };
}

// ---------------------------------------------------------------------------
// 5. splitResourceFactsByGroup
// ---------------------------------------------------------------------------

/**
 * Divide os fatos mensais por grupo para geração das tabelas MOI, MOD e EQUIP.
 *
 * @example
 * const { moi, mod, equip, other } = splitResourceFactsByGroup(facts);
 */
export function splitResourceFactsByGroup(facts: MonthlyResourceFact[]): {
  mod:   MonthlyResourceFact[];
  moi:   MonthlyResourceFact[];
  equip: MonthlyResourceFact[];
  other: MonthlyResourceFact[];
} {
  return {
    mod:   facts.filter(f => f.group === 'MOD'),
    moi:   facts.filter(f => f.group === 'MOI'),
    equip: facts.filter(f => f.group === 'EQUIP'),
    other: facts.filter(f => f.group !== 'MOD' && f.group !== 'MOI' && f.group !== 'EQUIP'),
  };
}

// ---------------------------------------------------------------------------
// 6. getFactsSummary — KPIs agregados
// ---------------------------------------------------------------------------

/**
 * Retorna KPIs agregados de uma lista de fatos mensais.
 */
export function getFactsSummary(facts: MonthlyResourceFact[]) {
  const totalPlannedCost   = facts.reduce((s, f) => s + f.plannedCost,   0);
  const totalRealizedCost  = facts.reduce((s, f) => s + f.realizedCost,  0);
  const totalRealHH        = facts.reduce((s, f) => s + f.realHH,        0);
  const totalPlannedHH     = facts.reduce((s, f) => s + f.plannedHH,     0);
  const countByStatus = facts.reduce<Partial<Record<MonthlyResourceStatus, number>>>(
    (acc, f) => { acc[f.status] = (acc[f.status] ?? 0) + 1; return acc; }, {}
  );

  return {
    totalFacts:         facts.length,
    totalPlannedCost,
    totalRealizedCost,
    financialDeviation: totalRealizedCost - totalPlannedCost,
    totalRealHH,
    totalPlannedHH,
    hhDeviation:        totalRealHH - totalPlannedHH,
    countByStatus,
  };
}

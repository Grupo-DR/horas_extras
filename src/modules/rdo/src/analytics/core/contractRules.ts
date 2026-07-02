/**
 * contractRules.ts
 * Regras de negócio de obras para validação de apontamentos de RDO.
 *
 * Responsabilidade: decidir se um RDO representa um "dia válido de execução"
 * e quais chaves de recursos (mão-de-obra / equipamento) devem ser contadas.
 *
 * Regras críticas de negócio:
 * 1. Se o dia for "sem atividade" → zera todos os recursos desse dia.
 * 2. Se a equipe estava mobilizada mas não iniciou atividade → zera.
 * 3. Feriados e fins de semana → excluídos pelo calendarRules.ts.
 * 4. Cada item/dia conta no máximo 1 apontamento (Set de chaves únicas).
 * 5. Sábado/domingo SEM execução → não conta.
 *
 * NOTA: Preserva integralmente utils/histogramUtils.ts. Nenhuma função
 * existente é alterada ou removida.
 */

import { RDOData } from '../../../types';
import { isWeekend, isHoliday } from './calendarRules';
import { parseBrazilianDate, normalizeItemName } from './normalizer';

// ---------------------------------------------------------------------------
// Tipos auxiliares internos
// ---------------------------------------------------------------------------

/** Tipo do parâmetro sourceGroup nas funções de presença */
export type ResourceSourceGroup = 'WORKFORCE' | 'EQUIPMENT';

// ---------------------------------------------------------------------------
// 1. detectNoActivityDay
// ---------------------------------------------------------------------------
/**
 * Detecta se o RDO indica que NÃO houve atividade produtiva no dia.
 *
 * Critérios que configuram "dia sem atividade":
 * - Campo `notes` contém palavras-chave como "sem atividade", "paralisação",
 *   "mobilizado", "aguardando", "chuva" (quando nenhuma activity existe).
 * - Lista `activities` vazia.
 * - Todas as activities têm status 'PENDING' e nenhuma tem quantidade > 0.
 * - Nenhum workforce E nenhum equipment apontado.
 *
 * Esta função é o ponto isolado de evolução da regra. Para adicionar novos
 * critérios, edite apenas aqui.
 *
 * @returns true se o dia deve ser computado como ZERO para todos os recursos
 *
 * @example
 * // RDO vazio (sem workforce, sem equipment, sem activities)
 * detectNoActivityDay({ workforce: [], equipment: [], activities: [], ... })
 * // → true
 */
export function detectNoActivityDay(rdo: RDOData): boolean {
  const hasWorkforce  = rdo.workforce.length > 0;
  const hasEquipment  = rdo.equipment.length > 0;
  const hasActivities = rdo.activities.length > 0;

  // Sem nenhum recurso E sem nenhuma activity → dia vazio
  if (!hasWorkforce && !hasEquipment && !hasActivities) return true;

  // Tem workforce/equipment mas TODAS as activities estão PENDING sem qty
  if (hasActivities) {
    const allPendingWithoutQty = rdo.activities.every(
      a => a.status === 'PENDING' && (!a.quantity || a.quantity === 0)
    );
    if (allPendingWithoutQty) return true;
  }

  // Verifica palavras-chave nas notas (mobilização sem início)
  if (rdo.notes) {
    const notesLower = rdo.notes.toLowerCase();
    const noActivityKeywords = [
      'sem atividade',
      'sem atividades',
      'paralisac',     // paralisação / paralisado
      'mobilizado sem inicio',
      'mobilizado sem início',
      'aguardando inicio',
      'aguardando início',
      'equipe aguardando',
      'nao iniciou',
      'não iniciou',
    ];
    const hasNoActivityNote = noActivityKeywords.some(kw =>
      notesLower.includes(kw)
    );
    // Aplica o critério de nota apenas se NÃO há atividades concluídas
    if (hasNoActivityNote) {
      const hasCompletedActivity = rdo.activities.some(
        a => a.status === 'DONE' || a.status === 'IN_PROGRESS'
      );
      if (!hasCompletedActivity) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// 2. isValidExecutionDay
// ---------------------------------------------------------------------------
/**
 * Determina se o RDO representa um dia válido para cômputo de presença
 * de recursos no histograma.
 *
 * Um dia é VÁLIDO quando TODAS as condições abaixo são verdadeiras:
 * 1. A data do RDO é parseável.
 * 2. Não é fim de semana (exceto se a obra declarar execução — futuro).
 * 3. Não é feriado (conforme lista da obra).
 * 4. Não é dia "sem atividade" segundo detectNoActivityDay().
 *
 * @param rdo      - Registro de RDO
 * @param holidays - Lista opcional de feriados 'YYYY-MM-DD' ou 'DD/MM/YYYY'
 *
 * @example
 * isValidExecutionDay({ date: '22/03/2025', activities: [...], ... })
 * // → true  (segunda-feira com atividades)
 *
 * isValidExecutionDay({ date: '22/03/2025', activities: [], workforce: [] })
 * // → false (dia sem recurso nem atividade)
 */
export function isValidExecutionDay(
  rdo: RDOData,
  holidays?: string[]
): boolean {
  // 1. Data válida
  const date = parseBrazilianDate(rdo.date);
  if (!date) return false;

  // 2. Não é fim de semana
  if (isWeekend(date)) return false;

  // 3. Não é feriado
  if (isHoliday(date, holidays)) return false;

  // 4. Não é dia sem atividade
  if (detectNoActivityDay(rdo)) return false;

  return true;
}

// ---------------------------------------------------------------------------
// 3. getRdoWorkingHours
// ---------------------------------------------------------------------------
/**
 * Retorna o total de horas trabalhadas reportadas no RDO.
 *
 * Estratégia atual (heurística):
 * - Soma hoursOperated de cada equipment item.
 * - Soma totalHours de cada workforce item.
 * - Se ambos zerados, assume turno padrão de 8h quando o dia é válido.
 *
 * Esta função não valida se o dia é útil — use isValidExecutionDay antes.
 *
 * @example
 * getRdoWorkingHours({ workforce: [{ totalHours: 8 }], equipment: [] })
 * // → 8
 */
export function getRdoWorkingHours(rdo: RDOData): number {
  let total = 0;

  rdo.workforce.forEach(w => {
    total += w.totalHours || 0;
  });

  rdo.equipment.forEach(e => {
    total += e.hoursOperated || 0;
  });

  // Se não há informação de horas mas há presença, assume turno padrão
  if (total === 0 && (rdo.workforce.length > 0 || rdo.equipment.length > 0)) {
    return 8;
  }

  return total;
}

// ---------------------------------------------------------------------------
// 4. getValidDailyPresenceKeys
// ---------------------------------------------------------------------------
/**
 * Extrai os nomes normalizados de recursos com PRESENÇA VÁLIDA em um RDO.
 *
 * Regra: cada item/dia conta NO MÁXIMO 1 apontamento.
 * Se o dia for inválido (isValidExecutionDay = false), retorna Set vazio.
 *
 * Retorna um Set<string> onde cada string é o normalizeItemName do recurso.
 * O uso de Set já garante a regra de unicidade por item/dia.
 *
 * @param rdo         - RDO a analisar
 * @param sourceGroup - 'WORKFORCE' para mão-de-obra; 'EQUIPMENT' para equipamentos
 * @param holidays    - Lista opcional de feriados
 *
 * @example
 * // RDO de segunda-feira com 2 pedreiros e 1 retroescavadeira
 * getValidDailyPresenceKeys(rdo, 'WORKFORCE')
 * // → Set { 'PEDREIRO', 'SERVENTE' }
 *
 * getValidDailyPresenceKeys(rdo, 'EQUIPMENT')
 * // → Set { 'RETROESCAVADEIRA' }
 *
 * // RDO de sábado → Set vazio (fim de semana)
 * getValidDailyPresenceKeys(rdoSabado, 'WORKFORCE')
 * // → Set {}
 */
export function getValidDailyPresenceKeys(
  rdo: RDOData,
  sourceGroup: ResourceSourceGroup,
  holidays?: string[]
): Set<string> {
  const keys = new Set<string>();

  // Dia inválido → nenhum recurso é contado
  if (!isValidExecutionDay(rdo, holidays)) return keys;

  if (sourceGroup === 'WORKFORCE') {
    rdo.workforce.forEach(w => {
      if (w.count > 0) {
        keys.add(normalizeItemName(w.role));
      }
    });
  } else {
    rdo.equipment.forEach(e => {
      if (e.count > 0) {
        keys.add(normalizeItemName(e.name));
      }
    });
  }

  return keys;
}

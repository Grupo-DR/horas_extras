/**
 * calendarRules.ts
 * Regras de calendário para o módulo Contract Intelligence.
 *
 * Responsabilidade única: responder "este dia é válido para cômputo de
 * presença de recursos?" conforme as regras de obras brasileiras.
 *
 * Regras fundamentais:
 * - Sábados e domingos NÃO são dias úteis válidos por padrão.
 * - Feriados NÃO são dias úteis válidos.
 * - A lista de feriados é opcional e deve ser informada pela obra;
 *   quando ausente, apenas fins de semana são excluídos.
 *
 * Formato da lista de feriados: string[] de datas no formato 'YYYY-MM-DD'.
 *
 * NOTA: Não altera nenhuma lógica de utils/histogramUtils.ts.
 */

import { parseBrazilianDate, formatDateKey } from './normalizer';

// ---------------------------------------------------------------------------
// 1. isWeekend
// ---------------------------------------------------------------------------
/**
 * Retorna true se a data for sábado (6) ou domingo (0).
 *
 * @example
 * isWeekend(new Date(2025, 2, 22)) // Sábado → true
 * isWeekend(new Date(2025, 2, 24)) // Segunda → false
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay(); // 0 = Domingo, 6 = Sábado
  return day === 0 || day === 6;
}

// ---------------------------------------------------------------------------
// 2. isHoliday
// ---------------------------------------------------------------------------
/**
 * Retorna true se a data estiver na lista de feriados fornecida.
 * A comparação é feita por chave numérica YYYYMMDD para evitar erros de
 * timezone e parsing de string.
 *
 * @param date     - Data a verificar
 * @param holidays - Lista de strings 'YYYY-MM-DD' (opcional)
 *
 * @example
 * isHoliday(new Date(2025, 0, 1), ['2025-01-01']) // → true
 * isHoliday(new Date(2025, 0, 2), ['2025-01-01']) // → false
 */
export function isHoliday(date: Date, holidays?: string[]): boolean {
  if (!holidays || holidays.length === 0) return false;

  const dateKey = formatDateKey(date); // YYYYMMDD numérico

  return holidays.some(h => {
    const parsed = parseBrazilianDate(h.includes('/') ? h : h); // aceita YYYY-MM-DD
    if (!parsed) return false;
    return formatDateKey(parsed) === dateKey;
  });
}

// ---------------------------------------------------------------------------
// 3. getBusinessDaysInMonth
// ---------------------------------------------------------------------------
/**
 * Retorna a lista de datas úteis em um determinado mês/ano.
 * Exclui sábados, domingos e feriados informados.
 *
 * @param year     - Ano (ex: 2025)
 * @param month    - Mês 1-indexed (1 = janeiro … 12 = dezembro)
 * @param holidays - Lista opcional de feriados 'YYYY-MM-DD'
 *
 * @example
 * // Março/2025: 31 dias, começa Sábado
 * getBusinessDaysInMonth(2025, 3).length // → 21
 *
 * // Com feriado 01/03/2025 (Sábado, já excluído)
 * getBusinessDaysInMonth(2025, 3, ['2025-04-18']).length // → 20 (Sexta Santa)
 */
export function getBusinessDaysInMonth(
  year: number,
  month: number,     // 1-indexed
  holidays?: string[]
): Date[] {
  const businessDays: Date[] = [];
  // Primeiro dia do mês (month é 1-indexed, new Date usa 0-indexed)
  const cursor = new Date(year, month - 1, 1);

  while (cursor.getMonth() === month - 1) {
    if (!isWeekend(cursor) && !isHoliday(cursor, holidays)) {
      businessDays.push(new Date(cursor)); // cópia imutável
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return businessDays;
}

// ---------------------------------------------------------------------------
// 4. countBusinessDaysInMonth
// ---------------------------------------------------------------------------
/**
 * Retorna o total de dias úteis em um mês/ano.
 * Atalho para getBusinessDaysInMonth(...).length.
 *
 * Caso de validação:
 *   countBusinessDaysInMonth(2025, 3) deve retornar 21
 *   (março/2025: 31 dias − 4 sábados − 4 domingos − 2 feriados nacionais
 *    quando lista vazia → apenas fins de semana → 21 dias úteis)
 *
 * Nota: com lista de feriados vazia, março/2025 tem 21 dias úteis.
 *       O enunciado usa 22 — verifique se a obra não trabalha aos sábados.
 *       Para obras que trabalham sábado, use businessDaysOverride = 22
 *       em calculateValidDailyPresenceAverage.
 */
export function countBusinessDaysInMonth(
  year: number,
  month: number,
  holidays?: string[]
): number {
  return getBusinessDaysInMonth(year, month, holidays).length;
}

// ---------------------------------------------------------------------------
// 5. getAnoMesKeyFromDateString
// ---------------------------------------------------------------------------
/**
 * Extrai a chave numérica YYYYMM de uma string de data RDO.
 * Aceita os formatos DD/MM/YYYY e YYYY-MM-DD.
 *
 * Retorna 0 se a data for inválida (evita throw em pipelines de dados).
 *
 * @example
 * getAnoMesKeyFromDateString("22/03/2025") // → 202503
 * getAnoMesKeyFromDateString("2025-03-22") // → 202503
 * getAnoMesKeyFromDateString("")           // → 0
 */
export function getAnoMesKeyFromDateString(dateStr: string): number {
  const d = parseBrazilianDate(dateStr);
  if (!d) return 0;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return parseInt(`${y}${m}`, 10);
}

// ---------------------------------------------------------------------------
// 6. getMonthKeyFromDateString
// ---------------------------------------------------------------------------
/**
 * Extrai a chave 'YYYY-MM' de uma string de data RDO.
 * Aceita os formatos DD/MM/YYYY e YYYY-MM-DD.
 *
 * Compatível com o formato de monthKey usado em todo o sistema
 * (histogramUtils, HistogramItem.monthlyPlan etc.).
 *
 * Retorna '' se a data for inválida.
 *
 * @example
 * getMonthKeyFromDateString("22/03/2025") // → "2025-03"
 * getMonthKeyFromDateString("2025-03-22") // → "2025-03"
 */
export function getMonthKeyFromDateString(dateStr: string): string {
  const d = parseBrazilianDate(dateStr);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

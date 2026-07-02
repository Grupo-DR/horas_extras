/**
 * normalizer.ts
 * Funções de normalização de texto, datas e valores numéricos.
 *
 * Regra geral: toda chave analítica deve passar por este módulo antes de
 * ser usada em agrupamentos, comparações ou joins internos.
 *
 * NOTA: Este arquivo é parte do módulo Contract Intelligence e NÃO altera
 * nenhuma lógica existente em utils/histogramUtils.ts.
 */

// ---------------------------------------------------------------------------
// 1. removeAccents
// ---------------------------------------------------------------------------
/**
 * Remove diacríticos (acentos) de uma string usando decomposição Unicode NFD.
 *
 * @example
 * removeAccents("Armação")  // → "Armacao"
 * removeAccents("João")     // → "Joao"
 */
export function removeAccents(value: string): string {
  if (!value) return '';
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ---------------------------------------------------------------------------
// 2. normalizeText
// ---------------------------------------------------------------------------
/**
 * Normaliza texto para comparação case-insensitive sem acentos nem espaços
 * duplicados. Mantém letras, números e espaço simples.
 *
 * Uso: comparações de descrições longas onde capitalização/acento variam.
 *
 * @example
 * normalizeText("  Operador  de  Retroescavadeira ")
 *   // → "OPERADOR DE RETROESCAVADEIRA"
 */
export function normalizeText(value: string): string {
  if (!value) return '';
  return removeAccents(value.toString().trim())
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')  // Substitui pontuação por espaço
    .replace(/\s+/g, ' ')      // Colapsa múltiplos espaços
    .trim();
}

// ---------------------------------------------------------------------------
// 3. normalizeKey
// ---------------------------------------------------------------------------
/**
 * Gera uma chave compacta sem espaços ou caracteres especiais.
 * Ideal para chaves de dicionário (Record<string, ...>) e IDs sintéticos.
 *
 * @example
 * normalizeKey("Mão-de-Obra Direta") // → "MAODEOBRA_DIRETA"
 */
export function normalizeKey(value: string): string {
  if (!value) return '';
  return normalizeText(value).replace(/\s+/g, '_');
}

// ---------------------------------------------------------------------------
// 4. normalizeItemName
// ---------------------------------------------------------------------------
/**
 * Normalização padrão de nome de item de histograma/recurso.
 * Equivalente à normalizeItemName de histogramUtils.ts, reexportada aqui
 * para garantir consistência dentro do módulo analytics.
 *
 * Regra: UPPER, sem acentos, sem pontuação, espaços simples.
 *
 * @example
 * normalizeItemName("Retroescavadeira") // → "RETROESCAVADEIRA"
 * normalizeItemName("  pedreiro  ")     // → "PEDREIRO"
 */
export function normalizeItemName(value: string): string {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// 5. safeNumber
// ---------------------------------------------------------------------------
/**
 * Converte qualquer valor em número de forma segura.
 * Retorna 0 para valores nulos, undefined, NaN ou strings não-numéricas.
 * Suporta separador decimal brasileiro (vírgula).
 *
 * @example
 * safeNumber("3,5")    // → 3.5
 * safeNumber("1.200")  // → 1200   (milhar com ponto)
 * safeNumber(null)     // → 0
 * safeNumber("")       // → 0
 */
export function safeNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  const str = String(value).trim();

  // Detecta formato brasileiro: ex "1.200,50" → "1200.50"
  // Heurística: se há vírgula após dígitos, assume pt-BR
  const hasBrComma = /\d,\d/.test(str);
  const hasBrThousand = /\d\.\d{3}/.test(str);

  let normalized = str;
  if (hasBrComma || hasBrThousand) {
    normalized = str.replace(/\./g, '').replace(',', '.');
  }

  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

// ---------------------------------------------------------------------------
// 6. parseBrazilianDate
// ---------------------------------------------------------------------------
/**
 * Faz parse de datas no formato brasileiro DD/MM/YYYY ou YYYY-MM-DD.
 * Retorna null para formatos inválidos em vez de lançar exceção.
 *
 * Importante: o construtor Date() do JS interpreta YYYY-MM-DD como UTC,
 * o que pode causar off-by-one em fuso negativo. Aqui usamos sempre
 * componentes explícitos para evitar esse problema.
 *
 * @example
 * parseBrazilianDate("22/03/2025")  // → Date(2025, 2, 22)
 * parseBrazilianDate("2025-03-22")  // → Date(2025, 2, 22)
 * parseBrazilianDate("abc")         // → null
 */
export function parseBrazilianDate(value: string): Date | null {
  if (!value) return null;
  const s = value.toString().trim();

  // Formato DD/MM/YYYY
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const day   = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1; // 0-indexed
    const year  = parseInt(brMatch[3], 10);
    const d = new Date(year, month, day);
    // Valida que o date não foi "corrigido" automaticamente (ex: 31/02)
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
    return null;
  }

  // Formato ISO YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year  = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day   = parseInt(isoMatch[3], 10);
    const d = new Date(year, month, day);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// 7. formatDateKey
// ---------------------------------------------------------------------------
/**
 * Converte um objeto Date em chave numérica no formato YYYYMMDD.
 * Usado para joins e agrupamentos ordinais rápidos sem alocação de string.
 *
 * @example
 * formatDateKey(new Date(2025, 2, 22)) // → 20250322
 */
export function formatDateKey(date: Date): number {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return parseInt(`${y}${m}${d}`, 10);
}

// ---------------------------------------------------------------------------
// 8. formatAnoMesKey
// ---------------------------------------------------------------------------
/**
 * Converte um objeto Date em chave numérica no formato YYYYMM.
 * Usado para agrupar fatos por mês sem alocação de string.
 *
 * @example
 * formatAnoMesKey(new Date(2025, 2, 1)) // → 202503
 */
export function formatAnoMesKey(date: Date): number {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return parseInt(`${y}${m}`, 10);
}

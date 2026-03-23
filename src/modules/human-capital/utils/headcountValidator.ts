/**
 * utils/headcountValidator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Validação estrutural e de negócio do headcount.
 * Módulo puro – sem efeitos colaterais.
 *
 * Validações estruturais  → verificam cada linha individualmente
 * Validações de negócio   → verificam invariantes cruzados (soma por chapa+dia)
 */

import {
    HeadcountRecord,
    HeadcountValidationError,
    HeadcountUploadResult,
} from '../types';
import {
    REQUIRED_COLUMNS,
    RawHeadcountRow,
    normalizeHeadcountRow,
    isValidDateString,
    normalizeExcelDate,
    expandDateRange,
} from './headcount';
import type { ParsedExcelResult } from './headcount';

// ─── Tolerância decimal ───────────────────────────────────────────────────────

/** Tolerância para a soma das distribuições (cobre arredondamentos de planilha) */
const DISTRIBUTION_TOLERANCE = 0.01;

// ─── Validação Estrutural ─────────────────────────────────────────────────────

/**
 * Valida a presença de colunas obrigatórias.
 * Deve ser chamada ANTES de tentar processar as linhas.
 */
const validateColumns = (foundColumns: Set<string>): HeadcountValidationError[] => {
    const errors: HeadcountValidationError[] = [];
    for (const col of REQUIRED_COLUMNS) {
        if (!foundColumns.has(col)) {
            errors.push({
                kind: 'structural',
                message: `Coluna obrigatória ausente: "${col}". Verifique o cabeçalho da planilha.`,
            });
        }
    }
    return errors;
};

/**
 * Valida cada linha individualmente, retornando erros estruturais.
 * Retorna também o `HeadcountRecord` normalizado para as linhas válidas.
 */
const validateRows = (
    rows: RawHeadcountRow[]
): {
    validRecords: HeadcountRecord[];
    invalidRecords: HeadcountRecord[];
    errors: HeadcountValidationError[];
} => {
    const validRecords: HeadcountRecord[] = [];
    const invalidRecords: HeadcountRecord[] = [];
    const errors: HeadcountValidationError[] = [];

    for (const row of rows) {
        const rowErrors: HeadcountValidationError[] = [];

        // ── data_inicio ──────────────────────────────────────────────────────
        const dataInicio = normalizeExcelDate(row.data_inicio);
        if (!isValidDateString(dataInicio)) {
            rowErrors.push({
                kind: 'structural',
                row: row.rowIndex,
                message: `Linha ${row.rowIndex}: data_inicio inválida – valor recebido: "${row.data_inicio ?? '(vazio)'}"`,
            });
        }

        // ── data_fim ─────────────────────────────────────────────────────────
        const dataFim = normalizeExcelDate(row.data_fim);
        if (!isValidDateString(dataFim)) {
            rowErrors.push({
                kind: 'structural',
                row: row.rowIndex,
                message: `Linha ${row.rowIndex}: data_fim inválida – valor recebido: "${row.data_fim ?? '(vazio)'}"`,
            });
        }

        // ── data_inicio <= data_fim ───────────────────────────────────────────
        if (isValidDateString(dataInicio) && isValidDateString(dataFim) && dataInicio > dataFim) {
            rowErrors.push({
                kind: 'structural',
                row: row.rowIndex,
                message: `Linha ${row.rowIndex}: data_inicio (${dataInicio}) é posterior a data_fim (${dataFim})`,
            });
        }

        // ── chapa ─────────────────────────────────────────────────────────────
        const chapa = String(row.chapa ?? '').trim();
        if (!chapa) {
            rowErrors.push({
                kind: 'structural',
                row: row.rowIndex,
                message: `Linha ${row.rowIndex}: chapa obrigatória ausente`,
            });
        }

        // ── centro_custo ──────────────────────────────────────────────────────
        const cc = String(row.centro_custo ?? '').trim();
        if (!cc) {
            rowErrors.push({
                kind: 'structural',
                row: row.rowIndex,
                message: `Linha ${row.rowIndex}: centro_custo obrigatório ausente`,
            });
        }

        // ── distribuicao ──────────────────────────────────────────────────────
        const dist = Number(row.distribuicao);
        if (row.distribuicao === '' || row.distribuicao === null || row.distribuicao === undefined) {
            rowErrors.push({
                kind: 'structural',
                row: row.rowIndex,
                message: `Linha ${row.rowIndex}: distribuicao obrigatória ausente`,
            });
        } else if (isNaN(dist)) {
            rowErrors.push({
                kind: 'structural',
                row: row.rowIndex,
                message: `Linha ${row.rowIndex}: distribuicao não é um número – valor: "${row.distribuicao}"`,
            });
        } else if (dist <= 0) {
            rowErrors.push({
                kind: 'structural',
                row: row.rowIndex,
                message: `Linha ${row.rowIndex}: distribuicao deve ser > 0 (recebido: ${dist})`,
            });
        } else if (dist > 1) {
            rowErrors.push({
                kind: 'structural',
                row: row.rowIndex,
                message: `Linha ${row.rowIndex}: distribuicao deve ser ≤ 1 (recebido: ${dist})`,
            });
        }

        if (rowErrors.length > 0) {
            errors.push(...rowErrors);
            // Tenta mesmo assim normalizar para exibição
            const partial = normalizeHeadcountRow(row);
            if (partial) invalidRecords.push(partial);
        } else {
            // Linha válida – normaliza com segurança
            const record = normalizeHeadcountRow(row);
            if (record) validRecords.push(record);
        }
    }

    return { validRecords, invalidRecords, errors };
};

// ─── Validação de Negócio ─────────────────────────────────────────────────────

/**
 * Garante que para cada chapa + dia coberto pelas vigências,
 * a soma das distribuições é 1 (dentro da tolerância).
 *
 * Algoritmo:
 * 1. Para cada HeadcountRecord válido, expande o período em dias individuais
 * 2. Para cada chapa+dia, acumula a soma das distribuições
 * 3. Verifica se a soma ≈ 1
 *
 * Só retorna o PRIMEIRO dia problemático por chapa para evitar inundar o usuário
 * com centenas de erros repetitivos (ex.: chapa com soma 1.3 em todos os 31 dias do mês).
 */
export const validateBusinessRules = (records: HeadcountRecord[]): HeadcountValidationError[] => {
    if (records.length === 0) return [];

    // Acumula: Map<chapa, Map<date, totalDistribuicao>>
    const accumulator = new Map<string, Map<string, number>>();

    for (const rec of records) {
        const days = expandDateRange(rec.dataInicio, rec.dataFim);
        if (!accumulator.has(rec.chapa)) {
            accumulator.set(rec.chapa, new Map());
        }
        const chapaMap = accumulator.get(rec.chapa)!;
        for (const day of days) {
            chapaMap.set(day, (chapaMap.get(day) ?? 0) + rec.distribuicao);
        }
    }

    const errors: HeadcountValidationError[] = [];

    for (const [chapa, dayMap] of accumulator) {
        // Agrupa dias problemáticos para reportar de forma compacta
        const badDays: Array<{ date: string; soma: number }> = [];

        for (const [date, soma] of dayMap) {
            if (Math.abs(soma - 1) > DISTRIBUTION_TOLERANCE) {
                badDays.push({ date, soma });
            }
        }

        if (badDays.length === 0) continue;

        // Ordena por data para facilitar leitura
        badDays.sort((a, b) => a.date.localeCompare(b.date));

        // Limita a mensagem: mostra os 3 primeiros dias e indica quantos mais
        const displayDays = badDays.slice(0, 3);
        const remainder = badDays.length - displayDays.length;
        const dayList = displayDays
            .map(({ date, soma }) => `${date} (soma = ${soma.toFixed(2)})`)
            .join(', ');
        const suffix = remainder > 0 ? ` e mais ${remainder} dia(s)` : '';

        errors.push({
            kind: 'business',
            chapa,
            date: badDays[0].date,
            message:
                `Chapa ${chapa}: soma das distribuições ≠ 1 em ${badDays.length} dia(s). ` +
                `Exemplos: ${dayList}${suffix}. ` +
                `Esperado: 1.00 (tolerância ±${DISTRIBUTION_TOLERANCE}).`,
        });
    }

    return errors;
};

// ─── Pipeline completa ────────────────────────────────────────────────────────

/**
 * Executa a pipeline de validação completa a partir do resultado do parse.
 * Retorna o `HeadcountUploadResult` pronto para exibição na UI.
 */
export const runFullValidation = (parsed: ParsedExcelResult): HeadcountUploadResult => {
    // 1. Colunas
    const columnErrors = validateColumns(parsed.foundColumns);

    // Se faltam colunas, não faz sentido validar as linhas
    if (columnErrors.length > 0) {
        return {
            validRecords: [],
            invalidRecords: [],
            structuralErrors: columnErrors,
            businessErrors: [],
            totalRows: parsed.totalRows,
            periodStart: undefined,
            periodEnd: undefined,
            uniqueChapas: 0,
            isBusinessValid: false,
        };
    }

    // 2. Linhas individualmente
    const { validRecords, invalidRecords, errors: rowErrors } = validateRows(parsed.rows);

    // 3. Regras de negócio (apenas sobre registros estruturalmente válidos)
    const businessErrors = validateBusinessRules(validRecords);

    // 4. Métricas de período e chapas
    let periodStart: string | undefined;
    let periodEnd: string | undefined;
    const chapaSet = new Set<string>();

    for (const r of validRecords) {
        chapaSet.add(r.chapa);
        if (!periodStart || r.dataInicio < periodStart) periodStart = r.dataInicio;
        if (!periodEnd || r.dataFim > periodEnd) periodEnd = r.dataFim;
    }

    return {
        validRecords,
        invalidRecords,
        structuralErrors: rowErrors,
        businessErrors,
        totalRows: parsed.totalRows,
        periodStart,
        periodEnd,
        uniqueChapas: chapaSet.size,
        isBusinessValid: businessErrors.length === 0,
    };
};

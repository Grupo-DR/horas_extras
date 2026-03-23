/**
 * utils/headcount.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Parse e normalização de planilhas Excel de headcount.
 * Este módulo é puro (sem efeitos colaterais / sem chamadas a serviços).
 *
 * Layout esperado da planilha (cabeçalho na primeira linha, case-insensitive):
 *   data_inicio | data_fim | chapa | centro_custo | distribuicao
 */

import * as XLSX from 'xlsx';
import { HeadcountRecord } from '../types';

// ─── Constantes ───────────────────────────────────────────────────────────────

export const REQUIRED_COLUMNS = [
    'data_inicio',
    'data_fim',
    'chapa',
    'centro_custo',
    'distribuicao',
] as const;

export type RequiredColumn = typeof REQUIRED_COLUMNS[number];

// ─── Tipos internos ───────────────────────────────────────────────────────────

/**
 * Linha bruta vinda do xlsx antes de qualquer validação ou transformação.
 * Os valores são string | number | undefined porque o xlsx pode retornar qualquer um desses.
 */
export interface RawHeadcountRow {
    rowIndex: number; // 1-based, excluindo cabeçalho (ex.: linha 2 do Excel = rowIndex 1)
    data_inicio?: unknown;
    data_fim?: unknown;
    chapa?: unknown;
    centro_custo?: unknown;
    distribuicao?: unknown;
}

/** Resultado da leitura bruta do Excel antes da normalização */
export interface ParsedExcelResult {
    /** Mapa de colunas encontradas (lowercase) */
    foundColumns: Set<string>;
    /** Linhas brutas */
    rows: RawHeadcountRow[];
    /** Total de linhas de dados (sem cabeçalho) */
    totalRows: number;
}

// ─── Helpers de data ─────────────────────────────────────────────────────────

/**
 * Converte a representação de data do xlsx para 'YYYY-MM-DD'.
 * O xlsx pode retornar:
 *  - number serial do Excel (ex.: 45000)
 *  - string no formato 'DD/MM/YYYY', 'YYYY-MM-DD', 'M/D/YYYY', etc.
 */
export const normalizeExcelDate = (raw: unknown): string | null => {
    if (raw === null || raw === undefined || raw === '') return null;

    // Número serial do Excel
    if (typeof raw === 'number') {
        // XLSX.SSF.parse_date_code devolve { y, m, d, H, M, S }
        const dateJs = XLSX.SSF.parse_date_code(raw);
        if (!dateJs) return null;
        const y = String(dateJs.y).padStart(4, '0');
        const m = String(dateJs.m).padStart(2, '0');
        const d = String(dateJs.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const s = String(raw).trim();

    // Já está em YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // DD/MM/YYYY (padrão brasileiro)
    const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
        const [, d, m, y] = brMatch;
        return `${y}-${m}-${d}`;
    }

    // M/D/YYYY (padrão americano)
    const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
        const [, m, d, y] = usMatch;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Tenta Date nativo como último recurso
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        const y = String(d.getFullYear()).padStart(4, '0');
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${mo}-${dd}`;
    }

    return null;
};

/** Valida se uma string 'YYYY-MM-DD' representa uma data real e plausível (> 2000) */
export const isValidDateString = (s: string | null): s is string => {
    if (!s) return false;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return false;
    if (y < 2000 || y > 2100) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() + 1 === m && dt.getDate() === d;
};

// ─── Helpers de coluna ────────────────────────────────────────────────────────

/**
 * Normaliza um cabeçalho para lowercase, sem espaços extras.
 * ex.: "Centro_Custo " → "centro_custo"
 */
const normalizeHeader = (h: string): string =>
    h.toLowerCase().trim().replace(/\s+/g, '_');

// ─── Parse principal ──────────────────────────────────────────────────────────

/**
 * Lê um arquivo Excel (.xlsx / .xls / .csv aceitos pela lib xlsx)
 * e retorna os dados brutos com mapa de colunas encontradas.
 *
 * NÃO valida – apenas estrutura os dados para a camada de validação.
 */
export const parseHeadcountXlsx = async (file: File): Promise<ParsedExcelResult> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

    // Usa a primeira aba
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        return { foundColumns: new Set(), rows: [], totalRows: 0 };
    }

    const sheet = workbook.Sheets[sheetName];

    // sheet_to_json com header:1 retorna Array<Array<unknown>>
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (raw.length === 0) {
        return { foundColumns: new Set(), rows: [], totalRows: 0 };
    }

    // Primeira linha = cabeçalhos
    const headerRow = (raw[0] as unknown[]).map(h => normalizeHeader(String(h ?? '')));
    const foundColumns = new Set(headerRow.filter(h => h !== ''));

    // Mapeia índice de cada coluna necessária
    const colIndex: Record<RequiredColumn, number> = {
        data_inicio: headerRow.indexOf('data_inicio'),
        data_fim: headerRow.indexOf('data_fim'),
        chapa: headerRow.indexOf('chapa'),
        centro_custo: headerRow.indexOf('centro_custo'),
        distribuicao: headerRow.indexOf('distribuicao'),
    };

    // Linhas de dados (índice 1 em diante)
    const dataRows = raw.slice(1);
    const rows: RawHeadcountRow[] = dataRows
        .map((r, i) => {
            const row = r as unknown[];
            return {
                rowIndex: i + 2, // +2 porque: 1-based + pula o cabeçalho
                data_inicio: colIndex.data_inicio >= 0 ? row[colIndex.data_inicio] : undefined,
                data_fim: colIndex.data_fim >= 0 ? row[colIndex.data_fim] : undefined,
                chapa: colIndex.chapa >= 0 ? row[colIndex.chapa] : undefined,
                centro_custo: colIndex.centro_custo >= 0 ? row[colIndex.centro_custo] : undefined,
                distribuicao: colIndex.distribuicao >= 0 ? row[colIndex.distribuicao] : undefined,
            };
        })
        // Remove linhas completamente vazias
        .filter(r =>
            r.data_inicio !== '' || r.data_fim !== '' ||
            r.chapa !== '' || r.centro_custo !== '' || r.distribuicao !== ''
        );

    return { foundColumns, rows, totalRows: rows.length };
};

// ─── Normalização ─────────────────────────────────────────────────────────────

/**
 * Tenta normalizar uma linha bruta para `HeadcountRecord`.
 * Retorna `null` se qualquer campo obrigatório estiver ausente ou inválido
 * (as mensagens de erro detalhadas ficam a cargo do validator).
 */
export const normalizeHeadcountRow = (row: RawHeadcountRow): HeadcountRecord | null => {
    const dataInicio = normalizeExcelDate(row.data_inicio);
    const dataFim = normalizeExcelDate(row.data_fim);
    const chapa = String(row.chapa ?? '').trim().toUpperCase();
    const centroCusto = String(row.centro_custo ?? '').trim().toUpperCase();
    const distribuicao = Number(row.distribuicao);

    if (
        !isValidDateString(dataInicio) ||
        !isValidDateString(dataFim) ||
        !chapa ||
        !centroCusto ||
        isNaN(distribuicao)
    ) {
        return null;
    }

    return { dataInicio, dataFim, chapa, centroCusto, distribuicao };
};

// ─── Utilidade: gerar todos os dias de um período ─────────────────────────────

/**
 * Retorna array de strings 'YYYY-MM-DD' de todos os dias entre inicio e fim (inclusive).
 * Limitado a 1825 dias (5 anos) para evitar loops infinitos em dados ruins.
 */
export const expandDateRange = (dataInicio: string, dataFim: string): string[] => {
    const dates: string[] = [];
    const start = new Date(dataInicio + 'T12:00:00');
    const end = new Date(dataFim + 'T12:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return dates;

    const MAX_DAYS = 1825;
    const current = new Date(start);
    while (current <= end && dates.length < MAX_DAYS) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        current.setDate(current.getDate() + 1);
    }
    return dates;
};

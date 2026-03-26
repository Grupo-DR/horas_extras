import { formatDecimalHours } from './formatters';

export const formatDecimalToTime = (decimalHours: number): string => {
    if (isNaN(decimalHours) || decimalHours === null) return '00:00';
    return formatDecimalHours(decimalHours);
};

export const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const parseDateKey = (dateKey: string): Date => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
};

const PAYROLL_COMPETENCY_START_DAY = 21;
const PAYROLL_COMPETENCY_END_DAY = 20;

export const toDateKey = (dateInput?: string | Date | null): string => {
    if (!dateInput) return '';

    if (dateInput instanceof Date) {
        return isNaN(dateInput.getTime()) ? '' : formatDateKey(dateInput);
    }

    const normalized = dateInput.trim();
    const isoMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    const parsed = new Date(normalized);
    return isNaN(parsed.getTime()) ? '' : formatDateKey(parsed);
};

export const getPayrollCompetencyMonthKey = (dateString: string): string => {
    const dateKey = toDateKey(dateString);
    if (!dateKey) return '';

    const dateObj = parseDateKey(dateKey);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const day = dateObj.getDate();

    let payrollYear = year;
    let payrollMonth = month;

    if (day >= 21) {
        payrollMonth += 1;
        if (payrollMonth > 11) {
            payrollMonth = 0;
            payrollYear += 1;
        }
    }

    return `${payrollYear}-${String(payrollMonth + 1).padStart(2, '0')}`;
};

const parseMonthKey = (monthKey: string): { year: number; month: number } | null => {
    const match = monthKey.trim().match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!year || month < 1 || month > 12) return null;

    return { year, month };
};

export interface PayrollCompetencyRange {
    monthKey: string;
    startDate: string;
    endDate: string;
}

export const getPayrollCompetencyRange = (monthKey: string): PayrollCompetencyRange | null => {
    const parsed = parseMonthKey(monthKey);
    if (!parsed) return null;

    const start = new Date(parsed.year, parsed.month - 2, PAYROLL_COMPETENCY_START_DAY, 12, 0, 0, 0);
    const end = new Date(parsed.year, parsed.month - 1, PAYROLL_COMPETENCY_END_DAY, 12, 0, 0, 0);

    return {
        monthKey: `${parsed.year}-${String(parsed.month).padStart(2, '0')}`,
        startDate: formatDateKey(start),
        endDate: formatDateKey(end),
    };
};

const getInclusiveRangeDays = (startDate: string, endDate: string): number => {
    const start = parseDateKey(startDate);
    const end = parseDateKey(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / 86400000) + 1;
};

export const getDateRangeOverlapDays = (
    firstStartDate: string,
    firstEndDate: string,
    secondStartDate: string,
    secondEndDate: string
): number => {
    const firstStart = toDateKey(firstStartDate);
    const firstEnd = toDateKey(firstEndDate);
    const secondStart = toDateKey(secondStartDate);
    const secondEnd = toDateKey(secondEndDate);

    if (!firstStart || !firstEnd || !secondStart || !secondEnd) return 0;

    const overlapStart = firstStart > secondStart ? firstStart : secondStart;
    const overlapEnd = firstEnd < secondEnd ? firstEnd : secondEnd;

    return getInclusiveRangeDays(overlapStart, overlapEnd);
};

export const getPayrollCompetencyOverlapDays = (
    monthKey: string,
    startDate: string,
    endDate: string
): number => {
    const range = getPayrollCompetencyRange(monthKey);
    if (!range) return 0;

    return getDateRangeOverlapDays(range.startDate, range.endDate, startDate, endDate);
};

export const getPayrollMonthKey = (dateString: string): string => {
    const monthKey = getPayrollCompetencyMonthKey(dateString);
    if (!monthKey) return '';

    return `${monthKey}-Payroll`;
};

export const getPayrollCompetencyMonthKeysForRange = (startDate: string, endDate: string): string[] => {
    const startKey = toDateKey(startDate);
    const endKey = toDateKey(endDate);
    if (!startKey || !endKey) return [];

    const start = parseDateKey(startKey);
    const end = parseDateKey(endKey);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

    const keys = new Set<string>();
    const cursor = new Date(start);
    cursor.setHours(12, 0, 0, 0);

    let guard = 0;
    while (cursor <= end && guard < 48) {
        const monthKey = getPayrollCompetencyMonthKey(formatDateKey(cursor));
        if (monthKey) keys.add(monthKey);

        if (cursor.getDate() < 21) {
            cursor.setDate(21);
        } else {
            cursor.setMonth(cursor.getMonth() + 1, 1);
        }
        cursor.setHours(12, 0, 0, 0);
        guard += 1;
    }

    return Array.from(keys).sort();
};

export const isExtraEvent = (evento?: string): boolean => {
    const evt = (evento || '').toUpperCase();
    return evt.includes('EXTRA');
};

export const isExtra100Event = (evento?: string): boolean => {
    const evt = (evento || '').toUpperCase();
    return isExtraEvent(evt) && evt.includes('100');
};

export const isExtra60Event = (evento?: string): boolean => {
    const evt = (evento || '').toUpperCase();
    return isExtraEvent(evt) && evt.includes('60') && !evt.includes('100');
};

export const isInterjornadaEvent = (evento?: string): boolean => {
    const evt = (evento || '').toUpperCase();
    return evt.includes('INTER');
};

export const isNoturnoEvent = (evento?: string): boolean => {
    const evt = (evento || '').toUpperCase();
    return evt.includes('NOTURNO') || evt.includes('NOT');
};

export const isRelevantOvertimeEvent = (evento?: string): boolean => {
    return isExtraEvent(evento) || isInterjornadaEvent(evento) || isNoturnoEvent(evento);
};

export const normalizeCC = (cc?: string): string => cc ? cc.trim().toUpperCase() : 'S/ CC';
export const normalizeFunction = (funcao?: string): string => funcao ? funcao.trim().toUpperCase() : 'S/ FUNÇÃO';
export const normalizeName = (nome?: string): string => nome ? nome.trim().toUpperCase() : 'S/ NOME';
export const normalizeChapa = (chapa?: string): string => chapa ? chapa.trim().toUpperCase() : '';

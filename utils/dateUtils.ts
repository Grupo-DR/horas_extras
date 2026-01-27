
import { Timestamp } from 'firebase/firestore';

/**
 * Safely parses any date input (string, Date, Timestamp) into a valid Javascript Date object.
 * Returns null if the date is invalid.
 * 
 * Rules:
 * - If string is YYYY-MM-DD, appends T12:00:00 to prevent timezone offsets.
 * - If Timestamp, converts to Date.
 * - Validation check is passed before returning.
 */
export const safeDateParse = (value: any): Date | null => {
    if (!value) return null;

    let date: Date;

    if (value instanceof Timestamp) {
        date = value.toDate();
    } else if (value instanceof Date) {
        date = value;
    } else if (typeof value === 'string') {
        // If it's a simple ISO date (YYYY-MM-DD), force noon to avoid timezone shift
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            date = new Date(`${value}T12:00:00`);
        } else {
            date = new Date(value);
        }
    } else {
        return null;
    }

    // Final sanity check
    if (isNaN(date.getTime())) return null;

    return date;
};

/**
 * Formats a date for use in <input type="date" /> (YYYY-MM-DD).
 */
export const formatDateForInput = (date: any): string => {
    const d = safeDateParse(date);
    if (!d) return '';
    // Use Local Time components to match the "Noon" strategy (avoiding UTC shifts)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Converts a value to a Firestore Timestamp safely.
 * returns Timestamp.now() if invalid, to prevent crashes, or null if preferred (but Timestamp expected often).
 * We will return null if invalid so the service can decide to throw or ignore.
 */
export const toFirestoreTimestamp = (value: any): Timestamp | null => {
    const d = safeDateParse(value);
    if (!d) return null;
    return Timestamp.fromDate(d);
};

/**
 * Converts ISO date format (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY).
 * Used when importing RDO JSONs from Python that use ISO format.
 */
export const isoToBrazilianDate = (isoDate: string | null): string | null => {
    if (!isoDate) return null;

    // Check if already in Brazilian format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoDate)) {
        return isoDate;
    }

    // Convert ISO to Brazilian
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        const [year, month, day] = isoDate.split('-');
        return `${day}/${month}/${year}`;
    }

    return isoDate; // Return as-is if unrecognized format
};

/**
 * Converts Brazilian date format (DD/MM/YYYY) to ISO format (YYYY-MM-DD).
 * Used when saving dates to ensure consistency.
 */
export const brazilianToIsoDate = (brDate: string | null): string | null => {
    if (!brDate) return null;

    // Check if already in ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(brDate)) {
        return brDate;
    }

    // Convert Brazilian to ISO
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(brDate)) {
        const [day, month, year] = brDate.split('/');
        return `${year}-${month}-${day}`;
    }

    return brDate; // Return as-is if unrecognized format
};

/**
 * Formats a date to Brazilian format (DD/MM/YYYY) for display.
 * Accepts Date objects, ISO strings, or Brazilian strings.
 */
export const formatBrazilianDate = (date: any): string => {
    const d = safeDateParse(date);
    if (!d) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
};


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
    return d.toISOString().split('T')[0];
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

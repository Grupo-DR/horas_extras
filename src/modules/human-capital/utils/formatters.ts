
export const formatDecimalHours = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) return '00:00';

    const hours = Math.floor(Math.abs(value));
    const decimalPart = Math.abs(value) - hours;
    let minutes = Math.round(decimalPart * 60);

    let displayHours = hours;

    if (minutes === 60) {
        displayHours += 1;
        minutes = 0;
    }

    const sign = value < 0 ? '-' : '';

    return `${sign}${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const parseTimeToDecimal = (timeString: string): number => {
    if (!timeString) return 0;

    // Handle "HH:mm" format
    if (timeString.includes(':')) {
        const [hours, minutes] = timeString.split(':').map(Number);
        if (isNaN(hours)) return 0;
        const mins = isNaN(minutes) ? 0 : minutes;
        return hours + (mins / 60);
    }

    // Handle plain number string ("8" -> 8.0, "8.5" -> 8.5)
    const num = parseFloat(timeString.replace(',', '.'));
    return isNaN(num) ? 0 : num;
};

/**
 * Converte data de YYYY-MM-DD para MM/DD/AAAA (formato da API)
 */
export const formatDateForApi = (dateStr: string): string => {
    if (!dateStr || !dateStr.includes('-')) return dateStr;
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
};

/**
 * Converte data de MM/DD/AAAA para YYYY-MM-DD (formato do input date)
 */
export const formatDateForInput = (dateStr: string): string => {
    if (!dateStr || !dateStr.includes('/')) return dateStr;
    const [month, day, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

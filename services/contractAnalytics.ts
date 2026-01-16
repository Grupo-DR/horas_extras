import {
    Contract,
    ContractEvent,
    ContractMeasurement
} from '../types';
import {
    addMonths,
    startOfMonth,
    endOfMonth,
    isSameMonth,
    format,
    differenceInMonths
} from 'date-fns';
import { safeDateParse } from '../utils/dateUtils';
import { ptBR } from 'date-fns/locale';

export interface TimelineDataPoint {
    monthKey: string;     // '2024-01' (Sortable)
    label: string;        // 'Jan/24' (Display)
    date: Date;           // Raw Date for XAxis

    // Financial Values
    measuredMonthly: number;    // Bar: Produced in this month
    accumulated: number;        // Line: Total accumulated physically
    contractValue: number;      // Step Line: Active Contract Ceiling
    balance: number;            // Line: Remaining Balance (Contract - Accumulated)

    // Metadata
    events: ContractEvent[];    // Markers
    isProjected: boolean;       // Future projection flag
}

/**
 * Calculates the month-by-month financial timeline of a contract.
 * Responds to Additives (Value/Term) and Measurements.
 */
export const generateFinancialTimeline = (contract: Contract): TimelineDataPoint[] => {
    // 1. Sanitize & Sort Inputs to prevent chaos
    const startDate = safeDateParse(contract.startDate) || new Date();
    // Default initial values if missing (migration compatibility)
    const initialValue = contract.initialValue || contract.currentValue || (contract as any).totalValue || 0;
    const initialEndDate = safeDateParse(contract.initialEndDate) || safeDateParse((contract as any).endDate) || new Date();

    const sortedEvents = [...(contract.events || [])].sort((a, b) => {
        const da = safeDateParse(a.date) || new Date();
        const db = safeDateParse(b.date) || new Date();
        return da.getTime() - db.getTime();
    });

    const sortedMeasurements = [...(contract.measurements || [])].sort((a, b) => {
        const da = safeDateParse(a.date) || new Date();
        const db = safeDateParse(b.date) || new Date();
        return da.getTime() - db.getTime();
    });

    // 2. Determine Time Range
    // Start: Contract Start
    // End: Max(Effective End Date, Today, Last Measurement) + Buffer

    // Calculate effective end date from events
    let effectiveEndDate = new Date(initialEndDate);
    sortedEvents.forEach(e => {
        if (e.termDeltaDays) {
            effectiveEndDate.setDate(effectiveEndDate.getDate() + e.termDeltaDays);
        }
    });

    const today = new Date();
    const lastMeasurementDate = sortedMeasurements.length > 0
        ? (safeDateParse(sortedMeasurements[sortedMeasurements.length - 1].date) || new Date())
        : startDate;

    // The chart should go at least until the latest relevant date
    let finalDate = new Date(Math.max(effectiveEndDate.getTime(), today.getTime(), lastMeasurementDate.getTime()));

    // Add a small buffer (1 month) for visualization comfort
    finalDate = addMonths(finalDate, 1);

    // Iteration Setup
    let cursorDate = startOfMonth(startDate);
    const timeline: TimelineDataPoint[] = [];

    // Running Totals
    let runningContractValue = initialValue;
    let runningAccumulated = 0;

    // To handle "gaps" in measurements where we just carry over the accumulated value
    // We only carry over if the contract has visibly started measuring
    let hasStartedMeasurement = false;

    // Loop Month by Month
    while (cursorDate <= finalDate) {
        const monthEnd = endOfMonth(cursorDate);

        // A. Process Events active for this month
        // Logic: Event impacts value starting from its month of occurrence
        const monthEvents = sortedEvents.filter(e => {
            const d = safeDateParse(e.date);
            return d && isSameMonth(d, cursorDate);
        });

        monthEvents.forEach(e => {
            runningContractValue += (e.valueDelta || 0);
        });

        // B. Process Measurements for this month
        // We find the measurement declared for this month
        const monthMeasurement = sortedMeasurements.find(m => {
            const d = safeDateParse(m.date);
            return d && isSameMonth(d, cursorDate);
        });

        let measuredInternal = 0;

        if (monthMeasurement) {
            hasStartedMeasurement = true;
            measuredInternal = monthMeasurement.value;

            // Optional: If the measurement carries a "state of truth" for totals, use it?
            // Relying on internal sum is safer for graph consistency unless we trust the importation 100%
            // But let's respect the "value" property as the monthly production.
            runningAccumulated += measuredInternal;
        }

        // C. Build Data Point
        // If future: we stop accumulating (flat line) or project? 
        // Request said: "Linha acumulada deve crescer monotonicamente" -> implied history.
        // For future, flat line is best to show "nothing happened yet".

        const isFuture = cursorDate > today && !isSameMonth(cursorDate, today);

        timeline.push({
            monthKey: format(cursorDate, 'yyyy-MM'),
            label: format(cursorDate, 'MMM/yy', { locale: ptBR }),
            date: new Date(cursorDate),

            measuredMonthly: monthMeasurement ? measuredInternal : 0,

            // If we haven't started measuring, accum is 0. 
            // If we have, it holds the last value.
            accumulated: runningAccumulated,

            contractValue: runningContractValue,
            balance: runningContractValue - runningAccumulated,

            events: monthEvents,
            isProjected: isFuture
        });

        // Next
        cursorDate = addMonths(cursorDate, 1);
    }

    return timeline;
};

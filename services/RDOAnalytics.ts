import { differenceInDays, parse, isValid } from 'date-fns';

// Types representing the dashboard data layers
export interface DailyKPI {
    date: string; // ISO date
    dateObj: Date;
    dayOfWeek: string;

    // Safety / Occurrences
    occurrenceCount: number;
    hasCriticalOccurrence: boolean;
    weatherCondition: string; // "Praticável" | "Impraticável"

    // Labor
    totalPeople: number;
    totalManHours: number; // Sum of hours (needs parsing)

    // Equipment
    equipmentCount: number; // Distinct pieces of equipment

    // Physical Progress (Simplified)
    activeActivities: number;
}

export interface ActivityProgress {
    code: string;
    fullDescription: string;
    unit: string;
    percentage: number;
    lastStatus: string;
}

export const RDOAnalytics = {

    getDailyKPIs: (rdos: any[]): DailyKPI[] => {
        return rdos.map((rdo: any) => {
            const dateStr = rdo.relatorio?.data; // "18/11/2025"
            // Parse date "dd/MM/yyyy" -> Date Object
            let dateObj = new Date();
            try {
                if (dateStr) {
                    dateObj = parse(dateStr, 'dd/MM/yyyy', new Date());
                }
            } catch (e) {
                console.error("Date parse error", dateStr);
            }

            // 1. Occurrences (Count only)
            const occurrenceCount = rdo.ocorrencias ? rdo.ocorrencias.length : 0;

            // 2. Equipment (Count only)
            const equipmentCount = rdo.equipamentos ? rdo.equipamentos.length : 0;

            // 3. Labor (People count & Estimate HH)
            const people = rdo.mao_de_obra || [];
            const totalPeople = people.length;
            // Simple logic: 9h per person average if not parsed, or try to parse "09:00"
            const totalManHours = people.reduce((acc: number, p: any) => {
                const hStr = p.horas; // "09:00"
                if (!hStr) return acc + 9;
                const parts = hStr.split(':');
                const hours = parseInt(parts[0]) + (parseInt(parts[1]) / 60);
                return acc + (isNaN(hours) ? 0 : hours);
            }, 0);

            // 4. Weather
            const weatherMorning = rdo.clima?.manha?.condicao || 'Praticável';
            const weatherAfternoon = rdo.clima?.tarde?.condicao || 'Praticável';
            const weatherCondition = (weatherMorning === 'Impraticável' || weatherAfternoon === 'Impraticável')
                ? 'Impraticável'
                : 'Praticável';

            const activeActivities = rdo.atividades ? rdo.atividades.length : 0;

            return {
                date: dateStr || 'N/D',
                dateObj: dateObj,
                dayOfWeek: rdo.relatorio?.dia_semana || '',
                occurrenceCount,
                hasCriticalOccurrence: occurrenceCount > 2, // Arbitrary threshold for demo
                weatherCondition,
                totalPeople,
                totalManHours,
                equipmentCount,
                activeActivities
            };
        }).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    },

    // Get aggregated stats for the "Executive View"
    getExecutiveStats: (rdos: any[]) => {
        const daily = RDOAnalytics.getDailyKPIs(rdos);

        // Accumulators
        const totalManHours = daily.reduce((acc, d) => acc + d.totalManHours, 0);
        const totalOccurrences = daily.reduce((acc, d) => acc + d.occurrenceCount, 0);
        const badWeatherDays = daily.filter(d => d.weatherCondition === 'Impraticável').length;

        // Averages
        const avgPeople = daily.length ? Math.round(daily.reduce((acc, d) => acc + d.totalPeople, 0) / daily.length) : 0;
        const avgEquipment = daily.length ? Math.round(daily.reduce((acc, d) => acc + d.equipmentCount, 0) / daily.length) : 0;

        return {
            totalManHours,
            totalOccurrences,
            badWeatherDays,
            avgPeople,
            avgEquipment,
            dataPoints: daily.length
        };
    },

    // Extract Activity History for Gantt/Line chart
    getActivityProgress: (rdos: any[]): ActivityProgress[] => {
        // Group by Activity Description to track progress
        // This is tricky because description texts vary slightly.
        // For MVP, we will list latest status of distinct activities.
        const activitiesMap = new Map<string, any>();

        rdos.forEach((rdo: any) => {
            if (!rdo.atividades) return;
            rdo.atividades.forEach((act: any) => {
                // Key: First 15 chars of description to group similar items? Or split by code "3003537"
                const desc = act.descricao || "";
                const codeMatch = desc.match(/^\d+/); // "3003537"
                const key = codeMatch ? codeMatch[0] : desc.substring(0, 20);

                // Parse Percentage "50% - Em Andamento" or "2%"
                const statusStr = act.status || "";
                const percentMatch = statusStr.match(/(\d+(\.\d+)?)%/);
                const percentage = percentMatch ? parseFloat(percentMatch[1]) : 0;

                const existing = activitiesMap.get(key);
                // Keep the one with highest progress or latest date
                if (!existing || percentage > existing.percentage) {
                    activitiesMap.set(key, {
                        code: key,
                        fullDescription: desc,
                        unit: act.unidade,
                        percentage: percentage,
                        lastStatus: statusStr
                    });
                }
            });
        });

        return Array.from(activitiesMap.values());
    }
};

import React, { useState, useMemo } from 'react';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
    parse, isValid
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { ExtractedRDO } from '../../types';
import { CalendarDayCell, DailyMetrics } from './CalendarDayCell';

interface Props {
    rdos: ExtractedRDO[];
}

export const SiteCalendar: React.FC<Props> = ({ rdos }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // 1. Generate Calendar Grid
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentDate]);

    // 2. Aggregate Data by Date
    const dailyDataMap = useMemo(() => {
        const map = new Map<string, DailyMetrics>();

        rdos.forEach(rdo => {
            const dateStr = rdo.relatorio?.data;
            if (!dateStr) return;

            // Parse Date exactly as in Analytics logic
            let rdoDate: Date | null = null;
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                rdoDate = parse(dateStr, 'yyyy-MM-dd', new Date());
            } else if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                rdoDate = parse(dateStr, 'dd/MM/yyyy', new Date());
            }

            if (!rdoDate || !isValid(rdoDate)) return;

            const key = format(rdoDate, 'yyyy-MM-dd');

            const existing = map.get(key) || {
                date: rdoDate,
                totalPeople: 0,
                totalEquipment: 0,
                weatherMorning: '',
                weatherAfternoon: '',
                occurrenceCount: 0,
                hasRDO: true
            };

            // Aggregate Counts
            existing.totalPeople += (rdo.mao_de_obra?.length || 0);
            existing.totalEquipment += (rdo.equipamentos?.length || 0);
            existing.occurrenceCount += (rdo.ocorrencias?.length || 0);

            // Weather Logic: Concatenate distinct conditions or prioritize bad weather
            // Simple accumulation for display logic in cell
            if (rdo.clima?.manha?.condicao) existing.weatherMorning += ' ' + rdo.clima.manha.condicao;
            if (rdo.clima?.tarde?.condicao) existing.weatherAfternoon += ' ' + rdo.clima.tarde.condicao;

            map.set(key, existing);
        });

        return map;
    }, [rdos]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            {/* Calendar Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="text-blue-600" />
                    <h2 className="text-lg font-bold text-slate-800 capitalize">
                        {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                    </h2>
                </div>
                <div className="flex gap-1">
                    <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                        <ChevronLeft />
                    </button>
                    <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                        <ChevronRight />
                    </button>
                </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 divide-x divide-slate-200">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <div key={day} className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 auto-rows-fr flex-1 divide-x divide-y divide-slate-100 bg-slate-50">
                {calendarDays.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const metrics = dailyDataMap.get(dateKey);
                    const isCurrent = isSameMonth(day, currentDate);

                    return (
                        <CalendarDayCell
                            key={dateKey}
                            day={day}
                            metrics={metrics}
                            isCurrentMonth={isCurrent}
                        />
                    );
                })}
            </div>
        </div>
    );
};

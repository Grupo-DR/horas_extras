import React from 'react';
import { Users, Tractor, AlertTriangle, CloudRain, Sun, Cloud, Droplets } from 'lucide-react';

export interface DailyMetrics {
    date: Date;
    totalPeople: number;
    totalEquipment: number;
    weatherMorning: string;
    weatherAfternoon: string;
    occurrenceCount: number;
    hasRDO: boolean;
}

interface Props {
    day: Date;
    metrics?: DailyMetrics;
    isCurrentMonth: boolean;
    onClick?: () => void;
}

export const CalendarDayCell: React.FC<Props> = ({ day, metrics, isCurrentMonth, onClick }) => {

    // Helper to determine dominant weather icon
    const getWeatherIcon = (m?: string, a?: string) => {
        const combined = ((m || '') + (a || '')).toLowerCase();
        if (combined.includes('chuva')) return <CloudRain size={14} className="text-purple-500" />;
        if (combined.includes('nublado')) return <Cloud size={14} className="text-slate-400" />;
        if (combined.includes('sol') || combined.includes('limpo')) return <Sun size={14} className="text-orange-400" />;
        return null; // No icon if no data or unknown
    };

    if (!metrics?.hasRDO) {
        return (
            <div className={`min-h-[100px] border-b border-r p-2 transition-colors ${isCurrentMonth ? 'bg-white' : 'bg-slate-50 text-slate-300'}`}>
                <div className="text-xs font-semibold mb-1">{day.getDate()}</div>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className={`min-h-[100px] border-b border-r p-2 cursor-pointer transition-all hover:bg-blue-50/50 group ${isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'}`}
        >
            <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold leading-none ${isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                    {day.getDate()}
                </span>
                {getWeatherIcon(metrics.weatherMorning, metrics.weatherAfternoon)}
            </div>

            <div className="space-y-1">
                {/* Labor */}
                <div className="flex items-center gap-1.5" title="Total de Colaboradores">
                    <div className="bg-blue-100 text-blue-600 p-0.5 rounded">
                        <Users size={10} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">{metrics.totalPeople}</span>
                </div>

                {/* Equipment */}
                <div className="flex items-center gap-1.5" title="Total de Equipamentos">
                    <div className="bg-yellow-100 text-yellow-600 p-0.5 rounded">
                        <Tractor size={10} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">{metrics.totalEquipment}</span>
                </div>

                {/* Occurrences - Only show if > 0 */}
                {metrics.occurrenceCount > 0 && (
                    <div className="flex items-center gap-1.5 mt-1 animate-pulse" title="Ocorrências Registradas">
                        <div className="bg-red-100 text-red-600 p-0.5 rounded">
                            <AlertTriangle size={10} />
                        </div>
                        <span className="text-[10px] font-bold text-red-600">{metrics.occurrenceCount}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

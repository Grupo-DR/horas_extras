import React from 'react';
import { Users, Tractor, AlertTriangle, CloudRain, Sun, Cloud } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

    // Helper to check for bad weather text
    const hasBadWeather = (m?: string, a?: string) => {
        const combined = ((m || '') + (a || '')).toLowerCase();
        return combined.includes('chuva') || combined.includes('impraticável');
    };

    const isBadWeather = metrics ? hasBadWeather(metrics.weatherMorning, metrics.weatherAfternoon) : false;

    if (!metrics?.hasRDO) {
        return (
            <div className={`min-h-[140px] border-b border-r p-2 transition-colors flex flex-col justify-start ${isCurrentMonth ? 'bg-white' : 'bg-slate-50 text-slate-300'}`}>
                <div className="text-[10px] font-semibold mb-1 text-slate-400">
                    {format(day, 'dd/MM/yyyy', { locale: ptBR })}
                </div>
            </div>
        );
    }

    // Dynamic Class for Neon Border if Occurrence > 0
    const borderClass = metrics.occurrenceCount > 0
        ? 'ring-2 ring-red-500 ring-offset-1 shadow-[0_0_8px_rgba(239,68,68,0.6)] z-10 border-red-200'
        : 'border-b border-r border-slate-200 hover:bg-blue-50/50';

    return (
        <div
            onClick={onClick}
            className={`min-h-[140px] p-3 cursor-pointer transition-all group flex flex-col relative ${borderClass} ${isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'}`}
        >
            {/* Header: Full Date & Weather Icon */}
            <div className="flex justify-between items-center mb-3">
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isCurrentMonth ? 'text-slate-500' : 'text-slate-400'}`}>
                    {format(day, 'dd/MM/yyyy', { locale: ptBR })}
                </span>
                {getWeatherIcon(metrics.weatherMorning, metrics.weatherAfternoon)}
            </div>

            <div className="space-y-2 flex-1 flex flex-col justify-center">
                {/* Labor */}
                <div className="flex items-center gap-2">
                    <div className="bg-blue-100 text-blue-600 p-1 rounded-md shrink-0">
                        <Users size={12} />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-[10px] text-slate-400 font-medium uppercase">Mão de Obra</span>
                        <span className="text-xs font-bold text-slate-700">{metrics.totalPeople}</span>
                    </div>
                </div>

                {/* Equipment */}
                <div className="flex items-center gap-2">
                    <div className="bg-yellow-100 text-yellow-600 p-1 rounded-md shrink-0">
                        <Tractor size={12} />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-[10px] text-slate-400 font-medium uppercase">Equipamentos</span>
                        <span className="text-xs font-bold text-slate-700">{metrics.totalEquipment}</span>
                    </div>
                </div>

                {/* Occurrences - Only show if > 0 */}
                {metrics.occurrenceCount > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                        <div className="bg-red-100 text-red-600 p-1 rounded-md shrink-0">
                            <AlertTriangle size={12} />
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] text-red-400 font-bold uppercase">Ocorrências</span>
                            <span className="text-xs font-bold text-red-600">{metrics.occurrenceCount}</span>
                        </div>
                    </div>
                )}

                {/* Bad Weather Label */}
                {isBadWeather && (
                    <div className="flex items-center gap-2 mt-1">
                        <div className="bg-purple-100 text-purple-600 p-1 rounded-md shrink-0">
                            <CloudRain size={12} />
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] text-purple-600 font-bold uppercase leading-tight">Clima<br />Desfavorável</span>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

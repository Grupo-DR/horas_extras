import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, X } from 'lucide-react';
import { OvertimeRecord, PlanningRecord } from '../types';
import { formatDecimalHours } from '../utils/formatters';
import { formatDateKey, isRelevantOvertimeEvent, normalizeChapa, toDateKey } from '../utils/overtime';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface EmployeeDailyComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    employeeName: string;
    chapa: string;
    periodStart: Date;
    periodEnd: Date;
    plannedRecords: PlanningRecord[];
    realRecords: OvertimeRecord[];
}

const getDeltaClasses = (delta: number): string => {
    if (delta > 0) return 'text-red-600 bg-red-50 border-red-100';
    if (delta < 0) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    return 'text-slate-600 bg-slate-50 border-slate-200';
};

const EmployeeDailyComparisonModal: React.FC<EmployeeDailyComparisonModalProps> = ({
    isOpen,
    onClose,
    employeeName,
    chapa,
    periodStart,
    periodEnd,
    plannedRecords,
    realRecords
}) => {
    const [showOnlyDeviations, setShowOnlyDeviations] = React.useState(false);
    const normalizedChapa = useMemo(() => normalizeChapa(chapa), [chapa]);

    const { days, totals, filteredDays } = useMemo(() => {
        const startKey = formatDateKey(periodStart);
        const endKey = formatDateKey(periodEnd);
        const plannedByDay: Record<string, number> = {};
        const realByDay: Record<string, number> = {};

        plannedRecords.forEach(record => {
            if (record.type !== 'DAILY') return;
            if (normalizeChapa(record.chapa) !== normalizedChapa) return;
            if (!record.date || record.date < startKey || record.date > endKey) return;
            plannedByDay[record.date] = (plannedByDay[record.date] || 0) + (Number(record.plannedHours) || 0);
        });

        realRecords.forEach(record => {
            if (normalizeChapa(record.CHAPA) !== normalizedChapa) return;
            if (!isRelevantOvertimeEvent(record.EVENTO)) return;
            const dateKey = toDateKey(record.DATA);
            if (!dateKey || dateKey < startKey || dateKey > endKey) return;
            realByDay[dateKey] = (realByDay[dateKey] || 0) + (Number(record.HORAS) || 0);
        });

        const comparisonDays: { day: Date; dateKey: string; planned: number; real: number; delta: number }[] = [];
        const cursor = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate(), 12, 0, 0, 0);

        while (cursor <= periodEnd) {
            const day = new Date(cursor);
            const dateKey = formatDateKey(day);
            const planned = plannedByDay[dateKey] || 0;
            const real = realByDay[dateKey] || 0;
            comparisonDays.push({
                day,
                dateKey,
                planned,
                real,
                delta: real - planned
            });
            cursor.setDate(cursor.getDate() + 1);
        }

        return {
            days: comparisonDays,
            filteredDays: showOnlyDeviations ? comparisonDays.filter(d => Math.abs(d.delta) > 0.01) : comparisonDays,
            totals: comparisonDays.reduce((acc, item) => ({
                planned: acc.planned + item.planned,
                real: acc.real + item.real,
                delta: acc.delta + item.delta
            }), { planned: 0, real: 0, delta: 0 })
        };
    }, [normalizedChapa, periodEnd, periodStart, plannedRecords, realRecords, showOnlyDeviations]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] overflow-hidden flex flex-col max-h-[92vh]">
                <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <CalendarDays size={18} className="text-indigo-100" />
                            <h3 className="text-lg font-bold">Raio-X Diário do Colaborador</h3>
                        </div>
                        <p className="text-indigo-100 text-sm mt-0.5">
                            {employeeName} • Chapa: {chapa} • Período: {periodStart.toLocaleDateString('pt-BR')} a {periodEnd.toLocaleDateString('pt-BR')}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowOnlyDeviations(!showOnlyDeviations)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all border ${showOnlyDeviations ? 'bg-white text-indigo-600 border-white' : 'bg-indigo-500/30 text-white border-indigo-400/50 hover:bg-indigo-500/50'}`}
                        >
                            <ArrowUpRight size={14} className={showOnlyDeviations ? 'text-indigo-600' : 'text-indigo-100'} />
                            Somente dias com desvio
                        </button>
                        
                        <div className="w-px h-8 bg-indigo-500/50 mx-1" />

                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="border-collapse text-xs" style={{ minWidth: `${(filteredDays.length + 2) * 56}px` }}>
                        <thead className="sticky top-0 z-20">
                            <tr>
                                <th className="sticky left-0 z-30 bg-slate-100 px-4 py-2 text-left font-black text-slate-700 border-b border-r border-slate-200 min-w-[180px]">
                                    Indicador
                                </th>
                                {filteredDays.map(item => {
                                     const isSun = item.day.getDay() === 0;
                                     const isSat = item.day.getDay() === 6;
                                     return (
                                         <th
                                             key={item.dateKey}
                                             className={`px-1 py-2 text-center font-bold border-b border-slate-200 w-12 min-w-[44px] ${isSun ? 'bg-red-100 text-red-700' : isSat ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}
                                         >
                                             <div className="text-[11px]">{item.day.getDate()}</div>
                                             <div className="text-[9px] font-normal opacity-70">{WEEKDAY_LABELS[item.day.getDay()]}</div>
                                         </th>
                                     );
                                 })}
                                 <th className="bg-slate-100 px-3 py-2 text-center font-black text-slate-700 border-b border-l-2 border-slate-300 min-w-[72px]">
                                     Total
                                 </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-slate-100">
                                <td className="sticky left-0 bg-white px-4 py-2 border-r border-slate-200 z-10">
                                    <p className="font-bold text-slate-800">Planejado</p>
                                    <p className="text-[10px] text-slate-400">Motor de planejamento</p>
                                </td>
                                {filteredDays.map(item => {
                                    const isSun = item.day.getDay() === 0;
                                    const isSat = item.day.getDay() === 6;
                                    return (
                                        <td key={item.dateKey} className={`px-1 py-2 text-center ${isSun ? 'bg-red-50' : isSat ? 'bg-orange-50' : ''}`}>
                                            <span className={`inline-flex min-w-[40px] items-center justify-center rounded border px-1.5 py-0.5 font-mono font-semibold ${item.planned > 0 ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-300'}`}>
                                                {formatDecimalHours(item.planned)}
                                            </span>
                                        </td>
                                    );
                                })}
                                <td className="px-3 py-2 text-center font-black font-mono border-l-2 border-slate-300 text-blue-700 bg-blue-50">
                                    {formatDecimalHours(totals.planned)}
                                </td>
                            </tr>

                            <tr className="border-b border-slate-100">
                                <td className="sticky left-0 bg-white px-4 py-2 border-r border-slate-200 z-10">
                                    <p className="font-bold text-slate-800">Realizado</p>
                                    <p className="text-[10px] text-slate-400">Eventos reais do ponto</p>
                                </td>
                                {filteredDays.map(item => {
                                    const isSun = item.day.getDay() === 0;
                                    const isSat = item.day.getDay() === 6;
                                    return (
                                        <td key={item.dateKey} className={`px-1 py-2 text-center ${isSun ? 'bg-red-50' : isSat ? 'bg-orange-50' : ''}`}>
                                            <span className={`inline-flex min-w-[40px] items-center justify-center rounded border px-1.5 py-0.5 font-mono font-semibold ${item.real > 0 ? 'border-slate-300 bg-slate-100 text-slate-800' : 'border-slate-200 bg-white text-slate-300'}`}>
                                                {formatDecimalHours(item.real)}
                                            </span>
                                        </td>
                                    );
                                })}
                                <td className="px-3 py-2 text-center font-black font-mono border-l-2 border-slate-300 text-slate-800 bg-slate-100">
                                    {formatDecimalHours(totals.real)}
                                </td>
                            </tr>

                            <tr className="border-b border-slate-100">
                                <td className="sticky left-0 bg-white px-4 py-2 border-r border-slate-200 z-10">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-slate-800">Delta</p>
                                        {totals.delta > 0 ? <ArrowUpRight size={12} className="text-red-500" /> : totals.delta < 0 ? <ArrowDownRight size={12} className="text-emerald-500" /> : null}
                                    </div>
                                    <p className="text-[10px] text-slate-400">Realizado - Planejado</p>
                                </td>
                                {filteredDays.map(item => {
                                    const isSun = item.day.getDay() === 0;
                                    const isSat = item.day.getDay() === 6;
                                    return (
                                        <td key={item.dateKey} className={`px-1 py-2 text-center ${isSun ? 'bg-red-50' : isSat ? 'bg-orange-50' : ''}`}>
                                            <span className={`inline-flex min-w-[40px] items-center justify-center rounded border px-1.5 py-0.5 font-mono font-bold ${getDeltaClasses(item.delta)}`}>
                                                {formatDecimalHours(item.delta)}
                                            </span>
                                        </td>
                                    );
                                })}
                                <td className={`px-3 py-2 text-center font-black font-mono border-l-2 border-slate-300 ${getDeltaClasses(totals.delta)}`}>
                                    {formatDecimalHours(totals.delta)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Delta positivo em vermelho indica realizado acima do planejado. Delta negativo em verde indica realizado abaixo do planejado.
                    </p>
                    <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg transition-colors">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmployeeDailyComparisonModal;

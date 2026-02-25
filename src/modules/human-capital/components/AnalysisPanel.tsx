import React, { useMemo, useState } from 'react';
import { OvertimeRecord } from '../types';
import { RealOvertimeRecord } from '../data/realOvertime';
import { AlertTriangle, Building2, Scale, ChevronLeft, ChevronRight, Calendar, Users, Search } from 'lucide-react';
import { getCCName, getCCRegional } from '../data/ccMaster';

interface AnalysisPanelProps {
    data: OvertimeRecord[];
    selectedYear: string;
    realOvertime: RealOvertimeRecord[];
}

type DayData = { he60: number; he100: number; inter: number; noturno: number };

// ────────────────────────────────────────────────────────────
// Componente: Calendário
// ────────────────────────────────────────────────────────────
const CalendarView: React.FC<{ data: OvertimeRecord[] }> = ({ data }) => {
    const today = new Date();
    const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth(); // 0-indexed

    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const monthName = viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    // Agrega dados por dia
    const dayMap = useMemo<Record<string, DayData>>(() => {
        const map: Record<string, DayData> = {};
        data.forEach(r => {
            if (!r.DATA) return;
            const d = new Date(r.DATA);
            if (d.getFullYear() !== year || d.getMonth() !== month) return;

            const key = d.getDate().toString();
            if (!map[key]) map[key] = { he60: 0, he100: 0, inter: 0, noturno: 0 };

            const evt = (r.EVENTO || '').toUpperCase();
            if (evt.includes('EXTRA') && (evt.includes('60') || (!evt.includes('100')))) map[key].he60++;
            else if (evt.includes('EXTRA') && evt.includes('100')) map[key].he100++;
            else if (evt.includes('INTER')) map[key].inter++;
            else if (evt.includes('NOTURNO') || evt.includes('NOT')) map[key].noturno++;
        });
        return map;
    }, [data, year, month]);

    // Estrutura do calendário
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Dom
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks: (number | null)[][] = [];
    let day = 1;
    for (let w = 0; w < 6; w++) {
        const week: (number | null)[] = [];
        for (let d = 0; d < 7; d++) {
            const cellIndex = w * 7 + d;
            if (cellIndex < firstDayOfWeek || day > daysInMonth) {
                week.push(null);
            } else {
                week.push(day++);
            }
        }
        weeks.push(week);
        if (day > daysInMonth) break;
    }

    const todayDate = new Date();
    const isToday = (d: number) =>
        d === todayDate.getDate() && month === todayDate.getMonth() && year === todayDate.getFullYear();

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header do calendário */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Calendar size={16} className="text-blue-500" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide capitalize">
                        {monthName}
                    </h3>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={prevMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Legenda */}
            <div className="px-5 py-2 flex items-center gap-4 border-b border-gray-50 bg-gray-50/50 flex-wrap">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> HE 60%
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> HE 100%
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Interjornada
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600">
                    <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Noturno
                </span>
            </div>

            {/* Grade */}
            <div className="p-4">
                {/* Cabeçalho dos dias da semana */}
                <div className="grid grid-cols-7 mb-2">
                    {weekDays.map(wd => (
                        <div key={wd} className={`text-center text-[10px] font-bold uppercase tracking-widest py-1 ${wd === 'Dom' || wd === 'Sáb' ? 'text-orange-400' : 'text-gray-400'}`}>
                            {wd}
                        </div>
                    ))}
                </div>

                {/* Semanas */}
                <div className="space-y-1">
                    {weeks.map((week, wi) => (
                        <div key={wi} className="grid grid-cols-7 gap-1">
                            {week.map((d, di) => {
                                if (!d) return <div key={di} className="h-[104px]" />;

                                const info = dayMap[d.toString()];
                                const isWeekend = di === 0 || di === 6;
                                const total = info ? info.he60 + info.he100 + info.inter + info.noturno : 0;
                                const hasData = total > 0;

                                return (
                                    <div
                                        key={di}
                                        className={`h-[104px] rounded-xl border p-1.5 flex flex-col transition-all
                                          ${isToday(d) ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-100'}
                                          ${hasData ? 'bg-white shadow-sm' : isWeekend ? 'bg-orange-50/20' : 'bg-gray-50/30'}
                                        `}
                                    >
                                        {/* Número do dia */}
                                        <span className={`text-[9px] font-bold leading-none mb-1 ${isToday(d) ? 'text-blue-600' : isWeekend ? 'text-orange-400' : 'text-gray-400'
                                            }`}>
                                            {d}/{month + 1}
                                        </span>

                                        {/* Corpo: total + badges */}
                                        {hasData && (
                                            <div className="flex flex-1">
                                                {/* Total — metade esquerda */}
                                                <div className="w-1/2 flex items-center justify-center">
                                                    <span className="text-2xl font-black text-gray-700 leading-none">
                                                        {total}
                                                    </span>
                                                </div>

                                                {/* Badges — metade direita, alinhados à direita */}
                                                <div className="w-1/2 flex flex-col justify-start gap-[2px]">
                                                    {info.he60 > 0 && (
                                                        <div className="px-1 py-0 rounded bg-blue-50 border border-blue-100 text-right">
                                                            <span className="text-[8px] font-bold text-blue-600 leading-none">60%: {info.he60}</span>
                                                        </div>
                                                    )}
                                                    {info.he100 > 0 && (
                                                        <div className="px-1 py-0 rounded bg-red-50 border border-red-100 text-right">
                                                            <span className="text-[8px] font-bold text-red-600 leading-none">100%: {info.he100}</span>
                                                        </div>
                                                    )}
                                                    {info.inter > 0 && (
                                                        <div className="px-1 py-0 rounded bg-amber-50 border border-amber-100 text-right">
                                                            <span className="text-[8px] font-bold text-amber-600 leading-none">Inter: {info.inter}</span>
                                                        </div>
                                                    )}
                                                    {info.noturno > 0 && (
                                                        <div className="px-1 py-0 rounded bg-purple-50 border border-purple-100 text-right">
                                                            <span className="text-[8px] font-bold text-purple-600 leading-none">Not.: {info.noturno}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────
const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ data }) => {
    const [empSearch, setEmpSearch] = useState('');

    const ccSummary = useMemo(() => {
        const map: Record<string, { jornadasLongas: number; interjornadas: number }> = {};

        data.forEach(r => {
            const ccRaw = r.CODCCUSTO || 'S/ CC';
            const cc = ccRaw.replace(/\./g, '');

            if (!map[cc]) map[cc] = { jornadasLongas: 0, interjornadas: 0 };

            const evt = (r.EVENTO || '').toUpperCase();
            const hours = Number(r.HORAS) || 0;

            if ((evt.includes('EXTRA') || evt.includes('60') || evt.includes('100')) && hours > 10) {
                map[cc].jornadasLongas += 1;
            }
            if (evt.includes('INTER')) {
                map[cc].interjornadas += 1;
            }
        });

        return Object.entries(map)
            .map(([cc, vals]) => ({
                cc,
                nome: getCCName(cc),
                regional: getCCRegional(cc),
                ...vals,
            }))
            .filter(item => item.jornadasLongas > 0 || item.interjornadas > 0)
            .sort((a, b) => (b.jornadasLongas + b.interjornadas) - (a.jornadasLongas + a.interjornadas));
    }, [data]);

    const employeeSummary = useMemo(() => {
        const map: Record<string, {
            name: string;
            cc: string;
            he60: number;
            he100: number;
            inter: number;
            noturnas: number;
            total: number;
        }> = {};

        data.forEach(r => {
            const chapa = r.CHAPA;
            if (!chapa) return;

            if (!map[chapa]) {
                map[chapa] = {
                    name: r.NOME || 'Sem Nome',
                    cc: r.CODCCUSTO || 'S/ CC',
                    he60: 0,
                    he100: 0,
                    inter: 0,
                    noturnas: 0,
                    total: 0
                };
            }

            const evt = (r.EVENTO || '').toUpperCase();
            const hours = Number(r.HORAS) || 0;

            if (evt.includes('EXTRA')) {
                if (evt.includes('100')) {
                    map[chapa].he100 += hours;
                } else {
                    map[chapa].he60 += hours;
                }
            } else if (evt.includes('INTER')) {
                map[chapa].inter += hours;
            } else if (evt.includes('NOTURNO') || evt.includes('NOT')) {
                map[chapa].noturnas += hours;
            }
        });

        return Object.values(map)
            .map(emp => ({
                ...emp,
                total: emp.he60 + emp.he100 + emp.inter + emp.noturnas
            }))
            .filter(emp => emp.total > 0)
            .filter(emp => {
                if (!empSearch) return true;
                const searchLower = empSearch.toLowerCase();
                return emp.name.toLowerCase().includes(searchLower) || emp.cc.toLowerCase().includes(searchLower);
            })
            .sort((a, b) => b.total - a.total);
    }, [data, empSearch]);

    const totais = useMemo(() => ({
        jornadasLongas: ccSummary.reduce((acc, r) => acc + r.jornadasLongas, 0),
        interjornadas: ccSummary.reduce((acc, r) => acc + r.interjornadas, 0),
    }), [ccSummary]);

    return (
        <div className="space-y-6">

            {/* Cards de totais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-red-500 text-white shadow-lg shrink-0">
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Jornadas &gt; 10h</p>
                        <h3 className="text-2xl font-bold text-gray-800 font-mono">{totais.jornadasLongas}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Ocorrências no período</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-500 text-white shadow-lg shrink-0">
                        <Scale size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Interjornadas</p>
                        <h3 className="text-2xl font-bold text-gray-800 font-mono">{totais.interjornadas}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Ocorrências no período</p>
                    </div>
                </div>
            </div>

            {/* Calendário */}
            <CalendarView data={data} />

            {/* Tabela por Colaborador */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Users size={16} className="text-indigo-500" />
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                            Detalhamento por Colaborador
                        </h3>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar colaborador ou CC..."
                            className="pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full md:w-64"
                            value={empSearch}
                            onChange={(e) => setEmpSearch(e.target.value)}
                        />
                    </div>
                </div>

                {employeeSummary.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <p className="font-medium">Nenhum colaborador encontrado.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Centro de Custo</th>
                                    <th className="px-6 py-4">Nome do Colaborador</th>
                                    <th className="px-6 py-4 text-center">HE 60</th>
                                    <th className="px-6 py-4 text-center">HE 100</th>
                                    <th className="px-6 py-4 text-center">Inter.</th>
                                    <th className="px-6 py-4 text-center">Noturnas</th>
                                    <th className="px-6 py-4 text-center bg-gray-200/50">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {employeeSummary.map((emp, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-[10px] text-gray-400">{emp.cc}</span>
                                                <span className="text-[11px] font-medium text-gray-700 uppercase">{getCCName(emp.cc)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 font-bold text-gray-800 text-xs">{emp.name}</td>
                                        <td className="px-6 py-3 text-center font-mono text-blue-600 font-bold">
                                            {emp.he60 > 0 ? emp.he60.toFixed(1) : '—'}
                                        </td>
                                        <td className="px-6 py-3 text-center font-mono text-red-600 font-bold">
                                            {emp.he100 > 0 ? emp.he100.toFixed(1) : '—'}
                                        </td>
                                        <td className="px-6 py-3 text-center font-mono text-amber-600 font-bold">
                                            {emp.inter > 0 ? emp.inter.toFixed(1) : '—'}
                                        </td>
                                        <td className="px-6 py-3 text-center font-mono text-purple-600 font-bold">
                                            {emp.noturnas > 0 ? emp.noturnas.toFixed(1) : '—'}
                                        </td>
                                        <td className="px-6 py-3 text-center font-mono font-black text-gray-900 bg-gray-50/50">
                                            {emp.total.toFixed(1)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalysisPanel;

import React, { useMemo, useState } from 'react';
import { OvertimeRecord } from '../types';
import { RealOvertimeRecord } from '../data/realOvertime';
import { AlertTriangle, Building2, Scale, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

// Mapeamento CC → Nome do projeto (códigos sem pontos)
const CC_NAMES: Record<string, string> = {
    '10101': 'ADMINISTRATIVO FINANCEIRO',
    '10301': 'COMERCIAL',
    '10401': 'CAPITAL HUMANO',
    '10501': 'SSMA',
    '10601': 'SUPRIMENTOS',
    '300001': 'GESTAO DE ATIVOS',
    '301502': 'VLI - ESTRADAS VICINAIS - MAN PREV, COR',
    '301503': 'SER E LOC DE EQUIP COR. CENTRO-NORTE VL',
    '301804': 'PATRULHAS FIXAS RUMO',
    '301805': 'MODERNIZACAO E LIMPEZA DE LASTRO',
    '301806': 'MANUT. INFRA NORTE ZEV - ZBV',
    '301903': 'MANUT. INFRA NORTE ZAR \u2013 TMI',
    '302801': 'INFRA ESTRUTURA - GERDAU S/A',
    '304301': 'CONSORCIO PERA FERREA',
    '304401': 'MODERNIZACAO E LIMP LASTRO - ARARAQUARA',
    '304402': 'INFRANORTE - ARARAQUARA',
    '304501': 'RUMO PATIO CATANDUVA - CATIGUA',
    '10104': 'TECNOLOGIA DA INFORMACAO',
};

// Mapeamento CC → Regional (códigos sem pontos)
const CC_REGIONAL: Record<string, string> = {
    '10101': 'Sede', '10104': 'Sede', '10301': 'Sede', '10401': 'Sede',
    '10501': 'Sede', '10601': 'Sede', '300001': 'Sede',
    '301502': 'Regional 01', '301503': 'Regional 01',
    '302801': 'Regional 01', '304301': 'Regional 01', '304501': 'Regional 01',
    '301804': 'Regional 02', '301805': 'Regional 02', '301806': 'Regional 02',
    '301903': 'Regional 02', '304401': 'Regional 02', '304402': 'Regional 02',
};

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
                nome: CC_NAMES[cc] || cc,
                regional: CC_REGIONAL[cc] || 'Outros',
                ...vals,
            }))
            .filter(item => item.jornadasLongas > 0 || item.interjornadas > 0)
            .sort((a, b) => (b.jornadasLongas + b.interjornadas) - (a.jornadasLongas + a.interjornadas));
    }, [data]);

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

            {/* Tabela por CC */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                    <Building2 size={16} className="text-blue-500" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                        Análise por Centro de Custo
                    </h3>
                </div>

                {ccSummary.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <p className="font-medium">Nenhuma ocorrência encontrada no período.</p>
                        <p className="text-sm mt-1">Ajuste os filtros ou o intervalo de datas.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[9px] tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Código CC</th>
                                    <th className="px-6 py-4">Nome / Descrição</th>
                                    <th className="px-6 py-4">Regional</th>
                                    <th className="px-6 py-4 text-center">
                                        <span className="flex items-center justify-center gap-1">
                                            <AlertTriangle size={10} className="text-red-500" />
                                            Jornadas &gt; 10h
                                        </span>
                                    </th>
                                    <th className="px-6 py-4 text-center">
                                        <span className="flex items-center justify-center gap-1">
                                            <Scale size={10} className="text-amber-500" />
                                            Interjornadas
                                        </span>
                                    </th>
                                    <th className="px-6 py-4 text-center">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {ccSummary.map((item) => {
                                    const total = item.jornadasLongas + item.interjornadas;
                                    return (
                                        <tr key={item.cc} className="hover:bg-blue-50/40 transition-colors">
                                            <td className="px-6 py-3 font-mono font-medium text-gray-900 text-xs">{item.cc}</td>
                                            <td className="px-6 py-3 text-gray-600 text-xs">{item.nome}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.regional === 'Sede' ? 'bg-blue-50 text-blue-600' :
                                                    item.regional === 'Regional 01' ? 'bg-emerald-50 text-emerald-700' :
                                                        item.regional === 'Regional 02' ? 'bg-purple-50 text-purple-700' :
                                                            'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {item.regional}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {item.jornadasLongas > 0 ? (
                                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold text-sm">
                                                        {item.jornadasLongas}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 font-mono">&mdash;</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {item.interjornadas > 0 ? (
                                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm">
                                                        {item.interjornadas}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 font-mono">&mdash;</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={`font-bold font-mono text-sm ${total > 5 ? 'text-red-600' : total > 2 ? 'text-amber-600' : 'text-gray-600'
                                                    }`}>
                                                    {total}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                <tr>
                                    <td className="px-6 py-3 font-bold text-gray-700 text-xs uppercase tracking-wide" colSpan={3}>
                                        TOTAL GERAL
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-red-100 text-red-700 font-bold text-sm">
                                            {totais.jornadasLongas}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-bold text-sm">
                                            {totais.interjornadas}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-center font-bold font-mono text-gray-800">
                                        {totais.jornadasLongas + totais.interjornadas}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalysisPanel;

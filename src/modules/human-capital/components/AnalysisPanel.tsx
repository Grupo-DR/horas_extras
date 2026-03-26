import React, { useMemo, useState } from 'react';
import {
    formatDecimalToTime,
    formatDateKey,
    getPayrollMonthKey
} from '../utils/overtime';
import { OvertimeRecord, PlanningRecord } from '../types';
import { RealOvertimeRecord } from '../data/realOvertime';
import type { FilterState } from './FilterBar';
import {
    AlertTriangle, Building2, Scale, Users, CheckCircle2,
    Search, TrendingUp, BarChart3, PieChart, Activity, Layers, Moon, Zap, ArrowUpRight,
    MapPin, Briefcase, ShieldAlert, X, ChevronDown, Info
} from 'lucide-react';
import { getCCName, getCCRegional } from '../data/ccMaster';
import EmployeeDailyComparisonModal from './EmployeeDailyComparisonModal';
import { getAllPlanningRecords } from '../services/planning';
import {
    ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, Cell, LabelList, BarChart, ReferenceLine
} from 'recharts';

interface AnalysisPanelProps {
    data: OvertimeRecord[];
    allData?: OvertimeRecord[];
    selectedYear: string;
    realOvertime: RealOvertimeRecord[];
    periodStart: Date;
    periodEnd: Date;
    filters: FilterState;
}



// ────────────────────────────────────────────────────────────
export const isExtraEvent = (evento?: string): boolean => {
    const evt = (evento || '').toUpperCase();
    return evt.includes('EXTRA');
};

export const isExtra100Event = (evento?: string): boolean => {
    const evt = (evento || '').toUpperCase();
    return isExtraEvent(evt) && evt.includes('100');
};

export const isExtra60Event = (evento?: string): boolean => {
    const evt = (evento || '').toUpperCase();
    return isExtraEvent(evt) && evt.includes('60') && !evt.includes('100');
};

export const isInterjornadaEvent = (evento?: string): boolean => {
    const evt = (evento || '').toUpperCase();
    return evt.includes('INTER');
};

export const isNoturnoEvent = (evento?: string): boolean => {
    const evt = (evento || '').toUpperCase();
    return evt.includes('NOTURNO') || evt.includes('NOT');
};

export const isRelevantOvertimeEvent = (evento?: string): boolean => {
    return isExtraEvent(evento) || isInterjornadaEvent(evento) || isNoturnoEvent(evento);
};

export const normalizeCC = (cc?: string): string => cc ? cc.trim().toUpperCase() : 'S/ CC';
export const normalizeFunction = (funcao?: string): string => funcao ? funcao.trim().toUpperCase() : 'S/ FUNÇÃO';
export const normalizeName = (nome?: string): string => nome ? nome.trim().toUpperCase() : 'S/ NOME';
export const normalizeChapa = (chapa?: string): string => chapa ? chapa.trim().toUpperCase() : '';

const buildExtraHoursAggregations = (data: OvertimeRecord[]) => {
    const dailyHours: Record<string, number> = {};
    const monthlyHours: Record<string, number> = {};
    const empToCC: Record<string, string> = {};

    data.forEach(record => {
        const chapa = normalizeChapa(record.CHAPA);
        if (!chapa) return;

        const cc = normalizeCC(record.CODCCUSTO);
        empToCC[chapa] = cc;

        if (!isExtraEvent(record.EVENTO) || !record.DATA) return;

        const hours = Number(record.HORAS) || 0;
        const dateObj = new Date(record.DATA);
        if (isNaN(dateObj.getTime())) return;

        const dayKey = dateObj.toISOString().split('T')[0];
        const payrollKey = getPayrollMonthKey(record.DATA);
        const dailyCompositeKey = `${chapa}|${dayKey}`;
        const monthlyCompositeKey = `${chapa}|${payrollKey}`;

        dailyHours[dailyCompositeKey] = (dailyHours[dailyCompositeKey] || 0) + hours;
        monthlyHours[monthlyCompositeKey] = (monthlyHours[monthlyCompositeKey] || 0) + hours;
    });

    return { dailyHours, monthlyHours, empToCC };
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Custom Outlier Label
// ────────────────────────────────────────────────────────────
const CustomOutlierLabel = (props: any) => {
    const { x, y, width, value, index, chartData } = props;
    const entry = chartData[index];

    if (!entry || !entry.isOutlier) return null;

    return (
        <text
            x={Number(x) + Number(width) / 2}
            y={Number(y) - 5}
            fill="#e11d48"
            fontSize={10}
            textAnchor="middle"
            fontWeight="bold"
        >
            🚨 {formatDecimalToTime(Number(value))}
        </text>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Modal de Ajuda da Tendência
// ────────────────────────────────────────────────────────────
const TrendHelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-semibold text-slate-800">Entendendo o Gráfico de Tendência</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-600">
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🟦</div>
                        <div>
                            <strong className="text-slate-800">Barras Azuis (Dias Úteis):</strong> Representam o total de horas realizadas no dia, somando horas extras, interjornada e adicional noturno.
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🟧</div>
                        <div>
                            <strong className="text-slate-800">Barras Laranjas (Finais de Semana):</strong> Destacam dias de sábado e domingo para facilitar a leitura de picos operacionais fora da rotina.
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">📉</div>
                        <div>
                            <strong className="text-slate-800">Linha Verde (Planejado):</strong> Mostra quantas horas estavam previstas para cada dia. Quando a barra fica acima da linha, houve estouro do planejamento.
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🚨</div>
                        <div>
                            <strong className="text-slate-800">Barras Vermelhas (Outliers/Anomalias):</strong> São picos críticos de horas extras que fogem completamente do comportamento normal da operação.
                        </div>
                    </div>
                    <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="text-xl mt-0.5">🧮</div>
                        <div>
                            <strong className="text-slate-800 block mb-1">Como a Anomalia (Outlier) é calculada?</strong>
                            <p>
                                Utilizamos um modelo estatístico chamado <strong>Modelo Hurdle (IQR Condicional)</strong>. O sistema analisa o período filtrando apenas os dias com ocorrência de horas extras, ignorando os dias "zerados" para entender o verdadeiro comportamento de dias trabalhados. Isso evita distorções e cria um <strong className="text-slate-700">Limite de Risco Dinâmico</strong> altamente preciso para equipas pequenas. Qualquer dia que ultrapasse esse limite calculado (e possua um volume mínimo de 8 horas) é classificado matematicamente como uma anomalia que exige a atenção do gestor.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Gráfico de Tendência (Trend Analysis)
// ────────────────────────────────────────────────────────────
const TrendTooltip: React.FC<{ active?: boolean; payload?: any[] }> = ({ active, payload }) => {
    const point = payload?.[0]?.payload;
    if (!active || !point) return null;

    const hasPlanned = typeof point.planned === 'number';
    const delta = hasPlanned ? point.realTotal - point.planned : null;

    return (
        <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-sm min-w-[220px]">
            <div className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data</p>
                <p className="text-sm font-semibold text-slate-800">
                    {new Date(`${point.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                </p>
            </div>
            <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Realizado</span>
                    <span className="font-mono font-bold text-slate-800">{formatDecimalToTime(point.realTotal)}</span>
                </div>
                {hasPlanned && (
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-emerald-600">Planejado</span>
                        <span className="font-mono font-bold text-emerald-700">{formatDecimalToTime(point.planned)}</span>
                    </div>
                )}
                {delta !== null && (
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">Desvio</span>
                        <span className={`font-mono font-bold ${delta > 0 ? 'text-rose-600' : delta < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                            {formatDecimalToTime(delta)}
                        </span>
                    </div>
                )}
            </div>
            <div className="my-2 border-t border-slate-100" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-blue-600">HE 60%</span>
                    <span className="font-mono text-slate-700">{formatDecimalToTime(point.real60)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span className="text-rose-600">HE 100%</span>
                    <span className="font-mono text-slate-700">{formatDecimalToTime(point.real100)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span className="text-amber-600">Inter.</span>
                    <span className="font-mono text-slate-700">{formatDecimalToTime(point.realInter)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span className="text-purple-600">Noturno</span>
                    <span className="font-mono text-slate-700">{formatDecimalToTime(point.realNoturno)}</span>
                </div>
            </div>
        </div>
    );
};

const TrendAnalysis: React.FC<{
    data: OvertimeRecord[];
    referenceData: OvertimeRecord[];
    planningRecords: PlanningRecord[];
    filters: FilterState;
    periodStart: Date;
    periodEnd: Date;
    onDayClick?: (date: string) => void;
}> = ({ data, referenceData, planningRecords, filters, periodStart, periodEnd, onDayClick }) => {
    const [showHelp, setShowHelp] = useState(false);

    const chartData = useMemo(() => {
        const map: Record<string, { date: string; he: number; inter: number; noturno: number; total: number }> = {};

        data.forEach(r => {
            if (!r.DATA) return;
            const dateObj = new Date(r.DATA);
            const key = dateObj.toISOString().split('T')[0];

            if (!map[key]) map[key] = { date: key, he: 0, inter: 0, noturno: 0, total: 0 };

            const hours = Number(r.HORAS) || 0;

            if (isExtraEvent(r.EVENTO)) {
                map[key].he += hours;
                map[key].total += hours;
            } else if (isInterjornadaEvent(r.EVENTO)) {
                map[key].inter += hours;
                map[key].total += hours;
            } else if (isNoturnoEvent(r.EVENTO)) {
                map[key].noturno += hours;
                map[key].total += hours;
            }
        });

        const sorted = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));

        // Cálculo Estatístico do IQR Condicional (Modelo Hurdle) para Limite de Outliers
        const nonZeroTotals = sorted.map(item => item.total).filter(t => t > 0).sort((a, b) => a - b);
        let outlierThreshold = Infinity;

        if (nonZeroTotals.length > 0) {
            const q1Index = Math.floor(nonZeroTotals.length * 0.25);
            const q3Index = Math.floor(nonZeroTotals.length * 0.75);
            const q1 = nonZeroTotals[q1Index];
            const q3 = nonZeroTotals[q3Index];
            const iqr = q3 - q1;
            outlierThreshold = q3 + (1.5 * iqr);
        }

        // Média Móvel (7 dias) e Inteligência Diagnóstica
        return sorted.map((item, index, arr) => {
            const start = Math.max(0, index - 6);
            const subset = arr.slice(start, index + 1);
            const avg = subset.reduce((acc, curr) => acc + curr.total, 0) / subset.length;

            const dateObj = new Date(item.date + 'T00:00:00');
            const dayOfWeek = dateObj.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            const isOutlier = item.total > outlierThreshold && item.total > 8;

            return {
                ...item,
                displayDate: dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                movingAvg: Number(avg.toFixed(1)),
                isWeekend,
                isOutlier
            };
        });
    }, [data]);

    if (chartData.length === 0) return null;

    return (
        <>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-blue-500" />
                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Análise de Tendência Temporal</h3>
                    </div>
                    <button
                        onClick={() => setShowHelp(true)}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                        title="Como ler este gráfico?"
                    >
                        <Info size={18} />
                    </button>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="displayDate"
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tickFormatter={formatDecimalToTime}
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                                label={{ value: 'Horas', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#94a3b8' } }}
                            />
                            <Tooltip
                                formatter={(value: any, name: any) => [typeof value === 'number' ? formatDecimalToTime(value) : value, name]}
                                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#64748b', paddingTop: '10px' }} />

                            <Bar
                                dataKey="he"
                                name="H. Extras"
                                radius={[4, 4, 0, 0]}
                                opacity={0.8}
                                cursor={onDayClick ? "pointer" : "default"}
                                onClick={(entry: any) => {
                                    if (onDayClick && entry && entry.date) {
                                        onDayClick(entry.date);
                                    }
                                }}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.isOutlier ? '#e11d48' : entry.isWeekend ? '#f59e0b' : '#6366f1'}
                                    />
                                ))}
                                <LabelList dataKey="he" content={<CustomOutlierLabel chartData={chartData} />} />
                            </Bar>

                            <Line
                                type="monotone"
                                dataKey="movingAvg"
                                name="Média Móvel (7 dias)"
                                stroke="#475569"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
            {showHelp && <TrendHelpModal onClose={() => setShowHelp(false)} />}
        </>
    );
};

const TrendAnalysisEnhanced: React.FC<{
    data: OvertimeRecord[];
    referenceData: OvertimeRecord[];
    planningRecords: PlanningRecord[];
    filters: FilterState;
    periodStart: Date;
    periodEnd: Date;
    onDayClick?: (date: string) => void;
}> = ({ data, referenceData, planningRecords, filters, periodStart, periodEnd, onDayClick }) => {
    const [showHelp, setShowHelp] = useState(false);

    const chartData = useMemo(() => {
        const shouldShowPlanned = !filters.type;
        const map: Record<string, {
            date: string;
            real60: number;
            real100: number;
            realInter: number;
            realNoturno: number;
            realTotal: number;
            planned: number;
        }> = {};

        const start = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate(), 12, 0, 0, 0);
        const end = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate(), 12, 0, 0, 0);
        const cursor = new Date(start);

        while (cursor <= end) {
            const key = formatDateKey(cursor);
            map[key] = {
                date: key,
                real60: 0,
                real100: 0,
                realInter: 0,
                realNoturno: 0,
                realTotal: 0,
                planned: 0
            };
            cursor.setDate(cursor.getDate() + 1);
        }

        data.forEach(record => {
            if (!record.DATA) return;

            const dateObj = new Date(record.DATA);
            if (isNaN(dateObj.getTime())) return;

            const dateKey = dateObj.toISOString().split('T')[0];
            if (!map[dateKey]) return;

            const hours = Number(record.HORAS) || 0;

            if (isExtra100Event(record.EVENTO)) {
                map[dateKey].real100 += hours;
                map[dateKey].realTotal += hours;
            } else if (isExtra60Event(record.EVENTO)) {
                map[dateKey].real60 += hours;
                map[dateKey].realTotal += hours;
            } else if (isInterjornadaEvent(record.EVENTO)) {
                map[dateKey].realInter += hours;
                map[dateKey].realTotal += hours;
            } else if (isNoturnoEvent(record.EVENTO)) {
                map[dateKey].realNoturno += hours;
                map[dateKey].realTotal += hours;
            }
        });

        if (shouldShowPlanned) {
            const chapaToFunction = new Map<string, string>();
            referenceData.forEach(record => {
                if (record.CHAPA && record.FUNCAO) chapaToFunction.set(record.CHAPA, record.FUNCAO);
            });

            planningRecords.forEach(record => {
                if (record.type !== 'DAILY') return;
                if (!record.date || !map[record.date]) return;

                const searchTerm = filters.searchTerm.trim().toLowerCase();
                if (searchTerm) {
                    const matchesName = (record.nome || '').toLowerCase().includes(searchTerm);
                    const matchesChapa = (record.chapa || '').toLowerCase().includes(searchTerm);
                    if (!matchesName && !matchesChapa) return;
                }

                if (filters.costCenter && normalizeCC(record.costCenter) !== normalizeCC(filters.costCenter)) return;
                if (filters.regional && getCCRegional(record.costCenter || '') !== filters.regional) return;

                if (filters.function) {
                    const mappedFunction = normalizeFunction(chapaToFunction.get(record.chapa));
                    if (mappedFunction !== normalizeFunction(filters.function)) return;
                }

                map[record.date].planned += Number(record.plannedHours) || 0;
            });
        }

        const sorted = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
        const nonZeroTotals = sorted.map(item => item.realTotal).filter(total => total > 0).sort((a, b) => a - b);
        let outlierThreshold = Infinity;

        if (nonZeroTotals.length > 0) {
            const q1Index = Math.floor(nonZeroTotals.length * 0.25);
            const q3Index = Math.floor(nonZeroTotals.length * 0.75);
            const q1 = nonZeroTotals[q1Index];
            const q3 = nonZeroTotals[q3Index];
            const iqr = q3 - q1;
            outlierThreshold = q3 + (1.5 * iqr);
        }

        return sorted.map(item => {
            const dateObj = new Date(`${item.date}T12:00:00`);
            const dayOfWeek = dateObj.getDay();

            return {
                ...item,
                displayDate: dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
                isOutlier: item.realTotal > outlierThreshold && item.realTotal > 8,
                planned: shouldShowPlanned ? item.planned : null
            };
        });
    }, [data, referenceData, planningRecords, filters, periodStart, periodEnd]);

    const hasAnyValue = chartData.some(item => item.realTotal > 0 || (typeof item.planned === 'number' && item.planned > 0));
    if (!hasAnyValue) return null;

    return (
        <>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-blue-500" />
                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">AnÃ¡lise de TendÃªncia Temporal</h3>
                    </div>
                    <button
                        onClick={() => setShowHelp(true)}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                        title="Como ler este grÃ¡fico?"
                    >
                        <Info size={18} />
                    </button>
                </div>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="displayDate"
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tickFormatter={formatDecimalToTime}
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                                label={{ value: 'Horas', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#94a3b8' } }}
                            />
                            <Tooltip content={<TrendTooltip />} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#64748b', paddingTop: '10px' }} />

                            <Bar
                                dataKey="realTotal"
                                name="Realizado"
                                radius={[4, 4, 0, 0]}
                                opacity={0.85}
                                cursor={onDayClick ? 'pointer' : 'default'}
                                onClick={(entry: any) => {
                                    if (onDayClick && entry && entry.date) {
                                        onDayClick(entry.date);
                                    }
                                }}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.isOutlier ? '#e11d48' : entry.isWeekend ? '#f59e0b' : '#6366f1'}
                                    />
                                ))}
                                <LabelList dataKey="realTotal" content={<CustomOutlierLabel chartData={chartData} />} />
                            </Bar>

                            {chartData.some(entry => typeof entry.planned === 'number') && (
                                <Line
                                    type="monotone"
                                    dataKey="planned"
                                    name="Planejado"
                                    stroke="#059669"
                                    strokeWidth={3}
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#059669' }}
                                    connectNulls={false}
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
            {showHelp && <TrendHelpModal onClose={() => setShowHelp(false)} />}
        </>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Modal de Ajuda de Pareto
// ────────────────────────────────────────────────────────────
const ParetoHelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-semibold text-slate-800">Entendendo o Gráfico de Pareto</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-600">
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🧠</div>
                        <div>
                            <strong className="text-slate-800 block">O Princípio de Pareto (Regra 80/20):</strong> Este gráfico baseia-se na premissa de que cerca de 80% dos problemas (neste caso, horas extras) são causados por apenas 20% das causas (centros de custo, funções, etc.).
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">📊</div>
                        <div>
                            <strong className="text-slate-800 block">Barras Destacadas (Os "Poucos Vitais"):</strong> As barras com cor forte à esquerda representam os maiores ofensores. Eles, somados, são responsáveis por até 80% de todo o passivo trabalhista gerado. Foque as suas ações de gestão exclusivamente nestes grupos!
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🌫️</div>
                        <div>
                            <strong className="text-slate-800 block">Barras Cinzentas (A "Cauda Longa"):</strong> Representam grupos com baixo volume de horas. O impacto de tentar reduzir horas nestes grupos é mínimo.
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">📈</div>
                        <div>
                            <strong className="text-slate-800 block">Linha Crescente:</strong> Mostra a percentagem acumulada. Quando esta linha cruza a linha tracejada dos 80%, o sistema corta o destaque visual das barras.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Análise de Concentração (Pareto)
// ────────────────────────────────────────────────────────────
const ConcentrationPareto: React.FC<{ data: OvertimeRecord[], onBarClick?: (title: string, chapas: string[]) => void }> = ({ data, onBarClick }) => {
    const [view, setView] = useState<'cc' | 'funcao' | 'colaborador' | 'regional'>('cc');
    const [showHelp, setShowHelp] = useState(false);

    const chartData = useMemo(() => {
        const counts: Record<string, { value: number; chapas: Set<string> }> = {};
        data.forEach(r => {
            if (!isRelevantOvertimeEvent(r.EVENTO)) {
                return;
            }

            let key = '';
            if (view === 'cc') key = normalizeCC(r.CODCCUSTO);
            else if (view === 'funcao') key = normalizeFunction(r.FUNCAO);
            else if (view === 'colaborador') key = normalizeName(r.NOME);
            else if (view === 'regional') key = getCCRegional(normalizeCC(r.CODCCUSTO));

            if (!counts[key]) counts[key] = { value: 0, chapas: new Set() };
            counts[key].value += (Number(r.HORAS) || 0);
            
            const chapa = normalizeChapa(r.CHAPA);
            if (chapa) counts[key].chapas.add(chapa);
        });

        const sorted = Object.entries(counts)
            .map(([name, groupData]) => ({
                name: view === 'cc' ? `${name} - ${getCCName(name)}` : name,
                value: Number(groupData.value.toFixed(1)),
                chapas: Array.from(groupData.chapas)
            }))
            .sort((a, b) => b.value - a.value);

        const total = sorted.reduce((acc, curr) => acc + curr.value, 0);
        let accumulated = 0;

        return sorted.map(item => {
            accumulated += item.value;
            const percent = Number(((accumulated / total) * 100).toFixed(1));
            const itemPercent = Number(((item.value / total) * 100).toFixed(1));
            const isVitalFew = (percent - itemPercent) < 80;
            return {
                ...item,
                percent,
                isVitalFew
            };
        }).slice(0, 15);
    }, [data, view]);

    return (
        <>
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={18} className="text-indigo-500" />
                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Análise de Concentração (Pareto)</h3>
                        <button
                            onClick={() => setShowHelp(true)}
                            className="text-slate-400 hover:text-slate-600 transition-colors p-1 ml-2"
                            title="Entendendo o Gráfico de Pareto"
                        >
                            <Info size={18} />
                        </button>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl self-start">
                        {(['cc', 'funcao', 'colaborador', 'regional'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-semibold uppercase transition-all ${view === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                {v === 'cc' ? 'CC' : v === 'funcao' ? 'Função' : v === 'colaborador' ? 'Colab.' : 'Regional'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                                hide={chartData.length > 8}
                            />
                            <YAxis
                                yAxisId="left"
                                tickFormatter={formatDecimalToTime}
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                                unit="%"
                            />
                            <Tooltip
                                formatter={(value: any, name: any) => [name === 'Horas' && typeof value === 'number' ? formatDecimalToTime(value) : value, name]}
                                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <ReferenceLine y={80} yAxisId="right" stroke="#94a3b8" strokeDasharray="3 3" />
                            <Bar
                                yAxisId="left"
                                dataKey="value"
                                name="Horas"
                                radius={[4, 4, 0, 0]}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.isVitalFew ? '#6366f1' : '#cbd5e1'}
                                        cursor={onBarClick ? 'pointer' : 'default'}
                                        onClick={() => onBarClick && onBarClick(`Detalhamento: ${entry.name}`, entry.chapas)}
                                    />
                                ))}
                            </Bar>
                            <Line yAxisId="right" type="monotone" dataKey="percent" name="% Acumulada" stroke="#e11d48" strokeWidth={3} dot={{ r: 4, fill: '#e11d48' }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
            {showHelp && <ParetoHelpModal onClose={() => setShowHelp(false)} />}
        </>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Modal de Ajuda do Histograma de Distribuição
// ────────────────────────────────────────────────────────────
const HistogramHelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-semibold text-slate-800">Entendendo a Distribuição de Horas</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-600">
                    <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="text-xl mt-0.5">📊</div>
                        <div>
                            <strong className="text-slate-800 block mb-1">O que este gráfico mostra?</strong>
                            <p>Ele funciona como um "Raio-X" da sua equipa. Em vez de mostrar o total de horas, ele mostra o <em>volume de pessoas</em> agrupadas pelo nível de exaustão. Ajuda a responder se o problema é sistémico (muita gente a fazer poucas horas extras) ou localizado (pouca gente a fazer muitas horas extras).</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🟢</div>
                        <div>
                            <strong className="text-emerald-700 block">Seguro (0-10h):</strong> Colaboradores com um volume aceitável e esporádico. Risco financeiro e trabalhista muito baixo.
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🔵</div>
                        <div>
                            <strong className="text-blue-700 block">Atenção (10-20h):</strong> Zona de alerta inicial. O colaborador já está a acumular uma carga que afeta o custo da obra.
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🟠</div>
                        <div>
                            <strong className="text-amber-700 block">Crítico (20-40h):</strong> Risco moderado a alto de passivo trabalhista e fadiga física.
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🚨</div>
                        <div>
                            <strong className="text-rose-700 block">Risco Alto (40h+):</strong> Colaboradores que provavelmente ultrapassaram o limite legal da CLT. Exigem investigação imediata pelo RH ou Gestor da Obra.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Distribuição de Horas (Histograma)
// ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-[0_10px_15px_-3px_rgb(0,0,0,0.1)] border border-slate-200 flex flex-col gap-2 min-w-[180px]">
                <p className="font-semibold text-slate-700 border-b border-slate-100 pb-2 mb-1">{data.range}</p>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Colaboradores:</span>
                    <span className="font-semibold text-slate-800">{data.count}</span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-slate-500 font-medium">Total de Horas:</span>
                    <span className="font-semibold text-indigo-600 font-mono tracking-tight bg-indigo-50 px-2 py-0.5 rounded-md">
                        {formatDecimalToTime(data.totalHours)}
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

const DistributionHistogram: React.FC<{ data: OvertimeRecord[]; onBucketClick?: (title: string, chapas: string[]) => void }> = ({ data, onBucketClick }) => {
    const [showHelp, setShowHelp] = useState(false);

    const buckets = useMemo(() => {
        const empHours: Record<string, number> = {};
        data.forEach(r => {
            const chapa = normalizeChapa(r.CHAPA);
            if (!chapa) return;
            if (isRelevantOvertimeEvent(r.EVENTO)) {
                empHours[r.CHAPA] = (empHours[r.CHAPA] || 0) + (Number(r.HORAS) || 0);
            }
        });

        const groups = [
            { range: 'Seguro (0-10h)', count: 0, totalHours: 0, color: '#10b981', chapas: [] as string[] },
            { range: 'Atenção (10-20h)', count: 0, totalHours: 0, color: '#3b82f6', chapas: [] as string[] },
            { range: 'Crítico (20-40h)', count: 0, totalHours: 0, color: '#f59e0b', chapas: [] as string[] },
            { range: 'Risco Alto (40h+)', count: 0, totalHours: 0, color: '#ef4444', chapas: [] as string[] }
        ];

        Object.entries(empHours).forEach(([chapa, h]) => {
            if (h <= 10) { groups[0].count++; groups[0].totalHours += h; groups[0].chapas.push(chapa); }
            else if (h <= 20) { groups[1].count++; groups[1].totalHours += h; groups[1].chapas.push(chapa); }
            else if (h <= 40) { groups[2].count++; groups[2].totalHours += h; groups[2].chapas.push(chapa); }
            else { groups[3].count++; groups[3].totalHours += h; groups[3].chapas.push(chapa); }
        });

        return groups;
    }, [data]);

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <PieChart size={18} className="text-emerald-500" />
                    Distribuição por Colaborador
                </h3>
                <button
                    onClick={() => setShowHelp(true)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    title="Como ler este gráfico?"
                >
                    <Info size={18} />
                </button>
            </div>
            <div className="flex-1 w-full min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buckets} layout="vertical" margin={{ left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="range" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: '600', fill: '#94a3b8' }} width={110} />
                        <Tooltip content={<CustomTooltip />} cursor={false} />
                        <Bar dataKey="count" name="Colaboradores" radius={[0, 4, 4, 0]} activeBar={false}>
                            {buckets.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                    cursor={onBucketClick ? "pointer" : "default"}
                                    onClick={() => onBucketClick && onBucketClick(`Faixa: ${entry.range}`, entry.chapas)}
                                    className="hover:opacity-80 transition-opacity"
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {showHelp && <HistogramHelpModal onClose={() => setShowHelp(false)} />}
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Modal de Ajuda do Mapa de Pressão
// ────────────────────────────────────────────────────────────
const PressureHelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-semibold text-slate-800">Entendendo o Mapa de Pressão</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-600">
                    <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="text-xl mt-0.5">🌡️</div>
                        <div>
                            <strong className="text-slate-800 block mb-1">O que é o Mapa de Pressão?</strong>
                            <p>É um <em>Heatmap</em> (Mapa de Calor) que identifica quais Centros de Custo estão a sofrer o maior desgaste operacional e a gerar o maior passivo trabalhista.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🧮</div>
                        <div>
                            <strong className="text-slate-700 block text-base mb-1">O Índice de Risco:</strong>
                            Não olhamos apenas para o volume de horas, mas para a <em>gravidade</em> delas. O sistema calcula um índice ponderado onde: HE 60% tem peso normal (x1), HE 100% tem peso alto (x2.5) e Violação de Interjornada tem peso crítico (x5). Esse total é então dividido pelo número de pessoas (Headcount) da equipa.
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🎨</div>
                        <div>
                            <strong className="text-slate-700 block text-base mb-1">Cores (Cápsulas):</strong>
                            Quanto mais forte for a cor da cápsula (Vermelho para HE 100%, Laranja para Interjornada, Azul para as restantes), maior é o volume médio de horas por pessoa naquele Centro de Custo.
                        </div>
                    </div>
                    <div className="flex items-start gap-3 border-t border-slate-100 pt-4 mt-2">
                        <div className="text-xl mt-0.5">🎯</div>
                        <div>
                            <strong className="text-rose-700 block text-base mb-1">Ação:</strong>
                            Foque as suas auditorias nas equipas que estão no topo da tabela com a barra de Risco vermelha quase cheia.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Tabela Detalhada por Colaborador
// ────────────────────────────────────────────────────────────
const EmployeeTable: React.FC<{ data: OvertimeRecord[]; onEmployeeClick: (name: string, chapa: string) => void }> = ({ data, onEmployeeClick }) => {
    const [search, setSearch] = useState('');

    const employeeSummary = useMemo(() => {
        const map: Record<string, {
            chapa: string;
            name: string;
            cc: string;
            he60: number;
            he100: number;
            inter: number;
            noturnas: number;
            total: number;
        }> = {};

        data.forEach(r => {
            const chapa = normalizeChapa(r.CHAPA);
            if (!chapa) return;

            if (!map[chapa]) {
                map[chapa] = {
                    chapa,
                    name: normalizeName(r.NOME),
                    cc: normalizeCC(r.CODCCUSTO),
                    he60: 0,
                    he100: 0,
                    inter: 0,
                    noturnas: 0,
                    total: 0
                };
            }

            const hours = Number(r.HORAS) || 0;

            if (isExtra100Event(r.EVENTO)) {
                map[chapa].he100 += hours;
            } else if (isExtra60Event(r.EVENTO)) {
                map[chapa].he60 += hours;
            } else if (isInterjornadaEvent(r.EVENTO)) {
                map[chapa].inter += hours;
            } else if (isNoturnoEvent(r.EVENTO)) {
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
                if (!search) return true;
                const s = search.toLowerCase();
                return emp.name.toLowerCase().includes(s) || emp.cc.toLowerCase().includes(s) || emp.chapa.toLowerCase().includes(s);
            })
            .sort((a, b) => b.total - a.total);
    }, [data, search]);

    return (
        <div id="employee-table" className="bg-white rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Users size={16} className="text-indigo-500" />
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Detalhamento por Colaborador</h3>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                        type="text"
                        placeholder="Buscar colaborador ou CC..."
                        className="pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-full md:w-64"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200 sticky top-0 z-10 box-decoration-clone">
                        <tr>
                            <th className="px-6 py-4">Nome do Colaborador</th>
                            <th className="px-6 py-4">CC</th>
                            <th className="px-6 py-4 text-center">HE 60</th>
                            <th className="px-6 py-4 text-center">HE 100</th>
                            <th className="px-6 py-4 text-center">Inter.</th>
                            <th className="px-6 py-4 text-center">Not.</th>
                            <th className="px-6 py-4 text-center bg-slate-100/50">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {employeeSummary.map((emp, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-3">
                                    <button
                                        onClick={() => onEmployeeClick(emp.name, emp.chapa)}
                                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 text-xs"
                                        title="Abrir raio-x diário do colaborador"
                                    >
                                        {emp.name}
                                    </button>
                                </td>
                                <td className="px-6 py-3">
                                    <span className="font-mono text-[10px] text-slate-400">{emp.cc}</span>
                                </td>
                                <td className="px-6 py-3 text-center font-mono tracking-tight text-blue-600 font-semibold">{formatDecimalToTime(emp.he60)}</td>
                                <td className="px-6 py-3 text-center font-mono tracking-tight text-rose-600 font-semibold">{formatDecimalToTime(emp.he100)}</td>
                                <td className="px-6 py-3 text-center font-mono tracking-tight text-amber-600 font-semibold">{formatDecimalToTime(emp.inter)}</td>
                                <td className="px-6 py-3 text-center font-mono tracking-tight text-purple-600 font-semibold">{formatDecimalToTime(emp.noturnas)}</td>
                                <td className="px-6 py-3 text-center font-mono tracking-tight font-bold text-slate-800 bg-slate-50/50">{formatDecimalToTime(emp.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Mapa de Pressão por CC (Heat Table)
// ────────────────────────────────────────────────────────────
const PressureMap: React.FC<{ data: OvertimeRecord[] }> = ({ data }) => {
    const [showHelp, setShowHelp] = useState(false);

    const tableData = useMemo(() => {
        const map: Record<string, { cc: string; he60: number; he100: number; inter: number; noturno: number; uniqueEmps: Set<string> }> = {};

        data.forEach(r => {
            const cc = normalizeCC(r.CODCCUSTO);
            if (!map[cc]) map[cc] = { cc, he60: 0, he100: 0, inter: 0, noturno: 0, uniqueEmps: new Set() };

            const hours = Number(r.HORAS) || 0;
            const chapa = normalizeChapa(r.CHAPA);
            if (chapa) map[cc].uniqueEmps.add(chapa);

            if (isExtra100Event(r.EVENTO)) map[cc].he100 += hours;
            else if (isExtra60Event(r.EVENTO)) map[cc].he60 += hours;
            else if (isInterjornadaEvent(r.EVENTO)) map[cc].inter += hours;
            else if (isNoturnoEvent(r.EVENTO)) map[cc].noturno += hours;
        });

        return Object.values(map).map(item => {
            const headcount = item.uniqueEmps.size || 1;
            const riskIndex = (item.he100 * 2.5 + item.he60 * 1.0 + item.inter * 5.0 + item.noturno * 0.5) / headcount;
            return {
                ...item,
                headcount,
                riskIndex: Number(riskIndex.toFixed(1))
            };
        }).sort((a, b) => b.riskIndex - a.riskIndex);
    }, [data]);

    const getHeatColor = (value: number, max: number, type: 'danger' | 'warning' | 'info') => {
        const ratio = Math.min(value / (max || 1), 1);
        if (type === 'danger') return `rgba(239, 68, 68, ${ratio * 0.8 + 0.05})`;
        if (type === 'warning') return `rgba(245, 158, 11, ${ratio * 0.8 + 0.05})`;
        return `rgba(59, 130, 246, ${ratio * 0.8 + 0.05})`;
    };

    const maxRisk = Math.max(...tableData.map(d => d.riskIndex), 1);

    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50 overflow-hidden relative">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-rose-500" />
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Mapa de Pressão por Centro de Custo</h3>
                </div>
                <button
                    onClick={() => setShowHelp(true)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    title="Como ler este mapa?"
                >
                    <Info size={18} />
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200 sticky top-0 z-10 box-decoration-clone">
                        <tr>
                            <th className="px-6 py-4">Centro de Custo</th>
                            <th className="px-6 py-4 text-center">Colaboradores</th>
                            <th className="px-6 py-4 text-center">HE 60%</th>
                            <th className="px-6 py-4 text-center">HE 100%</th>
                            <th className="px-6 py-4 text-center">Inter.</th>
                            <th className="px-6 py-4 text-center">Noturno</th>
                            <th className="px-6 py-4 text-center bg-gray-100">Índice de Risco</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {tableData.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-3 font-semibold text-slate-800">
                                    <div className="flex flex-col">
                                        <span className="text-slate-400 font-mono text-[10px]">{item.cc}</span>
                                        <span className="truncate max-w-[180px]">{getCCName(item.cc)}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-center font-semibold text-slate-500">{item.headcount}</td>
                                <td className="px-6 py-3 text-center font-mono tracking-tight text-slate-800 font-semibold" style={{ backgroundColor: getHeatColor(item.he60 / item.headcount, 10, 'info') }}>
                                    {formatDecimalToTime(item.he60)}
                                </td>
                                <td className="px-6 py-3 text-center font-mono tracking-tight text-slate-800 font-semibold" style={{ backgroundColor: getHeatColor(item.he100 / item.headcount, 5, 'danger') }}>
                                    {formatDecimalToTime(item.he100)}
                                </td>
                                <td className="px-6 py-3 text-center font-mono tracking-tight text-slate-800 font-semibold" style={{ backgroundColor: getHeatColor(item.inter / item.headcount, 2, 'warning') }}>
                                    {formatDecimalToTime(item.inter)}
                                </td>
                                <td className="px-6 py-3 text-center font-mono tracking-tight text-slate-800 font-semibold" style={{ backgroundColor: getHeatColor(item.noturno / item.headcount, 10, 'info') }}>
                                    {formatDecimalToTime(item.noturno)}
                                </td>
                                <td className="px-6 py-3 text-center bg-slate-50/50">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${item.riskIndex > maxRisk * 0.7 ? 'bg-rose-500' : item.riskIndex > maxRisk * 0.3 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${(item.riskIndex / maxRisk) * 100}%` }}
                                            />
                                        </div>
                                        <span className="font-mono tracking-tight font-bold text-slate-800 text-sm w-8">{item.riskIndex}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {showHelp && <PressureHelpModal onClose={() => setShowHelp(false)} />}
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Modal de Ajuda de Compliance
// ────────────────────────────────────────────────────────────
const ComplianceHelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-semibold text-slate-800">Entendendo o Compliance Trabalhista</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-600">
                    <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="text-xl mt-0.5">🛡️</div>
                        <div>
                            <strong className="text-slate-800 block mb-1">O que é este painel?</strong>
                            <p>Este módulo atua como uma auditoria ativa, monitorizando infrações diretas à legislação trabalhista (CLT) e mapeando o passivo gerado por cada Centro de Custo.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🔴</div>
                        <div>
                            <strong className="text-rose-700 block">Violação Diária (&gt; 2h):</strong> A legislação permite um máximo de 2 horas extras por dia útil. O sistema sinaliza automaticamente qualquer colaborador que tenha excedido este limite diário, expondo a empresa a riscos de multas e processos.
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🟠</div>
                        <div>
                            <strong className="text-amber-700 block">Violação Mensal (&gt; 44h):</strong> Monitoriza o acúmulo excessivo de horas ao longo da competência (mês). Volumes mensais muito altos indicam subdimensionamento crítico da equipa.
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="text-xl mt-0.5">🎯</div>
                        <div>
                            <strong className="text-indigo-700 block">Como auditar (Drill-down):</strong> Clique sobre a linha de qualquer Centro de Custo para expandir o nível de detalhe. O sistema listará os colaboradores infratores. Clique no nome do colaborador para abrir o extrato exato (dia a dia) de quando as infrações ocorreram.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Tabela de Compliance Trabalhista
// ────────────────────────────────────────────────────────────
const ComplianceTable: React.FC<{ data: OvertimeRecord[]; onRowClick?: (cc: string, ccName: string) => void }> = ({ data, onRowClick }) => {
    const [showHelp, setShowHelp] = useState(false);

    const complianceData = useMemo(() => {
        // Mapeamentos para agregação de horas por CHAPA
        // dailyHours: "CHAPA|YYYY-MM-DD" -> horas
        const dailyHours: Record<string, number> = {};
        // monthlyHours: "CHAPA|YYYY-MM-Payroll" -> horas
        const monthlyHours: Record<string, number> = {};

        // Mapeamento primário para CC: CHAPA -> CODCCUSTO
        const empToCC: Record<string, string> = {};

        // Loop principal único nos dados
        data.forEach(r => {
            const chapa = normalizeChapa(r.CHAPA);
            if (!chapa) return;

            const cc = normalizeCC(r.CODCCUSTO);
            empToCC[chapa] = cc; // Assume último CC lido ou mapeia todos do colaborador

            if (isExtraEvent(r.EVENTO)) {
                const hours = Number(r.HORAS) || 0;

                if (r.DATA) {
                    const dateObj = new Date(r.DATA);
                    if (!isNaN(dateObj.getTime())) {
                        const dayKey = dateObj.toISOString().split('T')[0];
                        const payrollKey = getPayrollMonthKey(r.DATA);

                        const dKey = `${chapa}|${dayKey}`;
                        const mKey = `${chapa}|${payrollKey}`;

                        dailyHours[dKey] = (dailyHours[dKey] || 0) + hours;
                        monthlyHours[mKey] = (monthlyHours[mKey] || 0) + hours;
                    }
                }
            }
        });

        // Contagem de violações e agregação por CC
        interface CCData {
            cc: string;
            ccName: string;
            employeesInRisk: Set<string>;
            dailyViolations: number;
            monthlyViolations: number;
        }

        const ccMap: Record<string, CCData> = {};

        // Avaliar violações Diárias (> 2h)
        Object.entries(dailyHours).forEach(([key, hours]) => {
            if (hours > 2) {
                const [chapa] = key.split('|');
                const cc = empToCC[chapa];
                if (cc) {
                    if (!ccMap[cc]) {
                        ccMap[cc] = { cc, ccName: getCCName(cc), employeesInRisk: new Set(), dailyViolations: 0, monthlyViolations: 0 };
                    }
                    ccMap[cc].dailyViolations += 1;
                    ccMap[cc].employeesInRisk.add(chapa);
                }
            }
        });

        // Avaliar violações Mensais (> 44h na competência)
        Object.entries(monthlyHours).forEach(([key, hours]) => {
            if (hours > 44) {
                const [chapa] = key.split('|');
                const cc = empToCC[chapa];
                if (cc) {
                    if (!ccMap[cc]) {
                        ccMap[cc] = { cc, ccName: getCCName(cc), employeesInRisk: new Set(), dailyViolations: 0, monthlyViolations: 0 };
                    }
                    ccMap[cc].monthlyViolations += 1;
                    ccMap[cc].employeesInRisk.add(chapa);
                }
            }
        });

        return Object.values(ccMap)
            .map(c => ({
                cc: c.cc,
                ccName: c.ccName,
                employeesInRisk: c.employeesInRisk.size,
                violatingChapas: Array.from(c.employeesInRisk),
                dailyViolations: c.dailyViolations,
                monthlyViolations: c.monthlyViolations,
                totalViolations: c.dailyViolations + c.monthlyViolations
            }))
            .filter(c => c.totalViolations > 0)
            .sort((a, b) => b.totalViolations - a.totalViolations);
    }, [data]);

    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50 overflow-hidden relative">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between mb-0">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-500" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                        Compliance Trabalhista (Viol. Limites de Jornada)
                    </h3>
                </div>
                <button
                    onClick={() => setShowHelp(true)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    title="Como auditar estas informações?"
                >
                    <Info size={18} />
                </button>
            </div>

            {complianceData.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                    </div>
                    <h4 className="text-slate-700 font-semibold text-lg">Operação 100% em Compliance</h4>
                    <p className="text-slate-500 text-sm mt-1 max-w-sm">
                        Nenhum centro de custo detectou violação de horas extras acima de 2h diárias ou de 44h na competência mensal para este período.
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200 sticky top-0 z-10 box-decoration-clone">
                            <tr>
                                <th className="px-6 py-4">Centro de Custo</th>
                                <th className="px-6 py-4 text-center">Colab. em Risco</th>
                                <th className="px-6 py-4 text-center">Violações (&gt;2h/dia)</th>
                                <th className="px-6 py-4 text-center">Violações (&gt;44h/mês)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {complianceData.map((item, idx) => (
                                <tr
                                    key={idx}
                                    className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-rose-50/50' : 'hover:bg-slate-50/80'}`}
                                    onClick={() => onRowClick && onRowClick(item.cc, item.ccName)}
                                >
                                    <td className="px-6 py-3 font-semibold text-slate-800">
                                        <div className="flex flex-col">
                                            <span className="text-slate-400 font-mono text-[10px]">{item.cc}</span>
                                            <span className="truncate max-w-[250px] font-semibold text-xs text-slate-800">{item.ccName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <span className="inline-flex py-1 px-3 rounded-full bg-amber-100 text-amber-700 font-semibold tracking-tight text-xs">
                                            {item.employeesInRisk}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-center font-mono tracking-tight font-semibold text-rose-600">
                                        {item.dailyViolations}
                                    </td>
                                    <td className="px-6 py-3 text-center font-mono tracking-tight font-semibold text-indigo-600">
                                        {item.monthlyViolations}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {showHelp && <ComplianceHelpModal onClose={() => setShowHelp(false)} />}
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
// Sub-componente: Modal de Detalhamento Diário (Drill-down)
// ────────────────────────────────────────────────────────────
const DailyDrilldownModal: React.FC<{ date: string | null; data: OvertimeRecord[]; onClose: () => void; onEmployeeClick: (name: string, chapa: string) => void }> = ({ date, data, onClose, onEmployeeClick }) => {
    const { listData, totals } = useMemo(() => {
        if (!date) return { listData: [], totals: { he60: 0, he100: 0, inter: 0, noturnas: 0, total: 0 } };

        const map: Record<string, {
            chapa: string;
            name: string;
            cc: string;
            he60: number;
            he100: number;
            inter: number;
            noturnas: number;
            total: number;
        }> = {};

        data.forEach(r => {
            if (!r.DATA || !r.DATA.startsWith(date)) return;

            const chapa = normalizeChapa(r.CHAPA);
            if (!chapa) return;

            if (!map[chapa]) {
                map[chapa] = {
                    chapa,
                    name: normalizeName(r.NOME),
                    cc: normalizeCC(r.CODCCUSTO),
                    he60: 0,
                    he100: 0,
                    inter: 0,
                    noturnas: 0,
                    total: 0
                };
            }

            const hours = Number(r.HORAS) || 0;

            if (isExtra100Event(r.EVENTO)) {
                map[chapa].he100 += hours;
            } else if (isExtra60Event(r.EVENTO)) {
                map[chapa].he60 += hours;
            } else if (isInterjornadaEvent(r.EVENTO)) {
                map[chapa].inter += hours;
            } else if (isNoturnoEvent(r.EVENTO)) {
                map[chapa].noturnas += hours;
            }
        });

        const list = Object.values(map)
            .map(emp => ({ ...emp, total: emp.he60 + emp.he100 + emp.inter + emp.noturnas }))
            .filter(emp => emp.total > 0)
            .sort((a, b) => b.total - a.total);

        const calcTotals = list.reduce((acc, curr) => ({
            he60: acc.he60 + curr.he60,
            he100: acc.he100 + curr.he100,
            inter: acc.inter + curr.inter,
            noturnas: acc.noturnas + curr.noturnas,
            total: acc.total + curr.total
        }), { he60: 0, he100: 0, inter: 0, noturnas: 0, total: 0 });

        return { listData: list, totals: calcTotals };
    }, [data, date]);

    if (!date) return null;

    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-gray-100 flex flex-col gap-3 relative bg-gray-50/50">
                    <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                    <h3 className="text-lg font-semibold text-slate-700 pr-8">Detalhamento do Dia: {formattedDate}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-semibold tracking-tight font-mono">
                            HE 60: {formatDecimalToTime(totals.he60)}
                        </span>
                        <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded text-[10px] font-semibold tracking-tight font-mono">
                            HE 100: {formatDecimalToTime(totals.he100)}
                        </span>
                        <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-[10px] font-semibold tracking-tight font-mono">
                            Inter: {formatDecimalToTime(totals.inter)}
                        </span>
                        <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-[10px] font-semibold tracking-tight font-mono">
                            Noturno: {formatDecimalToTime(totals.noturnas)}
                        </span>
                        <span className="bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold tracking-tight font-mono shadow-sm">
                            Total: {formatDecimalToTime(totals.total)}
                        </span>
                    </div>
                </div>
                <div className="overflow-y-auto max-h-[60vh]">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200 sticky top-0 z-10 box-decoration-clone">
                            <tr>
                                <th className="px-6 py-4">Nome</th>
                                <th className="px-6 py-4">CC</th>
                                <th className="px-6 py-4 text-center">HE 60</th>
                                <th className="px-6 py-4 text-center">HE 100</th>
                                <th className="px-6 py-4 text-center">Inter.</th>
                                <th className="px-6 py-4 text-center">Not.</th>
                                <th className="px-6 py-4 text-center bg-slate-100/50">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {listData.map((emp, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-3">
                                        <button
                                            onClick={() => onEmployeeClick(emp.name, emp.chapa)}
                                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 text-xs"
                                            title="Abrir raio-x diário do colaborador"
                                        >
                                            {emp.name}
                                        </button>
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className="font-mono text-[10px] text-slate-400">{emp.cc}</span>
                                    </td>
                                    <td className="px-6 py-3 text-center font-mono tracking-tight text-blue-600 font-semibold">{formatDecimalToTime(emp.he60)}</td>
                                    <td className="px-6 py-3 text-center font-mono tracking-tight text-rose-600 font-semibold">{formatDecimalToTime(emp.he100)}</td>
                                    <td className="px-6 py-3 text-center font-mono tracking-tight text-amber-600 font-semibold">{formatDecimalToTime(emp.inter)}</td>
                                    <td className="px-6 py-3 text-center font-mono tracking-tight text-purple-600 font-semibold">{formatDecimalToTime(emp.noturnas)}</td>
                                    <td className="px-6 py-3 text-center font-mono tracking-tight font-bold text-slate-800 bg-slate-50/50">{formatDecimalToTime(emp.total)}</td>
                                </tr>
                            ))}
                            {listData.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">Nenhum registro encontrado para este dia.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Modal Genérico de Colaboradores (Drill-down)
// ────────────────────────────────────────────────────────────
const EmployeeListDrilldownModal: React.FC<{ title: string; chapas: string[]; data: OvertimeRecord[]; onClose: () => void; onEmployeeClick: (name: string, chapa: string) => void }> = ({ title, chapas, data, onClose, onEmployeeClick }) => {
    const { listData, totals } = useMemo(() => {
        if (!chapas || chapas.length === 0) return { listData: [], totals: { he60: 0, he100: 0, inter: 0, noturnas: 0, total: 0 } };

        const map: Record<string, {
            chapa: string;
            name: string;
            cc: string;
            he60: number;
            he100: number;
            inter: number;
            noturnas: number;
            total: number;
        }> = {};

        data.forEach(r => {
            const chapa = normalizeChapa(r.CHAPA);
            if (!chapa || !chapas.includes(chapa)) return;

            if (!map[chapa]) {
                map[chapa] = {
                    chapa,
                    name: normalizeName(r.NOME),
                    cc: normalizeCC(r.CODCCUSTO),
                    he60: 0,
                    he100: 0,
                    inter: 0,
                    noturnas: 0,
                    total: 0
                };
            }

            const hours = Number(r.HORAS) || 0;

            if (isExtra100Event(r.EVENTO)) {
                map[chapa].he100 += hours;
            } else if (isExtra60Event(r.EVENTO)) {
                map[chapa].he60 += hours;
            } else if (isInterjornadaEvent(r.EVENTO)) {
                map[chapa].inter += hours;
            } else if (isNoturnoEvent(r.EVENTO)) {
                map[chapa].noturnas += hours;
            }
        });

        const list = Object.values(map)
            .map(emp => ({ ...emp, total: emp.he60 + emp.he100 + emp.inter + emp.noturnas }))
            .filter(emp => emp.total > 0)
            .sort((a, b) => b.total - a.total);

        const calcTotals = list.reduce((acc, curr) => ({
            he60: acc.he60 + curr.he60,
            he100: acc.he100 + curr.he100,
            inter: acc.inter + curr.inter,
            noturnas: acc.noturnas + curr.noturnas,
            total: acc.total + curr.total
        }), { he60: 0, he100: 0, inter: 0, noturnas: 0, total: 0 });

        return { listData: list, totals: calcTotals };
    }, [data, chapas]);

    if (!chapas || chapas.length === 0) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-gray-100 flex flex-col gap-3 relative bg-gray-50/50">
                    <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                    <h3 className="text-lg font-semibold text-slate-700 pr-8">{title}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-semibold tracking-tight font-mono">
                            HE 60: {formatDecimalToTime(totals.he60)}
                        </span>
                        <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded text-[10px] font-semibold tracking-tight font-mono">
                            HE 100: {formatDecimalToTime(totals.he100)}
                        </span>
                        <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-[10px] font-semibold tracking-tight font-mono">
                            Inter: {formatDecimalToTime(totals.inter)}
                        </span>
                        <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-[10px] font-semibold tracking-tight font-mono">
                            Noturno: {formatDecimalToTime(totals.noturnas)}
                        </span>
                        <span className="bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold tracking-tight font-mono shadow-sm">
                            Total: {formatDecimalToTime(totals.total)}
                        </span>
                    </div>
                </div>
                <div className="overflow-y-auto max-h-[60vh]">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200 sticky top-0 z-10 box-decoration-clone">
                            <tr>
                                <th className="px-6 py-4">Nome</th>
                                <th className="px-6 py-4">CC</th>
                                <th className="px-6 py-4 text-center">HE 60</th>
                                <th className="px-6 py-4 text-center">HE 100</th>
                                <th className="px-6 py-4 text-center">Inter.</th>
                                <th className="px-6 py-4 text-center">Not.</th>
                                <th className="px-6 py-4 text-center bg-slate-100/50">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {listData.map((emp, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-3">
                                        <button
                                            onClick={() => onEmployeeClick(emp.name, emp.chapa)}
                                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 text-xs"
                                            title="Abrir raio-x diário do colaborador"
                                        >
                                            {emp.name}
                                        </button>
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className="font-mono text-[10px] text-slate-400">{emp.cc}</span>
                                    </td>
                                    <td className="px-6 py-3 text-center font-mono tracking-tight text-blue-600 font-semibold">{formatDecimalToTime(emp.he60)}</td>
                                    <td className="px-6 py-3 text-center font-mono tracking-tight text-rose-600 font-semibold">{formatDecimalToTime(emp.he100)}</td>
                                    <td className="px-6 py-3 text-center font-mono tracking-tight text-amber-600 font-semibold">{formatDecimalToTime(emp.inter)}</td>
                                    <td className="px-6 py-3 text-center font-mono tracking-tight text-purple-600 font-semibold">{formatDecimalToTime(emp.noturnas)}</td>
                                    <td className="px-6 py-3 text-center font-mono tracking-tight font-bold text-slate-800 bg-slate-50/50">{formatDecimalToTime(emp.total)}</td>
                                </tr>
                            ))}
                            {listData.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">Nenhum registro encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Modal Master-Detail de Compliance Trabalhista
// ────────────────────────────────────────────────────────────
const ComplianceDrilldownModal: React.FC<{ cc: string; ccName: string; data: OvertimeRecord[]; onClose: () => void; onEmployeeClick: (name: string, chapa: string) => void }> = ({ cc, ccName, data, onClose, onEmployeeClick }) => {
    const [expandedChapa, setExpandedChapa] = useState<string | null>(null);

    const { offenders, totals } = useMemo(() => {
        if (!cc) return { offenders: [], totals: { he60: 0, he100: 0, inter: 0, noturnas: 0, total: 0 } };

        const map: Record<string, {
            chapa: string;
            name: string;
            he60: number;
            he100: number;
            inter: number;
            noturnas: number;
            total: number;
            dailyHours: Record<string, number>;
            monthlyHours: Record<string, number>;
            dailyViolations: { date: string; hours: number }[];
            monthlyViolations: { month: string; hours: number }[];
        }> = {};

        data.forEach(r => {
            const rowCC = normalizeCC(r.CODCCUSTO);
            if (rowCC !== cc) return;

            const chapa = normalizeChapa(r.CHAPA);
            if (!chapa) return;

            if (!map[chapa]) {
                map[chapa] = {
                    chapa,
                    name: normalizeName(r.NOME),
                    he60: 0,
                    he100: 0,
                    inter: 0,
                    noturnas: 0,
                    total: 0,
                    dailyHours: {},
                    monthlyHours: {},
                    dailyViolations: [],
                    monthlyViolations: []
                };
            }

            const hours = Number(r.HORAS) || 0;

            if (isExtraEvent(r.EVENTO)) {
                if (isExtra100Event(r.EVENTO)) map[chapa].he100 += hours;
                else map[chapa].he60 += hours;

                if (r.DATA) {
                    const dateObj = new Date(r.DATA);
                    if (!isNaN(dateObj.getTime())) {
                        const dayKey = dateObj.toISOString().split('T')[0];
                        const payrollKey = getPayrollMonthKey(r.DATA);

                        map[chapa].dailyHours[dayKey] = (map[chapa].dailyHours[dayKey] || 0) + hours;
                        map[chapa].monthlyHours[payrollKey] = (map[chapa].monthlyHours[payrollKey] || 0) + hours;
                    }
                }
            } else if (isInterjornadaEvent(r.EVENTO)) {
                map[chapa].inter += hours;
            } else if (isNoturnoEvent(r.EVENTO)) {
                map[chapa].noturnas += hours;
            }
        });

        // Apuração das violações e cálculo de totais
        const filteredOffenders = Object.values(map)
            .map(emp => {
                emp.total = emp.he60 + emp.he100 + emp.inter + emp.noturnas;

                Object.entries(emp.dailyHours).forEach(([date, hours]) => {
                    if (hours > 2) emp.dailyViolations.push({ date, hours });
                });

                Object.entries(emp.monthlyHours).forEach(([month, hours]) => {
                    if (hours > 44) emp.monthlyViolations.push({ month, hours });
                });

                // Ordenar violações por horas caindo
                emp.dailyViolations.sort((a, b) => b.hours - a.hours);
                emp.monthlyViolations.sort((a, b) => b.hours - a.hours);

                return emp;
            })
            .filter(emp => emp.dailyViolations.length > 0 || emp.monthlyViolations.length > 0)
            .sort((a, b) => (b.dailyViolations.length + b.monthlyViolations.length) - (a.dailyViolations.length + a.monthlyViolations.length));

        const calcTotals = filteredOffenders.reduce((acc, curr) => ({
            he60: acc.he60 + curr.he60,
            he100: acc.he100 + curr.he100,
            inter: acc.inter + curr.inter,
            noturnas: acc.noturnas + curr.noturnas,
            total: acc.total + curr.total
        }), { he60: 0, he100: 0, inter: 0, noturnas: 0, total: 0 });

        return { offenders: filteredOffenders, totals: calcTotals };
    }, [data, cc]);

    if (!cc) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-gray-100 flex flex-col gap-3 relative bg-gray-50/50">
                    <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                    <h3 className="text-lg font-semibold text-slate-700 pr-8">Auditoria de Compliance: {ccName}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-semibold tracking-tight font-mono">
                            HE 60: {formatDecimalToTime(totals.he60)}
                        </span>
                        <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded text-[10px] font-semibold tracking-tight font-mono">
                            HE 100: {formatDecimalToTime(totals.he100)}
                        </span>
                        <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-[10px] font-semibold tracking-tight font-mono">
                            Inter: {formatDecimalToTime(totals.inter)}
                        </span>
                        <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-[10px] font-semibold tracking-tight font-mono">
                            Noturno: {formatDecimalToTime(totals.noturnas)}
                        </span>
                        <span className="bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold tracking-tight font-mono shadow-sm">
                            Total: {formatDecimalToTime(totals.total)}
                        </span>
                    </div>
                </div>
                <div className="overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[11px] tracking-wider border-b border-slate-200 sticky top-0 z-10 box-decoration-clone">
                            <tr>
                                <th className="px-6 py-4">Nome do Colaborador</th>
                                <th className="px-6 py-4 text-center">HE Total</th>
                                <th className="px-6 py-4 text-center">Infrações Diárias (&gt;2h)</th>
                                <th className="px-6 py-4 text-center">Infrações Mensais (&gt;44h)</th>
                                <th className="px-6 py-4 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {offenders.map((emp, idx) => (
                                <React.Fragment key={idx}>
                                    <tr
                                        className={`transition-colors cursor-pointer ${expandedChapa === emp.chapa ? 'bg-indigo-50/50' : 'hover:bg-slate-50/80'}`}
                                        onClick={() => setExpandedChapa(expandedChapa === emp.chapa ? null : emp.chapa)}
                                    >
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onEmployeeClick(emp.name, emp.chapa);
                                                }}
                                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 text-xs"
                                                title="Abrir raio-x diário do colaborador"
                                            >
                                                {emp.name}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center font-mono tracking-tight font-bold text-slate-900">{formatDecimalToTime(emp.total)}</td>
                                        <td className="px-6 py-4 text-center">
                                            {emp.dailyViolations.length > 0 ? (
                                                <span className="text-rose-600 font-semibold bg-rose-50 border border-rose-100 px-2 py-1 rounded-full text-[10px] tracking-wider uppercase">{emp.dailyViolations.length} ocorrências</span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {emp.monthlyViolations.length > 0 ? (
                                                <span className="text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-full text-[10px] tracking-wider uppercase">{emp.monthlyViolations.length} ocorrências</span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center text-slate-400">
                                            <ChevronDown size={18} className={`transform transition-transform ${expandedChapa === emp.chapa ? 'rotate-180 text-indigo-500' : ''}`} />
                                        </td>
                                    </tr>
                                    {expandedChapa === emp.chapa && (
                                        <tr>
                                            <td colSpan={5} className="p-0">
                                                <div className="bg-slate-50/80 p-6 border-l-4 border-rose-500 shadow-inner flex flex-col md:flex-row gap-8">
                                                    {emp.dailyViolations.length > 0 && (
                                                        <div className="flex-1">
                                                            <h4 className="text-xs font-semibold text-rose-700 uppercase tracking-wider mb-3">Excesso Diário (&gt;2h)</h4>
                                                            <ul className="space-y-2">
                                                                {emp.dailyViolations.map((v, i) => {
                                                                    const d = new Date(v.date + 'T12:00:00');
                                                                    const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : v.date;
                                                                    return (
                                                                        <li key={i} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-rose-100 shadow-sm">
                                                                            <span className="text-sm text-slate-600">{dateStr}</span>
                                                                            <span className="font-mono tracking-tight font-semibold text-rose-600">{formatDecimalToTime(v.hours)}</span>
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {emp.monthlyViolations.length > 0 && (
                                                        <div className="flex-1">
                                                            <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-3">Excesso Mensal (&gt;44h)</h4>
                                                            <ul className="space-y-2">
                                                                {emp.monthlyViolations.map((v, i) => (
                                                                    <li key={i} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-indigo-100 shadow-sm">
                                                                        <span className="text-sm text-slate-600">{v.month.replace('-Payroll', '')}</span>
                                                                        <span className="font-mono tracking-tight font-semibold text-indigo-600">{formatDecimalToTime(v.hours)}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {offenders.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum registro encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────
const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ data, allData, periodStart, periodEnd, filters }) => {
    const [drilldownDate, setDrilldownDate] = useState<string | null>(null);
    const [listDrilldown, setListDrilldown] = useState<{ title: string; chapas: string[] } | null>(null);
    const [complianceDrilldown, setComplianceDrilldown] = useState<{ cc: string; ccName: string } | null>(null);
    const [comparisonModalData, setComparisonModalData] = useState<{ isOpen: boolean; employeeName: string; chapa: string } | null>(null);
    const realRecords = allData ?? data;
    const planningRecords = useMemo<PlanningRecord[]>(
        () => getAllPlanningRecords().filter(record => !record.status || record.status === 'approved'),
        []
    );

    const handleEmployeeClick = (employeeName: string, chapa: string) => {
        setComparisonModalData({ isOpen: true, employeeName, chapa });
    };

    // Calculando métricas gerais para os top cards de anomalia e interjornada
    const metrics = useMemo(() => {
        const { dailyHours } = buildExtraHoursAggregations(data);
        let dailyExtraViolations = 0;
        let interjornadas = 0;

        Object.values(dailyHours).forEach(hours => {
            if (hours > 2) dailyExtraViolations += 1;
        });

        data.forEach(r => {
            if (isInterjornadaEvent(r.EVENTO)) interjornadas++;
        });

        return { dailyExtraViolations, interjornadas };
    }, [data]);

    return (
        <div className="space-y-6">
            {/* Mega Cards de Alerta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-white to-slate-50 p-5 rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50 flex items-center gap-4 group hover:border-rose-300 transition-all">
                    <div className="p-3 rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/30 shrink-0 group-hover:scale-110 transition-transform">
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">ViolaÃ§Ãµes DiÃ¡rias de HE (&gt;2h)</p>
                        <h3 className="text-2xl font-bold tracking-tight text-slate-800 font-mono">{metrics.dailyExtraViolations}</h3>
                        <div className="flex items-center gap-1 text-[10px] text-rose-500 font-semibold mt-0.5">
                            <Zap size={10} />
                            <span>LIMITE CLT DE HORA EXTRA</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-white to-slate-50 p-5 rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50 flex items-center gap-4 group hover:border-amber-300 transition-all">
                    <div className="p-3 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/30 shrink-0 group-hover:scale-110 transition-transform">
                        <Scale size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Violações de Interjornada</p>
                        <h3 className="text-2xl font-bold tracking-tight text-slate-800 font-mono">{metrics.interjornadas}</h3>
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold mt-0.5">
                            <Layers size={10} />
                            <span>NECESSITA AJUSTE DE ESCALA</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gráficos Full Width */}
            <TrendAnalysisEnhanced
                data={data}
                referenceData={realRecords}
                planningRecords={planningRecords}
                filters={filters}
                periodStart={periodStart}
                periodEnd={periodEnd}
                onDayClick={setDrilldownDate}
            />
            <ConcentrationPareto data={data} onBarClick={(title, chapas) => setListDrilldown({ title, chapas })} />

            {/* Grid 50/50: Histograma e Compliance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DistributionHistogram data={data} onBucketClick={(title, chapas) => setListDrilldown({ title, chapas })} />
                <ComplianceTable data={data} onRowClick={(cc, ccName) => setComplianceDrilldown({ cc, ccName })} />
            </div>

            {/* Mapa de Pressão */}
            <PressureMap data={data} />

            {/* Tabela de Colaboradores */}
            <EmployeeTable data={data} onEmployeeClick={handleEmployeeClick} />

            {/* Modal de Drill-down Diário */}
            <DailyDrilldownModal
                date={drilldownDate}
                data={data}
                onClose={() => setDrilldownDate(null)}
                onEmployeeClick={handleEmployeeClick}
            />

            {/* Modal Genérico de Drill-down */}
            {listDrilldown && (
                <EmployeeListDrilldownModal
                    title={listDrilldown.title}
                    chapas={listDrilldown.chapas}
                    data={data}
                    onClose={() => setListDrilldown(null)}
                    onEmployeeClick={handleEmployeeClick}
                />
            )}

            {/* Modal de Compliance Trabalhista */}
            {complianceDrilldown && (
                <ComplianceDrilldownModal
                    cc={complianceDrilldown.cc}
                    ccName={complianceDrilldown.ccName}
                    data={data}
                    onClose={() => setComplianceDrilldown(null)}
                    onEmployeeClick={handleEmployeeClick}
                />
            )}
            {comparisonModalData && (
                <EmployeeDailyComparisonModal
                    isOpen={comparisonModalData.isOpen}
                    onClose={() => setComparisonModalData(null)}
                    employeeName={comparisonModalData.employeeName}
                    chapa={comparisonModalData.chapa}
                    periodStart={periodStart}
                    periodEnd={periodEnd}
                    plannedRecords={planningRecords}
                    realRecords={realRecords}
                />
            )}
        </div>
    );
};

export default AnalysisPanel;

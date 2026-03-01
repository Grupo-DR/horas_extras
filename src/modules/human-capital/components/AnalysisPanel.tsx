import React, { useMemo, useState } from 'react';
import { OvertimeRecord } from '../types';
import { RealOvertimeRecord } from '../data/realOvertime';
import {
    AlertTriangle, Building2, Scale, Users, CheckCircle2,
    Search, TrendingUp, BarChart3, PieChart, Activity, Layers, Moon, Zap, ArrowUpRight,
    MapPin, Briefcase, ShieldAlert, X, ChevronDown
} from 'lucide-react';
import { getCCName, getCCRegional } from '../data/ccMaster';
import {
    ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ReferenceLine, Cell, BarChart
} from 'recharts';

interface AnalysisPanelProps {
    data: OvertimeRecord[];
    selectedYear: string;
    realOvertime: RealOvertimeRecord[];
}

export const formatDecimalToTime = (decimalHours: number): string => {
    if (isNaN(decimalHours) || decimalHours === null) return "00:00";
    const isNegative = decimalHours < 0;
    const absHours = Math.abs(decimalHours);
    const h = Math.floor(absHours);
    const m = Math.round((absHours - h) * 60);
    const finalH = h + Math.floor(m / 60);
    const finalM = m % 60;
    const sign = isNegative ? "-" : "";
    return `${sign}${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
};

export const getPayrollMonthKey = (dateString: string): string => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) return '';

    const year = dateObj.getFullYear();
    const month = dateObj.getMonth(); // 0 to 11
    const day = dateObj.getDate();

    let payrollYear = year;
    let payrollMonth = month;

    if (day >= 21) {
        payrollMonth += 1;
        if (payrollMonth > 11) {
            payrollMonth = 0;
            payrollYear += 1;
        }
    }

    // Retorna YYYY-MM numerado de 01 a 12
    return `${payrollYear}-${String(payrollMonth + 1).padStart(2, '0')}-Payroll`;
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Gráfico de Tendência (Trend Analysis)
// ────────────────────────────────────────────────────────────
const TrendAnalysis: React.FC<{ data: OvertimeRecord[]; onDayClick?: (date: string) => void }> = ({ data, onDayClick }) => {
    const chartData = useMemo(() => {
        const map: Record<string, { date: string; he: number; inter: number; noturno: number; total: number }> = {};

        data.forEach(r => {
            if (!r.DATA) return;
            const dateObj = new Date(r.DATA);
            const key = dateObj.toISOString().split('T')[0];

            if (!map[key]) map[key] = { date: key, he: 0, inter: 0, noturno: 0, total: 0 };

            const evt = (r.EVENTO || '').toUpperCase();
            const hours = Number(r.HORAS) || 0;

            if (evt.includes('EXTRA') || evt.includes('60') || evt.includes('100')) {
                map[key].he += hours;
                map[key].total += hours;
            } else if (evt.includes('INTER')) {
                map[key].inter += hours;
                map[key].total += hours;
            } else if (evt.includes('NOTURNO') || evt.includes('NOT')) {
                map[key].noturno += hours;
                map[key].total += hours;
            }
        });

        const sorted = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));

        // Média Móvel (7 dias)
        return sorted.map((item, index, arr) => {
            const start = Math.max(0, index - 6);
            const subset = arr.slice(start, index + 1);
            const avg = subset.reduce((acc, curr) => acc + curr.total, 0) / subset.length;
            return {
                ...item,
                displayDate: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                movingAvg: Number(avg.toFixed(1))
            };
        });
    }, [data]);

    if (chartData.length === 0) return null;

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50">
            <div className="flex items-center gap-2 mb-6">
                <TrendingUp size={18} className="text-blue-500" />
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Análise de Tendência Temporal</h3>
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
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            opacity={0.8}
                            cursor={onDayClick ? "pointer" : "default"}
                            onClick={(entry: any) => {
                                if (onDayClick && entry && entry.date) {
                                    onDayClick(entry.date);
                                }
                            }}
                        />

                        <Line
                            type="monotone"
                            dataKey="movingAvg"
                            name="Média Móvel (7d)"
                            stroke="#e11d48"
                            strokeWidth={2}
                            dot={false}
                        />

                        <ReferenceLine
                            y={50}
                            stroke="#10b981"
                            strokeDasharray="5 5"
                            label={{ value: 'Limite Saudável', position: 'right', fill: '#10b981', fontSize: 11 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Análise de Concentração (Pareto)
// ────────────────────────────────────────────────────────────
const ConcentrationPareto: React.FC<{ data: OvertimeRecord[] }> = ({ data }) => {
    const [view, setView] = useState<'cc' | 'funcao' | 'colaborador' | 'regional'>('cc');

    const chartData = useMemo(() => {
        const counts: Record<string, number> = {};
        data.forEach(r => {
            let key = '';
            if (view === 'cc') key = r.CODCCUSTO || 'S/ CC';
            else if (view === 'funcao') key = r.FUNCAO || 'S/ Função';
            else if (view === 'colaborador') key = r.NOME || 'S/ Nome';
            else if (view === 'regional') key = getCCRegional(r.CODCCUSTO || '');

            counts[key] = (counts[key] || 0) + (Number(r.HORAS) || 0);
        });

        const sorted = Object.entries(counts)
            .map(([name, value]) => ({
                name: view === 'cc' ? `${name} - ${getCCName(name)}` : name,
                value: Number(value.toFixed(1))
            }))
            .sort((a, b) => b.value - a.value);

        const total = sorted.reduce((acc, curr) => acc + curr.value, 0);
        let accumulated = 0;

        return sorted.map(item => {
            accumulated += item.value;
            return {
                ...item,
                percent: Number(((accumulated / total) * 100).toFixed(1))
            };
        }).slice(0, 15);
    }, [data, view]);

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <BarChart3 size={18} className="text-indigo-500" />
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Análise de Concentração (Pareto)</h3>
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
                        <Bar yAxisId="left" dataKey="value" name="Horas" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="percent" name="% Acumulada" stroke="#e11d48" strokeWidth={3} dot={{ r: 4, fill: '#e11d48' }} />
                    </ComposedChart>
                </ResponsiveContainer>
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
    const buckets = useMemo(() => {
        const empHours: Record<string, number> = {};
        data.forEach(r => {
            if (!r.CHAPA) return;
            const evt = (r.EVENTO || '').toUpperCase();
            if (evt.includes('EXTRA') || evt.includes('60') || evt.includes('100') || evt.includes('INTER') || evt.includes('NOTURNO') || evt.includes('NOT')) {
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
            <div className="flex items-center gap-2 mb-6 shrink-0">
                <PieChart size={18} className="text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Distribuição de Horas por Colaborador</h3>
            </div>
            <div className="flex-1 w-full min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buckets} layout="vertical" margin={{ left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="range" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: '600', fill: '#94a3b8' }} width={110} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(2f, 3f, 4f, 0.04)' }} />
                        <Bar dataKey="count" name="Colaboradores" radius={[0, 4, 4, 0]}>
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
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Tabela Detalhada por Colaborador
// ────────────────────────────────────────────────────────────
const EmployeeTable: React.FC<{ data: OvertimeRecord[] }> = ({ data }) => {
    const [search, setSearch] = useState('');

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
                if (evt.includes('100')) map[chapa].he100 += hours;
                else map[chapa].he60 += hours;
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
                if (!search) return true;
                const s = search.toLowerCase();
                return emp.name.toLowerCase().includes(s) || emp.cc.toLowerCase().includes(s);
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
                                <td className="px-6 py-3 font-semibold text-slate-800 text-xs">{emp.name}</td>
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
    const tableData = useMemo(() => {
        const map: Record<string, { cc: string; he60: number; he100: number; inter: number; noturno: number; uniqueEmps: Set<string> }> = {};

        data.forEach(r => {
            const cc = r.CODCCUSTO || 'S/ CC';
            if (!map[cc]) map[cc] = { cc, he60: 0, he100: 0, inter: 0, noturno: 0, uniqueEmps: new Set() };

            const hours = Number(r.HORAS) || 0;
            const evt = (r.EVENTO || '').toUpperCase();
            if (r.CHAPA) map[cc].uniqueEmps.add(r.CHAPA);

            if (evt.includes('EXTRA')) {
                if (evt.includes('100')) map[cc].he100 += hours;
                else map[cc].he60 += hours;
            } else if (evt.includes('INTER')) map[cc].inter += hours;
            else if (evt.includes('NOTURNO') || evt.includes('NOT')) map[cc].noturno += hours;
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
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-rose-500" />
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Mapa de Pressão por Centro de Custo</h3>
                </div>
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
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Tabela de Compliance Trabalhista
// ────────────────────────────────────────────────────────────
const ComplianceTable: React.FC<{ data: OvertimeRecord[]; onRowClick?: (cc: string, ccName: string) => void }> = ({ data, onRowClick }) => {
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
            const chapa = r.CHAPA;
            if (!chapa) return;

            const cc = r.CODCCUSTO || 'S/ CC';
            empToCC[chapa] = cc; // Assume último CC lido ou mapeia todos do colaborador

            const evt = (r.EVENTO || '').toUpperCase();
            if (evt.includes('EXTRA') || evt.includes('60') || evt.includes('100')) {
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
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-md shadow-slate-200/50 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <ShieldAlert size={16} className="text-rose-500" />
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Compliance Trabalhista (Viol. Limites de Jornada)</h3>
                </div>
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
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
// Sub-componente: Modal de Detalhamento Diário (Drill-down)
// ────────────────────────────────────────────────────────────
const DailyDrilldownModal: React.FC<{ date: string | null; data: OvertimeRecord[]; onClose: () => void }> = ({ date, data, onClose }) => {
    const { listData, totals } = useMemo(() => {
        if (!date) return { listData: [], totals: { he60: 0, he100: 0, inter: 0, noturnas: 0, total: 0 } };

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
            if (!r.DATA || !r.DATA.startsWith(date)) return;

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
                if (evt.includes('100')) map[chapa].he100 += hours;
                else map[chapa].he60 += hours;
            } else if (evt.includes('INTER')) {
                map[chapa].inter += hours;
            } else if (evt.includes('NOTURNO') || evt.includes('NOT')) {
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
                                    <td className="px-6 py-3 font-semibold text-slate-800 text-xs">{emp.name}</td>
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
const EmployeeListDrilldownModal: React.FC<{ title: string; chapas: string[]; data: OvertimeRecord[]; onClose: () => void }> = ({ title, chapas, data, onClose }) => {
    const { listData, totals } = useMemo(() => {
        if (!chapas || chapas.length === 0) return { listData: [], totals: { he60: 0, he100: 0, inter: 0, noturnas: 0, total: 0 } };

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
            if (!chapa || !chapas.includes(chapa)) return;

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
                if (evt.includes('100')) map[chapa].he100 += hours;
                else map[chapa].he60 += hours;
            } else if (evt.includes('INTER')) {
                map[chapa].inter += hours;
            } else if (evt.includes('NOTURNO') || evt.includes('NOT')) {
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
                                    <td className="px-6 py-3 font-semibold text-slate-800 text-xs">{emp.name}</td>
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
const ComplianceDrilldownModal: React.FC<{ cc: string; ccName: string; data: OvertimeRecord[]; onClose: () => void }> = ({ cc, ccName, data, onClose }) => {
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
            const rowCC = r.CODCCUSTO || 'S/ CC';
            if (rowCC !== cc) return;

            const chapa = r.CHAPA;
            if (!chapa) return;

            if (!map[chapa]) {
                map[chapa] = {
                    chapa,
                    name: r.NOME || 'Sem Nome',
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

            const evt = (r.EVENTO || '').toUpperCase();
            const hours = Number(r.HORAS) || 0;

            if (evt.includes('EXTRA') || evt.includes('60') || evt.includes('100')) {
                if (evt.includes('100')) map[chapa].he100 += hours;
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
            } else if (evt.includes('INTER')) {
                map[chapa].inter += hours;
            } else if (evt.includes('NOTURNO') || evt.includes('NOT')) {
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
                                        <td className="px-6 py-4 font-semibold text-slate-800 text-xs">{emp.name}</td>
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
const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ data }) => {
    const [drilldownDate, setDrilldownDate] = useState<string | null>(null);
    const [listDrilldown, setListDrilldown] = useState<{ title: string; chapas: string[] } | null>(null);
    const [complianceDrilldown, setComplianceDrilldown] = useState<{ cc: string; ccName: string } | null>(null);

    // Calculando métricas gerais para os top cards de anomalia e interjornada
    const metrics = useMemo(() => {
        let jornadasLongas = 0;
        let interjornadas = 0;

        data.forEach(r => {
            const evt = (r.EVENTO || '').toUpperCase();
            const hours = Number(r.HORAS) || 0;
            if ((evt.includes('EXTRA') || evt.includes('60') || evt.includes('100')) && hours > 10) jornadasLongas++;
            if (evt.includes('INTER')) interjornadas++;
        });

        return { jornadasLongas, interjornadas };
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
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Anomalias de Jornada (&gt;10h)</p>
                        <h3 className="text-2xl font-bold tracking-tight text-slate-800 font-mono">{metrics.jornadasLongas}</h3>
                        <div className="flex items-center gap-1 text-[10px] text-rose-500 font-semibold mt-0.5">
                            <Zap size={10} />
                            <span>ALTO RISCO TRABALHISTA</span>
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
            <TrendAnalysis data={data} onDayClick={setDrilldownDate} />
            <ConcentrationPareto data={data} />

            {/* Grid 50/50: Histograma e Compliance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DistributionHistogram data={data} onBucketClick={(title, chapas) => setListDrilldown({ title, chapas })} />
                <ComplianceTable data={data} onRowClick={(cc, ccName) => setComplianceDrilldown({ cc, ccName })} />
            </div>

            {/* Mapa de Pressão */}
            <PressureMap data={data} />

            {/* Tabela de Colaboradores */}
            <EmployeeTable data={data} />

            {/* Modal de Drill-down Diário */}
            <DailyDrilldownModal date={drilldownDate} data={data} onClose={() => setDrilldownDate(null)} />

            {/* Modal Genérico de Drill-down */}
            {listDrilldown && (
                <EmployeeListDrilldownModal
                    title={listDrilldown.title}
                    chapas={listDrilldown.chapas}
                    data={data}
                    onClose={() => setListDrilldown(null)}
                />
            )}

            {/* Modal de Compliance Trabalhista */}
            {complianceDrilldown && (
                <ComplianceDrilldownModal
                    cc={complianceDrilldown.cc}
                    ccName={complianceDrilldown.ccName}
                    data={data}
                    onClose={() => setComplianceDrilldown(null)}
                />
            )}
        </div>
    );
};

export default AnalysisPanel;

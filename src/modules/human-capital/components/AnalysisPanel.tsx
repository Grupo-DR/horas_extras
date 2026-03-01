import React, { useMemo, useState } from 'react';
import { OvertimeRecord } from '../types';
import { RealOvertimeRecord } from '../data/realOvertime';
import {
    AlertTriangle, Building2, Scale, Users,
    Search, TrendingUp, BarChart3, PieChart, Activity, Layers, Moon, Zap, ArrowUpRight,
    MapPin, Briefcase
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

// ────────────────────────────────────────────────────────────
// Sub-componente: Gráfico de Tendência (Trend Analysis)
// ────────────────────────────────────────────────────────────
const TrendAnalysis: React.FC<{ data: OvertimeRecord[] }> = ({ data }) => {
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
                <TrendingUp size={18} className="text-blue-500" />
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Análise de Tendência Temporal</h3>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis
                            dataKey="displayDate"
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tickFormatter={formatDecimalToTime}
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            axisLine={false}
                            tickLine={false}
                            label={{ value: 'Horas', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#9ca3af' } }}
                        />
                        <Tooltip
                            formatter={(value: any, name: any) => [typeof value === 'number' ? formatDecimalToTime(value) : value, name]}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />

                        <Bar dataKey="he" name="H. Extras" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.7} />

                        <Line
                            type="monotone"
                            dataKey="movingAvg"
                            name="Média Móvel (7d)"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={false}
                        />

                        <ReferenceLine
                            y={50}
                            stroke="#10b981"
                            strokeDasharray="5 5"
                            label={{ value: 'Limite Saudável', position: 'right', fill: '#10b981', fontSize: 10 }}
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <BarChart3 size={18} className="text-indigo-500" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Análise de Concentração (Pareto)</h3>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl self-start">
                    {(['cc', 'funcao', 'colaborador', 'regional'] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${view === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            {v === 'cc' ? 'CC' : v === 'funcao' ? 'Função' : v === 'colaborador' ? 'Colab.' : 'Regional'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 9, fill: '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                            hide={chartData.length > 8}
                        />
                        <YAxis
                            yAxisId="left"
                            tickFormatter={formatDecimalToTime}
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            axisLine={false}
                            tickLine={false}
                            unit="%"
                        />
                        <Tooltip
                            formatter={(value: any, name: any) => [name === 'Horas' && typeof value === 'number' ? formatDecimalToTime(value) : value, name]}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar yAxisId="left" dataKey="value" name="Horas" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="percent" name="% Acumulada" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e' }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Sub-componente: Distribuição de Horas (Histograma)
// ────────────────────────────────────────────────────────────
const DistributionHistogram: React.FC<{ data: OvertimeRecord[] }> = ({ data }) => {
    const buckets = useMemo(() => {
        const empHours: Record<string, number> = {};
        data.forEach(r => {
            if (!r.CHAPA) return;
            empHours[r.CHAPA] = (empHours[r.CHAPA] || 0) + (Number(r.HORAS) || 0);
        });

        const groups = [
            { range: '0-10h', count: 0, color: '#10b981' },
            { range: '10-20h', count: 0, color: '#3b82f6' },
            { range: '20-40h', count: 0, color: '#f59e0b' },
            { range: '40h+', count: 0, color: '#ef4444' }
        ];

        Object.values(empHours).forEach(h => {
            if (h <= 10) groups[0].count++;
            else if (h <= 20) groups[1].count++;
            else if (h <= 40) groups[2].count++;
            else groups[3].count++;
        });

        return groups;
    }, [data]);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
                <PieChart size={18} className="text-emerald-500" />
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Distribuição de Horas por Colaborador</h3>
            </div>
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buckets} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="range" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold', fill: '#374151' }} width={60} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                        <Bar dataKey="count" name="Colaboradores" radius={[0, 4, 4, 0]}>
                            {buckets.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Users size={16} className="text-indigo-500" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Detalhamento por Colaborador</h3>
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
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-100/80 sticky top-0 text-gray-700 font-bold uppercase text-[9px] tracking-wider z-10 box-decoration-clone">
                        <tr>
                            <th className="px-6 py-4">Nome do Colaborador</th>
                            <th className="px-6 py-4">CC</th>
                            <th className="px-6 py-4 text-center">HE 60</th>
                            <th className="px-6 py-4 text-center">HE 100</th>
                            <th className="px-6 py-4 text-center">Inter.</th>
                            <th className="px-6 py-4 text-center">Not.</th>
                            <th className="px-6 py-4 text-center bg-gray-200/50">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {employeeSummary.map((emp, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                                <td className="px-6 py-3 font-bold text-gray-800 text-xs">{emp.name}</td>
                                <td className="px-6 py-3">
                                    <span className="font-mono text-[10px] text-gray-400">{emp.cc}</span>
                                </td>
                                <td className="px-6 py-3 text-center font-mono text-blue-600 font-bold">{formatDecimalToTime(emp.he60)}</td>
                                <td className="px-6 py-3 text-center font-mono text-red-600 font-bold">{formatDecimalToTime(emp.he100)}</td>
                                <td className="px-6 py-3 text-center font-mono text-amber-600 font-bold">{formatDecimalToTime(emp.inter)}</td>
                                <td className="px-6 py-3 text-center font-mono text-purple-600 font-bold">{formatDecimalToTime(emp.noturnas)}</td>
                                <td className="px-6 py-3 text-center font-mono font-black text-gray-900 bg-gray-50/50">{formatDecimalToTime(emp.total)}</td>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-red-500" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Mapa de Pressão por Centro de Custo</h3>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[9px] tracking-wider">
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
                    <tbody className="divide-y divide-gray-50">
                        {tableData.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-3 font-semibold text-gray-700">
                                    <div className="flex flex-col">
                                        <span className="text-gray-400 font-mono text-[10px]">{item.cc}</span>
                                        <span className="truncate max-w-[180px]">{getCCName(item.cc)}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-center font-bold text-gray-500">{item.headcount}</td>
                                <td className="px-6 py-3 text-center font-mono font-bold" style={{ backgroundColor: getHeatColor(item.he60 / item.headcount, 10, 'info') }}>
                                    {formatDecimalToTime(item.he60)}
                                </td>
                                <td className="px-6 py-3 text-center font-mono font-bold" style={{ backgroundColor: getHeatColor(item.he100 / item.headcount, 5, 'danger') }}>
                                    {formatDecimalToTime(item.he100)}
                                </td>
                                <td className="px-6 py-3 text-center font-mono font-bold" style={{ backgroundColor: getHeatColor(item.inter / item.headcount, 2, 'warning') }}>
                                    {formatDecimalToTime(item.inter)}
                                </td>
                                <td className="px-6 py-3 text-center font-mono font-bold" style={{ backgroundColor: getHeatColor(item.noturno / item.headcount, 10, 'info') }}>
                                    {formatDecimalToTime(item.noturno)}
                                </td>
                                <td className="px-6 py-3 text-center bg-gray-50/50">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-16 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${item.riskIndex > maxRisk * 0.7 ? 'bg-red-500' : item.riskIndex > maxRisk * 0.3 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${(item.riskIndex / maxRisk) * 100}%` }}
                                            />
                                        </div>
                                        <span className="font-mono font-black text-sm w-8">{item.riskIndex}</span>
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
// Componente principal
// ────────────────────────────────────────────────────────────
const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ data }) => {
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
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 group hover:border-red-200 transition-all">
                    <div className="p-3 rounded-xl bg-red-500 text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform">
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Anomalias de Jornada (&gt;10h)</p>
                        <h3 className="text-2xl font-bold text-gray-800 font-mono">{metrics.jornadasLongas}</h3>
                        <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold mt-0.5">
                            <Zap size={10} />
                            <span>ALTO RISCO TRABALHISTA</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 group hover:border-amber-200 transition-all">
                    <div className="p-3 rounded-xl bg-amber-500 text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform">
                        <Scale size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Violações de Interjornada</p>
                        <h3 className="text-2xl font-bold text-gray-800 font-mono">{metrics.interjornadas}</h3>
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold mt-0.5">
                            <Layers size={10} />
                            <span>NECESSITA AJUSTE DE ESCALA</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid de Dashboards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <TrendAnalysis data={data} />
                    <ConcentrationPareto data={data} />
                </div>
                <div className="space-y-6">
                    <DistributionHistogram data={data} />
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h4 className="text-xs font-bold uppercase tracking-widest opacity-80 mb-4">Insights da Operação</h4>
                            <p className="text-sm font-medium leading-relaxed">
                                {metrics.jornadasLongas > 10
                                    ? "⚠️ Notamos uma alta concentração de jornadas estendidas. Isso pode indicar subdimensionamento de equipes em centros críticos."
                                    : "✅ As jornadas estão dentro dos limites operacionais na maioria dos centros."}
                            </p>
                            <button className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all">
                                Ver detalhamento completo <ArrowUpRight size={12} />
                            </button>
                        </div>
                        <Activity size={120} className="absolute -bottom-10 -right-10 text-white/5" />
                    </div>
                </div>
            </div>

            {/* Mapa de Pressão */}
            <PressureMap data={data} />

            {/* Tabela de Colaboradores */}
            <EmployeeTable data={data} />
        </div>
    );
};

export default AnalysisPanel;

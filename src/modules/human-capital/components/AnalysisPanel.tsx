
import React, { useMemo, useState } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { OvertimeRecord } from '../types';
import { formatDecimalHours } from '../utils/formatters';
import { TrendingUp, AlertTriangle, CalendarDays, DollarSign, Clock } from 'lucide-react';
import { getAllPlanningRecords, getBudgets, getSalaries } from '../services/planning';

interface AnalysisPanelProps {
    data: OvertimeRecord[];
    selectedYear: string;
}

type ViewMode = 'hours' | 'finance';

const CustomTooltip = ({ active, payload, label, viewMode }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-4 border border-gray-100 shadow-xl rounded-xl min-w-[200px]">
                <p className="font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2 text-sm uppercase tracking-wide">{label}</p>

                {viewMode === 'finance' ? (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500 font-bold">Budget (Meta)</span>
                            <span className="font-mono font-bold text-indigo-600">
                                R$ {data.Budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500 font-bold">Planejado</span>
                            <span className="font-mono font-bold text-blue-600">
                                R$ {data.Planejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-50">
                            <span className="text-gray-500 font-bold">REALIZADO</span>
                            <span className="font-mono font-bold text-emerald-600 text-sm">
                                R$ {data.Real.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* REALIZADO SECTION */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">REALIZADO TOTAL</span>
                                <span className="font-mono font-bold text-blue-600 text-sm">{formatDecimalHours(data.Real)}</span>
                            </div>
                            <div className="space-y-1 pl-2 border-l-2 border-gray-100">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">H.E. 60%</span>
                                    <span className="font-mono text-gray-700">{formatDecimalHours(data.he60)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">H.E. 100%</span>
                                    <span className="font-mono text-gray-700">{formatDecimalHours(data.he100)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">Adic. Noturno</span>
                                    <span className="font-mono text-gray-700">{formatDecimalHours(data.night)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">Interjornada</span>
                                    <span className="font-mono text-gray-700">{formatDecimalHours(data.interjourney)}</span>
                                </div>
                            </div>
                        </div>

                        {/* PLANEJADO SECTION */}
                        <div className="pt-2 border-t border-gray-50">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PLANEJADO</span>
                                <span className="font-mono font-bold text-gray-400 text-sm">{formatDecimalHours(data.Planejado)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }
    return null;
};

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ data, selectedYear }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('finance');
    const budgets = useMemo(() => getBudgets(), []);
    const planningRecords = useMemo(() => getAllPlanningRecords(), []);
    const salariesMap = useMemo(() => {
        const map: Record<string, number> = {};
        getSalaries().forEach(s => map[s.chapa] = s.salary);
        return map;
    }, []);

    const chartData = useMemo(() => {
        const months = Array.from({ length: 12 }, (_, i) => {
            const d = new Date(parseInt(selectedYear), i, 1);
            return d.toLocaleString('pt-BR', { month: 'long' });
        });

        return months.map((month, index) => {
            // Filter Real Data
            const monthData = data.filter(r => {
                const d = new Date(r.DATA);
                return d.getMonth() === index && d.getFullYear() === parseInt(selectedYear);
            });

            // Calculate Real Values
            let realHours = 0;
            let realCost = 0;
            let he60 = 0;
            let he100 = 0;
            let night = 0;
            let interjourney = 0;

            monthData.forEach(r => {
                const hours = Number(r.HORAS) || 0;
                realHours += hours;
                const evt = (r.EVENTO || '').toUpperCase();

                if (evt.includes('60')) he60 += hours;
                if (evt.includes('100')) he100 += hours;
                if (evt.includes('NOTURNO') || evt.includes('20')) night += hours;
                if (evt.includes('INTER')) interjourney += hours;

                const sal = salariesMap[r.CHAPA];
                if (sal) {
                    const isSunday = new Date(r.DATA).getDay() === 0;
                    const baseHour = sal / 220;
                    const multiplier = r.EVENTO.includes('60') ? 1.6 : r.EVENTO.includes('100') ? 2.0 : 1.0;
                    // Simplifying logic for chart visualization
                    realCost += baseHour * (isSunday ? 2.0 : multiplier) * hours;
                }
            });

            // Calculate Planned Values
            let plannedHours = 0;
            let plannedCost = 0;

            planningRecords.filter(p => {
                const d = new Date(p.date);
                return d.getMonth() === index && d.getFullYear() === parseInt(selectedYear);
            }).forEach(p => {
                plannedHours += p.plannedHours;
                const sal = salariesMap[p.chapa];
                if (sal) {
                    const isSunday = new Date(p.date).getDay() === 0;
                    plannedCost += (sal / 220) * (isSunday ? 2.0 : 1.6) * p.plannedHours;
                }
            });

            // Calculate Budget
            const monthlyBudget = budgets
                .filter(b => b.month.toLowerCase() === month.toLowerCase())
                .reduce((acc, curr) => acc + curr.value, 0);

            const displayMonth = month.charAt(0).toUpperCase() + month.slice(1).substring(0, 2);

            return {
                name: displayMonth,
                fullMonth: month,
                Real: viewMode === 'finance' ? realCost : realHours,
                Planejado: viewMode === 'finance' ? plannedCost : plannedHours,
                Budget: viewMode === 'finance' ? monthlyBudget : 0, // Budget only makes sense for finance
                amt: viewMode === 'finance' ? realCost : realHours,
                he60, he100, night, interjourney // Passed for tooltip
            };
        });
    }, [data, selectedYear, viewMode, budgets, planningRecords, salariesMap]);

    // Compliance Metrics
    const complianceData = useMemo(() => {
        const excessiveHours = data.filter(r => r.HORAS > 10).length; // Example rule: >10h/day
        const sundayWork = data.filter(r => new Date(r.DATA).getDay() === 0).length;
        const interJornadaErrors = data.filter(r => r.EVENTO.includes('INTER')).length;

        return [
            { label: 'Jornadas Críticas (>10h)', value: excessiveHours, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Trabalho aos Domingos', value: sundayWork, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Violações Interjornada', value: interJornadaErrors, color: 'text-purple-600', bg: 'bg-purple-50' },
        ];
    }, [data]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <TrendingUp size={18} className="text-blue-600" />
                            {viewMode === 'finance' ? 'Evolução Financeira' : 'Evolução de Horas'}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                            {viewMode === 'finance'
                                ? 'Comparativo entre Budget (Meta), Planejado (Operacional) e Real (Executado)'
                                : 'Comparativo entre Horas Planejadas (Operacional) e Horas Reais (Executadas)'}
                        </p>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('hours')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${viewMode === 'hours' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                        >
                            <Clock size={12} /> Horas
                        </button>
                        <button
                            onClick={() => setViewMode('finance')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${viewMode === 'finance' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}
                        >
                            <DollarSign size={12} /> R$
                        </button>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                tickFormatter={(value) => viewMode === 'finance' ? `R$${(value / 1000).toFixed(0)}k` : value}
                            />
                            <Tooltip content={<CustomTooltip viewMode={viewMode} />} cursor={{ fill: '#f8fafc' }} />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />

                            <Bar dataKey="Planejado" name="Planejado" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="Real" name="Realizado" fill={viewMode === 'finance' ? '#10b981' : '#3b82f6'} radius={[4, 4, 0, 0]} barSize={20} />
                            {viewMode === 'finance' && (
                                <Line type="monotone" dataKey="Budget" name="Budget" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-6">
                    <AlertTriangle size={18} className="text-orange-500" />
                    Compliance Trabalhista
                </h3>

                <div className="space-y-4 flex-1">
                    {complianceData.map((item, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border border-transparent transition-all hover:border-gray-200 ${item.bg}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-xs font-bold uppercase tracking-wide ${item.color.replace('text-', 'text-opacity-70 ')}`}>
                                    {item.label}
                                </span>
                                <CalendarDays size={14} className={item.color} />
                            </div>
                            <div className={`text-2xl font-bold font-mono ${item.color}`}>
                                {item.value}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">Ocorrências no período selecionado</p>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="text-xs text-gray-400 text-center">
                        <span className="font-bold text-gray-800">Nota:</span> O excesso de horas extras (&gt;2h/dia) e supressão de interjornada geram passivo trabalhista.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalysisPanel;

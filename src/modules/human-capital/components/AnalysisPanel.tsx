import React, { useMemo, useState, useEffect } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { OvertimeRecord, BudgetRecord, SalaryAllocation } from '../types';
import { RealOvertimeRecord } from '../data/realOvertime';
import { formatDecimalHours } from '../utils/formatters';
import { TrendingUp, AlertTriangle, CalendarDays, DollarSign, Clock, X, CheckCircle2 } from 'lucide-react';
import { getAllPlanningRecords, getBudgets, getSalaries } from '../services/planning';

interface AnalysisPanelProps {
    data: OvertimeRecord[];
    selectedYear: string;
    realOvertime: RealOvertimeRecord[];
}

type ViewMode = 'hours' | 'finance';

const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- COMPONENTE AUXILIAR (Mantido igual) ---
const MonthDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    monthKey: string;
    data: OvertimeRecord[];
    planningText: string;
}> = ({ isOpen, onClose, monthKey, data, planningText }) => {
    if (!isOpen) return null;

    const [year, month] = monthKey.split('-').map(Number);
    const monthName = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    const daysInMonth = useMemo(() => {
        const days = [];
        const date = new Date(year, month - 1, 1);
        while (date.getMonth() === month - 1) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    }, [year, month]);

    const dailyData = useMemo(() => {
        const map = new Map<string, { real: number, events: string[] }>();
        // Otimização: Filtrar apenas uma vez para o modal
        data.forEach(r => {
            const d = new Date(r.DATA);
            if (d.getFullYear() === year && (d.getMonth() + 1) === month) {
                const key = formatDateKey(d);
                const existing = map.get(key) || { real: 0, events: [] };
                existing.real += Number(r.HORAS) || 0;
                if (r.EVENTO && !existing.events.includes(r.EVENTO)) existing.events.push(r.EVENTO);
                map.set(key, existing);
            }
        });
        return map;
    }, [data, year, month]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="text-xl font-bold capitalize">{monthName}</h3>
                        <p className="text-blue-100 text-sm">Detalhes Diários • {planningText}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                    <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                            <div key={d} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: daysInMonth[0].getDay() }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-24 bg-transparent" />
                        ))}

                        {daysInMonth.map(day => {
                            const dateKey = formatDateKey(day);
                            const info = dailyData.get(dateKey) || { real: 0, events: [] };
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            const isSunday = day.getDay() === 0;

                            return (
                                <div
                                    key={dateKey}
                                    title={`Eventos: ${info.events.join(', ') || 'Nenhum'}`}
                                    className={`h-24 border rounded-xl p-3 flex flex-col justify-between transition-all hover:scale-[1.02] ${info.real > 0 ? 'bg-white border-blue-200 shadow-md ring-1 ring-blue-50' : 'bg-white/50 border-gray-100'
                                        } ${isWeekend ? 'bg-orange-50/30' : ''}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-xs font-bold ${isWeekend ? 'text-orange-500' : 'text-gray-400'}`}>
                                            {day.getDate()}
                                        </span>
                                        {info.real > 0 && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${isSunday ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {isSunday ? '100%' : '60%'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        {info.real > 0 ? (
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-400 font-medium">Real</span>
                                                <span className="text-base font-bold font-mono text-gray-800">{formatDecimalHours(info.real)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-200">-</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="p-4 bg-gray-100 border-t border-gray-200 text-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        Clique nos dias para mais detalhes (em breve)
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- TOOLTIP (Mantido igual) ---
const CustomTooltip = ({ active, payload, label, viewMode }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-4 border border-gray-100 shadow-xl rounded-xl min-w-[200px]">
                <p className="font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2 text-sm uppercase tracking-wide">
                    {label} {payload[0]?.payload?.isPartial ? <span className="text-xs text-amber-500 font-normal ml-2">(Período em andamento)</span> : ''}
                </p>

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
                            <span className="text-gray-500 font-bold">REALIZADO (HE)</span>
                            <span className="font-mono font-bold text-emerald-600 text-sm">
                                R$ {data.Real.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
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
                            </div>
                        </div>
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

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ data, selectedYear, realOvertime }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('finance');
    const [monthModalOpen, setMonthModalOpen] = useState(false);
    const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

    // Estados para dados assíncronos
    const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
    const [salariesMap, setSalariesMap] = useState<Record<string, number>>({});

    // Efeito de Carga Inicial
    useEffect(() => {
        const fetchFinancialData = async () => {
            try {
                // Carrega todos os meses do ano selecionado em paralelo
                const promises = Array.from({ length: 12 }, (_, i) => {
                    const mk = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
                    return Promise.all([
                        getBudgets(mk).catch(() => []),
                        getSalaries(mk).catch(() => [])
                    ]);
                });

                const results = await Promise.all(promises);
                const allBudgets: BudgetRecord[] = [];
                const allSalaries: Record<string, number> = {};

                results.forEach(([bArr, sArr]) => {
                    if (bArr) allBudgets.push(...bArr);
                    if (sArr) {
                        sArr.forEach(s => { if (s.chapa && s.salary) allSalaries[s.chapa] = s.salary; });
                    }
                });

                setBudgets(allBudgets);
                setSalariesMap(allSalaries);
            } catch (error) {
                console.error("Erro ao carregar dados financeiros:", error);
            }
        };
        fetchFinancialData();
    }, [selectedYear]);

    const planningRecords = useMemo(() => getAllPlanningRecords(), []);

    // --- ALGORITMO OTIMIZADO DE GERAÇÃO DO GRÁFICO ---
    const chartData = useMemo(() => {
        // 1. Inicializa Mapa de Agregação (O(12))
        const aggregationMap = new Map<string, any>();
        for (let i = 0; i < 12; i++) {
            const monthKey = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
            aggregationMap.set(monthKey, {
                realHours: 0, he60: 0, he100: 0, night: 0, interjourney: 0,
                plannedHours: 0, plannedCost: 0, budget: 0,
                monthIndex: i
            });
        }

        // 2. Passagem Única nos Dados Reais (O(N))
        data.forEach(r => {
            const d = new Date(r.DATA);
            if (d.getFullYear() !== parseInt(selectedYear)) return;

            const monthKey = `${selectedYear}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const agg = aggregationMap.get(monthKey);

            if (agg) {
                const hours = Number(r.HORAS) || 0;
                agg.realHours += hours;

                const evt = (r.EVENTO || '').toUpperCase();
                if (evt.includes('60')) agg.he60 += hours;
                if (evt.includes('100')) agg.he100 += hours;
                if (evt.includes('NOTURNO') || evt.includes('20')) agg.night += hours;
                if (evt.includes('INTER')) agg.interjourney += hours;
            }
        });

        // 3. Passagem Única no Planejamento (O(M))
        planningRecords.forEach(p => {
            const d = new Date(p.date);
            if (d.getFullYear() !== parseInt(selectedYear)) return;

            const monthKey = `${selectedYear}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const agg = aggregationMap.get(monthKey);

            if (agg) {
                agg.plannedHours += p.plannedHours;
                const sal = salariesMap[p.chapa];
                if (sal) {
                    const isSunday = d.getDay() === 0;
                    agg.plannedCost += (sal / 220) * (isSunday ? 2.0 : 1.6) * p.plannedHours;
                }
            }
        });

        // 4. Passagem Única no Budget (O(B))
        budgets.forEach(b => {
            const agg = aggregationMap.get(b.monthKey);
            if (agg) {
                agg.budget += b.value;
            }
        });

        // 5. Montagem Final (O(12))
        return Array.from(aggregationMap.entries()).map(([monthKey, agg]) => {
            const [y, m] = monthKey.split('-');
            const monthName = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('pt-BR', { month: 'long' });
            const displayMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1).substring(0, 2);

            // Override financeiro manual se disponível
            let realFinancialValue = 0;
            if (viewMode === 'finance') {
                // Pequena busca linear aqui é aceitável pois realOvertime é minúsculo (12 registros por ano)
                const manualData = realOvertime.find(r => r.year === parseInt(selectedYear) && r.month === parseInt(m));
                realFinancialValue = manualData ? manualData.value : 0;
            }

            return {
                name: displayMonth,
                fullMonth: monthName,
                monthIndex: agg.monthIndex,
                year: selectedYear,
                Real: viewMode === 'finance' ? realFinancialValue : agg.realHours,
                Planejado: viewMode === 'finance' ? agg.plannedCost : agg.plannedHours,
                Budget: viewMode === 'finance' ? agg.budget : 0,
                // Metadados para tooltip
                he60: agg.he60,
                he100: agg.he100,
                night: agg.night,
                interjourney: agg.interjourney,
                isPartial: parseInt(selectedYear) === 2026 && agg.monthIndex === 0
            };
        });

    }, [data, selectedYear, viewMode, budgets, planningRecords, salariesMap, realOvertime]);

    const complianceData = useMemo(() => {
        const excessiveHours = data.filter(r => r.HORAS > 10).length;
        const sundayWork = data.filter(r => new Date(r.DATA).getDay() === 0).length;
        const interJornadaErrors = data.filter(r => r.EVENTO.includes('INTER')).length;

        return [
            { label: 'Jornadas Críticas (>10h)', value: excessiveHours, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Trabalho aos Domingos', value: sundayWork, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Violações Interjornada', value: interJornadaErrors, color: 'text-purple-600', bg: 'bg-purple-50' },
        ];
    }, [data]);

    const handleChartClick = (state: any) => {
        if (state && state.activePayload && state.activePayload.length > 0) {
            const payload = state.activePayload[0].payload;
            const year = payload.year;
            const month = (payload.monthIndex + 1).toString().padStart(2, '0');
            setSelectedMonthKey(`${year}-${month}`);
            setMonthModalOpen(true);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {selectedMonthKey && (
                <MonthDetailsModal
                    isOpen={monthModalOpen}
                    onClose={() => setMonthModalOpen(false)}
                    monthKey={selectedMonthKey}
                    data={data}
                    planningText={viewMode === 'finance' ? 'Visualização Financeira' : 'Visualização de Horas'}
                />
            )}

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
                        <ComposedChart
                            data={chartData}
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                            onClick={handleChartClick}
                            className="cursor-pointer"
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => viewMode === 'finance' ? `R$${(value / 1000).toFixed(0)}k` : value} />
                            <Tooltip content={<CustomTooltip viewMode={viewMode} />} cursor={{ fill: '#f8fafc' }} />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                            <Bar dataKey="Planejado" name="Planejado" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="Real" name="Realizado (HE)" fill={viewMode === 'finance' ? '#10b981' : '#3b82f6'} radius={[4, 4, 0, 0]} barSize={20} />
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
                                <span className={`text-xs font-bold uppercase tracking-wide ${item.color.replace('text-', 'text-opacity-70 ')}`}>{item.label}</span>
                                <CalendarDays size={14} className={item.color} />
                            </div>
                            <div className={`text-2xl font-bold font-mono ${item.color}`}>{item.value}</div>
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

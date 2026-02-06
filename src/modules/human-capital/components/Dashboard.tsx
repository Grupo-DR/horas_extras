import React, { useMemo, useState, useEffect } from 'react';
import { OvertimeRecord, UserProfile, PlanningRecord, BudgetRecord, SalaryRecord } from '../types';
import { RealOvertimeRecord } from '../data/realOvertime';
import { Clock, Briefcase, TrendingUp, Wallet, Calculator, Search, Building2, AlertTriangle, Moon, Sun, Scale, Percent, ArrowUpRight, ArrowDownRight, X, User, DollarSign, ListFilter } from 'lucide-react';
import { formatDecimalHours } from '../utils/formatters';
import { getAllPlanningRecords, getBudgets, getSalaries } from '../services/planning';

interface DashboardProps {
    data: OvertimeRecord[];
    realOvertime: RealOvertimeRecord[];
    filterContext: {
        startDate: string;
        endDate: string;
        mode: string;
        year: string;
        month: string;
    };
}

type ViewMode = 'hours' | 'finance';

const HierarchySection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
            <div className="h-4 w-1 bg-blue-600 rounded-full"></div>
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{title}</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {children}
        </div>
    </div>
);

const StatsCard: React.FC<{
    title: string;
    value: string;
    subValue?: React.ReactNode;
    icon: React.ReactNode;
    color: string;
    comparison?: {
        label: string;
        value: string;
        percent?: number;
        isOver?: boolean;
    }
}> = ({ title, value, subValue, icon, color, comparison }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between transition-all hover:shadow-md h-full">
        <div className="flex items-center space-x-4 mb-4">
            <div className={`p-3 rounded-xl ${color} text-white shadow-lg shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{title}</p>
                <h3 className="text-xl font-bold text-gray-800 font-mono truncate">{value}</h3>
            </div>
            {comparison && comparison.percent !== undefined && (
                <div className={`shrink-0 flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg ${comparison.isOver ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {comparison.isOver ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {comparison.percent.toFixed(1)}%
                </div>
            )}
        </div>

        <div className="pt-3 border-t border-gray-50">
            {subValue ? (
                <div className="text-xs font-medium text-gray-500 w-full space-y-1">{subValue}</div>
            ) : comparison ? (
                <div className="flex flex-col">
                    <p className="text-[9px] text-gray-400 font-bold uppercase">{comparison.label}</p>
                    <p className="text-sm font-bold text-gray-700 font-mono">{comparison.value}</p>
                </div>
            ) : <div className="h-5" />}
        </div>
    </div>
);

const FunctionDetailModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    functionName: string;
    employees: { name: string; chapa: string; hours: number }[];
}> = ({ isOpen, onClose, functionName, employees }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="bg-blue-600 p-6 flex justify-between items-center text-white shrink-0 relative z-30">
                    <div>
                        <h3 className="text-xl font-bold">{functionName}</h3>
                        <p className="text-blue-100 text-sm opacity-90">Colaboradores vinculados a esta função</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto bg-white flex-1">
                    <table className="w-full text-left text-sm text-gray-600 border-collapse">
                        <thead className="sticky top-0 z-20 shadow-sm">
                            <tr className="bg-gray-100">
                                <th className="px-6 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Colaborador</th>
                                <th className="px-6 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Chapa</th>
                                <th className="px-6 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200 text-right">Horas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employees.map((emp, idx) => (
                                <tr key={emp.chapa + idx} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-gray-900">{emp.name}</td>
                                    <td className="px-6 py-3 font-mono text-gray-400 text-xs">{emp.chapa}</td>
                                    <td className="px-6 py-3 text-right font-bold font-mono text-blue-600">{formatDecimalHours(emp.hours)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{employees.length} COLABORADORES NA LISTA</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Total de Horas:</span>
                        <span className="text-lg font-bold text-gray-900 font-mono">
                            {formatDecimalHours(employees.reduce((acc, curr) => acc + curr.hours, 0))}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CostCenterDetailModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    ccName: string;
    ccCode: string;
    data: { name: string; real: number; planned: number; realCost: number; plannedCost: number }[];
    viewMode: ViewMode;
}> = ({ isOpen, onClose, ccName, ccCode, data, viewMode }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="bg-indigo-600 p-6 flex justify-between items-center text-white shrink-0 relative z-30">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold">{ccName}</h3>
                            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-mono">{ccCode}</span>
                        </div>
                        <p className="text-indigo-100 text-sm opacity-90">Breakdown por Funções</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto bg-white flex-1">
                    <table className="w-full text-left text-sm text-gray-600 border-collapse">
                        <thead className="sticky top-0 z-20 shadow-sm">
                            <tr className="bg-gray-100">
                                <th className="px-6 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Função</th>
                                {viewMode === 'hours' ? (
                                    <>
                                        <th className="px-6 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Plan.</th>
                                        <th className="px-6 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Real</th>
                                        <th className="px-6 py-4 text-center text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Plan. x Real</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Custo Plan.</th>
                                        <th className="px-6 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Custo Real</th>
                                        <th className="px-6 py-4 text-center text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Plan. x Real (R$)</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.map((item, idx) => {
                                const diffHours = item.planned - item.real;
                                const diffCost = item.plannedCost - item.realCost;
                                return (
                                    <tr key={item.name + idx} className="hover:bg-indigo-50/50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-gray-900">{item.name}</td>
                                        {viewMode === 'hours' ? (
                                            <>
                                                <td className="px-6 py-3 text-right font-mono text-gray-400">{formatDecimalHours(item.planned)}</td>
                                                <td className="px-6 py-3 text-right font-mono font-bold text-gray-800">{formatDecimalHours(item.real)}</td>
                                                <td className="px-6 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${diffHours < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {diffHours > 0 ? `+${formatDecimalHours(diffHours)}` : formatDecimalHours(diffHours)}
                                                    </span>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-3 text-right font-mono text-blue-600">R$ {item.plannedCost.toLocaleString('pt-BR')}</td>
                                                <td className="px-6 py-3 text-right font-mono font-bold text-gray-800">R$ {item.realCost.toLocaleString('pt-BR')}</td>
                                                <td className="px-6 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${diffCost < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        R$ {diffCost.toLocaleString('pt-BR')}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <Briefcase size={14} className="text-gray-400" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{data.length} FUNÇÕES NESTE CENTRO DE CUSTO</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ data, realOvertime, filterContext }) => {
    const [dashboardViewMode, setDashboardViewMode] = useState<ViewMode>('finance');

    const [ccSearch, setCcSearch] = useState('');
    const [funcSearch, setFuncSearch] = useState('');
    const [selectedFuncModal, setSelectedFuncModal] = useState<string | null>(null);
    const [selectedCcModal, setSelectedCcModal] = useState<string | null>(null);
    const [ccViewMode, setCcViewMode] = useState<ViewMode>('hours');
    const [funcViewMode, setFuncViewMode] = useState<ViewMode>('hours');

    const planningRecords = useMemo(() => getAllPlanningRecords(), []);

    // State for Async Data
    const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
    const [salariesMap, setSalariesMap] = useState<Record<string, number>>({});

    // Busca de Budgets/Salários
    useEffect(() => {
        const fetchData = async () => {
            let queryKey = `${filterContext.year}-${filterContext.month}`;

            // Lógica de Budget:
            // Se for Folha (Competência), o budget é do Mês Selecionado (ex: Jan).
            // Se for Calendário, o budget é do Mês Selecionado (ex: Jan).
            // Se for Customizado, tentamos inferir o mês principal pela data de início.
            if (filterContext.mode === 'CUSTOM') {
                const d = new Date(filterContext.startDate);
                queryKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }

            // Se for Anual, precisaria carregar tudo, mas por simplicidade carregamos o último mês ou tratamos diferente.
            // Para Anual, o ideal seria uma nova rota de API, mas vamos manter simples por enquanto.

            try {
                const fetchedBudgets = await getBudgets(queryKey);
                setBudgets(fetchedBudgets);

                const fetchedSalaries = await getSalaries(queryKey);
                const map: Record<string, number> = {};
                fetchedSalaries.forEach(s => map[s.chapa] = s.salary);
                setSalariesMap(map);

            } catch (err) {
                console.error("Dashboard data load failed", err);
            }
        };

        fetchData();
    }, [filterContext]);

    // O "periodData" é apenas uma segurança extra, pois "data" já vem filtrado da API
    // Mas garante que os cálculos batam com o texto do cabeçalho
    const periodData = useMemo(() => {
        const start = new Date(filterContext.startDate + 'T00:00:00');
        const end = new Date(filterContext.endDate + 'T23:59:59');

        return data.filter(r => {
            const d = new Date(r.DATA);
            // Ajuste de Fuso para evitar erros de "dia anterior"
            // Assumindo que r.DATA vem YYYY-MM-DD
            return d >= start && d <= end;
        });
    }, [data, filterContext]);

    // Métricas
    const metrics = useMemo(() => {
        let totalRealHours = 0;
        let totalRealCost = 0;

        periodData.forEach(r => {
            const h = Number(r.HORAS) || 0;
            totalRealHours += h;

            const salario = salariesMap[r.CHAPA] || 0;
            if (salario > 0) {
                const valorHora = salario / 220;
                let multiplier = 1.5;
                if (r.EVENTO?.includes('100') || r.EVENTO?.includes('DOMINGO')) multiplier = 2.0;
                totalRealCost += (valorHora * multiplier * h);
            }
        });

        // Override financeiro manual para modos "Fechados" (Mês inteiro)
        // Se for Customizado, não usamos o valor manual pois ele é sempre mensal cheio
        if (filterContext.mode !== 'CUSTOM' && filterContext.mode !== 'ANNUAL') {
            const manualFinance = realOvertime.find(r =>
                r.year === parseInt(filterContext.year) &&
                r.month === parseInt(filterContext.month)
            );
            if (manualFinance) {
                totalRealCost = manualFinance.value;
            }
        }

        // Planejado
        let totalPlannedHours = 0;
        let totalPlannedCost = 0;

        planningRecords.forEach(p => {
            const pd = new Date(p.date);
            const start = new Date(filterContext.startDate);
            const end = new Date(filterContext.endDate);

            if (pd >= start && pd <= end) {
                totalPlannedHours += p.plannedHours;
                const sal = salariesMap[p.chapa] || 0;
                if (sal > 0) {
                    const isSunday = pd.getDay() === 0;
                    totalPlannedCost += (sal / 220) * (isSunday ? 2.0 : 1.6) * p.plannedHours;
                }
            }
        });

        const totalBudget = budgets.reduce((acc, b) => acc + b.value, 0);

        return {
            realHours: totalRealHours,
            realCost: totalRealCost,
            plannedHours: totalPlannedHours,
            plannedCost: totalPlannedCost,
            budget: totalBudget,
            savings: totalBudget - totalRealCost,
            headcount: new Set(periodData.map(r => r.CHAPA)).size
        };
    }, [periodData, planningRecords, budgets, salariesMap, filterContext, realOvertime]);

    // Mock para Gráfico (Dados Agrupados por Função)
    const groupedByFunction = useMemo(() => {
        const map: Record<string, { real: number; planned: number; realCost: number; plannedCost: number }> = {};

        periodData.forEach(r => {
            const fun = r.FUNCAO || 'Outros';
            if (!map[fun]) map[fun] = { real: 0, planned: 0, realCost: 0, plannedCost: 0 };

            const h = Number(r.HORAS) || 0;
            map[fun].real += h;

            const salario = salariesMap[r.CHAPA] || 0;
            if (salario > 0) {
                const valorHora = salario / 220;
                let multiplier = 1.6; // Média simples para gráfico
                map[fun].realCost += (valorHora * multiplier * h);
            }
        });

        // Create a quick lookup map for Chapa -> Function from the main data
        const chapaToRole: Record<string, string> = {};
        data.forEach(r => {
            if (r.CHAPA && r.FUNCAO) {
                chapaToRole[r.CHAPA] = r.FUNCAO;
            }
        });

        // Add Planned to Function Map
        planningRecords.forEach(p => {
            const pd = new Date(p.date);
            const start = new Date(filterContext.startDate);
            const end = new Date(filterContext.endDate);

            if (pd >= start && pd <= end) {
                // FALLBACK: Try to find role for this employee, otherwise 'Outros'
                const role = chapaToRole[p.chapa] || 'Outros';

                if (!map[role]) map[role] = { real: 0, planned: 0, realCost: 0, plannedCost: 0 };
                map[role].planned += p.plannedHours;

                const sal = salariesMap[p.chapa] || 0;
                if (sal > 0) {
                    map[role].plannedCost += (sal / 220) * 1.6 * p.plannedHours;
                }
            }
        });

        return Object.entries(map)
            .map(([name, val]) => ({ name, ...val }))
            .sort((a, b) => b.real - a.real)
            .slice(0, 8); // Top 8 funções
    }, [periodData, planningRecords, salariesMap, filterContext, data]);

    // Mock para Gráfico (Dados Agrupados por CC)
    const groupedByCC = useMemo(() => {
        const map: Record<string, { real: number; planned: number; realCost: number; plannedCost: number; items: typeof groupedByFunction }> = {};

        periodData.forEach(r => {
            const cc = r.CODCCUSTO || 'Sem CC';
            if (!map[cc]) map[cc] = { real: 0, planned: 0, realCost: 0, plannedCost: 0, items: [] };

            const h = Number(r.HORAS) || 0;
            map[cc].real += h;

            const salario = salariesMap[r.CHAPA] || 0;
            if (salario > 0) {
                const valorHora = salario / 220;
                let multiplier = 1.6;
                map[cc].realCost += (valorHora * multiplier * h);
            }
        });

        // Add Planned to CC Map (Aproximado, pois Planning não tem CC direto, teria que cruzar com usuário... Simplificando: Assumindo que o user context filtra planning)
        // Nota: Para precisão total, planningRecords precisa ter CC.

        return Object.entries(map)
            .map(([name, val]) => ({ name, ...val }))
            .sort((a, b) => b.real - a.real);
    }, [periodData, salariesMap]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header de Contexto */}
            <div className="flex justify-between items-center bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                <div className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="font-bold text-blue-700 uppercase text-xs tracking-wider">Período Ativo:</span>
                    <span className="font-mono font-medium text-gray-800">
                        {new Date(filterContext.startDate).toLocaleDateString('pt-BR')}
                        <span className="mx-2 text-gray-400">➜</span>
                        {new Date(filterContext.endDate).toLocaleDateString('pt-BR')}
                    </span>
                </div>
                {filterContext.mode === 'PAYROLL' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-blue-600 px-2 py-1 rounded border border-blue-100 shadow-sm">
                        Competência (Folha)
                    </span>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                {dashboardViewMode === 'finance' ? 'Realizado (R$)' : 'Horas Reais'}
                            </p>
                            <h3 className={`text-2xl font-bold font-mono mt-1 ${(metrics.realCost > metrics.budget && dashboardViewMode === 'finance') ? 'text-red-600' : 'text-gray-800'
                                }`}>
                                {dashboardViewMode === 'finance'
                                    ? `R$ ${metrics.realCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                    : formatDecimalHours(metrics.realHours)
                                }
                            </h3>
                        </div>
                        <div className={`p-3 rounded-xl ${(metrics.realCost > metrics.budget && dashboardViewMode === 'finance') ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                            <Wallet size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Budget (Meta)</p>
                            <h3 className="text-2xl font-bold font-mono text-gray-800 mt-1">
                                R$ {metrics.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h3>
                        </div>
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Scale size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                {dashboardViewMode === 'finance' ? 'Planejado (R$)' : 'Horas Planejadas'}
                            </p>
                            <h3 className="text-2xl font-bold font-mono text-gray-800 mt-1">
                                {dashboardViewMode === 'finance'
                                    ? `R$ ${metrics.plannedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                    : formatDecimalHours(metrics.plannedHours)
                                }
                            </h3>
                        </div>
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                            <Calculator size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Savings</p>
                            <h3 className={`text-2xl font-bold font-mono mt-1 ${metrics.savings < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                R$ {metrics.savings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h3>
                        </div>
                        <div className={`p-3 rounded-xl ${metrics.savings < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            <TrendingUp size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Toggle View Mode */}
            <div className="flex justify-end">
                <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
                    <button
                        onClick={() => setDashboardViewMode('finance')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${dashboardViewMode === 'finance' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <DollarSign size={14} /> Financeiro
                    </button>
                    <button
                        onClick={() => setDashboardViewMode('hours')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${dashboardViewMode === 'hours' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Clock size={14} /> Horas
                    </button>
                </div>
            </div>

            <HierarchySection title="Visão por Centro de Custo">
                {groupedByCC.map((cc, idx) => (
                    <StatsCard
                        key={idx}
                        title={cc.name}
                        value={dashboardViewMode === 'finance' ? `R$ ${cc.realCost.toLocaleString('pt-BR')}` : formatDecimalHours(cc.real)}
                        color="bg-blue-500"
                        icon={<Building2 size={24} />}
                        subValue={
                            <button
                                onClick={() => {
                                    setSelectedCcModal(cc.name);
                                    // Necessário passar dados detalhados para o modal se quisermos drilldown
                                }}
                                className="text-blue-600 hover:underline flex items-center gap-1 mt-2"
                            >
                                <Search size={12} /> Ver detalhes
                            </button>
                        }
                    />
                ))}
            </HierarchySection>

            <HierarchySection title="Top Funções com Horas Extras">
                {groupedByFunction.map((fun, idx) => (
                    <StatsCard
                        key={idx}
                        title={fun.name}
                        value={dashboardViewMode === 'finance' ? `R$ ${fun.realCost.toLocaleString('pt-BR')}` : formatDecimalHours(fun.real)}
                        color="bg-indigo-500"
                        icon={<Briefcase size={24} />}
                        subValue={
                            <button
                                onClick={() => setSelectedFuncModal(fun.name)}
                                className="text-indigo-600 hover:underline flex items-center gap-1 mt-2"
                            >
                                <ListFilter size={12} /> Detalhar colaboradores
                            </button>
                        }
                    />
                ))}
            </HierarchySection>

            {/* Modais */}
            {selectedFuncModal && (
                <FunctionDetailModal
                    isOpen={!!selectedFuncModal}
                    onClose={() => setSelectedFuncModal(null)}
                    functionName={selectedFuncModal}
                    employees={periodData
                        .filter(r => r.FUNCAO === selectedFuncModal)
                        .reduce((acc: any[], curr) => {
                            const existing = acc.find(e => e.chapa === curr.CHAPA);
                            if (existing) {
                                existing.hours += Number(curr.HORAS || 0);
                            } else {
                                acc.push({
                                    name: curr.NOME,
                                    chapa: curr.CHAPA,
                                    hours: Number(curr.HORAS || 0)
                                });
                            }
                            return acc;
                        }, [])
                        .sort((a: any, b: any) => b.hours - a.hours)
                    }
                />
            )}
        </div>
    );
};

export default Dashboard;

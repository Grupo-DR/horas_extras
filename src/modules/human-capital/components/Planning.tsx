import React, { useState, useEffect, useMemo } from 'react';
import { OvertimeRecord, UserProfile, PlanningRecord, SalaryAllocation, BudgetRecord } from '../types';
import { getSalaries, getPlanning, savePlanning, getBudgets } from '../services/planning';
import { Calendar, User, DollarSign, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Calculator, FileText, Search, X, Loader2 } from 'lucide-react';
import { formatDecimalHours } from '../utils/formatters';

interface PlanningProps {
    user: UserProfile;
    employees: OvertimeRecord[]; // These are base employee records (often from overtime data or a master list)
}

// --- MODAL COMPONENT (Restored) ---
const EmployeeCalendarModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    employee: OvertimeRecord;
    planningType: 'DAILY' | 'MONTHLY';
    monthKey: string;
    existingPlans: PlanningRecord[];
    onSave: (plans: PlanningRecord[]) => Promise<void>;
    hasSalary: boolean; // NO NUMERIC SALARY
    allocation: number;
    costCenter: string;
}> = ({ isOpen, onClose, employee, planningType, monthKey, existingPlans, onSave, hasSalary, allocation, costCenter }) => {
    const [plans, setPlans] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const map: Record<string, number> = {};
            existingPlans.forEach(p => {
                if (p.chapa === employee.CHAPA && p.costCenter === costCenter) {
                    map[p.date] = p.plannedHours;
                }
            });
            setPlans(map);
        }
    }, [isOpen, existingPlans, employee, costCenter]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const records: PlanningRecord[] = Object.entries(plans).map(([date, hours]) => ({
                id: `plan_${date}_${employee.CHAPA}_${costCenter}_${planningType}`,
                chapa: employee.CHAPA,
                nome: employee.NOME,
                costCenter,
                date,
                type: planningType,
                plannedHours: hours
            }));
            await onSave(records);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const daysInMonth = new Date(parseInt(monthKey.split('-')[0]), parseInt(monthKey.split('-')[1]), 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(parseInt(monthKey.split('-')[0]), parseInt(monthKey.split('-')[1]) - 1, i + 1);
        return {
            date: d.toISOString().split('T')[0],
            day: i + 1,
            weekday: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
            isWeekend: d.getDay() === 0 || d.getDay() === 6
        };
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-blue-600 p-6 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="text-lg font-bold">{employee.NOME}</h3>
                        <p className="text-blue-100 text-xs font-mono">{employee.CHAPA} • {costCenter}</p>
                    </div>
                    <button onClick={onClose} disabled={saving}><X size={24} /></button>
                </div>

                <div className="p-4 bg-gray-50 border-b border-gray-100 flex gap-4 shrink-0">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <span className="text-xs text-gray-500 font-bold uppercase">Status Salarial:</span>
                        {hasSalary ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs"><CheckCircle2 size={14} /> Vinculado</span>
                        ) : (
                            <span className="flex items-center gap-1 text-red-500 font-bold text-xs"><AlertCircle size={14} /> Sem Salário</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <span className="text-xs text-gray-500 font-bold uppercase">Rateio:</span>
                        <span className="text-blue-600 font-bold text-xs">{(allocation * 100).toFixed(0)}%</span>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {planningType === 'DAILY' ? (
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                            {days.map(d => (
                                <div key={d.date} className={`flex flex-col gap-1 p-2 rounded-lg border ${d.isWeekend ? 'bg-gray-50 border-gray-200' : 'bg-white border-blue-100'}`}>
                                    <span className={`text-[10px] font-bold uppercase text-center ${d.isWeekend ? 'text-red-400' : 'text-gray-500'}`}>{d.day} {d.weekday}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="24"
                                        step="0.5"
                                        className="w-full text-center font-mono font-bold text-sm border-gray-200 rounded focus:ring-blue-500 focus:border-blue-500"
                                        value={plans[d.date] || ''}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            setPlans(prev => ({ ...prev, [d.date]: isNaN(val) ? 0 : val }));
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40">
                            <label className="text-sm font-bold text-gray-700 mb-2">Total de Horas Mensal</label>
                            <input
                                type="number"
                                className="text-3xl font-bold font-mono text-center w-40 border-b-2 border-blue-500 focus:outline-none"
                                value={plans[`${monthKey}-01`] || ''}
                                onChange={e => setPlans({ [`${monthKey}-01`]: parseFloat(e.target.value) || 0 })}
                                placeholder="0"
                            />
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors" disabled={saving}>Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        {saving ? 'Salvando...' : 'Confirmar Planejamento'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- MAIN COMPONENT ---
const Planning: React.FC<PlanningProps> = ({ user, employees }) => {
    // State
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedCC, setSelectedCC] = useState<string>('');
    const [planningType, setPlanningType] = useState<'DAILY' | 'MONTHLY'>('DAILY');
    const [searchTerm, setSearchTerm] = useState('');

    // Data State
    const [allocations, setAllocations] = useState<SalaryAllocation[]>([]);
    const [planningRecords, setPlanningRecords] = useState<PlanningRecord[]>([]);
    const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<OvertimeRecord | null>(null);

    // --- LOAD DATA ---
    const loadData = async () => {
        setLoading(true);
        try {
            const [salData, planData, budgetData] = await Promise.all([
                getSalaries(selectedMonth, user),
                getPlanning(selectedCC || undefined, selectedMonth, planningType, user),
                getBudgets(selectedMonth, user)
            ]);
            setAllocations(salData);
            setPlanningRecords(planData);
            setBudgets(budgetData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedMonth, selectedCC, planningType, user]);

    // --- DERIVED METRICS ---
    const metrics = useMemo(() => {
        let totalPlannedHours = 0;
        let totalPlannedCost = 0;
        let totalBudget = 0;

        // Budget Calculation (Filter by CC if selected)
        budgets.forEach(b => {
            if (!selectedCC || b.costCenter === selectedCC) {
                totalBudget += b.value;
            }
        });

        // Planning Calculation
        planningRecords.forEach(p => {
            if (!selectedCC || p.costCenter === selectedCC) {
                totalPlannedHours += p.plannedHours;

                // COST ESTIMATION (Backend Logic Simulation)
                // Need to find salary for this employee + Active check
                const alloc = allocations.find(a => a.chapa === p.chapa && a.monthKey === selectedMonth);
                if (alloc && alloc.salary > 0) {
                    // Cost Formula: (Salary / 220) * 1.6 (approx) * Hours
                    // Simplified for estimation
                    const hourlyRate = alloc.salary / 220;
                    totalPlannedCost += hourlyRate * 1.6 * p.plannedHours;
                }
            }
        });

        return {
            totalPlannedHours,
            totalPlannedCost,
            totalBudget,
            balance: totalBudget - totalPlannedCost
        };
    }, [planningRecords, budgets, allocations, selectedCC, selectedMonth]);

    // --- EMPLOYEES FILTER ---
    // Rule: ACTIVE ONLY (status === 'A')
    const activeEmployees = useMemo(() => {
        const activeChapas = new Set(
            allocations
                .filter(a => a.status === 'A')
                .map(a => a.chapa)
        );

        // Filter base employees list (or allocations list)
        // Ideally we iterate allocations to get 'Active' people for this month
        // But we need 'NOME' and 'FUNCAO' which are in 'employees' (OvertimeRecord)
        // or we need to trust 'employees' list matches.

        // Let's map over allocations to ensure we catch everyone allocated to this CC/Month
        // And merge with employee details.

        const list = allocations
            .filter(a => a.status === 'A')
            .filter(a => !selectedCC || a.costCenter === selectedCC)
            .map(a => {
                const info = employees.find(e => e.CHAPA === a.chapa);
                return {
                    chapa: a.chapa,
                    costCenter: a.costCenter,
                    name: info?.NOME || `Func. ${a.chapa}`,
                    role: info?.FUNCAO || 'Não Identificado',
                    allocation: a.allocation,
                    hasSalary: a.salary > 0 // Indicator logic
                };
            });

        // Filter by search
        return list.filter(e =>
            e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.chapa.includes(searchTerm)
        ).sort((a, b) => a.name.localeCompare(b.name));

    }, [allocations, employees, selectedCC, searchTerm]);


    // --- HANDLERS ---
    const handleOpenModal = (empChapa: string, costCenter: string) => {
        const emp = employees.find(e => e.CHAPA === empChapa) || {
            CHAPA: empChapa, NOME: 'Desconhecido', FUNCAO: '', CODCCUSTO: costCenter, DATA: '', SECAO: '', EVENTO: '', HORAS: 0, VALOR: 0
        };
        setSelectedEmployee(emp);
        setModalOpen(true);
    };

    const handleSavePlans = async (newPlans: PlanningRecord[]) => {
        // Merge with existing state optimistically then save
        await savePlanning(newPlans, user);
        // Reload to refresh
        loadData();
    };

    // --- RENDER ---
    return (
        <div className="space-y-6">

            {/* TOP METRICS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><FileText size={20} /></div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Planejado</p>
                            <p className="text-xl font-bold font-mono text-gray-800">{formatDecimalHours(metrics.totalPlannedHours)} h</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600"><DollarSign size={20} /></div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Budget Disponível</p>
                            <p className="text-xl font-bold font-mono text-gray-800">R$ {metrics.totalBudget.toLocaleString('pt-BR', { notation: 'compact' })}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-50 rounded-lg text-purple-600"><Calculator size={20} /></div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Custo Estimado</p>
                            <p className="text-xl font-bold font-mono text-gray-800">R$ {metrics.totalPlannedCost.toLocaleString('pt-BR', { notation: 'compact' })}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg ${metrics.balance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {metrics.balance >= 0 ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo Budget</p>
                            <p className={`text-xl font-bold font-mono ${metrics.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                R$ {metrics.balance.toLocaleString('pt-BR', { notation: 'compact' })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* FILTERS BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                        <Calendar size={16} className="text-gray-400" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-gray-700 focus:ring-0"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                        <User size={16} className="text-gray-400" />
                        <select
                            value={selectedCC}
                            onChange={e => setSelectedCC(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-gray-700 focus:ring-0 min-w-[150px]"
                        >
                            <option value="">Todos Centros de Custo</option>
                            {Array.from(new Set(allocations.map(a => a.costCenter))).sort().map(cc => (
                                <option key={cc} value={cc}>{cc}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setPlanningType('DAILY')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${planningType === 'DAILY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Diário
                    </button>
                    <button
                        onClick={() => setPlanningType('MONTHLY')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${planningType === 'MONTHLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Mensal
                    </button>
                </div>
            </div>

            {/* MAIN TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Search Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <User size={16} className="text-blue-500" />
                        Colaboradores Ativos ({activeEmployees.length})
                    </h3>
                    <div className="relative">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar colaborador..."
                            className="pl-8 pr-4 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-10 flex justify-center text-blue-600"><Loader2 className="animate-spin" /></div>
                ) : (
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Colaborador</th>
                                <th className="px-6 py-4">Função</th>
                                <th className="px-6 py-4 text-center">Salário</th>
                                <th className="px-6 py-4 text-center">Rateio</th>
                                <th className="px-6 py-4 text-right">Planejado</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {activeEmployees.map(emp => {
                                const empPlans = planningRecords.filter(p => p.chapa === emp.chapa && p.costCenter === emp.costCenter);
                                const totalHours = empPlans.reduce((acc, curr) => acc + curr.plannedHours, 0);

                                return (
                                    <tr key={`${emp.chapa}-${emp.costCenter}`} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="px-6 py-3">
                                            <div className="font-bold text-gray-800">{emp.name}</div>
                                            <div className="text-[10px] font-mono text-gray-400">{emp.chapa}</div>
                                            {selectedCC === '' && <div className="text-[10px] text-blue-500 font-bold">{emp.costCenter}</div>}
                                        </td>
                                        <td className="px-6 py-3 text-xs">{emp.role}</td>
                                        <td className="px-6 py-3 text-center">
                                            {/* STRICT RULE: NO NUMBERS */}
                                            {emp.hasSalary ? (
                                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-600" title="Salário Vinculado">
                                                    <CheckCircle2 size={16} />
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-500" title="Sem Salário Vinculado">
                                                    <AlertCircle size={16} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold font-mono">
                                                {(emp.allocation * 100).toFixed(0)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono font-bold text-gray-800">
                                            {totalHours > 0 ? formatDecimalHours(totalHours) : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <button
                                                onClick={() => handleOpenModal(emp.chapa, emp.costCenter)}
                                                className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 hover:shadow-sm text-blue-600 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Calendar size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* MODAL */}
            {selectedEmployee && modalOpen && (
                <EmployeeCalendarModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    employee={selectedEmployee}
                    planningType={planningType}
                    monthKey={selectedMonth}
                    existingPlans={planningRecords}
                    onSave={handleSavePlans}
                    // Pass context from activeEmployees list for this specific CC context? 
                    // Warning: selectedEmployee is OvertimeRecord, doesn't have allocation info attached directly.
                    // We need to find the allocation record again.
                    hasSalary={allocations.some(a => a.chapa === selectedEmployee.CHAPA && a.monthKey === selectedMonth && a.costCenter === (selectedCC || selectedEmployee.CODCCUSTO) && a.salary > 0)}
                    allocation={allocations.find(a => a.chapa === selectedEmployee.CHAPA && a.monthKey === selectedMonth && a.costCenter === (selectedCC || selectedEmployee.CODCCUSTO))?.allocation || 0}
                    costCenter={selectedCC || selectedEmployee.CODCCUSTO}
                />
            )}

        </div>
    );
};

export default Planning;

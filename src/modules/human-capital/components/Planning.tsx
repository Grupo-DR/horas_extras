
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { OvertimeRecord, UserProfile, PlanningRecord, SalaryAllocation, BudgetRecord, WorkTeam, ManualEmployee } from '../types';
import { savePlanning, getPlanning, saveSalaries, getSalariesSync, saveBudgets, getBudgetsSync, saveTeams, getTeams, deleteTeam, getTeamsSync } from '../services/planning';

import { Calendar as CalendarIcon, Save, LayoutList, CalendarDays, ChevronLeft, ChevronRight, User, Calculator, Users, X, FileUp, AlertTriangle, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, Building2, MapPin, CheckCircle2, Plus, Search } from 'lucide-react';
import { formatDecimalHours, parseTimeToDecimal } from '../utils/formatters';
import * as XLSX from 'xlsx';
import { TeamCard } from './TeamCard';
import { PlanningTable } from './PlanningTable';

// Constants for Regional Mapping based on the provided image
const REGIONAL_MAP: Record<string, string> = {
    '301201': 'Regional 01', '301502': 'Regional 01', '301503': 'Regional 01',
    '302801': 'Regional 01', '304301': 'Regional 01', '304501': 'Regional 01',
    '301804': 'Regional 02', '301805': 'Regional 02', '301806': 'Regional 02',
    '301903': 'Regional 02', '304401': 'Regional 02', '304402': 'Regional 02',
    '1001': 'Sede', '1002': 'Sede', '1003': 'Sede', '1004': 'Sede', '1005': 'Sede',
    '10101': 'Sede', '10301': 'Sede', '10401': 'Sede', '10501': 'Sede', '10601': 'Sede',
    '300001': 'Sede'
};

const getRegional = (cc: string): string => {
    const normalized = cc.replace(/\./g, '');
    return REGIONAL_MAP[normalized] || 'Outros';
};

const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface PlanningProps {
    user: UserProfile;
    employees: OvertimeRecord[];
    manualEmployees: ManualEmployee[];
}

const EmployeeCalendarModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    employeeName: string;
    chapa: string;
    periodStart: Date;
    periodEnd: Date;
    plans: Record<string, number>;
    salary?: number;
}> = ({ isOpen, onClose, employeeName, chapa, periodStart, periodEnd, plans, salary }) => {
    if (!isOpen) return null;

    const daysInPeriod = useMemo(() => {
        const daysArr = [];
        const curr = new Date(periodStart);
        if (isNaN(curr.getTime())) return [];
        let count = 0;
        while (curr <= periodEnd && count < 32) {
            daysArr.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
            count++;
        }
        return daysArr;
    }, [periodStart, periodEnd]);

    const calculation = useMemo(() => {
        return daysInPeriod.reduce((acc, day) => {
            const key = `${chapa}_${formatDateKey(day)}`;
            const hours = plans[key] || 0;
            const isSunday = day.getDay() === 0;

            let value = 0;
            if (salary && hours > 0) {
                const baseHour = salary / 220;
                const multiplier = isSunday ? 2.0 : 1.6;
                value = baseHour * multiplier * hours;
            }

            return {
                hours: acc.hours + hours,
                value: acc.value + value
            };
        }, { hours: 0, value: 0 });
    }, [daysInPeriod, chapa, plans, salary]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-blue-600 p-6 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="text-xl font-bold">{employeeName}</h3>
                        <p className="text-blue-100 text-sm">Chapa: {chapa} • Período: {periodStart.toLocaleDateString('pt-BR')} a {periodEnd.toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="text-right flex gap-6">
                        <div>
                            <p className="text-xs uppercase opacity-80 font-bold">Total Horas</p>
                            <p className="text-2xl font-mono font-bold">{formatDecimalHours(calculation.hours)}</p>
                        </div>
                        {salary && (
                            <div>
                                <p className="text-xs uppercase opacity-80 font-bold">Custo Planejado</p>
                                <p className="text-2xl font-mono font-bold">R$ {calculation.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="ml-4 p-2 hover:bg-white/20 rounded-full transition-colors">
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
                        {Array.from({ length: periodStart.getDay() }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-24 bg-transparent" />
                        ))}

                        {daysInPeriod.map(day => {
                            const dateKey = formatDateKey(day);
                            const key = `${chapa}_${dateKey}`;
                            const hours = plans[key] || 0;
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            const isSunday = day.getDay() === 0;

                            return (
                                <div
                                    key={dateKey}
                                    className={`h-24 border rounded-xl p-3 flex flex-col justify-between transition-all ${hours > 0 ? 'bg-white border-blue-200 shadow-md ring-1 ring-blue-50' : 'bg-white/50 border-gray-100 text-gray-300'
                                        } ${isWeekend ? 'bg-orange-50/30' : ''}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-xs font-bold ${isWeekend ? 'text-orange-500' : 'text-gray-400'}`}>
                                            {day.getDate()}
                                        </span>
                                        {hours > 0 && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${isSunday ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {isSunday ? '100%' : '60%'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        {hours > 0 ? (
                                            <span className="text-base font-bold font-mono text-gray-800">{formatDecimalHours(hours)}</span>
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
                        Visualização de Planejamento Detalhado por Dia
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- MODALS FOR TEAMS ---


const CreateTeamModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, manager: string, cc: string) => void;
    costCenters: string[];
}> = ({ isOpen, onClose, onSave, costCenters }) => {
    const [name, setName] = useState('');
    const [manager, setManager] = useState('');
    const [cc, setCc] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!name || !cc) return;
        onSave(name, manager, cc);
        setName(''); setManager(''); setCc('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Nova Frente de Trabalho (Equipe)</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome da Equipe</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Equipe Predial" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Centro de Custo</label>
                        <select value={cc} onChange={e => setCc(e.target.value)} className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Selecione...</option>
                            {costCenters.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Gestor (Opcional)</label>
                        <input type="text" value={manager} onChange={e => setManager(e.target.value)} className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: João da Silva" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-lg">Cancelar</button>
                    <button onClick={handleSubmit} disabled={!name || !cc} className="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">Criar Equipe</button>
                </div>
            </div>
        </div>
    );
};

const AddMemberModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (chapas: string[]) => void;
    availableEmployees: Array<{ chapa: string; nome: string; cc: string }>;
}> = ({ isOpen, onClose, onAdd, availableEmployees }) => {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<string[]>([]);

    if (!isOpen) return null;

    const filtered = availableEmployees.filter(e =>
        e.nome.toLowerCase().includes(search.toLowerCase()) ||
        e.chapa.includes(search)
    ).slice(0, 50); // Limit results for performance

    const toggle = (chapa: string) => {
        setSelected(prev => prev.includes(chapa) ? prev.filter(c => c !== chapa) : [...prev, chapa]);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg h-[80vh] flex flex-col">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Adicionar Membros</h3>
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Buscar por nome ou chapa..."
                        autoFocus
                    />
                </div>
                <div className="flex-1 overflow-y-auto border rounded-lg divide-y divide-gray-100">
                    {filtered.map(emp => (
                        <div key={emp.chapa} onClick={() => toggle(emp.chapa)} className={`p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${selected.includes(emp.chapa) ? 'bg-blue-50' : ''}`}>
                            <div>
                                <p className="font-bold text-sm text-gray-800">{emp.nome}</p>
                                <p className="text-xs text-gray-500">{emp.chapa} • {emp.cc}</p>
                            </div>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${selected.includes(emp.chapa) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                {selected.includes(emp.chapa) && <CheckCircle2 size={12} className="text-white" />}
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && <p className="p-4 text-center text-gray-400 text-sm">Nenhum colaborador encontrado.</p>}
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-lg">Cancelar</button>
                    <button onClick={() => { onAdd(selected); onClose(); setSelected([]); }} disabled={selected.length === 0} className="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        Adicionar ({selected.length})
                    </button>
                </div>
            </div>
        </div>
    );
};

const Planning: React.FC<PlanningProps> = ({ user, employees, manualEmployees }) => {
    const [mode, setMode] = useState<'MONTHLY' | 'DAILY'>('DAILY');
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const [ccFilter, setCcFilter] = useState<string>('');
    const [regionalFilter, setRegionalFilter] = useState<string>('');

    const { periodStart, periodEnd } = useMemo(() => {
        const parts = selectedMonth.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const end = new Date(year, month - 1, 20);
        const start = new Date(year, month - 2, 21);
        return { periodStart: start, periodEnd: end };
    }, [selectedMonth]);

    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(periodStart);
    useEffect(() => { setCurrentWeekStart(periodStart); }, [periodStart]);

    const [plans, setPlans] = useState<Record<string, number>>({});
    const [salaries, setSalaries] = useState<Record<string, number>>({});
    const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Teams State
    const [teams, setTeams] = useState<WorkTeam[]>([]);
    const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
    const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<{ name: string, chapa: string } | null>(null);

    const salaryInputRef = useRef<HTMLInputElement>(null);
    const budgetInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (alert) {
            const timer = setTimeout(() => setAlert(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [alert]);

    // Derived Lists
    const costCenters = useMemo(() => {
        const set = new Set<string>();
        employees.forEach(e => { if (e.CODCCUSTO) set.add(e.CODCCUSTO); });
        return Array.from(set).sort();
    }, [employees]);

    const regionals = useMemo(() => {
        const set = new Set<string>();
        employees.forEach(e => {
            if (e.CODCCUSTO) set.add(getRegional(e.CODCCUSTO));
        });
        return Array.from(set).sort();
    }, [employees]);

    const uniqueEmployees = useMemo(() => {
        const map = new Map<string, { nome: string; cc: string; chapa: string; regional: string }>();
        employees.forEach(e => {
            if (!map.has(e.CHAPA)) {
                map.set(e.CHAPA, { nome: e.NOME, cc: e.CODCCUSTO, chapa: e.CHAPA, regional: getRegional(e.CODCCUSTO) });
            }
        });
        manualEmployees.forEach(m => {
            if (!map.has(m.chapa)) {
                map.set(m.chapa, { nome: m.name, cc: m.costCenter, chapa: m.chapa, regional: getRegional(m.costCenter) });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [employees, manualEmployees]);

    // Load Data
    useEffect(() => {
        const storedSalaries = getSalariesSync();
        const sMap: Record<string, number> = {};
        storedSalaries.forEach(s => sMap[s.chapa] = s.salary);
        setSalaries(sMap);

        const storedBudgets = getBudgetsSync();
        setBudgets(storedBudgets);

        const loadedTeams = getTeamsSync(); // Sync for immediate render, async for update could be added
        setTeams(loadedTeams);

        // Background refresh for teams
        getTeams(user).then(t => setTeams(t));
    }, []);

    useEffect(() => {
        const loadPlans = async () => {
            let records: PlanningRecord[] = [];
            const startMonthStr = formatDateKey(periodStart).slice(0, 7);
            const endMonthStr = formatDateKey(periodEnd).slice(0, 7);

            // Fetch for all accessible to user
            const recs1 = await getPlanning(undefined, startMonthStr, mode === 'MONTHLY' ? 'MONTHLY' : 'DAILY');
            records = [...recs1];

            if (startMonthStr !== endMonthStr) {
                const recs2 = await getPlanning(undefined, endMonthStr, mode === 'MONTHLY' ? 'MONTHLY' : 'DAILY');
                records = [...records, ...recs2];
            }

            const planMap: Record<string, number> = {};
            records.forEach(r => {
                const key = mode === 'MONTHLY' ? r.chapa : `${r.chapa}_${r.date}`;
                planMap[key] = r.plannedHours;
            });
            setPlans(planMap);
        };
        loadPlans();
    }, [mode, selectedMonth, periodStart, periodEnd, user]);

    // Team Actions
    const handleCreateTeam = (name: string, manager: string, cc: string) => {
        const newTeam: WorkTeam = {
            id: crypto.randomUUID(),
            name,
            managerName: manager,
            costCenter: cc,
            memberChapas: []
        };
        const updated = [...teams, newTeam];
        setTeams(updated);
        saveTeams(updated, user);
        setAlert({ type: 'success', message: 'Equipe criada com sucesso!' });
    };


    const handleDeleteTeam = (teamId: string) => {
        const updated = teams.filter(t => t.id !== teamId);
        setTeams(updated);
        deleteTeam(teamId, user);
        setAlert({ type: 'success', message: 'Equipe removida.' });
    };

    const handleAddMembers = (chapas: string[]) => {
        if (!addMemberTeamId) return;
        const updated = teams.map(t => {
            if (t.id === addMemberTeamId) {
                // Avoid duplicates
                const newMembers = [...new Set([...t.memberChapas, ...chapas])];
                return { ...t, memberChapas: newMembers };
            }
            return t;
        });
        setTeams(updated);
        saveTeams(updated, user);
        setAddMemberTeamId(null);
    };

    // Helper to get Employee Object
    const getEmpObj = (chapa: string) => uniqueEmployees.find(e => e.chapa === chapa);

    // Calculate Global Stats (Filtered)
    const filteredEmployeesForStats = useMemo(() => {
        return uniqueEmployees.filter(e => {
            const reg = e.regional;
            const matchesCC = !ccFilter || e.cc === ccFilter;
            const matchesRegional = !regionalFilter || reg === regionalFilter;
            const isAuthorized = user.role === 'HC_COSTCENTER_PLANNER' ? e.cc === user.costCenter : true;
            return matchesCC && matchesRegional && isAuthorized;
        });
    }, [uniqueEmployees, ccFilter, regionalFilter, user]);

    const calculateTotalStats = () => {
        let totalHours = 0;
        let totalValue = 0;

        filteredEmployeesForStats.forEach(emp => {
            const salary = salaries[emp.chapa];
            if (mode === 'MONTHLY') {
                const hours = plans[emp.chapa] || 0;
                totalHours += hours;
                if (salary) totalValue += (salary / 220) * 1.6 * hours;
            } else {
                const curr = new Date(periodStart);
                while (curr <= periodEnd) {
                    const key = `${emp.chapa}_${formatDateKey(curr)}`;
                    const hours = plans[key] || 0;
                    totalHours += hours;
                    if (salary && hours > 0) {
                        const isSunday = curr.getDay() === 0;
                        const baseHour = salary / 220;
                        const multiplier = isSunday ? 2.0 : 1.6;
                        totalValue += baseHour * multiplier * hours;
                    }
                    curr.setDate(curr.getDate() + 1);
                }
            }
        });
        return { totalHours, totalValue };
    };

    const globalStats = calculateTotalStats();

    const currentBudget = useMemo(() => {
        const parts = selectedMonth.split('-');
        const monthNum = parseInt(parts[1], 10);
        const monthStr = MONTH_NAMES[monthNum - 1];

        return budgets.reduce((acc, b) => {
            const matchesMonth = b.month.toLowerCase() === monthStr.toLowerCase();
            const matchesCC = !ccFilter || b.costCenter === ccFilter;
            const matchesRegional = !regionalFilter || getRegional(b.costCenter) === regionalFilter;
            const isAuthorized = user.role === 'HC_COSTCENTER_PLANNER' ? b.costCenter === user.costCenter : true;
            return (matchesMonth && matchesCC && matchesRegional && isAuthorized) ? acc + b.value : acc;
        }, 0);
    }, [budgets, selectedMonth, user, ccFilter, regionalFilter]);

    const costDiff = currentBudget - globalStats.totalValue;
    const costPercent = currentBudget > 0 ? (globalStats.totalValue / currentBudget) * 100 : 0;
    const isOverBudget = globalStats.totalValue > currentBudget && currentBudget > 0;

    const changeWeek = (direction: 'next' | 'prev') => {
        setCurrentWeekStart(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
            return newDate;
        });
    };

    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(currentWeekStart);
            d.setDate(currentWeekStart.getDate() + i);
            days.push(d);
        }
        return days;
    }, [currentWeekStart]);

    const handlePlanChange = (chapa: string, dateKey: string, value: string) => {
        const decimalValue = parseTimeToDecimal(value);
        const key = mode === 'MONTHLY' ? chapa : `${chapa}_${dateKey}`;
        setPlans(prev => ({ ...prev, [key]: decimalValue }));
    };

    const handleSalaryImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (json.length === 0) {
                    setAlert({ type: 'error', message: "Arquivo vazio." });
                    return;
                }

                const headers = (json[0] as any[]).map(h => String(h).toUpperCase().trim());
                const idxChapa = headers.findIndex(h => h.includes('CHAPA'));
                const idxSalario = headers.findIndex(h => h.includes('SALÁRIO') || h.includes('SALARIO'));
                const idxMes = headers.findIndex(h => h.includes('MÊS') || h.includes('MES'));
                const idxStatus = headers.findIndex(h => h.includes('STATUS'));

                if (idxChapa === -1 || idxSalario === -1 || idxMes === -1 || idxStatus === -1) {
                    setAlert({ type: 'error', message: "Colunas obrigatórias não encontradas: Chapa, Salário, Mês, Status." });
                    return;
                }

                const salaryAllocations: SalaryAllocation[] = [];
                const salaryMap: Record<string, number> = { ...salaries };
                let count = 0;
                const currentYear = new Date().getFullYear();

                for (let i = 1; i < json.length; i++) {
                    const row = json[i] as any[];
                    if (!row || row.length === 0) continue;
                    const chapa = String(row[idxChapa] || '').trim();
                    const status = String(row[idxStatus] || '').trim().toUpperCase();
                    const mesName = String(row[idxMes] || '').trim();
                    let salaryVal = row[idxSalario];

                    if (status !== 'A') continue;
                    if (typeof salaryVal === 'string') salaryVal = parseFloat(salaryVal.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());

                    if (chapa && mesName && !isNaN(salaryVal)) {
                        const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === mesName.toLowerCase());
                        if (monthIndex === -1) continue;
                        const monthKey = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}`;
                        const emp = employees.find(e => e.CHAPA === chapa);
                        const costCenter = emp?.CODCCUSTO || 'UNKNOWN';
                        if (monthKey === selectedMonth) salaryMap[chapa] = salaryVal;
                        salaryAllocations.push({ monthKey, chapa, salary: salaryVal, allocation: 1.0, costCenter, status: 'A' });
                        count++;
                    }
                }

                if (count > 0) {
                    saveSalaries(salaryAllocations, user);
                    setSalaries(salaryMap);
                    setAlert({ type: 'success', message: `${count} salários importados!` });
                } else {
                    setAlert({ type: 'error', message: "Nenhum registro válido encontrado." });
                }

            } catch (err) { console.error(err); setAlert({ type: 'error', message: "Erro na importação" }); }
        };
        reader.readAsBinaryString(file);
        if (salaryInputRef.current) salaryInputRef.current.value = '';
    };

    const handleBudgetImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                const newBudgets: BudgetRecord[] = [];
                let count = 0;
                const currentYear = new Date().getFullYear();

                json.forEach((row: any, index: number) => {
                    if (index === 0 && (String(row[0]).toLowerCase().includes('mês'))) return;
                    const monthName = String(row[0] || '').trim();
                    const costCenter = String(row[1] || '').trim();
                    let budgetVal = row[2];
                    if (typeof budgetVal === 'string') budgetVal = parseFloat(budgetVal.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
                    if (monthName && costCenter && !isNaN(budgetVal)) {
                        const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
                        const monthKey = monthIndex >= 0 ? `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}` : selectedMonth;
                        newBudgets.push({ month: monthName, monthKey, costCenter, value: budgetVal });
                        count++;
                    }
                });

                if (count > 0) {
                    saveBudgets(newBudgets, user);
                    setBudgets(newBudgets);
                    setAlert({ type: 'success', message: `${count} budgets importados!` });
                } else {
                    setAlert({ type: 'error', message: "Erro budget." });
                }
            } catch (err) { setAlert({ type: 'error', message: "Falha budget." }); }
        };
        reader.readAsBinaryString(file);
        if (budgetInputRef.current) budgetInputRef.current.value = '';
    };

    const handleSave = async () => {
        setSaving(true);
        const recordsToSave: PlanningRecord[] = [];
        uniqueEmployees.forEach(emp => {
            if (mode === 'MONTHLY') {
                const hours = plans[emp.chapa];
                if (hours !== undefined) {
                    recordsToSave.push({ id: `${emp.chapa}_MONTHLY_${selectedMonth}`, chapa: emp.chapa, nome: emp.nome, costCenter: emp.cc, date: selectedMonth, type: 'MONTHLY', plannedHours: hours });
                }
            } else {
                const curr = new Date(periodStart);
                while (curr <= periodEnd) {
                    const dateKey = formatDateKey(curr);
                    const key = `${emp.chapa}_${dateKey}`;
                    const hours = plans[key];
                    if (hours !== undefined) {
                        recordsToSave.push({ id: `${emp.chapa}_DAILY_${dateKey}`, chapa: emp.chapa, nome: emp.nome, costCenter: emp.cc, date: dateKey, type: 'DAILY', plannedHours: hours });
                    }
                    curr.setDate(curr.getDate() + 1);
                }
            }
        });
        await savePlanning(recordsToSave, user);
        setSaving(false);
        setAlert({ type: 'success', message: 'Planejamento salvo!' });
    };

    const handleEmployeeClick = (emp: { nome: string; chapa: string }) => {
        setSelectedEmployee({ name: emp.nome, chapa: emp.chapa });
        setModalOpen(true);
    };

    // FILTERED TEAMS
    const displayTeams = useMemo(() => {
        return teams.filter(t => {
            const matchesCC = !ccFilter || t.costCenter === ccFilter;
            const teamRegional = getRegional(t.costCenter);
            const matchesRegional = !regionalFilter || teamRegional === regionalFilter;
            const isAuthorized = user.role === 'HC_COSTCENTER_PLANNER' ? t.costCenter === user.costCenter : true;
            return matchesCC && matchesRegional && isAuthorized;
        });
    }, [teams, ccFilter, regionalFilter, user]);

    return (
        <div className="space-y-6">
            <CreateTeamModal
                isOpen={isCreateTeamOpen}
                onClose={() => setIsCreateTeamOpen(false)}
                onSave={handleCreateTeam}
                costCenters={costCenters}
            />

            <AddMemberModal
                isOpen={!!addMemberTeamId}
                onClose={() => setAddMemberTeamId(null)}
                onAdd={handleAddMembers}
                availableEmployees={uniqueEmployees}
            />

            {selectedEmployee && (
                <EmployeeCalendarModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    employeeName={selectedEmployee.name}
                    chapa={selectedEmployee.chapa}
                    periodStart={periodStart}
                    periodEnd={periodEnd}
                    plans={plans}
                    salary={salaries[selectedEmployee.chapa]}
                />
            )}

            {alert && (
                <div className={`fixed bottom-8 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-bounce ${alert.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'}`}>
                    {alert.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                    <p className="font-bold text-sm tracking-tight">{alert.message}</p>
                    <button onClick={() => setAlert(null)} className="ml-4 hover:bg-white/20 p-1 rounded-full"><X size={16} /></button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 xl:col-span-2">
                    <div className="bg-blue-600 p-3 rounded-xl text-white shadow-lg shadow-blue-200 shrink-0"><Users size={20} /></div>
                    <div className="min-w-0">
                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider truncate">Total Planejado</p>
                        <p className="text-xl font-bold font-mono text-gray-800">{formatDecimalHours(globalStats.totalHours)}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 xl:col-span-3">
                    <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-lg shadow-indigo-200 shrink-0"><Wallet size={20} /></div>
                    <div className="min-w-0">
                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider truncate">Budget {MONTH_NAMES[parseInt(selectedMonth.split('-')[1], 10) - 1]}</p>
                        <p className="text-xl font-bold font-mono text-gray-800 truncate">R$ {currentBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className={`p-6 rounded-2xl shadow-sm border flex items-center gap-4 transition-all xl:col-span-4 ${isOverBudget ? 'bg-red-50 border-red-100 shadow-red-50' : 'bg-white border-gray-100'}`}>
                    <div className={`${isOverBudget ? 'bg-red-600' : 'bg-emerald-600'} p-3 rounded-xl text-white shadow-lg shrink-0`}><TrendingUp size={20} /></div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider truncate">Custo Planejado</p>
                        <p className={`text-xl xl:text-2xl font-bold font-mono ${isOverBudget ? 'text-red-700' : 'text-emerald-700'} truncate`}>
                            R$ {globalStats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    {currentBudget > 0 && (
                        <div className="text-right shrink-0 ${isOverBudget ? 'text-red-600' : 'text-emerald-700'}">
                            <div className="flex items-center justify-end text-sm font-bold">
                                {isOverBudget ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                {Math.abs(100 - costPercent).toFixed(1)}%
                            </div>
                            <div className="text-[9px] font-medium opacity-70 uppercase tracking-tighter">{isOverBudget ? 'Acima' : 'Abaixo'}</div>
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 xl:col-span-3">
                    <div className={`p-3 rounded-xl text-white shadow-lg shrink-0 ${costDiff < 0 ? 'bg-red-500' : 'bg-blue-500'}`}><Calculator size={20} /></div>
                    <div className="min-w-0">
                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider truncate">Saldo do Budget</p>
                        <p className={`text-xl font-bold font-mono ${costDiff < 0 ? 'text-red-600' : 'text-blue-600'} truncate`}>
                            R$ {costDiff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col xl:flex-row items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Mês de Referência</label>
                            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium" />
                        </div>

                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Regional</label>
                            <select value={regionalFilter} onChange={(e) => setRegionalFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[140px] font-medium">
                                <option value="">Todas</option>
                                {regionals.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Centro de Custo</label>
                            <select value={ccFilter} onChange={(e) => setCcFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[140px] max-w-[200px] font-medium">
                                <option value="">Todos</option>
                                {costCenters.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                            </select>
                        </div>

                        <div className="flex bg-gray-200 p-1 rounded-lg self-end h-[42px]">
                            <button onClick={() => setMode('MONTHLY')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all uppercase ${mode === 'MONTHLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Mensal</button>
                            <button onClick={() => setMode('DAILY')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all uppercase ${mode === 'DAILY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Diário</button>
                        </div>

                        {mode === 'DAILY' && (
                            <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 self-end h-[42px]">
                                <button onClick={() => changeWeek('prev')} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft size={16} /></button>
                                <span className="font-bold text-gray-700 text-[11px] min-w-[150px] text-center">{weekDays[0].toLocaleDateString('pt-BR')} - {weekDays[6].toLocaleDateString('pt-BR')}</span>
                                <button onClick={() => changeWeek('next')} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight size={16} /></button>
                            </div>
                        )}

                        <button onClick={() => setIsCreateTeamOpen(true)} className="bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-tight hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-sm">
                            <Plus size={16} /> Nova Equipe
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-3 w-full xl:w-auto justify-end">
                        {(user.role === 'HC_ADMIN') && (
                            <>
                                <input type="file" ref={salaryInputRef} onChange={handleSalaryImport} accept=".xlsx,.xls,.csv,.txt" className="hidden" />
                                <button onClick={() => salaryInputRef.current?.click()} className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-indigo-50 flex items-center gap-2 shadow-sm">
                                    <FileUp size={16} /> Salários
                                </button>
                                <input type="file" ref={budgetInputRef} onChange={handleBudgetImport} accept=".xlsx,.xls" className="hidden" />
                                <button onClick={() => budgetInputRef.current?.click()} className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-indigo-50 flex items-center gap-2 shadow-sm">
                                    <FileUp size={16} /> Budget
                                </button>
                            </>
                        )}
                        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase hover:bg-blue-700 transition flex items-center gap-2 shadow-md">
                            {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={18} />} Salvar
                        </button>
                    </div>
                </div>

                <div className="p-6 bg-gray-50 min-h-[400px]">
                    {displayTeams.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <LayoutList size={48} className="text-gray-300 mb-4" />
                            <p className="text-lg font-bold text-gray-500">Nenhuma equipe criada</p>
                            <p className="text-sm text-gray-400">Clique em "Nova Equipe" para começar</p>
                        </div>
                    ) : (
                        displayTeams.map(team => {
                            const teamEmployees = team.memberChapas
                                .map(chapa => getEmpObj(chapa))
                                .filter((e): e is { nome: string; chapa: string; cc: string; regional: string } => !!e);

                            return (
                                <TeamCard
                                    key={team.id}
                                    team={team}
                                    employees={teamEmployees}
                                    plans={plans}
                                    salaries={salaries}
                                    mode={mode}
                                    periodStart={periodStart}
                                    periodEnd={periodEnd}
                                    weekDays={weekDays}
                                    onPlanChange={handlePlanChange}
                                    onEmployeeClick={handleEmployeeClick}
                                    onAddMember={setAddMemberTeamId}
                                    onDeleteTeam={handleDeleteTeam}
                                />
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default Planning;

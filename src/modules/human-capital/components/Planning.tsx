
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { OvertimeRecord, UserProfile, PlanningRecord, SalaryRecord, BudgetRecord } from '../types';
import { savePlanning, getPlanning, saveSalaries, getSalaries, saveBudgets, getBudgets } from '../services/planning';
import { Calendar as CalendarIcon, Save, LayoutList, CalendarDays, ChevronLeft, ChevronRight, User, Calculator, Users, X, FileUp, AlertTriangle, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, Building2, MapPin, CheckCircle2 } from 'lucide-react';
import { formatDecimalHours, parseTimeToDecimal } from '../utils/formatters';
import * as XLSX from 'xlsx';

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
            </div>
        </div>
    );
};

const Planning: React.FC<PlanningProps> = ({ user, employees }) => {
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
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<{ name: string, chapa: string } | null>(null);
    const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const salaryInputRef = useRef<HTMLInputElement>(null);
    const budgetInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (alert) {
            const timer = setTimeout(() => setAlert(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [alert]);

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
            const reg = getRegional(e.CODCCUSTO);
            const matchesCC = !ccFilter || e.CODCCUSTO === ccFilter;
            const matchesRegional = !regionalFilter || reg === regionalFilter;

            if (!map.has(e.CHAPA) && matchesCC && matchesRegional) {
                map.set(e.CHAPA, { nome: e.NOME, cc: e.CODCCUSTO, chapa: e.CHAPA, regional: reg });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [employees, ccFilter, regionalFilter]);

    useEffect(() => {
        const storedSalaries = getSalaries();
        const sMap: Record<string, number> = {};
        storedSalaries.forEach(s => sMap[s.chapa] = s.salary);
        setSalaries(sMap);
        setBudgets(getBudgets());
    }, []);

    useEffect(() => {
        const loadPlans = async () => {
            const startMonthStr = formatDateKey(periodStart).slice(0, 7);
            let records = await getPlanning(user.role === 'LEVEL_B_01' ? user.costCenter : undefined, startMonthStr, mode === 'MONTHLY' ? 'MONTHLY' : 'DAILY');
            const planMap: Record<string, number> = {};
            records.forEach(r => {
                const key = mode === 'MONTHLY' ? r.chapa : `${r.chapa}_${r.date}`;
                planMap[key] = r.plannedHours;
            });
            setPlans(planMap);
        };
        loadPlans();
    }, [mode, selectedMonth, periodStart, periodEnd, user]);

    const changeWeek = (direction: 'next' | 'prev') => {
        setCurrentWeekStart(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
            return newDate;
        });
    };

    const calculatePersonStats = useMemo(() => {
        return (chapa: string) => {
            let totalHours = 0;
            let totalValue = 0;
            const salary = salaries[chapa];

            if (mode === 'MONTHLY') {
                totalHours = plans[chapa] || 0;
                if (salary) totalValue = (salary / 220) * 1.6 * totalHours;
            } else {
                const curr = new Date(periodStart);
                while (curr <= periodEnd) {
                    const key = `${chapa}_${formatDateKey(curr)}`;
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
            return { totalHours, totalValue };
        };
    }, [plans, salaries, mode, periodStart, periodEnd]);

    const teamTotals = useMemo(() => {
        return uniqueEmployees.reduce((acc, emp) => {
            const stats = calculatePersonStats(emp.chapa);
            return {
                hours: acc.hours + stats.totalHours,
                value: acc.value + stats.totalValue
            };
        }, { hours: 0, value: 0 });
    }, [uniqueEmployees, calculatePersonStats]);

    const currentBudget = useMemo(() => {
        const monthStr = MONTH_NAMES[periodEnd.getMonth()];
        return budgets.reduce((acc, b) => {
            const matchesMonth = b.month.toLowerCase() === monthStr.toLowerCase();
            const matchesCC = !ccFilter || b.costCenter === ccFilter;
            return (matchesMonth && matchesCC) ? acc + b.value : acc;
        }, 0);
    }, [budgets, periodEnd, ccFilter]);

    const handleSave = async () => {
        setSaving(true);
        const recordsToSave: PlanningRecord[] = [];
        uniqueEmployees.forEach(emp => {
            if (mode === 'MONTHLY') {
                const hours = plans[emp.chapa];
                if (hours !== undefined) {
                    recordsToSave.push({
                        id: `${emp.chapa}_MONTHLY_${selectedMonth}`,
                        chapa: emp.chapa, nome: emp.nome, costCenter: emp.cc,
                        date: selectedMonth, type: 'MONTHLY', plannedHours: hours
                    });
                }
            } else {
                const curr = new Date(periodStart);
                while (curr <= periodEnd) {
                    const dateKey = formatDateKey(curr);
                    const key = `${emp.chapa}_${dateKey}`;
                    const hours = plans[key];
                    if (hours !== undefined) {
                        recordsToSave.push({
                            id: `${emp.chapa}_DAILY_${dateKey}`,
                            chapa: emp.chapa, nome: emp.nome, costCenter: emp.cc,
                            date: dateKey, type: 'DAILY', plannedHours: hours
                        });
                    }
                    curr.setDate(curr.getDate() + 1);
                }
            }
        });
        await savePlanning(recordsToSave);
        setSaving(false);
        setAlert({ type: 'success', message: 'Planejamento salvo com sucesso!' });
    };

    const handleInputChange = (chapa: string, dateKey: string, value: string) => {
        const decimalValue = parseTimeToDecimal(value);
        const key = mode === 'MONTHLY' ? chapa : `${chapa}_${dateKey}`;
        setPlans(prev => ({ ...prev, [key]: decimalValue }));
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

    return (
        <div className="space-y-6">
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
                <div className={`fixed bottom-8 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${alert.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'}`}>
                    {alert.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                    <p className="font-bold text-sm tracking-tight">{alert.message}</p>
                    <button onClick={() => setAlert(null)} className="ml-4 hover:bg-white/20 p-1 rounded-full"><X size={16} /></button>
                </div>
            )}

            {/* Header Stats and Controls */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Stats Cards */}
                <div className="xl:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="bg-blue-600 p-3 rounded-xl text-white shadow-lg"><Users size={20} /></div>
                        <div><p className="text-[10px] text-gray-400 font-bold uppercase">Total Horas</p><p className="text-xl font-bold font-mono">{formatDecimalHours(teamTotals.hours)}</p></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-lg"><Wallet size={20} /></div>
                        <div><p className="text-[10px] text-gray-400 font-bold uppercase">Budget</p><p className="text-xl font-bold font-mono">R$ {currentBudget.toLocaleString('pt-BR')}</p></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className={`p-3 rounded-xl text-white shadow-lg ${teamTotals.value > currentBudget ? 'bg-red-600' : 'bg-emerald-600'}`}><TrendingUp size={20} /></div>
                        <div><p className="text-[10px] text-gray-400 font-bold uppercase">Custo Planejado</p><p className={`text-xl font-bold font-mono ${teamTotals.value > currentBudget ? 'text-red-600' : 'text-emerald-600'}`}>R$ {teamTotals.value.toLocaleString('pt-BR')}</p></div>
                    </div>
                </div>

                {/* Controls */}
                <div className="xl:col-span-12 bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex gap-4 items-center">
                        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm font-bold text-gray-700" />
                        <select value={regionalFilter} onChange={(e) => setRegionalFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Regional</option>{regionals.map(r => <option key={r} value={r}>{r}</option>)}</select>
                        <select value={ccFilter} onChange={(e) => setCcFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Centro de Custo</option>{costCenters.map(c => <option key={c} value={c}>{c}</option>)}</select>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setMode('DAILY')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${mode === 'DAILY' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>Diário</button>
                        <button onClick={() => setMode('MONTHLY')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${mode === 'MONTHLY' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>Mensal</button>
                        <button onClick={handleSave} disabled={saving} className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-xs font-bold uppercase hover:bg-emerald-700 flex items-center gap-2">
                            {saving ? 'Salvando...' : <><Save size={16} /> Salvar</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px]">
                        <tr>
                            <th className="px-6 py-4 sticky left-0 bg-gray-100 z-10 w-64 border-r">Colaborador</th>
                            {mode === 'MONTHLY' ? <th className="px-6 py-4">Total Horas</th> :
                                weekDays.map(day => (
                                    <th key={day.toISOString()} className={`px-2 py-4 text-center min-w-[60px] border-r ${day.getDay() === 0 ? 'bg-red-50 text-red-600' : ''}`}>
                                        {day.getDate()}/{day.getMonth() + 1}
                                    </th>
                                ))
                            }
                            <th className="px-6 py-4 text-right bg-gray-200 w-32">Total Período</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {uniqueEmployees.map(emp => {
                            const stats = calculatePersonStats(emp.chapa);
                            return (
                                <tr key={emp.chapa} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 sticky left-0 bg-white z-10 border-r border-gray-100">
                                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedEmployee({ name: emp.nome, chapa: emp.chapa }); setModalOpen(true); }}>
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">{emp.nome.charAt(0)}</div>
                                            <div><p className="font-bold text-gray-900 truncate w-40">{emp.nome}</p><p className="text-[9px] text-gray-400 font-mono">{emp.chapa}</p></div>
                                        </div>
                                    </td>
                                    {mode === 'MONTHLY' ? (
                                        <td className="px-6 py-3"><input type="text" className="border rounded px-2 py-1 w-20 text-right font-mono" defaultValue={formatDecimalHours(plans[emp.chapa])} onBlur={(e) => handleInputChange(emp.chapa, '', e.target.value)} /></td>
                                    ) : (
                                        weekDays.map(day => {
                                            const dateKey = formatDateKey(day);
                                            const val = plans[`${emp.chapa}_${dateKey}`];
                                            const isOutside = day < periodStart || day > periodEnd;
                                            return (
                                                <td key={dateKey} className={`px-1 py-3 text-center border-r border-gray-50 ${isOutside ? 'bg-gray-50 opacity-30' : ''}`}>
                                                    <input type="text" disabled={isOutside} className={`w-full text-center font-mono text-xs border rounded py-1 ${val ? 'bg-blue-50 border-blue-200 font-bold text-blue-700' : 'border-transparent hover:border-gray-200'}`} defaultValue={val ? formatDecimalHours(val) : ''} onBlur={(e) => handleInputChange(emp.chapa, dateKey, e.target.value)} />
                                                </td>
                                            )
                                        })
                                    )}
                                    <td className="px-6 py-3 text-right font-mono font-bold text-gray-800 bg-gray-50 border-l">{formatDecimalHours(stats.totalHours)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Planning;

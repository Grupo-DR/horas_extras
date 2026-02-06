
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { OvertimeRecord, UserProfile, PlanningRecord, SalaryRecord, BudgetRecord, SalaryAllocation } from '../types';
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
        // Segurança para evitar loops infinitos ou datas inválidas
        if (isNaN(curr.getTime())) return [];

        // Limita o loop a 31 dias para segurança
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
        // Standard period logic: from 21st of previous month to 20th of current month
        const end = new Date(year, month - 1, 20);
        const start = new Date(year, month - 2, 21);
        return { periodStart: start, periodEnd: end };
    }, [selectedMonth]);

    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(periodStart);
    useEffect(() => { setCurrentWeekStart(periodStart); }, [periodStart]);

    const [plans, setPlans] = useState<Record<string, number>>({});
    const [salaries, setSalaries] = useState<SalaryAllocation[]>([]);
    const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
    const [saving, setSaving] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<{ name: string, chapa: string, salary: number } | null>(null);

    // Alert State
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

    // Derived: Active Salary Allocations for Selected Month
    const activeAllocations = useMemo(() => {
        // Filter salaries for the selected month (or fallback logic)
        const relevant = salaries.filter(s => s.monthKey === selectedMonth && s.status === 'A');

        if (relevant.length === 0 && salaries.length > 0) {
            // Fallback Logic:
            const grouped = new Map<string, SalaryAllocation[]>();
            salaries.forEach(s => {
                if (s.status === 'A' && s.monthKey <= selectedMonth) {
                    const existing = grouped.get(s.chapa) || [];
                    existing.push(s);
                    grouped.set(s.chapa, existing);
                }
            });

            const fallback: SalaryAllocation[] = [];
            grouped.forEach((recs) => {
                recs.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
                const bestMonth = recs[0].monthKey;
                fallback.push(...recs.filter(r => r.monthKey === bestMonth));
            });
            return fallback;
        }

        return relevant;
    }, [salaries, selectedMonth]);

    const uniqueEmployees = useMemo(() => {
        const map = new Map<string, { nome: string; cc: string; chapa: string; regional: string }>();

        // Set of active chapas in base
        const activeChapas = new Set(activeAllocations.map(s => s.chapa));

        employees.forEach(e => {
            // Filter: Must be active
            if (!activeChapas.has(e.CHAPA)) return;

            const reg = getRegional(e.CODCCUSTO);
            const matchesCC = !ccFilter || e.CODCCUSTO === ccFilter;
            const matchesRegional = !regionalFilter || reg === regionalFilter;

            if (!map.has(e.CHAPA) && matchesCC && matchesRegional) {
                map.set(e.CHAPA, { nome: e.NOME, cc: e.CODCCUSTO, chapa: e.CHAPA, regional: reg });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [employees, ccFilter, regionalFilter, activeAllocations]);

    useEffect(() => {
        const storedSalaries = getSalaries();
        setSalaries(storedSalaries);

        const storedBudgets = getBudgets();
        setBudgets(storedBudgets);
    }, []);

    useEffect(() => {
        const loadPlans = async () => {
            let records: PlanningRecord[] = [];
            const startMonthStr = formatDateKey(periodStart).slice(0, 7);
            const endMonthStr = formatDateKey(periodEnd).slice(0, 7);

            const recs1 = await getPlanning(user.role === 'LEVEL_B_01' ? user.costCenter : undefined, startMonthStr, mode === 'MONTHLY' ? 'MONTHLY' : 'DAILY');
            records = [...recs1];

            if (startMonthStr !== endMonthStr) {
                const recs2 = await getPlanning(user.role === 'LEVEL_B_01' ? user.costCenter : undefined, endMonthStr, mode === 'MONTHLY' ? 'MONTHLY' : 'DAILY');
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

    const changeWeek = (direction: 'next' | 'prev') => {
        setCurrentWeekStart(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
            return newDate;
        });
    };

    const handleEmployeeClick = (emp: { nome: string; chapa: string }) => {
        const allocs = activeAllocations.filter(a => a.chapa === emp.chapa);
        const salary = allocs.length > 0 ? allocs[0].salary : 0;
        setSelectedEmployee({ name: emp.nome, chapa: emp.chapa, salary });
        setModalOpen(true);
    };

    const parseMonthKey = (monthVal: any, yearVal: any): string => {
        // Case 1: Javascript Date
        if (monthVal instanceof Date) {
            return formatDateKey(monthVal).slice(0, 7);
        }
        // Case 2: Excel Serial Date (number > 20000)
        if (typeof monthVal === 'number' && monthVal > 20000) {
            // Approximate check for Excel dates
            const date = new Date((monthVal - 25569) * 86400 * 1000);
            // Adjust for timezone if needed, but usually works for month/year extraction
            // Adding a few hours to avoid timezone issues rolling back a day
            date.setHours(12);
            return formatDateKey(date).slice(0, 7);
        }
        // Case 3: String Parsing
        if (typeof monthVal === 'string') {
            const cleaned = monthVal.trim();
            // Check for "YYYY-MM" or "YYYY-MM-DD"
            if (cleaned.match(/^\d{4}-\d{2}/)) {
                return cleaned.slice(0, 7);
            }

            // Check for Month Name (Requires Year)
            const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === cleaned.toLowerCase());
            if (monthIndex >= 0 && yearVal) {
                const yyyy = String(yearVal).trim();
                const mm = String(monthIndex + 1).padStart(2, '0');
                return `${yyyy}-${mm}`;
            }
        }
        return '';
    };

    const normalizeCC = (cc: string): string => {
        return cc.replace(/\./g, '').trim();
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
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                if (json.length === 0) {
                    setAlert({ type: 'error', message: "Arquivo vazio." });
                    return;
                }

                // Header Mapping
                let headerRowIndex = -1;
                const colMap: Record<string, number> = {};

                // Find header
                for (let i = 0; i < Math.min(json.length, 10); i++) {
                    const row = json[i];
                    const rowStr = row.map(c => String(c).toLowerCase());
                    if (rowStr.some(c => c.includes('chapa') || c.includes('nome'))) {
                        headerRowIndex = i;
                        row.forEach((cell, idx) => {
                            const c = String(cell).toLowerCase().trim();
                            if (c.includes('mês') || c.includes('mes')) colMap['month'] = idx;
                            if (c.includes('chapa')) colMap['chapa'] = idx;
                            if (c.includes('status')) colMap['status'] = idx;
                            if (c.includes('cc') || c.includes('centro')) colMap['cc'] = idx;
                            if (c.includes('aloc') || c.includes('rateio')) colMap['allocation'] = idx;
                            if (c.includes('salário') || c.includes('salario')) colMap['salary'] = idx;
                        });
                        break;
                    }
                }

                if (headerRowIndex === -1 || colMap['chapa'] === undefined || colMap['status'] === undefined) {
                    setAlert({ type: 'error', message: "Colunas obrigatórias não encontradas: Chapa, Status. (Opcionais: Mês, CC, Alocação, Salário)" });
                    return;
                }

                const newSalaries: SalaryAllocation[] = [];
                let count = 0;

                for (let i = headerRowIndex + 1; i < json.length; i++) {
                    const row = json[i];
                    if (!row || row.length === 0) continue;

                    const chapa = String(row[colMap['chapa']] || '').trim();
                    if (!chapa) continue;

                    const status = String(row[colMap['status']] || '').trim();
                    const monthVal = colMap['month'] !== undefined ? row[colMap['month']] : undefined;

                    const monthKey = monthVal ? parseMonthKey(monthVal, undefined) : selectedMonth;

                    const cc = colMap['cc'] !== undefined ? normalizeCC(String(row[colMap['cc']] || '')) : '';

                    let allocation = 1.0;
                    if (colMap['allocation'] !== undefined) {
                        const rawAlloc = row[colMap['allocation']];
                        if (typeof rawAlloc === 'number') allocation = rawAlloc;
                        else if (typeof rawAlloc === 'string') {
                            if (rawAlloc.includes('%')) {
                                allocation = parseFloat(rawAlloc.replace('%', '').replace(',', '.')) / 100;
                            } else {
                                allocation = parseFloat(rawAlloc.replace(',', '.'));
                            }
                        }
                    }

                    let salary = 0;
                    if (colMap['salary'] !== undefined) {
                        const rawSal = row[colMap['salary']];
                        if (typeof rawSal === 'number') salary = rawSal;
                        else if (typeof rawSal === 'string') {
                            salary = parseFloat(rawSal.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
                        }
                    }

                    if (monthKey && chapa && status) {
                        newSalaries.push({
                            monthKey,
                            chapa,
                            status,
                            costCenter: cc,
                            allocation,
                            salary
                        });
                        count++;
                    }
                }

                if (count > 0) {
                    const existing = [...salaries];
                    const importedMonths = new Set(newSalaries.map(s => s.monthKey));
                    const filteredExisting = existing.filter(s => !importedMonths.has(s.monthKey));

                    const merged = [...filteredExisting, ...newSalaries];
                    saveSalaries(merged);
                    setSalaries(merged);
                    setAlert({ type: 'success', message: `${count} registros salariais importados/atualizados!` });
                } else {
                    setAlert({ type: 'error', message: "Nenhum dado válido." });
                }

            } catch (err) {
                console.error(err);
                setAlert({ type: 'error', message: "Falha ao processar arquivo de salários." });
            }
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
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                if (json.length === 0) {
                    setAlert({ type: 'error', message: "Arquivo vazio." });
                    return;
                }

                // Header Mapping
                let headerRowIndex = -1;
                const colMap: Record<string, number> = {};

                // Find header row (looking for "Mês" or "Mes")
                for (let i = 0; i < Math.min(json.length, 10); i++) {
                    const row = json[i];
                    const rowStr = row.map(c => String(c).toLowerCase());
                    if (rowStr.some(c => c.includes('mês') || c.includes('mes'))) {
                        headerRowIndex = i;
                        row.forEach((cell, idx) => {
                            const c = String(cell).toLowerCase().trim();
                            if (c.includes('mês') || c.includes('mes')) colMap['month'] = idx;
                            if (c.includes('ano') || c.includes('year')) colMap['year'] = idx;
                            if (c.includes('cc') || c.includes('centro') || c.includes('cost')) colMap['cc'] = idx;
                            if (c.includes('valor') || c.includes('value') || c.includes('orcado') || c.includes('budget')) colMap['value'] = idx;
                        });
                        break;
                    }
                }

                if (headerRowIndex === -1 || colMap['month'] === undefined || colMap['cc'] === undefined || colMap['value'] === undefined) {
                    setAlert({ type: 'error', message: "Colunas obrigatórias não encontradas: Mês, CC, Valor." });
                    return;
                }

                const newBudgets: BudgetRecord[] = [];
                let count = 0;

                for (let i = headerRowIndex + 1; i < json.length; i++) {
                    const row = json[i];
                    if (!row || row.length === 0) continue;

                    const monthVal = row[colMap['month']];
                    const yearVal = colMap['year'] !== undefined ? row[colMap['year']] : undefined;
                    const ccVal = row[colMap['cc']];
                    const valVal = row[colMap['value']];

                    if (!monthVal && !ccVal) continue;

                    const monthKey = parseMonthKey(monthVal, yearVal);
                    const costCenter = normalizeCC(String(ccVal || ''));
                    let value = valVal;

                    if (typeof value === 'string') {
                        value = parseFloat(value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
                    }

                    if (monthKey && costCenter && !isNaN(value)) {
                        newBudgets.push({
                            monthKey,
                            month: String(monthVal),
                            costCenter,
                            value
                        });
                        count++;
                    }
                }

                if (count > 0) {
                    saveBudgets(newBudgets);
                    setBudgets(newBudgets);
                    setAlert({ type: 'success', message: `${count} budgets importados com sucesso! (Chave: YYYY-MM)` });
                } else {
                    setAlert({ type: 'error', message: "Nenhum budget válido." });
                }
            } catch (err) {
                console.error(err);
                setAlert({ type: 'error', message: "Erro ao processar arquivo de budget." });
            }
        };
        reader.readAsBinaryString(file);
        if (budgetInputRef.current) budgetInputRef.current.value = '';
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

    const handleInputChange = (chapa: string, dateKey: string, value: string) => {
        const decimalValue = parseTimeToDecimal(value);
        const key = mode === 'MONTHLY' ? chapa : `${chapa}_${dateKey}`;
        setPlans(prev => ({ ...prev, [key]: decimalValue }));
    };

    const calculatePersonStats = useMemo(() => {
        return (chapa: string, employeeCC: string) => {
            let totalHours = 0;
            let totalValue = 0;

            // Find allocation for the specific CC
            const normalizedCC = normalizeCC(employeeCC);
            const userAllocations = activeAllocations.filter(a => a.chapa === chapa);
            const specificAlloc = userAllocations.find(a => normalizeCC(a.costCenter) === normalizedCC);

            // Fallback: If no specific allocation for this CC, use 100% of the salary found in any allocation
            // (Assuming salary is constant across allocations for the same chapa)
            const baseSalary = userAllocations.length > 0 ? userAllocations[0].salary : 0;
            const allocationFactor = specificAlloc ? specificAlloc.allocation : 1.0;
            const effectiveSalary = baseSalary * allocationFactor; // Base for this CC

            if (mode === 'MONTHLY') {
                totalHours = plans[chapa] || 0;
                if (effectiveSalary) totalValue = (effectiveSalary / 220) * 1.6 * totalHours;
            } else {
                const curr = new Date(periodStart);
                while (curr <= periodEnd) {
                    const key = `${chapa}_${formatDateKey(curr)}`;
                    const hours = plans[key] || 0;
                    totalHours += hours;

                    if (effectiveSalary && hours > 0) {
                        const isSunday = curr.getDay() === 0;
                        const baseHour = effectiveSalary / 220;
                        const multiplier = isSunday ? 2.0 : 1.6;
                        totalValue += baseHour * multiplier * hours;
                    }
                    curr.setDate(curr.getDate() + 1);
                }
            }
            return { totalHours, totalValue };
        };
    }, [plans, activeAllocations, mode, periodStart, periodEnd]);

    const teamTotals = useMemo(() => {
        return uniqueEmployees.reduce((acc, emp) => {
            const stats = calculatePersonStats(emp.chapa, emp.cc);
            return {
                hours: acc.hours + stats.totalHours,
                value: acc.value + stats.totalValue
            };
        }, { hours: 0, value: 0 });
    }, [uniqueEmployees, calculatePersonStats]);

    const currentBudget = useMemo(() => {
        return budgets.reduce((acc, b) => {
            const matchesMonth = b.monthKey === selectedMonth; // Direct YYYY-MM comparison
            const matchesCC = !ccFilter || b.costCenter === ccFilter;
            const matchesRegional = !regionalFilter || getRegional(b.costCenter) === regionalFilter;
            const isAuthorized = user.role === 'LEVEL_B_01' ? b.costCenter === user.costCenter : true;
            return (matchesMonth && matchesCC && matchesRegional && isAuthorized) ? acc + b.value : acc;
        }, 0);
    }, [budgets, selectedMonth, user, ccFilter, regionalFilter]);

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

    const costDiff = currentBudget - teamTotals.value;
    const costPercent = currentBudget > 0 ? (teamTotals.value / currentBudget) * 100 : 0;
    const isOverBudget = teamTotals.value > currentBudget && currentBudget > 0;

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

            {/* Custom Alerts */}
            {alert && (
                <div className={`fixed bottom-8 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-bounce ${alert.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'}`}>
                    {alert.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                    <p className="font-bold text-sm tracking-tight">{alert.message}</p>
                    <button onClick={() => setAlert(null)} className="ml-4 hover:bg-white/20 p-1 rounded-full"><X size={16} /></button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 xl:col-span-2">
                    <div className="bg-blue-600 p-3 rounded-xl text-white shadow-lg shadow-blue-200 shrink-0">
                        <Users size={20} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider truncate">Total Planejado</p>
                        <p className="text-xl font-bold font-mono text-gray-800">{formatDecimalHours(teamTotals.hours)}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 xl:col-span-3">
                    <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-lg shadow-indigo-200 shrink-0">
                        <Wallet size={20} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider truncate">Budget {MONTH_NAMES[parseInt(selectedMonth.split('-')[1], 10) - 1]}</p>
                        <p className="text-xl font-bold font-mono text-gray-800 truncate">R$ {currentBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className={`p-6 rounded-2xl shadow-sm border flex items-center gap-4 transition-all xl:col-span-4 ${isOverBudget ? 'bg-red-50 border-red-100 shadow-red-50' : 'bg-white border-gray-100'}`}>
                    <div className={`${isOverBudget ? 'bg-red-600' : 'bg-emerald-600'} p-3 rounded-xl text-white shadow-lg shrink-0`}>
                        <TrendingUp size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider truncate">Custo Planejado</p>
                        <p className={`text-xl xl:text-2xl font-bold font-mono ${isOverBudget ? 'text-red-700' : 'text-emerald-700'} truncate`}>
                            R$ {teamTotals.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    {currentBudget > 0 && (
                        <div className={`text-right shrink-0 ${isOverBudget ? 'text-red-600' : 'text-emerald-700'}`}>
                            <div className="flex items-center justify-end text-sm font-bold">
                                {isOverBudget ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                {Math.abs(100 - costPercent).toFixed(1)}%
                            </div>
                            <div className="text-[9px] font-medium opacity-70 uppercase tracking-tighter">
                                {isOverBudget ? 'Acima' : 'Abaixo'}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 xl:col-span-3">
                    <div className={`p-3 rounded-xl text-white shadow-lg shrink-0 ${costDiff < 0 ? 'bg-red-500' : 'bg-blue-500'}`}>
                        <Calculator size={20} />
                    </div>
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
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                                <MapPin size={10} /> Regional
                            </label>
                            <select value={regionalFilter} onChange={(e) => setRegionalFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[140px] font-medium">
                                <option value="">Todas</option>
                                {regionals.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                                <Building2 size={10} /> Centro de Custo
                            </label>
                            <select value={ccFilter} onChange={(e) => setCcFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[140px] max-w-[200px] font-medium">
                                <option value="">Todos</option>
                                {costCenters.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                            </select>
                        </div>

                        <div className="flex bg-gray-200 p-1 rounded-lg self-end h-[42px]">
                            <button onClick={() => setMode('MONTHLY')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 uppercase tracking-tight ${mode === 'MONTHLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                <CalendarDays size={14} /> Mensal
                            </button>
                            <button onClick={() => setMode('DAILY')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 uppercase tracking-tight ${mode === 'DAILY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                <LayoutList size={14} /> Diário
                            </button>
                        </div>

                        {mode === 'DAILY' && (
                            <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 self-end h-[42px]">
                                <button onClick={() => changeWeek('prev')} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={16} /></button>
                                <div className="text-center min-w-[150px]">
                                    <span className="font-bold text-gray-700 text-[11px] tracking-tight">{weekDays[0].toLocaleDateString('pt-BR')} - {weekDays[6].toLocaleDateString('pt-BR')}</span>
                                </div>
                                <button onClick={() => changeWeek('next')} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight size={16} /></button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-3 w-full xl:w-auto justify-end">
                        {(user.role === 'MASTER' || user.role === 'DEV_MASTER') && (
                            <>
                                <input type="file" ref={salaryInputRef} onChange={handleSalaryImport} accept=".xlsx,.xls,.csv,.txt" className="hidden" />
                                <button onClick={() => salaryInputRef.current?.click()} className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-tight hover:bg-indigo-50 transition-colors flex items-center gap-2 shadow-sm">
                                    <FileUp size={16} /> Salários
                                </button>

                                <input type="file" ref={budgetInputRef} onChange={handleBudgetImport} accept=".xlsx,.xls" className="hidden" />
                                <button onClick={() => budgetInputRef.current?.click()} className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-tight hover:bg-indigo-50 transition-colors flex items-center gap-2 shadow-sm">
                                    <FileUp size={16} /> Budget
                                </button>
                            </>
                        )}
                        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-tight hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md">
                            {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={18} />} Salvar
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px] tracking-widest border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 sticky left-0 bg-gray-100 z-10 w-64 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Colaborador</th>
                                {mode === 'MONTHLY' ? (
                                    <th className="px-6 py-4">Planejamento Período</th>
                                ) : (
                                    weekDays.map(day => {
                                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                        const isSunday = day.getDay() === 0;
                                        const isOutsidePeriod = day < periodStart || day > periodEnd;
                                        return (
                                            <th key={day.toISOString()} className={`px-2 py-4 text-center min-w-[90px] border-r border-gray-200 ${isSunday ? 'bg-red-50 text-red-800' : isWeekend ? 'bg-orange-50 text-orange-800' : ''} ${isOutsidePeriod ? 'opacity-30' : ''}`}>
                                                <div className="flex flex-col">
                                                    <span>{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                                                    <span className="font-normal opacity-60">{day.getDate()}</span>
                                                </div>
                                            </th>
                                        );
                                    })
                                )}
                                <th className="px-6 py-4 text-center bg-gray-200/50 text-gray-800 min-w-[140px] border-l border-gray-200 font-bold">Total Período</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {uniqueEmployees.map(emp => {
                                const stats = calculatePersonStats(emp.chapa, emp.cc);
                                const exceedsLimit = stats.totalHours > 44;

                                return (
                                    <tr key={emp.chapa} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-3 sticky left-0 bg-white z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleEmployeeClick(emp)}>
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">{emp.nome.charAt(0)}</div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-gray-900 truncate max-w-[180px] group-hover:text-blue-600 transition-colors">{emp.nome}</div>
                                                    <div className="text-[9px] text-gray-400 font-mono uppercase tracking-tighter">
                                                        {emp.chapa} • {emp.regional} • {emp.cc}
                                                    </div>
                                                    <div className="text-[9px] text-gray-500 font-mono italic flex flex-col">
                                                        {(() => {
                                                            const allocs = activeAllocations.filter(a => a.chapa === emp.chapa);
                                                            if (allocs.length === 0) return <span>S/ Salário</span>;

                                                            const rateioStr = allocs.map(a => `${(a.allocation * 100).toFixed(0)}% ${a.costCenter}`).join(' | ');
                                                            // Also show salary value? "R$ 10.000 (Rateio: ...)"
                                                            const salValue = allocs[0].salary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                                            return (
                                                                <>
                                                                    <span>{salValue}</span>
                                                                    {allocs.length > 0 && <span className="text-[8px] text-indigo-500 font-bold">Rateio: {rateioStr}</span>}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {mode === 'MONTHLY' ? (
                                            <td className="px-6 py-3">
                                                <input type="text" placeholder="00:00" onBlur={(e) => handleInputChange(emp.chapa, '', e.target.value)} defaultValue={formatDecimalHours(plans[emp.chapa])} key={`monthly-${plans[emp.chapa]}`} className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-right font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                            </td>
                                        ) : (
                                            weekDays.map(day => {
                                                const dateKey = formatDateKey(day);
                                                const rawVal = plans[`${emp.chapa}_${dateKey}`];
                                                const isSunday = day.getDay() === 0;
                                                const isOutsidePeriod = day < periodStart || day > periodEnd;
                                                return (
                                                    <td key={dateKey} className={`px-2 py-3 text-center border-r border-gray-100 ${isSunday ? 'bg-red-50/20' : ''}`}>
                                                        <input type="text" placeholder="00:00" disabled={isOutsidePeriod} onBlur={(e) => handleInputChange(emp.chapa, dateKey, e.target.value)} defaultValue={rawVal !== undefined ? formatDecimalHours(rawVal) : ''} key={`${dateKey}-${rawVal}`} className={`w-16 border rounded-lg px-1 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all ${rawVal ? (isSunday ? 'border-red-300 bg-red-50 ring-1 ring-red-100' : 'border-blue-300 bg-blue-50 ring-1 ring-blue-100') : 'border-gray-200'} ${isOutsidePeriod ? 'opacity-20 cursor-not-allowed bg-gray-50' : ''}`} />
                                                    </td>
                                                );
                                            })
                                        )}

                                        <td className={`px-4 py-3 text-center bg-gray-50 border-l border-gray-100 ${exceedsLimit ? 'bg-red-50' : ''}`}>
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center gap-1">
                                                    <span className={`font-bold font-mono text-base ${exceedsLimit ? 'text-red-600' : 'text-gray-800'}`}>
                                                        {formatDecimalHours(stats.totalHours)}
                                                    </span>
                                                    {exceedsLimit && (
                                                        <span title="Acima de 44h no período">
                                                            <AlertTriangle size={14} className="text-red-600" />
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] font-bold text-emerald-600 font-mono mt-1">
                                                    R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Planning;

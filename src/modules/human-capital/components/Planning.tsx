import React, { useState, useEffect, useMemo, useRef } from 'react';
import { OvertimeRecord, UserProfile, PlanningRecord, SalaryAllocation, BudgetRecord, WorkTeam, ManualEmployee, TeamAllocation, GlobalEmployee } from '../types';
import { savePlanning, getPlanning, saveSalaries, getSalariesSync, saveBudgets, getBudgetsSync, saveTeams, getTeams, deleteTeam, getTeamsSync, getAllBudgetsAsync, deleteBudgets, deleteAllBudgets, getTeamAllocationsSync, getTeamAllocations, saveTeamAllocations, saveGlobalEmployees, getGlobalEmployeesAsync, getGlobalEmployeesSync } from '../services/planning';
import { canApprove } from '../../iam/types';
import { ApprovalPanel } from './ApprovalPanel';

import { Users, Clock, Wallet, TrendingUp, Calculator, CheckCircle2, AlertTriangle, X, ChevronLeft, ChevronRight, Save, FileUp, Plus, Search, ArrowUpRight, ArrowDownRight, LayoutList, Trash2 } from 'lucide-react';
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

// --- BUDGET MANAGER MODAL ---

const BudgetManagerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile;
    onRefresh: () => void;
}> = ({ isOpen, onClose, user, onRefresh }) => {
    const [allBudgets, setAllBudgets] = useState<BudgetRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        getAllBudgetsAsync().then(b => { setAllBudgets(b); setLoading(false); });
    }, [isOpen]);

    // Group by monthKey
    const grouped = useMemo(() => {
        const map = new Map<string, { total: number; count: number; monthKey: string; month: string }>();
        allBudgets.forEach(b => {
            const existing = map.get(b.monthKey) || { total: 0, count: 0, monthKey: b.monthKey, month: b.month };
            map.set(b.monthKey, { ...existing, total: existing.total + b.value, count: existing.count + 1 });
        });
        return Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    }, [allBudgets]);

    const handleDelete = async (monthKey: string) => {
        if (!window.confirm(`Excluir TODOS os registros de budget de ${monthKey}? Esta ação não pode ser desfeita.`)) return;
        setDeleting(monthKey);
        try {
            await deleteBudgets(monthKey, user);
            setAllBudgets(prev => prev.filter(b => b.monthKey !== monthKey));
            onRefresh();
        } catch { alert('Erro ao excluir. Tente novamente.'); }
        finally { setDeleting(null); }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm(`Excluir TODOS os ${grouped.length} períodos de budget? Esta ação não pode ser desfeita.`)) return;
        setDeleting('__all__');
        try {
            await deleteAllBudgets(user);
            setAllBudgets([]);
            onRefresh();
        } catch { alert('Erro ao excluir todos. Tente novamente.'); }
        finally { setDeleting(null); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="text-lg font-bold">Gerenciar Budgets</h3>
                        <p className="text-indigo-200 text-xs">{grouped.length} períodos importados</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {grouped.length > 0 && (
                            <button
                                onClick={handleDeleteAll}
                                disabled={deleting === '__all__'}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {deleting === '__all__'
                                    ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    : <Trash2 size={13} />}
                                Apagar Todos
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                        </div>
                    ) : grouped.length === 0 ? (
                        <div className="py-16 text-center text-gray-400">
                            <Wallet size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="font-bold">Nenhum budget importado</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                                <tr>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Período</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Competência</th>
                                    <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qtd. CCs</th>
                                    <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Budget</th>
                                    <th className="px-5 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {grouped.map(g => (
                                    <tr key={g.monthKey} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="px-5 py-3 font-mono font-bold text-gray-700">{g.monthKey}</td>
                                        <td className="px-5 py-3 text-gray-600 capitalize">{g.month}</td>
                                        <td className="px-5 py-3 text-right text-gray-600">{g.count}</td>
                                        <td className="px-5 py-3 text-right font-bold font-mono text-indigo-700">
                                            R$ {g.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(g.monthKey)}
                                                disabled={deleting === g.monthKey}
                                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                                title="Excluir período"
                                            >
                                                {deleting === g.monthKey
                                                    ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                                    : <Trash2 size={15} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    A exclusão remove todos os Centros de Custo do período selecionado do Firestore e do cache local.
                </div>
            </div>
        </div>
    );
};// --- TEAM PLAN MODAL (Grade Membros × Dias) ---
const TeamPlanModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    team: WorkTeam;
    memberNames: Record<string, string>;
    memberFuncoes: Record<string, string>;
    plans: Record<string, number>;
    salaries: Record<string, number>;
    periodStart: Date;
    periodEnd: Date;
    onSave: (teamId: string, localNums: Record<string, number>) => Promise<void>;
    onRemoveMember: (teamId: string, chapa: string) => void;
    planStatuses: Record<string, string>;
    canOverrideLock: boolean;
}> = ({ isOpen, onClose, team, memberNames, memberFuncoes, plans, salaries, periodStart, periodEnd, onSave, onRemoveMember, planStatuses, canOverrideLock }) => {
    const [saving, setSaving] = useState(false);
    const [localValues, setLocalValues] = useState<Record<string, string>>({});

    const days = useMemo(() => {
        const arr: Date[] = [];
        const curr = new Date(periodStart);
        while (curr <= periodEnd) { arr.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }
        return arr;
    }, [periodStart, periodEnd]);

    useEffect(() => {
        if (!isOpen) return;
        const init: Record<string, string> = {};
        team.memberChapas.forEach(chapa => {
            days.forEach(day => {
                const dk = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                const h = plans[`${chapa}_${dk}`];
                if (h && h > 0) init[`${chapa}_${dk}`] = formatDecimalHours(h);
            });
        });
        setLocalValues(init);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, team.id]);

    const getMemberTotal = (chapa: string): number =>
        days.reduce((sum, day) => {
            const dk = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            return sum + parseTimeToDecimal(localValues[`${chapa}_${dk}`] || '0');
        }, 0);

    const handleInputChange = (chapa: string, dk: string, value: string) => {
        setLocalValues(prev => ({ ...prev, [`${chapa}_${dk}`]: value }));
    };

    const handleSaveClick = async () => {
        setSaving(true);
        const numericMap: Record<string, number> = {};
        team.memberChapas.forEach(chapa => {
            days.forEach(day => {
                const dk = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                numericMap[`${chapa}_${dk}`] = parseTimeToDecimal(localValues[`${chapa}_${dk}`] || '0');
            });
        });
        await onSave(team.id, numericMap);
        setSaving(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] overflow-hidden flex flex-col max-h-[92vh]">
                <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="text-lg font-bold">{team.name}</h3>
                        <p className="text-blue-200 text-xs mt-0.5">
                            CC: {team.costCenter} • Gestor: {team.managerName || 'N/A'} • Período: {periodStart.toLocaleDateString('pt-BR')} → {periodEnd.toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-auto">
                    {team.memberChapas.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            <Users size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="font-bold">Nenhum membro nesta equipe.</p>
                            <p className="text-sm mt-1">Use o botão + na lista de turmas para adicionar colaboradores.</p>
                        </div>
                    ) : (
                        <table className="border-collapse text-xs" style={{ minWidth: `${(days.length + 2) * 56}px` }}>
                            <thead className="sticky top-0 z-20">
                                <tr>
                                    <th className="sticky left-0 z-30 bg-slate-100 px-4 py-2 text-left font-black text-slate-700 border-b border-r border-slate-200 min-w-[200px]">
                                        Colaborador
                                    </th>
                                    {days.map(day => {
                                        const isSun = day.getDay() === 0;
                                        const isSat = day.getDay() === 6;
                                        return (
                                            <th key={day.toISOString()} className={`px-1 py-2 text-center font-bold border-b border-slate-200 w-12 min-w-[44px] ${isSun ? 'bg-red-100 text-red-700' : isSat ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                                                <div className="text-[11px]">{day.getDate()}</div>
                                                <div className="text-[9px] font-normal opacity-70">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][day.getDay()]}</div>
                                            </th>
                                        );
                                    })}
                                    <th className="bg-slate-100 px-3 py-2 text-center font-black text-slate-700 border-b border-l-2 border-slate-300 min-w-[72px]">
                                        Total
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {team.memberChapas.map(chapa => {
                                    const name = memberNames[chapa] || chapa;
                                    const total = getMemberTotal(chapa);
                                    const isOver = total > 44;
                                    return (
                                        <tr key={chapa} className="hover:bg-slate-50/70 border-b border-slate-100 group">
                                            <td className="sticky left-0 bg-white px-4 py-1.5 border-r border-slate-200 z-10 flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-slate-800 leading-tight">{name}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{memberFuncoes[chapa] || '—'}</p>
                                                </div>
                                                <button
                                                    onClick={() => onRemoveMember(team.id, chapa)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                                    title="Remover da Turma"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                            {days.map(day => {
                                                const dk = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                                                const key = `${chapa}_${dk}`;
                                                const strVal = localValues[key] || '';
                                                const isSun = day.getDay() === 0;
                                                const isSat = day.getDay() === 6;
                                                const hasValue = parseTimeToDecimal(strVal) > 0;
                                                const recordStatus = planStatuses[key] || 'approved'; // Retrocompatibilidade: sem status assume-se approved
                                                const isLocked = !canOverrideLock && (recordStatus === 'approved' || recordStatus === 'pending');

                                                return (
                                                    <td key={dk} className={`px-0.5 py-1 text-center ${isSun ? 'bg-red-50' : isSat ? 'bg-orange-50' : ''}`}>
                                                        <input
                                                            type="text"
                                                            value={strVal}
                                                            onChange={e => handleInputChange(chapa, dk, e.target.value)}
                                                            className={`w-10 text-center text-[11px] border rounded px-1 py-0.5 outline-none font-mono transition-colors 
                                                                ${hasValue ? 'border-blue-300 bg-blue-50 text-blue-800 font-bold' : 'border-gray-200 bg-white text-gray-300'}
                                                                ${isLocked ? 'cursor-not-allowed opacity-60 bg-gray-100 ring-1 ring-gray-300' : 'focus:ring-1 focus:ring-blue-400'}
                                                            `}
                                                            placeholder="--"
                                                            disabled={isLocked}
                                                            title={isLocked ? `Status: ${recordStatus}. Apenas aprovadores podem editar.` : undefined}
                                                        />
                                                    </td>
                                                );
                                            })}
                                            <td className={`px-3 py-1.5 text-center font-black font-mono border-l-2 border-slate-300 ${isOver ? 'text-red-600 bg-red-50' : 'text-emerald-700'}`}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <span>{formatDecimalHours(total)}</span>
                                                    {isOver && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle size={11} className="text-amber-500" />
                        Colaboradores acima de 44h totais são destacados em vermelho
                    </p>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg transition-colors">Fechar</button>
                        <button
                            onClick={handleSaveClick}
                            disabled={saving || team.memberChapas.length === 0}
                            className="px-5 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
                            Salvar Planejamento
                        </button>
                    </div>
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
    const [activeSubTab, setActiveSubTab] = useState<'PLANNING' | 'APPROVAL'>('PLANNING');

    const [ccFilter, setCcFilter] = useState<string>('');
    const [regionalFilter, setRegionalFilter] = useState<string>('');
    const [isBudgetManagerOpen, setIsBudgetManagerOpen] = useState(false);

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
    const [planStatuses, setPlanStatuses] = useState<Record<string, string>>({});
    const [salaries, setSalaries] = useState<Record<string, number>>({});
    const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Teams State
    const [teams, setTeams] = useState<WorkTeam[]>([]);
    const [allocations, setAllocations] = useState<TeamAllocation[]>([]);
    const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
    const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
    const [teamPlanModalId, setTeamPlanModalId] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<{ name: string, chapa: string } | null>(null);

    // Global Employees Dictionary
    const [globalEmployees, setGlobalEmployees] = useState<GlobalEmployee[]>(() => getGlobalEmployeesSync());

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

        // Background refresh for global employees
        getGlobalEmployeesAsync().then(emps => setGlobalEmployees(emps)).catch(console.error);
    }, []);

    // UPSERT Global Employees silently
    useEffect(() => {
        if (employees.length === 0 && manualEmployees.length === 0) return;

        const currentGlobalMap = new Map(globalEmployees.map(e => [e.chapa, e]));
        const newGlobalEmps: GlobalEmployee[] = [];
        let hasChanges = false;

        employees.forEach(e => {
            if (!e.CHAPA) return;
            const existing = currentGlobalMap.get(e.CHAPA);
            if (!existing || existing.nome !== e.NOME || existing.funcao !== e.FUNCAO || existing.costCenter !== e.CODCCUSTO) {
                newGlobalEmps.push({
                    chapa: e.CHAPA,
                    nome: e.NOME || '',
                    funcao: e.FUNCAO || '',
                    costCenter: e.CODCCUSTO || ''
                });
                hasChanges = true;
                currentGlobalMap.set(e.CHAPA, newGlobalEmps[newGlobalEmps.length - 1]); // locally mark as added
            }
        });

        manualEmployees.forEach(m => {
            if (!m.chapa) return;
            const existing = currentGlobalMap.get(m.chapa);
            if (!existing || existing.nome !== m.name || existing.costCenter !== m.costCenter) {
                newGlobalEmps.push({
                    chapa: m.chapa,
                    nome: m.name,
                    funcao: existing?.funcao || 'Manual',
                    costCenter: m.costCenter
                });
                hasChanges = true;
                currentGlobalMap.set(m.chapa, newGlobalEmps[newGlobalEmps.length - 1]);
            }
        });

        if (hasChanges && newGlobalEmps.length > 0) {
            saveGlobalEmployees(newGlobalEmps, user).then(() => {
                setGlobalEmployees(Array.from(currentGlobalMap.values()));
            }).catch(console.error);
        }
    }, [employees, manualEmployees, globalEmployees.length, user]);

    useEffect(() => {
        const cached = getTeamAllocationsSync();
        setAllocations(cached);
        const loadAllocs = async () => {
            const alls = await getTeamAllocations(selectedMonth, user);
            setAllocations(prev => {
                const map = new Map(prev.map(a => [a.id, a]));
                alls.forEach(a => map.set(a.id, a));
                return Array.from(map.values());
            });
        };
        loadAllocs();
    }, [selectedMonth, user]);

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
            const statusMap: Record<string, string> = {};
            records.forEach(r => {
                const key = mode === 'MONTHLY' ? r.chapa : `${r.chapa}_${r.date}`;
                planMap[key] = r.plannedHours;
                statusMap[key] = r.status || 'approved'; // Retrocompatibilidade global
            });
            setPlans(planMap);
            setPlanStatuses(statusMap);
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

    const handleAddMembers = async (chapas: string[]) => {
        if (!addMemberTeamId) return;
        const teamId = addMemberTeamId;

        let alloc = allocations.find(a => a.teamId === teamId && a.monthKey === selectedMonth);
        if (!alloc) {
            alloc = {
                id: crypto.randomUUID(),
                teamId: teamId,
                monthKey: selectedMonth,
                chapas: []
            };
        }

        const newMembers = [...new Set([...alloc.chapas, ...chapas])];
        const updatedAlloc = { ...alloc, chapas: newMembers };

        setAllocations(prev => {
            const other = prev.filter(a => a.id !== updatedAlloc.id);
            return [...other, updatedAlloc];
        });

        await saveTeamAllocations([updatedAlloc], user);
        setAddMemberTeamId(null);
        setAlert({ type: 'success', message: 'Membros adicionados à turma!' });
    };

    const handleApproveCC = async (cc: string) => {
        setSaving(true);
        try {
            // Get all records for this CC and Month that are 'pending'
            const startMonthStr = formatDateKey(periodStart).slice(0, 7);
            const endMonthStr = formatDateKey(periodEnd).slice(0, 7);

            let allRecs = await getPlanning(undefined, startMonthStr, mode === 'MONTHLY' ? 'MONTHLY' : 'DAILY');
            if (startMonthStr !== endMonthStr) {
                const recs2 = await getPlanning(undefined, endMonthStr, mode === 'MONTHLY' ? 'MONTHLY' : 'DAILY');
                allRecs = [...allRecs, ...recs2];
            }

            const pendingRecs = allRecs.filter(r => r.costCenter === cc && r.status === 'pending');
            if (pendingRecs.length === 0) {
                setAlert({ type: 'error', message: 'Nenhum registro pendente para este Centro de Custo.' });
                return;
            }

            const approvedRecs = pendingRecs.map(r => ({
                ...r,
                status: 'approved' as const,
                approvedBy: user.email,
                approvedAt: new Date().toISOString()
            }));

            await savePlanning(approvedRecs, user);

            // Refresh local state
            const newPlans = { ...plans };
            const newStatuses = { ...planStatuses };
            approvedRecs.forEach(r => {
                const key = mode === 'MONTHLY' ? r.chapa : `${r.chapa}_${r.date}`;
                newStatuses[key] = 'approved';
            });
            setPlanStatuses(newStatuses);

            setAlert({ type: 'success', message: `Planejamento de ${cc} aprovado com sucesso!` });
        } catch (error) {
            console.error(error);
            setAlert({ type: 'error', message: 'Erro ao aprovar planejamento.' });
        } finally {
            setSaving(false);
        }
    };

    const handleRejectCC = async (cc: string) => {
        setSaving(true);
        try {
            const startMonthStr = formatDateKey(periodStart).slice(0, 7);
            const endMonthStr = formatDateKey(periodEnd).slice(0, 7);

            let allRecs = await getPlanning(undefined, startMonthStr, mode === 'MONTHLY' ? 'MONTHLY' : 'DAILY');
            if (startMonthStr !== endMonthStr) {
                const recs2 = await getPlanning(undefined, endMonthStr, mode === 'MONTHLY' ? 'MONTHLY' : 'DAILY');
                allRecs = [...allRecs, ...recs2];
            }

            const pendingRecs = allRecs.filter(r => r.costCenter === cc && r.status === 'pending');
            const rejectedRecs = pendingRecs.map(r => ({
                ...r,
                status: 'draft' as const // Returning to draft so they can edit
            }));

            await savePlanning(rejectedRecs, user);

            // Refresh local state
            const newStatuses = { ...planStatuses };
            rejectedRecs.forEach(r => {
                const key = mode === 'MONTHLY' ? r.chapa : `${r.chapa}_${r.date}`;
                newStatuses[key] = 'draft';
            });
            setPlanStatuses(newStatuses);

            setAlert({ type: 'success', message: `Planejamento de ${cc} devolvido para ajuste.` });
        } catch (error) {
            console.error(error);
            setAlert({ type: 'error', message: 'Erro ao rejeitar planejamento.' });
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveMember = async (teamId: string, chapa: string) => {
        let alloc = allocations.find(a => a.teamId === teamId && a.monthKey === selectedMonth);
        if (!alloc) return;

        const newMembers = alloc.chapas.filter(c => c !== chapa);
        const updatedAlloc = { ...alloc, chapas: newMembers };

        setAllocations(prev => {
            const other = prev.filter(a => a.id !== updatedAlloc.id);
            return [...other, updatedAlloc];
        });

        await saveTeamAllocations([updatedAlloc], user);
        setAlert({ type: 'success', message: 'Membro removido da turma!' });
    };

    const handleClonePreviousMonth = async () => {
        const parts = selectedMonth.split('-');
        let year = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10) - 1;
        if (month === 0) {
            month = 12;
            year -= 1;
        }
        const prevMonthKey = `${year}-${String(month).padStart(2, '0')}`;

        const prevAllocs = await getTeamAllocations(prevMonthKey, user);
        if (prevAllocs.length === 0) {
            setAlert({ type: 'error', message: `Nenhuma alocação encontrada em ${prevMonthKey}.` });
            return;
        }

        const newAllocs: TeamAllocation[] = prevAllocs.map(a => ({
            id: crypto.randomUUID(),
            teamId: a.teamId,
            monthKey: selectedMonth,
            chapas: [...a.chapas]
        }));

        setAllocations(prev => {
            // Remove as antigas do mês selecionado
            const other = prev.filter(a => a.monthKey !== selectedMonth);
            return [...other, ...newAllocs];
        });

        await saveTeamAllocations(newAllocs, user);
        setAlert({ type: 'success', message: `Copiadas ${newAllocs.length} equipes de ${prevMonthKey}!` });
    };

    // FILTERED TEAMS (Moved up so it can be used by handleTeamPlanSave)
    const displayTeams = useMemo(() => {
        return teams.map(t => {
            const alloc = allocations.find(a => a.teamId === t.id && a.monthKey === selectedMonth);
            return {
                ...t,
                memberChapas: alloc ? alloc.chapas : [] // Aqui ocorre o versionamento temporal
            };
        }).filter(t => {
            const matchesCC = !ccFilter || t.costCenter === ccFilter;
            const teamRegional = getRegional(t.costCenter);
            const matchesRegional = !regionalFilter || teamRegional === regionalFilter;
            const isAuthorized = user.role === 'CH_COSTCENTER_PLANNER' ? t.costCenter === user.costCenter : true;
            return matchesCC && matchesRegional && isAuthorized;
        });
    }, [teams, allocations, selectedMonth, ccFilter, regionalFilter, user]);

    // Helper to get Employee Object
    const getEmpObj = (chapa: string) => uniqueEmployees.find(e => e.chapa === chapa);

    const handleTeamPlanSave = async (teamId: string, numericMap: Record<string, number>) => {
        // Usa `displayTeams` para acessar a WorkTeam já injetada com os `memberChapas` temporais do mês selecionado
        const team = displayTeams.find(t => t.id === teamId);
        if (!team) return;
        // Merge into plans state
        setPlans(prev => ({ ...prev, ...numericMap }));
        // Build PlanningRecord[] only for this team's members
        const mergedPlans = { ...plans, ...numericMap };
        const recordsToSave: PlanningRecord[] = [];
        team.memberChapas.forEach(chapa => {
            const emp = getEmpObj(chapa);
            if (!emp) return;
            const curr = new Date(periodStart);
            while (curr <= periodEnd) {
                const dateKey = formatDateKey(curr);
                const key = `${chapa}_${dateKey}`;
                const hours = mergedPlans[key];
                if (hours !== undefined) {
                    recordsToSave.push({
                        id: `${chapa}_DAILY_${dateKey}`,
                        chapa,
                        nome: emp.nome,
                        costCenter: team.costCenter,
                        date: dateKey,
                        type: 'DAILY',
                        plannedHours: hours,
                        status: 'draft'
                    });
                }
                curr.setDate(curr.getDate() + 1);
            }
        });
        await savePlanning(recordsToSave, user);
        setAlert({ type: 'success', message: `Planejamento da ${team.name} salvo!` });
    };

    // Calculate Global Stats (Filtered)
    const filteredEmployeesForStats = useMemo(() => {
        return uniqueEmployees.filter(e => {
            const reg = e.regional;
            const matchesCC = !ccFilter || e.cc === ccFilter;
            const matchesRegional = !regionalFilter || reg === regionalFilter;
            const isAuthorized = user.role === 'CH_COSTCENTER_PLANNER' ? e.cc === user.costCenter : true;
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
            const isAuthorized = user.role === 'CH_COSTCENTER_PLANNER' ? b.costCenter === user.costCenter : true;
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

                json.forEach((row: any, index: number) => {
                    if (index === 0 && (String(row[0]).toLowerCase().includes('mês'))) return;
                    const monthName = String(row[0] || '').trim();
                    const costCenter = String(row[1] || '').trim().replace(/\./g, ''); // normaliza: remove pontos
                    let budgetVal = row[2];
                    // Coluna D: ano (opcional, fallback para ano atual)
                    const yearRaw = row[3];
                    const year = yearRaw && !isNaN(Number(yearRaw)) ? Number(yearRaw) : new Date().getFullYear();

                    if (typeof budgetVal === 'string') budgetVal = parseFloat(budgetVal.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
                    if (monthName && costCenter && !isNaN(budgetVal)) {
                        const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
                        const monthKey = monthIndex >= 0 ? `${year}-${String(monthIndex + 1).padStart(2, '0')}` : selectedMonth;
                        newBudgets.push({ month: monthName, monthKey, costCenter, value: budgetVal });
                        count++;
                    }
                });

                if (count > 0) {
                    saveBudgets(newBudgets, user);
                    setBudgets(prev => {
                        // Merge: keep existing records for other monthKeys
                        const existingKeys = new Set(newBudgets.map(b => b.monthKey));
                        const retained = prev.filter(b => !existingKeys.has(b.monthKey));
                        return [...retained, ...newBudgets];
                    });
                    setAlert({ type: 'success', message: `${count} registros de budget importados!` });
                } else {
                    setAlert({ type: 'error', message: "Erro budget: nenhuma linha válida encontrada." });
                }
            } catch (err) { setAlert({ type: 'error', message: "Falha ao ler arquivo de budget." }); }
        };
        reader.readAsBinaryString(file);
        if (budgetInputRef.current) budgetInputRef.current.value = '';
    };

    const handleSave = async (submitPending: boolean = false) => {
        setSaving(true);
        const statusFlag: 'draft' | 'pending' = submitPending ? 'pending' : 'draft';
        const recordsToSave: PlanningRecord[] = [];
        uniqueEmployees.forEach(emp => {
            if (mode === 'MONTHLY') {
                const hours = plans[emp.chapa];
                if (hours !== undefined) {
                    recordsToSave.push({ id: `${emp.chapa}_MONTHLY_${selectedMonth}`, chapa: emp.chapa, nome: emp.nome, costCenter: emp.cc, date: selectedMonth, type: 'MONTHLY', plannedHours: hours, status: statusFlag });
                }
            } else {
                const curr = new Date(periodStart);
                while (curr <= periodEnd) {
                    const dateKey = formatDateKey(curr);
                    const key = `${emp.chapa}_${dateKey}`;
                    const hours = plans[key];
                    if (hours !== undefined) {
                        recordsToSave.push({ id: `${emp.chapa}_DAILY_${dateKey}`, chapa: emp.chapa, nome: emp.nome, costCenter: emp.cc, date: dateKey, type: 'DAILY', plannedHours: hours, status: statusFlag });
                    }
                    curr.setDate(curr.getDate() + 1);
                }
            }
        });
        await savePlanning(recordsToSave, user);
        setSaving(false);
        setAlert({ type: 'success', message: submitPending ? 'Planejamento submetido para aprovação!' : 'Rascunho salvo!' });
    };

    const handleEmployeeClick = (emp: { nome: string; chapa: string }) => {
        setSelectedEmployee({ name: emp.nome, chapa: emp.chapa });
        setModalOpen(true);
    };

    // FILTERED TEAMS
    // displayTeams was moved above to be accessible by handleTeamPlanSave

    // Colaboradores disponíveis para adicionar à equipe selecionada
    // Filtrados pelo CC da equipe e excluindo quem já é membro
    const availableForTeam = useMemo(() => {
        if (!addMemberTeamId) return uniqueEmployees;
        const team = teams.find(t => t.id === addMemberTeamId);
        if (!team) return uniqueEmployees;
        return uniqueEmployees.filter(e =>
            e.cc === team.costCenter && !team.memberChapas.includes(e.chapa)
        );
    }, [addMemberTeamId, teams, uniqueEmployees]);

    // Mapa chapa→nome para o TeamPlanModal
    // Usa a lista bruta de employees como fonte primária para garantir cobertura total e consulta o Global Dictionary
    const memberNames = useMemo(() => {
        const map: Record<string, string> = {};
        globalEmployees.forEach(e => { if (e.chapa && e.nome) map[e.chapa] = e.nome; });
        employees.forEach(e => { if (e.CHAPA && e.NOME) map[e.CHAPA] = e.NOME; });
        uniqueEmployees.forEach(e => { if (e.chapa && e.nome) map[e.chapa] = e.nome; });
        return map;
    }, [globalEmployees, employees, uniqueEmployees]);

    // Mapa chapa→cargo para o TeamPlanModal
    const memberFuncoes = useMemo(() => {
        const map: Record<string, string> = {};
        globalEmployees.forEach(e => { if (e.chapa && e.funcao) map[e.chapa] = e.funcao; });
        employees.forEach(e => { if (e.CHAPA && e.FUNCAO) map[e.CHAPA] = e.FUNCAO; });
        return map;
    }, [globalEmployees, employees]);


    const teamPlanModalTeam = displayTeams.find(t => t.id === teamPlanModalId) || null;

    return (
        <div className="space-y-6">
            <BudgetManagerModal
                isOpen={isBudgetManagerOpen}
                onClose={() => setIsBudgetManagerOpen(false)}
                user={user}
                onRefresh={() => {
                    const storedBudgets = getBudgetsSync();
                    setBudgets(storedBudgets);
                }}
            />
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
                availableEmployees={availableForTeam}
            />

            {teamPlanModalTeam && (
                <TeamPlanModal
                    isOpen={!!teamPlanModalId}
                    onClose={() => setTeamPlanModalId(null)}
                    team={teamPlanModalTeam}
                    memberNames={memberNames}
                    memberFuncoes={memberFuncoes}
                    plans={plans}
                    salaries={salaries}
                    periodStart={periodStart}
                    periodEnd={periodEnd}
                    onSave={handleTeamPlanSave}
                    onRemoveMember={handleRemoveMember}
                    planStatuses={planStatuses}
                    canOverrideLock={(user.role === 'CH_ADMIN' || user.role === 'CH_APPROVER')}
                />
            )}

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

            {canApprove(user.role) && (
                <div className="flex border-b border-slate-200 mb-6 bg-white rounded-t-xl overflow-hidden shadow-sm">
                    <button
                        onClick={() => setActiveSubTab('PLANNING')}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeSubTab === 'PLANNING' ? 'bg-blue-600 text-white shadow-inner' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <LayoutList size={18} /> Elaboração de Escalas
                    </button>
                    <button
                        onClick={() => setActiveSubTab('APPROVAL')}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeSubTab === 'APPROVAL' ? 'bg-indigo-600 text-white shadow-inner' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <CheckCircle2 size={18} /> Aprovação / Liberação
                    </button>
                </div>
            )}

            {activeSubTab === 'APPROVAL' ? (
                <ApprovalPanel
                    records={displayTeams.map(team => {
                        const teamEmployees = team.memberChapas
                            .map(chapa => getEmpObj(chapa))
                            .filter(e => !!e);

                        let totalHours = 0;
                        let totalCost = 0;
                        let hasPending = false;
                        let hasDraft = false;

                        teamEmployees.forEach((emp: any) => {
                            const salary = salaries[emp.chapa];
                            if (mode === 'MONTHLY') {
                                const hours = plans[emp.chapa] || 0;
                                totalHours += hours;
                                if (salary) totalCost += (salary / 220) * 1.6 * hours;
                                const st = planStatuses[emp.chapa] || 'approved';
                                if (st === 'pending') hasPending = true;
                                if (st === 'draft' && hours > 0) hasDraft = true;
                            } else {
                                const curr = new Date(periodStart);
                                while (curr <= periodEnd) {
                                    const dateKey = formatDateKey(curr);
                                    const key = `${emp.chapa}_${dateKey}`;
                                    const hours = plans[key] || 0;
                                    totalHours += hours;
                                    if (salary && hours > 0) {
                                        const isSunday = curr.getDay() === 0;
                                        const baseHour = salary / 220;
                                        const multiplier = isSunday ? 2.0 : 1.6;
                                        totalCost += baseHour * multiplier * hours;
                                    }
                                    const st = planStatuses[key] || 'approved';
                                    if (st === 'pending') hasPending = true;
                                    if (st === 'draft' && hours > 0) hasDraft = true;
                                    curr.setDate(curr.getDate() + 1);
                                }
                            }
                        });

                        const teamStatus = hasPending ? 'pending' : (hasDraft ? 'draft' : 'approved');

                        return {
                            id: team.id,
                            description: team.name,
                            costCenter: team.costCenter,
                            headcount: team.memberChapas.length,
                            plannedHours: totalHours,
                            customEstCost: totalCost,
                            estStatus: teamStatus,
                            date: selectedMonth,
                            shift: team.managerName || 'Integral'
                        };
                    })}
                    onApprove={handleApproveCC}
                    onReject={handleRejectCC}
                />
            ) : (
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
                            <button onClick={handleClonePreviousMonth} className="bg-white text-emerald-600 border border-emerald-200 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-tight hover:bg-emerald-50 transition-colors flex items-center gap-2 shadow-sm">
                                <Users size={16} /> Copiar Mês Anterior
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-3 w-full xl:w-auto justify-end">
                            {(user.role === 'CH_ADMIN') && (
                                <>
                                    <input type="file" ref={salaryInputRef} onChange={handleSalaryImport} accept=".xlsx,.xls,.csv,.txt" className="hidden" />
                                    <button onClick={() => salaryInputRef.current?.click()} className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-indigo-50 flex items-center gap-2 shadow-sm">
                                        <FileUp size={16} /> Salários
                                    </button>
                                    <input type="file" ref={budgetInputRef} onChange={handleBudgetImport} accept=".xlsx,.xls" className="hidden" />
                                    <button onClick={() => budgetInputRef.current?.click()} className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-indigo-50 flex items-center gap-2 shadow-sm">
                                        <FileUp size={16} /> Importar Budget
                                    </button>
                                    <button onClick={() => setIsBudgetManagerOpen(true)} className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-indigo-50 flex items-center gap-2 shadow-sm">
                                        <Wallet size={16} /> Gerenciar Budgets
                                    </button>
                                </>
                            )}
                            <button onClick={() => handleSave(false)} disabled={saving} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-bold uppercase hover:bg-gray-200 transition flex items-center gap-2 shadow-sm">
                                <Save size={18} /> Salvar Rascunho
                            </button>
                            <button onClick={() => {
                                if (window.confirm("Atenção: Enviar os dados limitará a edição futura desses centros de custo. Deseja prosseguir?")) {
                                    handleSave(true);
                                }
                            }} disabled={saving} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase hover:bg-blue-700 transition flex items-center gap-2 shadow-md">
                                {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle2 size={18} />} Enviar P/ Aprovar
                            </button>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 min-h-[400px]">
                        <PlanningTable
                            records={displayTeams.map(team => {
                                const teamEmployees = team.memberChapas
                                    .map(chapa => getEmpObj(chapa))
                                    .filter(e => !!e);

                                let totalHours = 0;
                                let totalCost = 0;

                                teamEmployees.forEach((emp: any) => {
                                    const salary = salaries[emp.chapa];
                                    if (mode === 'MONTHLY') {
                                        const hours = plans[emp.chapa] || 0;
                                        totalHours += hours;
                                        if (salary) totalCost += (salary / 220) * 1.6 * hours;
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
                                                totalCost += baseHour * multiplier * hours;
                                            }
                                            curr.setDate(curr.getDate() + 1);
                                        }
                                    }
                                });

                                return {
                                    id: team.id,
                                    description: team.name,
                                    costCenter: team.costCenter,
                                    headcount: team.memberChapas.length,
                                    plannedHours: totalHours,
                                    customEstCost: totalCost,
                                    date: selectedMonth,
                                    shift: team.managerName || 'Integral'
                                };
                            })}
                            onDelete={handleDeleteTeam}
                            onAddMember={setAddMemberTeamId}
                            onPlanTeam={setTeamPlanModalId}
                            salariesMap={salaries}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Planning;

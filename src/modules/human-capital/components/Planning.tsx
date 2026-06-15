import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { OvertimeRecord, UserProfile, PlanningRecord, BudgetRecord, ManualEmployee, GlobalEmployee, HeadcountRecord } from '../types';
import { savePlanning, getPlanning, getSalaries, getSalariesSync, saveBudgets, getBudgetsSync, getAllBudgetsAsync, deleteBudgets, deleteAllBudgets, saveGlobalEmployees, getGlobalEmployeesAsync, getGlobalEmployeesSync, getAllPlanningRecordsFromFirestore } from '../services/planning';
import { canApprove, canManageBudgets } from '../../iam/types';
import { ApprovalPanel } from './ApprovalPanel';
import { getCCName, getCCRegional } from '../data/ccMaster';
import { isRecordInHumanCapitalScope } from '../utils/scopeFilters';

import { Users, Wallet, TrendingUp, Calculator, CheckCircle2, AlertTriangle, X, ChevronLeft, ChevronRight, Save, FileUp, FileDown, ArrowUpRight, ArrowDownRight, LayoutList, Trash2, Mail, Copy } from 'lucide-react';
import { formatDecimalHours, parseTimeToDecimal } from '../utils/formatters';
import * as XLSX from 'xlsx';
import { PlanningTable } from './PlanningTable';

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
    headcountRecords?: HeadcountRecord[];
}

interface EmailDraftSummaryItem {
    costCenter: string;
    costCenterName: string;
    regional: string;
    headcount: number;
    totalHours: number;
    totalCost: number;
}

interface EmailDraftEmployeeItem {
    chapa: string;
    name: string;
    role: string;
    costCenter: string;
    costCenterName: string;
    daysPlanned: number;
    totalHours: number;
}

interface EmailDraftData {
    subject: string;
    body: string;
    periodLabel: string;
    monthLabel: string;
    totalHours: number;
    totalCost: number;
    totalHeadcount: number;
    items: EmailDraftSummaryItem[];
    employees: EmailDraftEmployeeItem[];
}

const parseDateKeyLocal = (value: string): Date => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
};

const formatDateBR = (value: string): string => {
    if (!value) return '-';
    return parseDateKeyLocal(value).toLocaleDateString('pt-BR');
};

const formatCurrencyBR = (value: number): string =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const resolvePlanningRange = (
    fallbackStart: string,
    fallbackEnd: string,
    selectedStart?: string,
    selectedEnd?: string
) => {
    const rawStart = selectedStart || fallbackStart;
    const rawEnd = selectedEnd || fallbackEnd;

    if (!rawStart || !rawEnd) {
        return { start: fallbackStart, end: fallbackEnd };
    }

    return rawStart <= rawEnd
        ? { start: rawStart, end: rawEnd }
        : { start: rawEnd, end: rawStart };
};

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
            const dateKey = formatDateKey(day);
            // Sum hours across all cost centers for this chapa on this day
            const hours = Object.entries(plans).reduce((sum, [k, v]) => {
                if (k.startsWith(`${chapa}_`) && k.endsWith(`_${dateKey}`)) return sum + v;
                return sum;
            }, 0);
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
                            // Sum hours across all cost centers for rendering
                            const hours = Object.entries(plans).reduce((sum, [k, v]) => {
                                if (k.startsWith(`${chapa}_`) && k.endsWith(`_${dateKey}`)) return sum + v;
                                return sum;
                            }, 0);
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

const EmailDraftModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    draft: EmailDraftData | null;
    onCopy: (text: string, label: string) => void | Promise<void>;
}> = ({ isOpen, onClose, draft, onCopy }) => {
    if (!isOpen) return null;

    const fullEmailText = draft ? `Assunto: ${draft.subject}\n\n${draft.body}` : '';

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Mail size={18} />
                            Rascunho de E-mail
                        </h3>
                        <p className="text-slate-300 text-xs mt-0.5">
                            Texto pronto para o gestor copiar e colar na solicitacao de aprovacao.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Fechar">
                        <X size={20} />
                    </button>
                </div>

                {!draft ? (
                    <div className="p-8 text-center text-slate-500">
                        <Mail size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-bold text-slate-700">Nao ha dados suficientes para gerar o e-mail.</p>
                        <p className="text-sm mt-1">Inclua horas no periodo selecionado e tente novamente.</p>
                    </div>
                ) : (
                    <>
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Competencia</span>
                                <span className="text-sm font-bold text-slate-700">{draft.monthLabel}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Periodo</span>
                                <span className="text-sm font-bold text-slate-700">{draft.periodLabel}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Horas</span>
                                <span className="text-sm font-bold text-slate-700">{formatDecimalHours(draft.totalHours)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Custo Estimado</span>
                                <span className="text-sm font-bold text-emerald-700">{formatCurrencyBR(draft.totalCost)}</span>
                            </div>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-4">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assunto</label>
                                    <button
                                        onClick={() => onCopy(draft.subject, 'Assunto do e-mail')}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50"
                                    >
                                        <Copy size={14} />
                                        Copiar assunto
                                    </button>
                                </div>
                                <input
                                    readOnly
                                    value={draft.subject}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-4">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Corpo</label>
                                    <button
                                        onClick={() => onCopy(draft.body, 'Corpo do e-mail')}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50"
                                    >
                                        <Copy size={14} />
                                        Copiar corpo
                                    </button>
                                </div>
                                <textarea
                                    readOnly
                                    value={draft.body}
                                    rows={18}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none resize-none whitespace-pre-wrap"
                                />
                            </div>

                            <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Resumo Consolidado</p>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-100 text-slate-500">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-[10px]">Centro de Custo</th>
                                                <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-[10px]">Regional</th>
                                                <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-[10px]">Efetivo</th>
                                                <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-[10px]">Horas</th>
                                                <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-[10px]">Custo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {draft.items.map(item => (
                                                <tr key={item.costCenter}>
                                                    <td className="px-4 py-3 text-slate-700 font-semibold">
                                                        {item.costCenter} - {item.costCenterName}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">{item.regional}</td>
                                                    <td className="px-4 py-3 text-right text-slate-700 font-mono">{item.headcount}</td>
                                                    <td className="px-4 py-3 text-right text-slate-700 font-mono">{formatDecimalHours(item.totalHours)}</td>
                                                    <td className="px-4 py-3 text-right text-emerald-700 font-mono font-bold">{formatCurrencyBR(item.totalCost)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Colaboradores Programados</p>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-100 text-slate-500">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-[10px]">Colaborador</th>
                                                <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-[10px]">Funcao</th>
                                                <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-[10px]">Centro de Custo</th>
                                                <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-[10px]">Dias</th>
                                                <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-[10px]">Horas</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {draft.employees.map(employee => (
                                                <tr key={`${employee.costCenter}_${employee.chapa}`}>
                                                    <td className="px-4 py-3 text-slate-700 font-semibold">{employee.name}</td>
                                                    <td className="px-4 py-3 text-slate-500">{employee.role}</td>
                                                    <td className="px-4 py-3 text-slate-500">{employee.costCenter} - {employee.costCenterName}</td>
                                                    <td className="px-4 py-3 text-right text-slate-700 font-mono">{employee.daysPlanned}</td>
                                                    <td className="px-4 py-3 text-right text-slate-700 font-mono">{formatDecimalHours(employee.totalHours)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                Colaboradores envolvidos: {draft.totalHeadcount} | Centros de custo: {draft.items.length}
                            </p>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                    onClick={onClose}
                                    className="flex-1 sm:flex-none px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Fechar
                                </button>
                                <button
                                    onClick={() => onCopy(fullEmailText, 'E-mail completo')}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    <Copy size={15} />
                                    Copiar e-mail completo
                                </button>
                            </div>
                        </div>
                    </>
                )}
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
        getAllBudgetsAsync(user).then(b => { setAllBudgets(b); setLoading(false); });
    }, [isOpen, user]);

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
};

// --- COST CENTER PLAN MODAL (Grade Membros × Dias) ---
const CostCenterPlanModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    costCenter: string;
    memberChapas: string[];
    memberNames: Record<string, string>;
    memberFuncoes: Record<string, string>;
    plans: Record<string, number>;
    periodStart: Date;
    periodEnd: Date;
    planRangeStart: string;
    planRangeEnd: string;
    onSave: (costCenter: string, localNums: Record<string, number>) => Promise<void>;
    planStatuses: Record<string, string>;
    canOverrideLock: boolean;
}> = ({ isOpen, onClose, costCenter, memberChapas, memberNames, memberFuncoes, plans, periodStart, periodEnd, planRangeStart, planRangeEnd, onSave, planStatuses, canOverrideLock }) => {
    const [saving, setSaving] = useState(false);
    const [localValues, setLocalValues] = useState<Record<string, string>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [showOnlySelected, setShowOnlySelected] = useState(false);
    const [showOnlyPlanned, setShowOnlyPlanned] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});

    const days = useMemo(() => {
        const arr: Date[] = [];
        const curr = new Date(periodStart);
        while (curr <= periodEnd) { arr.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }
        return arr;
    }, [periodStart, periodEnd]);

    useEffect(() => {
        if (!isOpen) return;
        const init: Record<string, string> = {};
        memberChapas.forEach(chapa => {
            days.forEach(day => {
                const dk = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                const key = `${chapa}_${costCenter}_${dk}`;
                const h = plans[key];
                if (h && h > 0) init[`${chapa}_${dk}`] = formatDecimalHours(h);
            });
        });
        setLocalValues(init);
    }, [isOpen, costCenter, memberChapas, days, plans]);

    useEffect(() => {
        if (!isOpen) return;
        setSearchTerm('');
        setRoleFilter('');
        setShowOnlySelected(false);
        setShowOnlyPlanned(false);
        setSelectedMembers({});
    }, [isOpen, costCenter]);

    const memberRoleLabels = useMemo(() => {
        const map: Record<string, string> = {};
        memberChapas.forEach(chapa => {
            map[chapa] = memberFuncoes[chapa] || 'Sem funcao cadastrada';
        });
        return map;
    }, [memberChapas, memberFuncoes]);

    const roleOptions = useMemo(() => {
        return Array.from(new Set(memberChapas.map(chapa => memberRoleLabels[chapa]).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    }, [memberChapas, memberRoleLabels]);

    const memberTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        memberChapas.forEach(chapa => {
            totals[chapa] = days.reduce((sum, day) => {
                const dk = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                return sum + parseTimeToDecimal(localValues[`${chapa}_${dk}`] || '0');
            }, 0);
        });
        return totals;
    }, [memberChapas, days, localValues]);

    const visibleMemberChapas = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return memberChapas.filter(chapa => {
            const name = (memberNames[chapa] || chapa).toLowerCase();
            const role = memberRoleLabels[chapa];
            const matchesSearch = !normalizedSearch || name.includes(normalizedSearch) || chapa.toLowerCase().includes(normalizedSearch);
            const matchesRole = !roleFilter || role === roleFilter;
            const matchesSelected = !showOnlySelected || !!selectedMembers[chapa];
            const matchesPlanned = !showOnlyPlanned || (memberTotals[chapa] || 0) > 0;
            return matchesSearch && matchesRole && matchesSelected && matchesPlanned;
        });
    }, [memberChapas, memberNames, memberRoleLabels, searchTerm, roleFilter, showOnlySelected, selectedMembers, showOnlyPlanned, memberTotals]);

    const selectedCount = useMemo(() => {
        return memberChapas.reduce((sum, chapa) => sum + (selectedMembers[chapa] ? 1 : 0), 0);
    }, [memberChapas, selectedMembers]);

    const handleInputChange = (chapa: string, dk: string, value: string) => {
        setLocalValues(prev => ({ ...prev, [`${chapa}_${dk}`]: value }));
    };

    const toggleMemberSelection = (chapa: string) => {
        setSelectedMembers(prev => ({ ...prev, [chapa]: !prev[chapa] }));
    };

    const handleSelectVisible = () => {
        setSelectedMembers(prev => {
            const next = { ...prev };
            visibleMemberChapas.forEach(chapa => {
                next[chapa] = true;
            });
            return next;
        });
    };

    const handleClearSelection = () => {
        setSelectedMembers({});
    };

    const handleSaveClick = async () => {
        setSaving(true);
        const numericMap: Record<string, number> = {};
        memberChapas.forEach(chapa => {
            days.forEach(day => {
                const dk = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                const fullKey = `${chapa}_${costCenter}_${dk}`;
                const numericVal = parseTimeToDecimal(localValues[`${chapa}_${dk}`] || '0');
                const existingHours = plans[fullKey] ?? 0;
                const existingStatus = planStatuses[fullKey] || 'draft';

                // FIX 4 — O modal só envia ao caller entradas com dados relevantes:
                // • Tem horas novas (> 0): sempre inclui.
                // • Tinha horas antes e agora está zerado E não é aprovado:
                //   usuário limpou explicitamente → inclui para apagar no Firestore.
                // • Aprovado com horas > 0 e valor do modal = 0: NÃO inclui
                //   (o usuário pode ter deixado o campo em branco, mas o registro
                //   aprovado é imutável — a guarda nas camadas 3C e 2 bloqueariam
                //   de qualquer forma, mas evitar envio é mais eficiente).
                const shouldInclude =
                    numericVal > 0 ||
                    (existingHours > 0 && existingStatus !== 'approved' && existingStatus !== 'pending');

                if (shouldInclude) {
                    numericMap[fullKey] = numericVal;
                }
            });
        });
        await onSave(costCenter, numericMap);
        setSaving(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] overflow-hidden flex flex-col max-h-[92vh]">
                <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="text-lg font-bold">Planejamento do Centro de Custo</h3>
                        <p className="text-blue-200 text-xs mt-0.5">
                            CC: {costCenter} • Período: {periodStart.toLocaleDateString('pt-BR')} a {periodEnd.toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Buscar</label>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Nome ou chapa"
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[220px]"
                                />
                            </div>

                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Funcao</label>
                                <select
                                    value={roleFilter}
                                    onChange={e => setRoleFilter(e.target.value)}
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[220px]"
                                >
                                    <option value="">Todas</option>
                                    {roleOptions.map(role => <option key={role} value={role}>{role}</option>)}
                                </select>
                            </div>

                            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={showOnlySelected}
                                    onChange={e => setShowOnlySelected(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                Somente selecionados
                            </label>

                            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={showOnlyPlanned}
                                    onChange={e => setShowOnlyPlanned(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                Somente com horas
                            </label>

                            <button
                                type="button"
                                onClick={handleSelectVisible}
                                disabled={visibleMemberChapas.length === 0}
                                className="px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Selecionar visiveis
                            </button>

                            <button
                                type="button"
                                onClick={handleClearSelection}
                                disabled={selectedCount === 0}
                                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Limpar selecao
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span>{visibleMemberChapas.length} de {memberChapas.length} colaboradores visiveis • {selectedCount} selecionados</span>
                            <span>Filtros e selecao afetam apenas a visualizacao. O salvamento preserva os demais colaboradores.</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    {memberChapas.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            <Users size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="font-bold">Nenhum colaborador encontrado neste Centro de Custo.</p>
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
                                {visibleMemberChapas.length === 0 && (
                                    <tr>
                                        <td colSpan={days.length + 2} className="px-4 py-10 text-center text-slate-400 font-medium">
                                            Nenhum colaborador corresponde aos filtros aplicados.
                                        </td>
                                    </tr>
                                )}

                                {visibleMemberChapas.map(chapa => {
                                    const name = memberNames[chapa] || chapa;
                                    const total = memberTotals[chapa] || 0;
                                    const isOver = total > 44;
                                    const isSelected = !!selectedMembers[chapa];
                                    return (
                                        <tr key={chapa} className={`hover:bg-slate-50/70 border-b border-slate-100 group ${isSelected ? 'bg-blue-50/60' : ''}`}>
                                            <td className="sticky left-0 bg-white px-4 py-1.5 border-r border-slate-200 z-10">
                                                <div className="flex items-start gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleMemberSelection(chapa)}
                                                        className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                        title="Selecionar colaborador"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-800 leading-tight">{name}</p>
                                                        <p className="text-[10px] text-slate-400 font-medium truncate max-w-[170px]">{memberRoleLabels[chapa]}</p>
                                                        <p className="text-[10px] text-slate-300 font-mono">{chapa}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            {days.map(day => {
                                                const dk = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                                                const key = `${chapa}_${dk}`;
                                                const strVal = localValues[key] || '';
                                                const isSun = day.getDay() === 0;
                                                const isSat = day.getDay() === 6;
                                                const hasValue = parseTimeToDecimal(strVal) > 0;
                                                const recordStatus = planStatuses[`${chapa}_${costCenter}_${dk}`] || 'draft';
                                                const hasRange = !!planRangeStart && !!planRangeEnd;
                                                const isOutsideRange = hasRange && (dk < planRangeStart || dk > planRangeEnd);
                                                const isLocked = (!canOverrideLock && (recordStatus === 'approved' || recordStatus === 'pending')) || isOutsideRange;

                                                return (
                                                    <td key={dk} className={`px-0.5 py-1 text-center ${isSun ? 'bg-red-50' : isSat ? 'bg-orange-50' : ''} ${isOutsideRange ? 'opacity-40 bg-slate-100' : ''}`}>
                                                        <input
                                                            type="text"
                                                            value={strVal}
                                                            onChange={e => handleInputChange(chapa, dk, e.target.value)}
                                                            className={`w-10 text-center text-[11px] border rounded px-1 py-0.5 outline-none font-mono transition-colors
                                                                ${hasValue ? 'border-blue-300 bg-blue-50 text-blue-800 font-bold' : 'border-gray-200 bg-white text-gray-300'}
                                                                ${isLocked ? 'cursor-not-allowed opacity-60 bg-gray-100 ring-1 ring-gray-300' : 'focus:ring-1 focus:ring-blue-400'}
                                                                ${isOutsideRange ? 'opacity-40 bg-slate-100 border-slate-200 text-slate-400' : ''}
                                                            `}
                                                            placeholder="--"
                                                            disabled={isLocked}
                                                            title={isOutsideRange ? 'Bloqueado: Fora do período selecionado' : (isLocked ? `Status: ${recordStatus}. Apenas aprovadores podem editar.` : undefined)}
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
                            disabled={saving || memberChapas.length === 0}
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

const Planning: React.FC<PlanningProps> = ({ user, employees, manualEmployees, headcountRecords = [] }) => {
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

    const payrollRangeStart = useMemo(() => formatDateKey(periodStart), [periodStart]);
    const payrollRangeEnd = useMemo(() => formatDateKey(periodEnd), [periodEnd]);

    const [planRangeStart, setPlanRangeStart] = useState<string>('');
    const [planRangeEnd, setPlanRangeEnd] = useState<string>('');
    const [submitRangeStart, setSubmitRangeStart] = useState<string>('');
    const [submitRangeEnd, setSubmitRangeEnd] = useState<string>('');

    useEffect(() => {
        setPlanRangeStart(payrollRangeStart);
        setPlanRangeEnd(payrollRangeEnd);
        setSubmitRangeStart(payrollRangeStart);
        setSubmitRangeEnd(payrollRangeEnd);
    }, [payrollRangeStart, payrollRangeEnd]);

    const submissionRange = useMemo(() => {
        return resolvePlanningRange(
            payrollRangeStart,
            payrollRangeEnd,
            submitRangeStart,
            submitRangeEnd
        );
    }, [payrollRangeStart, payrollRangeEnd, submitRangeStart, submitRangeEnd]);

    const isCustomSubmissionRange = submissionRange.start !== payrollRangeStart || submissionRange.end !== payrollRangeEnd;

    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(periodStart);
    useEffect(() => { setCurrentWeekStart(periodStart); }, [periodStart]);

    const [plans, setPlans] = useState<Record<string, number>>({});
    const [planStatuses, setPlanStatuses] = useState<Record<string, string>>({});
    const [salaries, setSalaries] = useState<Record<string, number>>({});
    const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const canManagePlanningBudgets = user.isSuperAdmin || canManageBudgets(user.role);
    const isAdministradorMaster = user.role === 'CH_ADMIN' || user.isSuperAdmin || (user.role as string) === 'DEV_MASTER' || (user.role as string) === 'MASTER';

    const handleExportPlanningJSON = async () => {
        setExporting(true);
        try {
            const records = await getAllPlanningRecordsFromFirestore();
            const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const downloadAnchor = document.createElement('a');
            downloadAnchor.href = url;
            downloadAnchor.download = `hc_planning_records_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            URL.revokeObjectURL(url);
            setAlert({ type: 'success', message: 'Coleção exportada com sucesso!' });
        } catch (error: any) {
            console.error("Erro ao exportar JSON:", error);
            setAlert({ type: 'error', message: `Erro ao exportar JSON: ${error.message}` });
        } finally {
            setExporting(false);
        }
    };

    const [ccPlanModalId, setCcPlanModalId] = useState<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<{ name: string, chapa: string } | null>(null);
    const [isEmailDraftOpen, setIsEmailDraftOpen] = useState(false);

    // Global Employees Dictionary
    const [globalEmployees, setGlobalEmployees] = useState<GlobalEmployee[]>(() => getGlobalEmployeesSync());

    const budgetInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (alert) {
            const timer = setTimeout(() => setAlert(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [alert]);

    const isAuthorizedCostCenter = useCallback(
        (costCenter: string) => isRecordInHumanCapitalScope(user, costCenter),
        [user]
    );

    const uniqueEmployees = useMemo(() => {
        const map = new Map<string, { nome: string; cc: string; chapa: string; regional: string }>();

        const dictName = new Map<string, string>();
        globalEmployees.forEach(e => { if (e.nome) dictName.set(e.chapa, e.nome); });
        employees.forEach(e => { if (e.NOME) dictName.set(e.CHAPA, e.NOME); });
        manualEmployees.forEach(m => {
            if (m.name && isAuthorizedCostCenter(m.costCenter)) {
                dictName.set(m.chapa, m.name);
            }
        });

        headcountRecords.forEach(h => {
            if (!isAuthorizedCostCenter(h.centroCusto)) return;
            if (h.chapa && String(h.chapa).includes('1846')) {
                console.log("DIAGNOSTIC: 1846 found (raw chapa: " + h.chapa + "):", h);
                console.log("DIAGNOSTIC: Range Check for " + h.chapa + ":", { dataInicio: h.dataInicio, planRangeEnd, dataFim: h.dataFim, planRangeStart });
            }
             if (h.dataInicio <= planRangeEnd && h.dataFim >= planRangeStart) {
                 const key = `${h.chapa}_${h.centroCusto}`;
                 if (!map.has(key)) {
                     const name = h.nome || dictName.get(h.chapa) || `Colaborador (Chapa ${h.chapa})`;
                     // We also store h.funcao if needed in the future, but currently map doesn't expect it,
                     // so we just pass name. If the map interface changes, we add it.
                     map.set(key, { nome: name, cc: h.centroCusto, chapa: h.chapa, regional: getCCRegional(h.centroCusto) });
                 }
             }
        });

        employees.forEach(e => {
            if (!isAuthorizedCostCenter(e.CODCCUSTO)) return;
            const key = `${e.CHAPA}_${e.CODCCUSTO}`;
            if (!map.has(key)) {
                map.set(key, { nome: e.NOME, cc: e.CODCCUSTO, chapa: e.CHAPA, regional: getCCRegional(e.CODCCUSTO) });
            }
        });

        manualEmployees.forEach(m => {
            if (!isAuthorizedCostCenter(m.costCenter)) return;
            const key = `${m.chapa}_${m.costCenter}`;
            if (!map.has(key)) {
                map.set(key, { nome: m.name, cc: m.costCenter, chapa: m.chapa, regional: getCCRegional(m.costCenter) });
            }
        });

        return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [employees, manualEmployees, headcountRecords, globalEmployees, planRangeStart, planRangeEnd, isAuthorizedCostCenter]);

    // Derived Lists
    const costCenters = useMemo(() => {
        return Array.from(new Set(uniqueEmployees.map(e => e.cc).filter(Boolean))).sort();
    }, [uniqueEmployees]);

    const regionals = useMemo(() => {
        return Array.from(new Set(uniqueEmployees.map(e => e.regional).filter(Boolean))).sort();
    }, [uniqueEmployees]);

    const employeeRoleByChapa = useMemo(() => {
        const map: Record<string, string> = {};
        globalEmployees.forEach(e => { if (e.chapa && e.funcao) map[e.chapa] = e.funcao; });
        employees.forEach(e => { if (e.CHAPA && e.FUNCAO) map[e.CHAPA] = e.FUNCAO; });
        manualEmployees.forEach(m => {
            if (m.chapa && m.role && isAuthorizedCostCenter(m.costCenter)) {
                map[m.chapa] = m.role;
            }
        });
        return map;
    }, [globalEmployees, employees, manualEmployees, isAuthorizedCostCenter]);

    const buildSalaryMap = (salaryRows: ReturnType<typeof getSalariesSync>): Record<string, number> => {
        const sMap: Record<string, number> = {};
        salaryRows.forEach(s => {
            if (!sMap[s.chapa] || s.salary > sMap[s.chapa]) {
                sMap[s.chapa] = s.salary;
            }
        });
        return sMap;
    };

    useEffect(() => {
        setSalaries(buildSalaryMap(getSalariesSync(selectedMonth).filter(s => isAuthorizedCostCenter(s.costCenter))));

        let cancelled = false;
        getSalaries(selectedMonth, user)
            .then(rows => {
                if (!cancelled) {
                    setSalaries(buildSalaryMap(rows));
                }
            })
            .catch(error => console.error('Error loading salaries for planning:', error));

        return () => {
            cancelled = true;
        };
    }, [selectedMonth, user, isAuthorizedCostCenter]);

    // Load reference data
    useEffect(() => {
        const storedBudgets = getBudgetsSync().filter(b => isAuthorizedCostCenter(b.costCenter));
        setBudgets(storedBudgets);
        getAllBudgetsAsync(user).then(setBudgets).catch(console.error);

        // Background refresh for global employees
        getGlobalEmployeesAsync().then(emps => setGlobalEmployees(emps)).catch(console.error);
    }, [user, isAuthorizedCostCenter]);

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
            if (!isAuthorizedCostCenter(m.costCenter)) return;
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
    }, [employees, manualEmployees, globalEmployees.length, user, isAuthorizedCostCenter]);

    useEffect(() => {
        const loadPlans = async () => {
            let records: PlanningRecord[] = [];
            const startMonthStr = formatDateKey(periodStart).slice(0, 7);
            const endMonthStr = formatDateKey(periodEnd).slice(0, 7);

            // Fetch for all accessible to user
            const recs1 = await getPlanning(undefined, startMonthStr, 'DAILY', user);
            records = [...recs1];

            if (startMonthStr !== endMonthStr) {
                const recs2 = await getPlanning(undefined, endMonthStr, 'DAILY', user);
                records = [...records, ...recs2];
            }

            const planMap: Record<string, number> = {};
            const statusMap: Record<string, string> = {};
            records.forEach(r => {
                const key = `${r.chapa}_${r.costCenter}_${r.date}`;
                // FIX 3A — Só armazena horas no planMap se o registro tem horas reais
                // ou status relevante (approved/pending). Zeros de rascunhos são
                // resíduos de saves anteriores e NÃO devem ser re-gravados no próximo save.
                // Manter apenas o statusMap para esses casos garante que o UI ainda
                // renderiza o status correto, sem expor o zero ao fluxo de gravação.
                const hasRealHours = (r.plannedHours ?? 0) > 0;
                const isRelevantStatus = r.status === 'approved' || r.status === 'pending';

                if (hasRealHours || isRelevantStatus) {
                    planMap[key] = r.plannedHours ?? 0;
                }
                // Sempre rastreia o status (para UI de bloqueio/ícones)
                if (r.status) {
                    statusMap[key] = r.status;
                }
            });
            setPlans(planMap);
            setPlanStatuses(statusMap);
        };
        loadPlans();
    }, [selectedMonth, periodStart, periodEnd, user]);

    const displayCostCenters = useMemo(() => {
        const ccMap = new Map<string, { id: string; costCenter: string; memberChapas: string[]; regional: string }>();
        uniqueEmployees.forEach(emp => {
            if (!emp.cc) return;
            if (!ccMap.has(emp.cc)) {
                ccMap.set(emp.cc, {
                    id: emp.cc,
                    costCenter: emp.cc,
                    memberChapas: [],
                    regional: emp.regional
                });
            }
            ccMap.get(emp.cc)!.memberChapas.push(emp.chapa);
        });

        return Array.from(ccMap.values())
            .map(cc => ({ ...cc, memberChapas: Array.from(new Set(cc.memberChapas)) }))
            .filter(cc => {
                const matchesCC = !ccFilter || cc.costCenter === ccFilter;
                const matchesRegional = !regionalFilter || cc.regional === regionalFilter;
                return matchesCC && matchesRegional && isAuthorizedCostCenter(cc.costCenter);
            })
            .sort((a, b) => a.costCenter.localeCompare(b.costCenter));
    }, [uniqueEmployees, ccFilter, regionalFilter, isAuthorizedCostCenter]);

    const emailDraft = useMemo<EmailDraftData | null>(() => {
        const monthParts = selectedMonth.split('-');
        const monthIndex = parseInt(monthParts[1], 10) - 1;
        const monthLabel = `${MONTH_NAMES[monthIndex]}/${monthParts[0]}`;
        const periodLabel = `${formatDateBR(submissionRange.start)} a ${formatDateBR(submissionRange.end)}`;
        const rangeStart = parseDateKeyLocal(submissionRange.start);
        const rangeEnd = parseDateKeyLocal(submissionRange.end);
        const overallMembers = new Set<string>();
        const employeeItems: EmailDraftEmployeeItem[] = [];

        const summaryItems = displayCostCenters.map(cc => {
            let totalHours = 0;
            let totalCost = 0;
            const membersWithHours = new Set<string>();

            cc.memberChapas.forEach(chapa => {
                const salary = salaries[chapa];
                const cursor = new Date(rangeStart);
                let employeeHours = 0;
                const plannedDates = new Set<string>();

                while (cursor <= rangeEnd) {
                    const dateKey = formatDateKey(cursor);
                    const hours = plans[`${chapa}_${cc.costCenter}_${dateKey}`] || 0;

                    if (hours > 0) {
                        totalHours += hours;
                        employeeHours += hours;
                        membersWithHours.add(chapa);
                        overallMembers.add(chapa);
                        plannedDates.add(dateKey);

                        if (salary) {
                            const isSunday = cursor.getDay() === 0;
                            const baseHour = salary / 220;
                            const multiplier = isSunday ? 2.0 : 1.6;
                            totalCost += baseHour * multiplier * hours;
                        }
                    }

                    cursor.setDate(cursor.getDate() + 1);
                }

                if (employeeHours > 0) {
                    const employeeMeta = uniqueEmployees.find(e => e.chapa === chapa && e.cc === cc.costCenter);
                    employeeItems.push({
                        chapa,
                        name: employeeMeta?.nome || `Colaborador ${chapa}`,
                        role: employeeRoleByChapa[chapa] || 'Sem funcao cadastrada',
                        costCenter: cc.costCenter,
                        costCenterName: getCCName(cc.costCenter),
                        daysPlanned: plannedDates.size,
                        totalHours: employeeHours
                    });
                }
            });

            return {
                costCenter: cc.costCenter,
                costCenterName: getCCName(cc.costCenter),
                regional: cc.regional,
                headcount: membersWithHours.size,
                totalHours,
                totalCost
            };
        }).filter(item => item.totalHours > 0);

        if (summaryItems.length === 0) return null;

        const totalHours = summaryItems.reduce((sum, item) => sum + item.totalHours, 0);
        const totalCost = summaryItems.reduce((sum, item) => sum + item.totalCost, 0);
        const sortedEmployees = [...employeeItems].sort((a, b) => {
            if (a.costCenter === b.costCenter) return a.name.localeCompare(b.name);
            return a.costCenter.localeCompare(b.costCenter);
        });

        const summaryLines = summaryItems.map(item =>
            `- ${item.costCenter} - ${item.costCenterName} | ${item.regional} | Horas: ${formatDecimalHours(item.totalHours)} | Custo estimado: ${formatCurrencyBR(item.totalCost)}`
        );
        const employeeLines = sortedEmployees.map(employee =>
            `- ${employee.name} | ${employee.role} | ${employee.daysPlanned} ${employee.daysPlanned === 1 ? 'dia programado' : 'dias programados'} | ${formatDecimalHours(employee.totalHours)} | ${employee.costCenter} - ${employee.costCenterName}`
        );

        const subject = `Solicitacao de acordo - Programacao de horas extras - ${monthLabel} - ${periodLabel}`;
        const body = [
            'Prezados,',
            '',
            `Informo que foi realizada a programacao de horas extras e solicito o de acordo para o periodo de ${periodLabel}.`,
            '',
            `Gestor solicitante: ${user.name}`,
            `E-mail do gestor: ${user.email}`,
            `Período da folha: ${periodLabel}`,
            `Total planejado: ${formatDecimalHours(totalHours)}`,
            `Custo estimado total: ${formatCurrencyBR(totalCost)}`,
            '',
            'Resumo por centro de custo:',
            ...summaryLines,
            '',
            'Colaboradores programados:',
            ...employeeLines,
            '',
            'Caso estejam de acordo, peco a aprovacao do planejamento no Portal Capital Humano.',
            '',
            'Atenciosamente,',
            user.name
        ].join('\n');

        return {
            subject,
            body,
            periodLabel,
            monthLabel,
            totalHours,
            totalCost,
            totalHeadcount: overallMembers.size,
            items: summaryItems,
            employees: sortedEmployees
        };
    }, [displayCostCenters, employeeRoleByChapa, plans, salaries, selectedMonth, submissionRange, uniqueEmployees, user.email, user.name]);

    // Helper to get Employee Object
    const getEmpObj = (chapa: string) => uniqueEmployees.find(e => e.chapa === chapa);

    const handleApproveCC = async (cc: string) => {
        if (!isAuthorizedCostCenter(cc)) {
            setAlert({ type: 'error', message: 'Voce nao possui acesso a este Centro de Custo.' });
            return;
        }

        setSaving(true);
        try {
            // Get all records for this CC and Month that are 'pending'
            const startMonthStr = formatDateKey(periodStart).slice(0, 7);
            const endMonthStr = formatDateKey(periodEnd).slice(0, 7);

            let allRecs = await getPlanning(undefined, startMonthStr, 'DAILY', user);
            if (startMonthStr !== endMonthStr) {
                const recs2 = await getPlanning(undefined, endMonthStr, 'DAILY', user);
                allRecs = [...allRecs, ...recs2];
            }

            const pendingRecs = allRecs.filter(
                r => r.costCenter === cc && r.status === 'pending' && parseTimeToDecimal(String(r.plannedHours ?? '0')) > 0
            );
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
            const newStatuses = { ...planStatuses };
            approvedRecs.forEach(r => {
                const key = `${r.chapa}_${r.costCenter}_${r.date}`;
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
        if (!isAuthorizedCostCenter(cc)) {
            setAlert({ type: 'error', message: 'Voce nao possui acesso a este Centro de Custo.' });
            return;
        }

        setSaving(true);
        try {
            const startMonthStr = formatDateKey(periodStart).slice(0, 7);
            const endMonthStr = formatDateKey(periodEnd).slice(0, 7);

            let allRecs = await getPlanning(undefined, startMonthStr, 'DAILY', user);
            if (startMonthStr !== endMonthStr) {
                const recs2 = await getPlanning(undefined, endMonthStr, 'DAILY', user);
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
                const key = `${r.chapa}_${r.costCenter}_${r.date}`;
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

    const handleCostCenterPlanSave = async (costCenter: string, numericMap: Record<string, number>) => {
        if (!isAuthorizedCostCenter(costCenter)) {
            setAlert({ type: 'error', message: 'Voce nao possui acesso a este Centro de Custo.' });
            return;
        }

        const ccData = displayCostCenters.find(cc => cc.costCenter === costCenter);
        if (!ccData) return;

        setPlans(prev => ({ ...prev, ...numericMap }));
        const mergedPlans = { ...plans, ...numericMap };
        const recordsToSave: PlanningRecord[] = [];

        ccData.memberChapas.forEach(chapa => {
            const emp = getEmpObj(chapa);
            if (!emp) return;
            const curr = new Date(periodStart);
            while (curr <= periodEnd) {
                const dateKey = formatDateKey(curr);
                const key = `${chapa}_${costCenter}_${dateKey}`;
                const hours = mergedPlans[key];
                const originalStatus = (planStatuses[key] as PlanningRecord['status']) || 'draft';

                // FIX 3C — Mesmas guards de imutabilidade do handleSave.

                // REGRA 1: Chave não presente no mapa → não foi tocada → pular.
                if (hours === undefined) {
                    curr.setDate(curr.getDate() + 1);
                    continue;
                }

                // REGRA 2: Aprovados com horas = 0 são intocáveis por este fluxo.
                if (originalStatus === 'approved' && hours <= 0) {
                    curr.setDate(curr.getDate() + 1);
                    continue;
                }

                // REGRA 3: Ghost records de rascunho não são persistidos.
                if (hours <= 0 && originalStatus === 'draft') {
                    curr.setDate(curr.getDate() + 1);
                    continue;
                }

                // Preserva status: approved e pending nunca regridem via save de gestor.
                const finalStatus: PlanningRecord['status'] =
                    (originalStatus === 'approved' || originalStatus === 'pending') && hours > 0
                        ? originalStatus
                        : 'draft';

                recordsToSave.push({
                    id: `${chapa}_${costCenter}_DAILY_${dateKey}`,
                    chapa,
                    nome: emp.nome,
                    costCenter,
                    date: dateKey,
                    type: 'DAILY',
                    plannedHours: hours,
                    status: finalStatus
                });
                curr.setDate(curr.getDate() + 1);
            }
        });

        await savePlanning(recordsToSave, user);
        setAlert({ type: 'success', message: `Planejamento do Centro de Custo ${costCenter} salvo!` });
    };

    // Calculate Global Stats (Filtered)
    const filteredEmployeesForStats = useMemo(() => {
        return uniqueEmployees.filter(e => {
            const reg = e.regional;
            const matchesCC = !ccFilter || e.cc === ccFilter;
            const matchesRegional = !regionalFilter || reg === regionalFilter;
            return matchesCC && matchesRegional && isAuthorizedCostCenter(e.cc);
        });
    }, [uniqueEmployees, ccFilter, regionalFilter, isAuthorizedCostCenter]);

    const calculateTotalStats = () => {
        let totalHours = 0;
        let totalValue = 0;

        filteredEmployeesForStats.forEach(emp => {
            const salary = salaries[emp.chapa];
            const curr = new Date(periodStart);
            while (curr <= periodEnd) {
                const key = `${emp.chapa}_${emp.cc}_${formatDateKey(curr)}`;
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
            const matchesRegional = !regionalFilter || getCCRegional(b.costCenter) === regionalFilter;
            return (matchesMonth && matchesCC && matchesRegional && isAuthorizedCostCenter(b.costCenter)) ? acc + b.value : acc;
        }, 0);
    }, [budgets, selectedMonth, ccFilter, regionalFilter, isAuthorizedCostCenter]);

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
        if (submitPending && !emailDraft) {
            setAlert({ type: 'error', message: 'Nao ha horas planejadas no intervalo selecionado para enviar para aprovacao.' });
            return;
        }

        setSaving(true);
        const recordsToSave: PlanningRecord[] = [];
        const nextStatuses = { ...planStatuses };

        try {
            uniqueEmployees.forEach(emp => {
                const curr = new Date(periodStart);
                while (curr <= periodEnd) {
                    const dateKey = formatDateKey(curr);
                    const key = `${emp.chapa}_${emp.cc}_${dateKey}`;
                    const hours = plans[key];
                    const originalStatus = (planStatuses[key] as PlanningRecord['status']) || 'draft';

                    // FIX 3B — Guards de imutabilidade: três regras antes de incluir no payload.

                    // REGRA 1: Não tocar o que não foi carregado nesta sessão.
                    // hours === undefined → chave ausente no planMap → dia intocado → pular.
                    if (hours === undefined) {
                        curr.setDate(curr.getDate() + 1);
                        continue;
                    }

                    // REGRA 2: Registros aprovados com horas = 0 no state local são resíduos
                    // do carregamento (approved sem horas reais, ex: dias fora da escala aprovada).
                    // Nunca sobrescrever via este fluxo — apenas approve/reject podem alterar.
                    if (originalStatus === 'approved' && hours <= 0) {
                        curr.setDate(curr.getDate() + 1);
                        continue;
                    }

                    // REGRA 3: Rascunhos com 0 horas são ghost records. Não persistir.
                    // (O usuário não programou nada para este dia — não criar registro vazio.)
                    if (hours <= 0 && originalStatus === 'draft') {
                        curr.setDate(curr.getDate() + 1);
                        continue;
                    }

                    const isWithinRange = dateKey >= submissionRange.start && dateKey <= submissionRange.end;
                    const hasHours = hours > 0;

                    // Determina o status final preservando imutabilidade.
                    let finalStatus: PlanningRecord['status'];
                    if (originalStatus === 'approved') {
                        // Approved é imutável por este fluxo — só approve/reject explícito muda.
                        finalStatus = 'approved';
                    } else if (submitPending) {
                        finalStatus = isWithinRange && hasHours ? 'pending' : (hasHours ? originalStatus : 'draft');
                    } else {
                        // Save-draft: não regredir pending → draft.
                        finalStatus = (originalStatus === 'pending' && hasHours) ? 'pending' : (hasHours ? 'draft' : 'draft');
                    }

                    recordsToSave.push({
                        id: `${emp.chapa}_${emp.cc}_DAILY_${dateKey}`,
                        chapa: emp.chapa,
                        nome: emp.nome,
                        costCenter: emp.cc,
                        date: dateKey,
                        type: 'DAILY',
                        plannedHours: hours,
                        status: finalStatus
                    });

                    nextStatuses[key] = finalStatus;
                    curr.setDate(curr.getDate() + 1);
                }
            });

            await savePlanning(recordsToSave, user);
            setPlanStatuses(nextStatuses);
            setAlert({ type: 'success', message: submitPending ? 'Planejamento submetido para aprovacao!' : 'Rascunho salvo!' });

            if (submitPending) {
                setIsEmailDraftOpen(true);
            }
        } catch (error) {
            console.error(error);
            setAlert({ type: 'error', message: 'Erro ao salvar planejamento.' });
        } finally {
            setSaving(false);
        }
    };

    const handleOpenEmailDraft = () => {
        if (!emailDraft) {
            setAlert({ type: 'error', message: 'Nao ha horas planejadas no intervalo selecionado para gerar o e-mail.' });
            return;
        }
        setIsEmailDraftOpen(true);
    };

    const handleCopyEmailText = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setAlert({ type: 'success', message: `${label} copiado com sucesso!` });
        } catch (error) {
            console.error(error);
            setAlert({ type: 'error', message: `Nao foi possivel copiar ${label.toLowerCase()}.` });
        }
    };

    const handleEmployeeClick = (emp: { nome: string; chapa: string }) => {
        setSelectedEmployee({ name: emp.nome, chapa: emp.chapa });
        setModalOpen(true);
    };

    // Mapa chapa→nome para o CostCenterPlanModal
    const memberNames = useMemo(() => {
        const map: Record<string, string> = {};
        globalEmployees.forEach(e => { if (e.chapa && e.nome) map[e.chapa] = e.nome; });
        employees.forEach(e => { if (e.CHAPA && e.NOME) map[e.CHAPA] = e.NOME; });
        uniqueEmployees.forEach(e => { if (e.chapa && e.nome) map[e.chapa] = e.nome; });
        return map;
    }, [globalEmployees, employees, uniqueEmployees]);

    // Mapa chapa→cargo para o CostCenterPlanModal
    const memberFuncoes = useMemo(() => {
        const map: Record<string, string> = {};
        globalEmployees.forEach(e => { if (e.chapa && e.funcao) map[e.chapa] = e.funcao; });
        employees.forEach(e => { if (e.CHAPA && e.FUNCAO) map[e.CHAPA] = e.FUNCAO; });
        return map;
    }, [globalEmployees, employees]);

    const ccPlanModalData = displayCostCenters.find(cc => cc.costCenter === ccPlanModalId) || null;

    return (
        <div className="space-y-6">
            <BudgetManagerModal
                isOpen={isBudgetManagerOpen}
                onClose={() => setIsBudgetManagerOpen(false)}
                user={user}
                onRefresh={() => {
                    const storedBudgets = getBudgetsSync().filter(b => isAuthorizedCostCenter(b.costCenter));
                    setBudgets(storedBudgets);
                }}
            />
            {ccPlanModalData && (
                <CostCenterPlanModal
                    isOpen={!!ccPlanModalId}
                    onClose={() => setCcPlanModalId(null)}
                    costCenter={ccPlanModalData.costCenter}
                    memberChapas={ccPlanModalData.memberChapas}
                    memberNames={memberNames}
                    memberFuncoes={memberFuncoes}
                    plans={plans}
                    periodStart={periodStart}
                    periodEnd={periodEnd}
                    planRangeStart={planRangeStart}
                    planRangeEnd={planRangeEnd}
                    onSave={handleCostCenterPlanSave}
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

            <EmailDraftModal
                isOpen={isEmailDraftOpen}
                onClose={() => setIsEmailDraftOpen(false)}
                draft={emailDraft}
                onCopy={handleCopyEmailText}
            />

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
                    records={displayCostCenters.map(cc => {
                        const ccEmployees = cc.memberChapas
                            .map(chapa => getEmpObj(chapa))
                            .filter(e => !!e);

                        let totalHours = 0;
                        let totalCost = 0;
                        let hasPending = false;
                        let hasDraft = false;
                        const detailRows: Array<{
                            id: string;
                            date: string;
                            ccName: string;
                            employeeName: string;
                            employeeRole: string;
                            hours: number;
                            status: string;
                        }> = [];

                        ccEmployees.forEach((emp: any) => {
                            const salary = salaries[emp.chapa];
                            const curr = new Date(periodStart);
                            while (curr <= periodEnd) {
                                const dateKey = formatDateKey(curr);
                                const key = `${emp.chapa}_${emp.cc}_${dateKey}`;
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
                                if (hours > 0) {
                                    detailRows.push({
                                        id: `${cc.id}_${key}`,
                                        date: dateKey,
                                        ccName: `CC ${cc.costCenter}`,
                                        employeeName: emp.nome,
                                        employeeRole: memberFuncoes[emp.chapa] || 'Sem função',
                                        hours,
                                        status: st
                                    });
                                }
                                curr.setDate(curr.getDate() + 1);
                            }
                        });

                        const ccStatus = hasPending ? 'pending' : (hasDraft ? 'draft' : 'approved');

                        return {
                            id: cc.id,
                            description: `Centro de Custo ${cc.costCenter}`,
                            costCenter: cc.costCenter,
                            headcount: cc.memberChapas.length,
                            plannedHours: totalHours,
                            customEstCost: totalCost,
                            estStatus: ccStatus,
                            date: selectedMonth,
                            shift: 'Integral',
                            detailRows
                        };
                    })}
                    onApprove={handleApproveCC}
                    onReject={handleRejectCC}
                    mode="DAILY"
                />
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-4">
                        <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
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
                        </div>

                        <div className="flex flex-wrap gap-3 w-full xl:w-auto justify-end">
                            {canManagePlanningBudgets && (
                                <>
                                    <input type="file" ref={budgetInputRef} onChange={handleBudgetImport} accept=".xlsx,.xls" className="hidden" />
                                    <button onClick={() => budgetInputRef.current?.click()} className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-indigo-50 flex items-center gap-2 shadow-sm">
                                        <FileUp size={16} /> Importar Budget
                                    </button>
                                    <button onClick={() => setIsBudgetManagerOpen(true)} className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-indigo-50 flex items-center gap-2 shadow-sm">
                                        <Wallet size={16} /> Gerenciar Budgets
                                    </button>
                                </>
                            )}
                            {isAdministradorMaster && (
                                <button
                                    onClick={handleExportPlanningJSON}
                                    disabled={exporting}
                                    className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-xs font-bold uppercase hover:bg-indigo-50 flex items-center gap-2 shadow-sm disabled:opacity-50 transition"
                                >
                                    {exporting ? (
                                        <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
                                    ) : (
                                        <FileDown size={16} />
                                    )}
                                    Exportar JSON
                                </button>
                            )}
                            <div className="self-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                Salários vêm do headcount ativo
                            </div>
                            <button onClick={() => handleSave(false)} disabled={saving} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-bold uppercase hover:bg-gray-200 transition flex items-center gap-2 shadow-sm">
                                <Save size={18} /> Salvar Rascunho
                            </button>
                            <button
                                onClick={handleOpenEmailDraft}
                                disabled={!emailDraft}
                                className="bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-lg text-sm font-bold uppercase hover:bg-slate-50 transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Mail size={16} /> Gerar E-mail do Periodo
                            </button>
                            <button onClick={() => {
                                const submitStart = submissionRange.start;
                                const submitEnd = submissionRange.end;
                                if (window.confirm(`Atencao: somente o periodo personalizado de ${formatDateBR(submitStart)} a ${formatDateBR(submitEnd)} sera submetido para aprovacao. Os demais dias permanecerao em rascunho/abertos. Deseja prosseguir?`)) {
                                    handleSave(true);
                                }
                            }} disabled={saving} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase hover:bg-blue-700 transition flex items-center gap-2 shadow-md">
                                {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle2 size={18} />} Enviar Periodo P/ Aprovar
                            </button>
                        </div>
                        </div>

                        <div className={`rounded-2xl border px-4 py-4 ${isCustomSubmissionRange ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}>
                            <div className="flex flex-col 2xl:flex-row 2xl:items-end 2xl:justify-between gap-4">
                                <div className="space-y-1">
                                    <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${isCustomSubmissionRange ? 'text-amber-700' : 'text-sky-700'}`}>
                                        {isCustomSubmissionRange ? 'Periodo personalizado de envio ativo' : 'Periodo padrao de envio'}
                                    </p>
                                    <p className="text-sm font-bold text-slate-800">
                                        O e-mail gerado e o envio para aprovacao consideram somente o periodo abaixo.
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        Folha: {formatDateBR(payrollRangeStart)} a {formatDateBR(payrollRangeEnd)} | Envio: {formatDateBR(submissionRange.start)} a {formatDateBR(submissionRange.end)}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-end gap-3">
                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Data inicial do envio</label>
                                        <input
                                            type="date"
                                            value={submitRangeStart}
                                            min={payrollRangeStart}
                                            max={submitRangeEnd || payrollRangeEnd}
                                            onChange={(e) => setSubmitRangeStart(e.target.value)}
                                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium bg-white"
                                        />
                                    </div>

                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Data final do envio</label>
                                        <input
                                            type="date"
                                            value={submitRangeEnd}
                                            min={submitRangeStart || payrollRangeStart}
                                            max={payrollRangeEnd}
                                            onChange={(e) => setSubmitRangeEnd(e.target.value)}
                                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium bg-white"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSubmitRangeStart(payrollRangeStart);
                                            setSubmitRangeEnd(payrollRangeEnd);
                                        }}
                                        className="h-[42px] px-4 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                        Usar periodo da folha
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 min-h-[400px]">
                        <PlanningTable
                            records={displayCostCenters.map(cc => {
                                const ccEmployees = cc.memberChapas
                                    .map(chapa => getEmpObj(chapa))
                                    .filter(e => !!e);

                                let totalHours = 0;
                                let totalDraftHours = 0;
                                let totalPendingHours = 0;
                                let totalApprovedHours = 0;
                                let totalCost = 0;

                                const memberRecords = ccEmployees.map((emp: any) => {
                                    let empHours = 0;
                                    let draftHours = 0;
                                    let pendingHours = 0;
                                    let approvedHours = 0;
                                    let empCost = 0;
                                    const salary = salaries[emp.chapa];

                                    const curr = new Date(periodStart);
                                    while (curr <= periodEnd) {
                                        const key = `${emp.chapa}_${cc.costCenter}_${formatDateKey(curr)}`;
                                        const hours = plans[key] || 0;
                                        const status = planStatuses[key] || 'draft';
                                        
                                        empHours += hours;
                                        if (hours > 0) {
                                            if (status === 'draft') draftHours += hours;
                                            else if (status === 'pending') pendingHours += hours;
                                            else if (status === 'approved') approvedHours += hours;
                                        }

                                        if (salary && hours > 0) {
                                            const isSunday = curr.getDay() === 0;
                                            const baseHour = salary / 220;
                                            const multiplier = isSunday ? 2.0 : 1.6;
                                            empCost += baseHour * multiplier * hours;
                                        }
                                        curr.setDate(curr.getDate() + 1);
                                    }

                                    totalHours += empHours;
                                    totalDraftHours += draftHours;
                                    totalPendingHours += pendingHours;
                                    totalApprovedHours += approvedHours;
                                    totalCost += empCost;

                                    return {
                                        id: `${cc.costCenter}_${emp.chapa}`,
                                        description: emp.nome,
                                        chapa: emp.chapa,
                                        plannedHours: empHours,
                                        draftHours,
                                        pendingHours,
                                        approvedHours,
                                        customEstCost: empCost
                                    };
                                });

                                return {
                                    id: cc.id,
                                    description: `Centro de Custo ${cc.costCenter}`,
                                    costCenter: cc.costCenter,
                                    headcount: cc.memberChapas.length,
                                    plannedHours: totalHours,
                                    draftHours: totalDraftHours,
                                    pendingHours: totalPendingHours,
                                    approvedHours: totalApprovedHours,
                                    customEstCost: totalCost,
                                    date: selectedMonth,
                                    shift: 'Integral',
                                    members: memberRecords
                                };
                            })}
                            onPlanCC={setCcPlanModalId}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Planning;

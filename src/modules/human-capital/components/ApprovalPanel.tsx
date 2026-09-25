import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Briefcase, Calendar, CheckCircle2, Eye, PencilLine, RefreshCw, Send, Undo2, X } from 'lucide-react';
import { PlanningRecord } from '../types';
import { getCCName, getCCRegional } from '../data/ccMaster';
import { formatDecimalHours } from '../utils/formatters';
import {
    PlanningQueueGroup,
    SalaryByCompetency,
    estimateOvertimeCost,
    estimateQueueCost,
    formatCompetencyLabel,
    getCompetencyTiming,
    getPlanningCompetency,
    getPlanningHours,
    isDateInRange
} from '../utils/planningWorkflow';

export type QueueTone = 'amber' | 'blue' | 'rose';

export interface QueueReadOnlySection {
    key: string;
    title: string;
    description: string;
    tone: QueueTone;
    groups: PlanningQueueGroup[];
    showRejectionReason?: boolean;
}

interface PlanningQueuePanelProps {
    title: string;
    subtitle: string;
    /** Rótulo do status dos registros acionáveis, ex.: "Aguardando diretor". */
    actionableLabel: string;
    actionableTone: QueueTone;
    actionable: PlanningQueueGroup[];
    readOnlySections: QueueReadOnlySection[];
    primaryActionLabel: string;
    primaryActionIcon: 'approve' | 'send';
    confirmPrimaryMessage: (costCenter: string, count: number, start: string, end: string) => string;
    onPrimary: (records: PlanningRecord[]) => Promise<boolean>;
    /** Quando presente, habilita "Devolver ao engenheiro" com motivo obrigatório. */
    onReturn?: (records: PlanningRecord[], reason: string) => Promise<boolean>;
    /** Quando presente, habilita "Editar horas" (abre a grade da obra). */
    onEdit?: (costCenter: string, firstDate: string) => void;
    roleByChapa: Record<string, string>;
    /** Salários por competência da folha: cada cartão usa o salário da própria competência. */
    salariesByCompetency: SalaryByCompetency;
    loading: boolean;
    busy: boolean;
    partial: boolean;
    onRefresh: () => void;
    emptyTitle: string;
    emptyMessage: string;
}

const toneClasses: Record<QueueTone, { badge: string; soft: string; text: string }> = {
    amber: { badge: 'bg-amber-100 text-amber-700', soft: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
    blue: { badge: 'bg-blue-100 text-blue-700', soft: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
    rose: { badge: 'bg-rose-100 text-rose-700', soft: 'bg-rose-50 border-rose-200', text: 'text-rose-700' }
};

const formatDateBR = (value?: string): string => {
    if (!value) return '-';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
};

const formatCurrency = (value: number): string =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayKey = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const MIN_REASON_LENGTH = 5;

export const PlanningQueuePanel: React.FC<PlanningQueuePanelProps> = ({
    title,
    subtitle,
    actionableLabel,
    actionableTone,
    actionable,
    readOnlySections,
    primaryActionLabel,
    primaryActionIcon,
    confirmPrimaryMessage,
    onPrimary,
    onReturn,
    onEdit,
    roleByChapa,
    salariesByCompetency,
    loading,
    busy,
    partial,
    onRefresh,
    emptyTitle,
    emptyMessage
}) => {
    const [selected, setSelected] = useState<{ group: PlanningQueueGroup; readOnly: boolean; tone: QueueTone; label: string } | null>(null);
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [returnReason, setReturnReason] = useState('');
    const [isReturning, setIsReturning] = useState(false);

    const today = todayKey();

    const groupCost = (records: PlanningRecord[]) => estimateQueueCost(records, salariesByCompetency);

    const salaryOf = (record: PlanningRecord): number | undefined =>
        salariesByCompetency[getPlanningCompetency(record.date)]?.[record.chapa];

    const openGroup = (group: PlanningQueueGroup, readOnly: boolean, tone: QueueTone, label: string) => {
        setSelected({ group, readOnly, tone, label });
        setRangeStart(group.firstDate);
        setRangeEnd(group.lastDate);
        setReturnReason('');
        setIsReturning(false);
    };

    // Se a fila foi recarregada, reposiciona o grupo aberto (ou fecha se sumiu).
    useEffect(() => {
        if (!selected) return;
        const pool = selected.readOnly
            ? readOnlySections.flatMap(section => section.groups)
            : actionable;
        const fresh = pool.find(g => g.key === selected.group.key);
        if (!fresh) {
            setSelected(null);
        } else if (fresh !== selected.group) {
            setSelected(prev => (prev ? { ...prev, group: fresh } : prev));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actionable, readOnlySections]);

    useEffect(() => {
        if (!selected) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setSelected(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selected]);

    const filteredRecords = useMemo(() => {
        if (!selected) return [];
        return selected.group.records.filter(r => isDateInRange(r.date, rangeStart, rangeEnd));
    }, [selected, rangeStart, rangeEnd]);

    const filteredHours = filteredRecords.reduce((sum, r) => sum + getPlanningHours(r.plannedHours), 0);
    const filteredCostInfo = groupCost(filteredRecords);
    const filteredCost = filteredCostInfo.cost;
    const filteredEmployees = new Set(filteredRecords.map(r => r.chapa)).size;

    const handlePrimary = async () => {
        if (!selected || filteredRecords.length === 0) return;
        const message = confirmPrimaryMessage(selected.group.costCenter, filteredRecords.length, rangeStart, rangeEnd);
        if (!window.confirm(message)) return;
        const ok = await onPrimary(filteredRecords);
        if (ok) setSelected(null);
    };

    const handleReturn = async () => {
        if (!selected || !onReturn || filteredRecords.length === 0) return;
        const reason = returnReason.trim();
        if (reason.length < MIN_REASON_LENGTH) return;
        if (!window.confirm(`Devolver ${filteredRecords.length} lançamento(s) da obra ${selected.group.costCenter} ao engenheiro?`)) return;
        const ok = await onReturn(filteredRecords, reason);
        if (ok) setSelected(null);
    };

    const renderGroupCard = (group: PlanningQueueGroup, readOnly: boolean, tone: QueueTone, label: string, showReason?: boolean) => {
        const classes = toneClasses[tone];
        const timing = getCompetencyTiming(group.competency, today);
        const costInfo = groupCost(group.records);
        const missingCount = costInfo.missingSalaryChapas.length;
        const hasNotes = timing !== 'future' || missingCount > 0 || (showReason && group.lastRejectionReason);
        return (
            <div key={`${label}_${group.key}`} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-1 p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
                            <Briefcase size={18} />
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-bold text-slate-800 text-sm truncate">{group.costCenter} - {getCCName(group.costCenter)}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">{getCCRegional(group.costCenter)}</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="px-2 py-1 rounded-md text-[11px] font-black bg-slate-800 text-white">
                            Folha {formatCompetencyLabel(group.competency)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${classes.badge}`}>{label}</span>
                    </div>
                </div>

                <div className="p-4 grid grid-cols-3 gap-3">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Competência</span>
                        <span className="text-xs font-bold text-slate-700">{formatDateBR(group.competencyStart)} a {formatDateBR(group.competencyEnd)}</span>
                        <span className="text-[10px] text-slate-400">Lançamentos: {formatDateBR(group.firstDate)} a {formatDateBR(group.lastDate)}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Horas / Pessoas</span>
                        <span className="text-sm font-black font-mono text-slate-700">{formatDecimalHours(group.totalHours)} · {group.employeeCount}</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            {missingCount > 0 ? 'Custo parcial' : 'Custo estimado'}
                        </span>
                        <span className={`text-sm font-black font-mono ${missingCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatCurrency(costInfo.cost)}</span>
                    </div>
                </div>

                {hasNotes && (
                    <div className="px-4 pb-3 space-y-2">
                        {timing === 'closed' && (
                            <p className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600">
                                <AlertTriangle size={12} /> Competência encerrada em {formatDateBR(group.competencyEnd)}: horas não aprovadas antes da folha.
                            </p>
                        )}
                        {timing === 'open' && (
                            <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
                                <AlertTriangle size={12} /> Competência em andamento: termina em {formatDateBR(group.competencyEnd)}.
                            </p>
                        )}
                        {missingCount > 0 && (
                            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
                                <span className="font-bold">{missingCount} pessoa(s) sem salário na folha de {formatCompetencyLabel(group.competency)}</span>
                                {' '}({formatDecimalHours(costInfo.missingSalaryHours)} fora do custo). Verifique o headcount dessa competência.
                            </p>
                        )}
                        {showReason && group.lastRejectionReason && (
                            <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-2 py-1.5">
                                <span className="font-bold">Motivo da devolução:</span> {group.lastRejectionReason}
                            </p>
                        )}
                    </div>
                )}

                <div className="p-3 bg-slate-50 border-t border-slate-100 mt-auto">
                    <button
                        onClick={() => openGroup(group, readOnly, tone, label)}
                        className={`w-full py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 ${readOnly ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                    >
                        {readOnly ? <><Eye size={16} /> Ver lançamentos</> : <><Calendar size={16} /> Revisar</>}
                    </button>
                </div>
            </div>
        );
    };

    const hasAnyReadOnly = readOnlySections.some(section => section.groups.length > 0);

    return (
        <>
            <div className="space-y-8 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <AlertCircle size={20} className={toneClasses[actionableTone].text} /> {title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
                    </div>
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="self-start md:self-auto px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold uppercase flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
                    </button>
                </div>

                {partial && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                        Não foi possível consultar todas as competências. A lista mostra apenas o período selecionado na tela.
                        Verifique se os índices do Firestore foram publicados.
                    </div>
                )}

                {loading && actionable.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">Carregando...</div>
                ) : actionable.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center flex flex-col items-center justify-center">
                        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                            <CheckCircle2 size={28} className="text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">{emptyTitle}</h3>
                        <p className="text-slate-500 mt-1 text-sm">{emptyMessage}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {actionable.map(group => renderGroupCard(group, false, actionableTone, actionableLabel))}
                    </div>
                )}

                {hasAnyReadOnly && readOnlySections.map(section => section.groups.length > 0 && (
                    <div key={section.key} className="space-y-3">
                        <div className={`rounded-xl border px-4 py-3 ${toneClasses[section.tone].soft}`}>
                            <p className={`text-sm font-bold ${toneClasses[section.tone].text}`}>{section.title}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{section.description}</p>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {section.groups.map(group => renderGroupCard(group, true, section.tone, section.title, section.showRejectionReason))}
                        </div>
                    </div>
                ))}
            </div>

            {selected && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] overflow-hidden flex flex-col max-h-[92vh]">
                        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
                            <div>
                                <h3 className="text-lg font-bold">{selected.group.costCenter} - {getCCName(selected.group.costCenter)}</h3>
                                <p className="text-indigo-200 text-xs mt-0.5">
                                    {getCCRegional(selected.group.costCenter)} | Folha {formatCompetencyLabel(selected.group.competency)} ({formatDateBR(selected.group.competencyStart)} a {formatDateBR(selected.group.competencyEnd)}) | {selected.label}
                                </p>
                            </div>
                            <button onClick={() => setSelected(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors" title="Fechar">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-end gap-4">
                            <div className="flex items-end gap-3">
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">De</label>
                                    <input
                                        type="date"
                                        value={rangeStart}
                                        min={selected.group.firstDate}
                                        max={rangeEnd || selected.group.lastDate}
                                        onChange={e => setRangeStart(e.target.value)}
                                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Até</label>
                                    <input
                                        type="date"
                                        value={rangeEnd}
                                        min={rangeStart || selected.group.firstDate}
                                        max={selected.group.lastDate}
                                        onChange={e => setRangeEnd(e.target.value)}
                                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-6 lg:ml-auto">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Pessoas</span>
                                    <span className="text-lg font-black font-mono text-slate-700">{filteredEmployees}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Horas</span>
                                    <span className="text-lg font-black font-mono text-slate-700">{formatDecimalHours(filteredHours)}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                        {filteredCostInfo.missingSalaryChapas.length > 0
                                            ? `Custo parcial (${filteredCostInfo.missingSalaryChapas.length} sem salário)`
                                            : 'Custo estimado'}
                                    </span>
                                    <span className={`text-lg font-black font-mono ${filteredCostInfo.missingSalaryChapas.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatCurrency(filteredCost)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {filteredRecords.length === 0 ? (
                                <div className="py-16 text-center text-slate-400 text-sm">Nenhum lançamento no intervalo escolhido.</div>
                            ) : (
                                <table className="w-full text-xs min-w-[760px]">
                                    <thead className="sticky top-0 z-20 bg-slate-100 text-slate-600">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-[10px] border-b border-slate-200">Data</th>
                                            <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-[10px] border-b border-slate-200">Colaborador</th>
                                            <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-[10px] border-b border-slate-200">Função</th>
                                            <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-[10px] border-b border-slate-200">Horas</th>
                                            <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-[10px] border-b border-slate-200">Custo est.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecords.map(r => {
                                            const hours = getPlanningHours(r.plannedHours);
                                            return (
                                                <tr key={r.id || `${r.chapa}_${r.date}`} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="px-4 py-2.5 text-slate-600">{formatDateBR(r.date)}</td>
                                                    <td className="px-4 py-2.5 text-slate-700">
                                                        <span className="font-semibold">{r.nome || `Chapa ${r.chapa}`}</span>
                                                        <span className="ml-2 text-[10px] text-slate-400 font-mono">{r.chapa}</span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-500">{roleByChapa[r.chapa] || '-'}</td>
                                                    <td className="px-4 py-2.5 text-right font-mono font-black text-slate-700">{formatDecimalHours(hours)}</td>
                                                    <td className="px-4 py-2.5 text-right font-mono text-emerald-700">
                                                        {salaryOf(r)
                                                            ? formatCurrency(estimateOvertimeCost(hours, salaryOf(r), r.date))
                                                            : <span className="text-amber-700 font-bold">sem salário na folha</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {!selected.readOnly && onReturn && isReturning && (
                            <div className="px-6 py-3 border-t border-slate-200 bg-rose-50">
                                <label className="text-[10px] font-bold text-rose-700 uppercase">Motivo da devolução (obrigatório)</label>
                                <textarea
                                    value={returnReason}
                                    onChange={e => setReturnReason(e.target.value)}
                                    rows={2}
                                    placeholder="Explique ao engenheiro o que precisa ser ajustado"
                                    className="mt-1 w-full border border-rose-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 outline-none bg-white"
                                />
                            </div>
                        )}

                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                Lançamentos no intervalo: {filteredRecords.length} de {selected.group.records.length}
                            </p>
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                <button onClick={() => setSelected(null)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg transition-colors">
                                    Fechar
                                </button>
                                {!selected.readOnly && onEdit && (
                                    <button
                                        onClick={() => { onEdit(selected.group.costCenter, rangeStart || selected.group.firstDate); setSelected(null); }}
                                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-100 flex items-center gap-2"
                                    >
                                        <PencilLine size={16} /> Editar horas
                                    </button>
                                )}
                                {!selected.readOnly && onReturn && (
                                    isReturning ? (
                                        <button
                                            onClick={handleReturn}
                                            disabled={busy || returnReason.trim().length < MIN_REASON_LENGTH || filteredRecords.length === 0}
                                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <Undo2 size={16} /> Confirmar devolução
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setIsReturning(true)}
                                            disabled={busy}
                                            className="px-4 py-2 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <Undo2 size={16} /> Devolver ao engenheiro
                                        </button>
                                    )
                                )}
                                {!selected.readOnly && (
                                    <button
                                        onClick={handlePrimary}
                                        disabled={busy || filteredRecords.length === 0}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {busy
                                            ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                            : primaryActionIcon === 'send' ? <Send size={16} /> : <CheckCircle2 size={16} />}
                                        {primaryActionLabel}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

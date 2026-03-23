/**
 * components/HeadcountGovernance.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Painel de governança do headcount ativo.
 * Exibe: status atual, período coberto, chapas únicas, diagnóstico de
 * conservação de horas e ação de limpeza do cache.
 *
 * Complementa HeadcountUpload — aparece ACIMA dele no Settings tab.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
    CheckCircle2, AlertTriangle, XCircle, Database,
    Users, CalendarRange, BarChart3, Trash2, RefreshCw, Info,
} from 'lucide-react';
import { HeadcountRecord, OvertimeRecord } from '../types';
import { diagnosticarConservacao } from '../utils/headcountRateio';

// ─── Props ────────────────────────────────────────────────────────────────────

interface HeadcountGovernanceProps {
    /** Registros de headcount ativos (do cache local) */
    headcountRecords: HeadcountRecord[];
    /** Dado bruto TOTVS para diagnóstico de conservação */
    rawData: OvertimeRecord[];
    /** Callback: limpar cache de headcount */
    onClear: () => void;
    /** Callback: forçar reload do cache */
    onRefresh: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso?: string): string => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
};

// ─── Componente ───────────────────────────────────────────────────────────────

const HeadcountGovernance: React.FC<HeadcountGovernanceProps> = ({
    headcountRecords,
    rawData,
    onClear,
    onRefresh,
}) => {
    const [showDiagnostic, setShowDiagnostic] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);

    const isActive = headcountRecords.length > 0;

    // ── Métricas do headcount ativo ─────────────────────────────────────────
    const stats = useMemo(() => {
        if (!isActive) return null;
        const chapas = new Set(headcountRecords.map(r => r.chapa));
        const ccs = new Set(headcountRecords.map(r => r.centroCusto));
        const starts = headcountRecords.map(r => r.dataInicio).sort();
        const ends = headcountRecords.map(r => r.dataFim).sort();
        return {
            totalRegistros: headcountRecords.length,
            chapasUnicas: chapas.size,
            ccUnicos: ccs.size,
            periodoStart: starts[0],
            periodoEnd: ends[ends.length - 1],
        };
    }, [headcountRecords, isActive]);

    // ── Diagnóstico de conservação (lazy — apenas quando expandido) ──────────
    const diag = useMemo(() => {
        if (!showDiagnostic || !isActive || rawData.length === 0) return null;
        return diagnosticarConservacao(rawData, headcountRecords);
    }, [showDiagnostic, rawData, headcountRecords, isActive]);

    const handleClear = useCallback(() => {
        if (!confirmClear) { setConfirmClear(true); return; }
        onClear();
        setConfirmClear(false);
        setShowDiagnostic(false);
    }, [confirmClear, onClear]);

    // ── Render: sem headcount ─────────────────────────────────────────────────
    if (!isActive) {
        return (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold">Nenhum headcount ativo</p>
                    <p className="text-amber-600 text-xs mt-0.5">
                        O dashboard está usando os dados brutos da TOTVS sem correção de rateio.
                        Faça um upload de headcount abaixo para ativar a distribuição por CC.
                    </p>
                </div>
            </div>
        );
    }

    // ── Render: headcount ativo ───────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* Status banner */}
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-800">
                        Headcount Ativo — rateio aplicado em todo o módulo
                    </p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                        Dados consolidados por CC usam a distribuição vigente do headcount.
                        Chapas sem headcount vigente mantêm o CC da TOTVS.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={onRefresh}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-colors"
                        title="Recarregar cache"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Stats grid */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <Database size={11} /> Registros
                        </div>
                        <span className="text-xl font-bold font-mono text-slate-800">{stats.totalRegistros}</span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <Users size={11} /> Chapas
                        </div>
                        <span className="text-xl font-bold font-mono text-slate-800">{stats.chapasUnicas}</span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <BarChart3 size={11} /> Centros de Custo
                        </div>
                        <span className="text-xl font-bold font-mono text-slate-800">{stats.ccUnicos}</span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <CalendarRange size={11} /> Período
                        </div>
                        <span className="text-xs font-semibold text-slate-700 font-mono leading-tight">
                            {formatDate(stats.periodoStart)}<br />→ {formatDate(stats.periodoEnd)}
                        </span>
                    </div>
                </div>
            )}

            {/* Diagnóstico de conservação */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                    onClick={() => setShowDiagnostic(d => !d)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Info size={14} className="text-slate-400" />
                        Diagnóstico de Conservação de Horas
                    </div>
                    <span className="text-xs text-slate-400">{showDiagnostic ? 'Ocultar' : 'Verificar'}</span>
                </button>

                {showDiagnostic && (
                    <div className="border-t border-slate-100 px-4 py-4 bg-slate-50">
                        {!diag ? (
                            <p className="text-xs text-slate-400 italic">
                                Nenhum dado TOTVS carregado para comparar.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Total Bruto', value: `${diag.totalBruto}h` },
                                        { label: 'Total Rateado', value: `${diag.totalRateado}h` },
                                        { label: 'Delta', value: `${diag.delta}h`, alert: Math.abs(diag.delta) > 0.01 },
                                        { label: 'Chapas s/ HC', value: `${diag.chapasSemHeadcount}`, alert: diag.chapasSemHeadcount > 0 },
                                    ].map(item => (
                                        <div key={item.label} className={`rounded-lg px-3 py-2 border ${item.alert ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                                            <div className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">{item.label}</div>
                                            <div className={`text-base font-bold font-mono ${item.alert ? 'text-amber-700' : 'text-slate-800'}`}>
                                                {item.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {Math.abs(diag.delta) <= 0.01 ? (
                                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                                        <CheckCircle2 size={13} />
                                        Conservação de horas confirmada — nenhuma hora foi criada ou perdida no rateio.
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                                        <AlertTriangle size={13} />
                                        Delta de {diag.delta}h — verifique se há chapas com headcount incompleto.
                                    </div>
                                )}
                                {diag.chapasSemHeadcount > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg">
                                        <Info size={13} className="shrink-0" />
                                        {diag.chapasSemHeadcount} chapa(s) sem headcount vigente estão usando o CC original da TOTVS como fallback auditável.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Ação de limpeza */}
            <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-slate-400">
                    Para atualizar o headcount, faça um novo upload abaixo.
                </p>
                {confirmClear ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-rose-600 font-medium">Confirmar limpeza?</span>
                        <button
                            onClick={handleClear}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors"
                        >
                            Sim, limpar
                        </button>
                        <button
                            onClick={() => setConfirmClear(false)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-medium hover:bg-rose-50 transition-colors"
                    >
                        <Trash2 size={12} />
                        Limpar headcount
                    </button>
                )}
            </div>
        </div>
    );
};

export default HeadcountGovernance;

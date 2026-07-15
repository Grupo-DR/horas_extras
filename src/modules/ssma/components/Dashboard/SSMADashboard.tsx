import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Users, AlertOctagon, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSSMADashboard } from '../../hooks/useSSMADashboard';
import { useSSMAStore } from '../../store/useSSMAStore';
import { SSMAInspectionEvent, SSMAMonthlyCollectiveResult, SSMAMonthlyPersonResult, SSMATargetFunctionGroup } from '../../types';
import { targetFunctionGroupLabel } from '../../domain/inspectionEventHelpers';
import { DashboardFilters } from './SSMADashboardFilters';
import { InspectionEventFormModal } from '../Inspections/InspectionEventFormModal';

const currentCompetence = () => new Date().toISOString().slice(0, 7);

const formatPercent = (value: number | null): string => {
    if (value === null || Number.isNaN(value)) return '-';
    return `${Math.round(value * 100)}%`;
};

const statusLabel = (status: SSMAMonthlyPersonResult['status']): string => {
    switch (status) {
        case 'ATENDE':
            return 'ATENDE';
        case 'NAO_ATENDE':
            return 'NAO ATENDE';
        case 'REALIZADO_SEM_META':
            return 'REALIZADO SEM META';
        case 'SEM_META':
        default:
            return 'SEM META';
    }
};

const statusClass = (status: SSMAMonthlyPersonResult['status']): string => {
    switch (status) {
        case 'ATENDE':
            return 'bg-emerald-50 text-emerald-700';
        case 'NAO_ATENDE':
            return 'bg-rose-50 text-rose-700';
        case 'REALIZADO_SEM_META':
            return 'bg-amber-50 text-amber-700';
        case 'SEM_META':
        default:
            return 'bg-gray-100 text-gray-600';
    }
};

const getGroupBreakdown = (result: SSMAMonthlyCollectiveResult | null) => {
    if (!result) return [];
    return [
        {
            group: 'GREG' as SSMATargetFunctionGroup,
            realIFS: result.realIFS_GREG,
            realAlojamento: result.realAloj_GREG,
            realHotel: result.realHotel_GREG,
            metaIFS: result.metaIFS_GREG,
            metaAlojamento: result.metaAloj_GREG,
            metaHotel: result.metaHotel_GREG
        },
        {
            group: 'GESTOR' as SSMATargetFunctionGroup,
            realIFS: result.realIFS_GESTOR,
            realAlojamento: result.realAloj_GESTOR,
            realHotel: result.realHotel_GESTOR,
            metaIFS: result.metaIFS_GESTOR,
            metaAlojamento: result.metaAloj_GESTOR,
            metaHotel: result.metaHotel_GESTOR
        },
        {
            group: 'SUPSSMA' as SSMATargetFunctionGroup,
            realIFS: result.realIFS_SUPSSMA,
            realAlojamento: result.realAloj_SUPSSMA,
            realHotel: result.realHotel_SUPSSMA,
            metaIFS: result.metaIFS_SUPSSMA,
            metaAlojamento: result.metaAloj_SUPSSMA,
            metaHotel: result.metaHotel_SUPSSMA
        },
        {
            group: 'TST' as SSMATargetFunctionGroup,
            realIFS: result.realIFS_TST,
            realAlojamento: result.realAloj_TST,
            realHotel: result.realHotel_TST,
            metaIFS: result.metaIFS_TST,
            metaAlojamento: result.metaAloj_TST,
            metaHotel: result.metaHotel_TST
        },
        {
            group: 'ENCARREGADO' as SSMATargetFunctionGroup,
            realIFS: result.realIFS_ENCARREGADO,
            realAlojamento: result.realAloj_ENCARREGADO,
            realHotel: result.realHotel_ENCARREGADO,
            metaIFS: result.metaIFS_ENCARREGADO,
            metaAlojamento: result.metaAloj_ENCARREGADO,
            metaHotel: result.metaHotel_ENCARREGADO
        }
    ].map(row => {
        const realTotal = row.realIFS + row.realAlojamento + row.realHotel;
        const metaTotal = row.metaIFS + row.metaAlojamento + row.metaHotel;
        return {
            ...row,
            realTotal,
            metaTotal,
            result: metaTotal > 0 ? Math.min(1, realTotal / metaTotal) : null
        };
    });
};

const MetricRealCell = ({ real, meta, className = '' }: { real: number, meta: number, className?: string }) => {
    const isEmpty = meta === 0 && real === 0;
    const isSuccess = meta === 0 ? real > 0 : real >= meta;
    
    let colorClass = "text-slate-500";
    if (!isEmpty) {
        colorClass = isSuccess ? "text-emerald-700 font-semibold bg-emerald-50/50" : "text-rose-700 font-semibold bg-rose-50/50";
    }
    
    return <td className={`px-3 py-3 text-center ${colorClass} ${className}`}>{real}</td>;
};

const ResultCell = ({ result, className = '' }: { result: number | null, className?: string }) => {
    const isSuccess = result !== null && result >= 1;
    let colorClass = "text-slate-500";
    if (result !== null) {
        colorClass = isSuccess ? "text-emerald-700 font-semibold bg-emerald-50/50" : "text-rose-700 font-semibold bg-rose-50/50";
    }
    
    return <td className={`px-3 py-3 text-center ${colorClass} ${className}`}>{formatPercent(result)}</td>;
};

export const SSMADashboard: React.FC = () => {
    const {
        filters,
        setFilters,
        loading,
        error,
        regionals,
        costCenters,
        events,
        personResults,
        collectiveResult
    } = useSSMADashboard({ competence: currentCompetence() });

    const { checklistItems, fetchChecklist } = useSSMAStore();
    const { profile } = useAuth();
    const [viewingEvent, setViewingEvent] = useState<SSMAInspectionEvent | null>(null);

    const handleOpenEvent = (eventId: string) => {
        const eventToView = events.find(e => e.id === eventId);
        if (eventToView) {
            setViewingEvent(eventToView);
        }
    };

    const sortedPersonResults = useMemo(() => {
        const order: Record<SSMATargetFunctionGroup, number> = { GREG: 1, GESTOR: 2, SUPSSMA: 3, TST: 4, ENCARREGADO: 5 };
        return [...personResults].sort((a, b) => {
            return (order[a.functionGroup] || 99) - (order[b.functionGroup] || 99);
        });
    }, [personResults]);

    useEffect(() => {
        fetchChecklist();
    }, [fetchChecklist]);

    const groupBreakdown = getGroupBreakdown(collectiveResult);

    const stats = useMemo(() => {
        let gravesAvaliados = 0;
        let gravesNC = 0;
        let gravissimosAvaliados = 0;
        let gravissimosNC = 0;

        const classificationMap = new Map<string, string>();
        checklistItems.forEach(i => classificationMap.set(i.id, i.ncClassification));

        events.forEach(event => {
            if (!event.items) return;
            event.items.forEach(item => {
                if (item.status === 'NA' || item.status === 'PENDENTE') return;
                const classification = (classificationMap.get(item.itemId) || '').toLowerCase().trim();
                
                if (classification === 'grave') {
                    gravesAvaliados++;
                    if (item.status === 'NAO_CONFORME') gravesNC++;
                } else if (classification === 'gravíssimo' || classification === 'gravissimo') {
                    gravissimosAvaliados++;
                    if (item.status === 'NAO_CONFORME') gravissimosNC++;
                }
            });
        });

        return {
            gravesAvaliados,
            gravesNC,
            gravesPercent: gravesAvaliados > 0 ? gravesNC / gravesAvaliados : 0,
            gravissimosAvaliados,
            gravissimosNC,
            gravissimosPercent: gravissimosAvaliados > 0 ? gravissimosNC / gravissimosAvaliados : 0,
        };
    }, [events, checklistItems]);

    const ncItemsList = useMemo(() => {
        const list: Array<{
            eventId: string;
            date: string;
            executor: string;
            costCenter: string;
            inspectionType: string;
            description: string;
            classification: string;
            comment: string;
        }> = [];

        events.forEach(event => {
            if (!event.items) return;
            event.items.forEach(item => {
                if (item.status === 'NAO_CONFORME') {
                    const checkItem = checklistItems.find(c => c.id === item.itemId);
                    list.push({
                        eventId: event.id,
                        date: event.date,
                        executor: event.executorNameSnapshot,
                        costCenter: event.costCenterNameSnapshot,
                        inspectionType: event.inspectionType,
                        description: checkItem?.description || 'Item desconhecido',
                        classification: checkItem?.ncClassification || '-',
                        comment: item.comment || '',
                    });
                }
            });
        });
        
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [events, checklistItems]);

    if (error) {
        return (
            <div className="rounded border border-rose-200 bg-rose-50 p-4 text-rose-700">
                <h2 className="font-semibold">Erro ao carregar dashboard</h2>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900">Gestão de Inspeções</h1>
                </div>
                {loading && <span className="text-sm font-semibold text-gray-500">Atualizando...</span>}
            </div>

            <DashboardFilters filters={filters} setFilters={setFilters} regionals={regionals} costCenters={costCenters} />

            {!collectiveResult ? (
                <div className="rounded border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                    <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                    Nenhum resultado calculado para a competência selecionada.
                </div>
            ) : (
                <>
                    {/* Top 3 Cards Layout */}
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* CARD 1: Inspeções vs Meta */}
                        <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Inspeções vs Meta</h3>
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Users size={20} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-slate-900">{events.length}</span>
                                    <span className="text-sm font-semibold text-slate-500">realizadas</span>
                                </div>
                                <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Meta Global</p>
                                        <p className="text-sm font-bold text-slate-800">{collectiveResult.totalMeta}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium">Atingimento</p>
                                        <p className="text-sm font-bold text-blue-600">{formatPercent(collectiveResult.totalMeta > 0 ? events.length / collectiveResult.totalMeta : null)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CARD 2: Gravíssimos */}
                        <div className={`flex flex-col justify-between rounded-xl border p-5 shadow-sm ${stats.gravissimosNC > 0 ? 'border-rose-200 bg-rose-50/50' : 'border-gray-200 bg-white'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-rose-800 uppercase tracking-wider">Itens Gravíssimos</h3>
                                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                                    <AlertOctagon size={20} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-rose-700">{stats.gravissimosNC}</span>
                                    <span className="text-sm font-semibold text-rose-600">Não Conformes</span>
                                </div>
                                <div className="mt-3 flex items-center gap-4 border-t border-rose-100/50 pt-3">
                                    <div>
                                        <p className="text-xs text-rose-600/80 font-medium">Itens Avaliados</p>
                                        <p className="text-sm font-bold text-rose-800">{stats.gravissimosAvaliados}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-rose-600/80 font-medium">% Falha</p>
                                        <p className="text-sm font-bold text-rose-700">{formatPercent(stats.gravissimosPercent)}</p>
                                    </div>
                                </div>
                                {stats.gravissimosNC > 0 && (
                                    <div className="mt-3 bg-rose-600 text-white text-[10px] uppercase tracking-wider font-bold text-center py-1 rounded">
                                        Risco Crítico - Interdição Imediata
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CARD 3: Graves */}
                        <div className={`flex flex-col justify-between rounded-xl border p-5 shadow-sm ${stats.gravesNC > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-white'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider">Itens Graves</h3>
                                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                    <AlertCircle size={20} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-amber-700">{stats.gravesNC}</span>
                                    <span className="text-sm font-semibold text-amber-600">Não Conformes</span>
                                </div>
                                <div className="mt-3 flex items-center gap-4 border-t border-amber-100/50 pt-3">
                                    <div>
                                        <p className="text-xs text-amber-600/80 font-medium">Itens Avaliados</p>
                                        <p className="text-sm font-bold text-amber-800">{stats.gravesAvaliados}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-amber-600/80 font-medium">% Falha</p>
                                        <p className="text-sm font-bold text-amber-700">{formatPercent(stats.gravesPercent)}</p>
                                    </div>
                                </div>
                                {stats.gravesNC > 0 && (
                                    <div className="mt-3 bg-amber-500 text-white text-[10px] uppercase tracking-wider font-bold text-center py-1 rounded">
                                        Risco Alto - Prazo 10 Dias
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded border border-gray-200 bg-white mt-6">
                        <div className="border-b border-gray-200 px-4 py-3">
                            <h2 className="text-sm font-semibold text-gray-900">Resultado coletivo por grupo</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-200">
                                        <th rowSpan={2} className="px-3 py-3 border-r border-gray-200 align-middle">Grupo</th>
                                        <th colSpan={2} className="px-3 py-2 text-center border-r border-gray-200">Alojamento</th>
                                        <th colSpan={2} className="px-3 py-2 text-center border-r border-gray-200">Hotel</th>
                                        <th colSpan={2} className="px-3 py-2 text-center border-r border-gray-200">Frente de Serviço</th>
                                        <th colSpan={3} className="px-3 py-2 text-center">Total</th>
                                    </tr>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50/50">
                                        <th className="px-3 py-2 text-center border-r border-gray-100">Meta</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-200">Real</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-100">Meta</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-200">Real</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-100">Meta</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-200">Real</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-100">Meta</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-100">Real</th>
                                        <th className="px-3 py-2 text-center">Resultado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {groupBreakdown.map(row => (
                                        <tr key={row.group} className="hover:bg-gray-50 border-b border-gray-100">
                                            <td className="px-3 py-3 font-semibold text-gray-900 border-r border-gray-200">{targetFunctionGroupLabel(row.group)}</td>
                                            <td className="px-3 py-3 text-center border-r border-gray-100">{row.metaAlojamento}</td>
                                            <MetricRealCell real={row.realAlojamento} meta={row.metaAlojamento} className="border-r border-gray-200" />
                                            <td className="px-3 py-3 text-center border-r border-gray-100">{row.metaHotel}</td>
                                            <MetricRealCell real={row.realHotel} meta={row.metaHotel} className="border-r border-gray-200" />
                                            <td className="px-3 py-3 text-center border-r border-gray-100">{row.metaIFS}</td>
                                            <MetricRealCell real={row.realIFS} meta={row.metaIFS} className="border-r border-gray-200" />
                                            <td className="px-3 py-3 text-center border-r border-gray-100 font-semibold">{row.metaTotal}</td>
                                            <MetricRealCell real={row.realTotal} meta={row.metaTotal} className="border-r border-gray-100" />
                                            <ResultCell result={row.result} />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded border border-gray-200 bg-white mt-6">
                        <div className="border-b border-gray-200 px-4 py-3">
                            <h2 className="text-sm font-semibold text-gray-900">Resultado individual</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-200">
                                        <th rowSpan={2} className="px-3 py-3 border-r border-gray-200 align-middle">Colaborador</th>
                                        <th rowSpan={2} className="px-3 py-3 border-r border-gray-200 align-middle">Função</th>
                                        <th colSpan={2} className="px-3 py-2 text-center border-r border-gray-200">Alojamento</th>
                                        <th colSpan={2} className="px-3 py-2 text-center border-r border-gray-200">Hotel</th>
                                        <th colSpan={2} className="px-3 py-2 text-center border-r border-gray-200">Frente de Serviço</th>
                                        <th colSpan={3} className="px-3 py-2 text-center border-r border-gray-200">Total</th>
                                    </tr>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50/50">
                                        <th className="px-3 py-2 text-center border-r border-gray-100">Meta</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-200">Real</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-100">Meta</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-200">Real</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-100">Meta</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-200">Real</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-100">Meta</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-100">Real</th>
                                        <th className="px-3 py-2 text-center border-r border-gray-200">Resultado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedPersonResults.length === 0 ? (
                                        <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">Nenhum colaborador no escopo atual.</td></tr>
                                    ) : (
                                        sortedPersonResults.map(result => (
                                            <tr key={result.id} className="hover:bg-gray-50 border-b border-gray-100">
                                                <td className="px-3 py-3 font-medium text-gray-900 border-r border-gray-200">{result.employeeNameSnapshot}</td>
                                                <td className="px-3 py-3 border-r border-gray-200">{targetFunctionGroupLabel(result.functionGroup)}</td>
                                                <td className="px-3 py-3 text-center border-r border-gray-100">{result.metaAlojamento}</td>
                                                <MetricRealCell real={result.realAlojamento} meta={result.metaAlojamento} className="border-r border-gray-200" />
                                                <td className="px-3 py-3 text-center border-r border-gray-100">{result.metaHotel}</td>
                                                <MetricRealCell real={result.realHotel} meta={result.metaHotel} className="border-r border-gray-200" />
                                                <td className="px-3 py-3 text-center border-r border-gray-100">{result.metaIFS}</td>
                                                <MetricRealCell real={result.realIFS} meta={result.metaIFS} className="border-r border-gray-200" />
                                                <td className="px-3 py-3 text-center border-r border-gray-100 font-semibold">{result.metaTotal}</td>
                                                <MetricRealCell real={result.realTotal} meta={result.metaTotal} className="border-r border-gray-100" />
                                                <ResultCell result={result.resultadoIndividual} className="border-r border-gray-200" />
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Tabela de Itens Não Conformes */}
                    <div className="overflow-hidden rounded border border-gray-200 bg-white mt-6">
                        <div className="border-b border-gray-200 px-4 py-3">
                            <h2 className="text-sm font-semibold text-gray-900">Itens Não Conformes Registrados</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        <th className="px-3 py-3">Data</th>
                                        <th className="px-3 py-3">Obra / Local</th>
                                        <th className="px-3 py-3">Inspetor</th>
                                        <th className="px-3 py-3">Tipo</th>
                                        <th className="px-3 py-3">Classificação</th>
                                        <th className="px-3 py-3">Item Avaliado</th>
                                        <th className="px-3 py-3">Comentário</th>
                                        <th className="px-3 py-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {ncItemsList.length === 0 ? (
                                        <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">Nenhum item não conforme registrado neste período.</td></tr>
                                    ) : (
                                        ncItemsList.map((nc, idx) => (
                                            <tr key={`${nc.eventId}-${idx}`} className="hover:bg-gray-50">
                                                <td className="px-3 py-3 whitespace-nowrap text-gray-900">
                                                    {new Date(nc.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                </td>
                                                <td className="px-3 py-3 font-medium text-gray-900">{nc.costCenter}</td>
                                                <td className="px-3 py-3 text-gray-500">{nc.executor}</td>
                                                <td className="px-3 py-3 text-gray-500">{nc.inspectionType}</td>
                                                <td className="px-3 py-3">
                                                    <span className={`inline-flex rounded px-2 py-1 text-[10px] uppercase font-bold tracking-wider ${
                                                        nc.classification.toLowerCase().includes('gravíssim') || nc.classification.toLowerCase().includes('gravissim')
                                                            ? 'bg-rose-100 text-rose-700'
                                                            : nc.classification.toLowerCase().includes('grave')
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                        {nc.classification}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-gray-900 max-w-md truncate" title={nc.description}>{nc.description}</td>
                                                <td className="px-3 py-3 text-gray-500 max-w-xs truncate" title={nc.comment}>{nc.comment || '-'}</td>
                                                <td className="px-3 py-3 text-right">
                                                    <button
                                                        onClick={() => handleOpenEvent(nc.eventId)}
                                                        className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                                                    >
                                                        Acessar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            <InspectionEventFormModal
                open={!!viewingEvent}
                event={viewingEvent}
                profile={profile}
                regionals={regionals}
                costCenters={costCenters}
                employees={[]}
                submitting={false}
                forceReadOnly={true}
                onClose={() => setViewingEvent(null)}
                onSubmit={async () => {}}
            />
        </div>
    );
};

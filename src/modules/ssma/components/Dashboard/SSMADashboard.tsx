import React from 'react';
import { AlertTriangle, BarChart3, Users } from 'lucide-react';
import { useSSMADashboard } from '../../hooks/useSSMADashboard';
import { SSMAMonthlyCollectiveResult, SSMAMonthlyPersonResult, SSMATargetFunctionGroup } from '../../types';
import { targetFunctionGroupLabel } from '../../domain/inspectionEventHelpers';
import { DashboardFilters } from './SSMADashboardFilters';

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
            metaIFS: result.metaIFS_GREG,
            metaAlojamento: result.metaAloj_GREG
        },
        {
            group: 'GESTOR' as SSMATargetFunctionGroup,
            realIFS: result.realIFS_GESTOR,
            realAlojamento: result.realAloj_GESTOR,
            metaIFS: result.metaIFS_GESTOR,
            metaAlojamento: result.metaAloj_GESTOR
        },
        {
            group: 'SUPSSMA' as SSMATargetFunctionGroup,
            realIFS: result.realIFS_SUPSSMA,
            realAlojamento: result.realAloj_SUPSSMA,
            metaIFS: result.metaIFS_SUPSSMA,
            metaAlojamento: result.metaAloj_SUPSSMA
        },
        {
            group: 'TST' as SSMATargetFunctionGroup,
            realIFS: result.realIFS_TST,
            realAlojamento: result.realAloj_TST,
            metaIFS: result.metaIFS_TST,
            metaAlojamento: result.metaAloj_TST
        },
        {
            group: 'ENCARREGADO' as SSMATargetFunctionGroup,
            realIFS: result.realIFS_ENCARREGADO,
            realAlojamento: result.realAloj_ENCARREGADO,
            metaIFS: result.metaIFS_ENCARREGADO,
            metaAlojamento: result.metaAloj_ENCARREGADO
        }
    ].map(row => {
        const realTotal = row.realIFS + row.realAlojamento;
        const metaTotal = row.metaIFS + row.metaAlojamento;
        return {
            ...row,
            realTotal,
            metaTotal,
            result: metaTotal > 0 ? realTotal / metaTotal : null
        };
    });
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

    const groupBreakdown = getGroupBreakdown(collectiveResult);

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
                    <h1 className="text-xl font-semibold text-gray-900">Dashboard SSMA</h1>
                    <p className="text-sm text-gray-500">Resultados calculados por eventos reais e metas mensais por pessoa.</p>
                </div>
                {loading && <span className="text-sm font-semibold text-gray-500">Atualizando...</span>}
            </div>

            <DashboardFilters filters={filters} setFilters={setFilters} regionals={regionals} costCenters={costCenters} />

            {!collectiveResult ? (
                <div className="rounded border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                    <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                    Nenhum resultado calculado para a competencia selecionada.
                </div>
            ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded border border-gray-200 bg-white p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Realizado</span>
                                <BarChart3 size={18} className="text-gray-400" />
                            </div>
                            <p className="mt-2 text-2xl font-semibold text-gray-900">{collectiveResult.totalRealizado}</p>
                        </div>
                        <div className="rounded border border-gray-200 bg-white p-4">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Meta total</span>
                            <p className="mt-2 text-2xl font-semibold text-gray-900">{collectiveResult.totalMeta}</p>
                        </div>
                        <div className="rounded border border-gray-200 bg-white p-4">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resultado coletivo</span>
                            <p className="mt-2 text-2xl font-semibold text-gray-900">{formatPercent(collectiveResult.resultadoColetivo)}</p>
                        </div>
                        <div className="rounded border border-gray-200 bg-white p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Eventos validos</span>
                                <Users size={18} className="text-gray-400" />
                            </div>
                            <p className="mt-2 text-2xl font-semibold text-gray-900">{events.length}</p>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded border border-gray-200 bg-white">
                        <div className="border-b border-gray-200 px-4 py-3">
                            <h2 className="text-sm font-semibold text-gray-900">Resultado coletivo por grupo</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        <th className="px-3 py-3">Grupo</th>
                                        <th className="px-3 py-3 text-center">Real IFS</th>
                                        <th className="px-3 py-3 text-center">Real Aloj.</th>
                                        <th className="px-3 py-3 text-center">Real Total</th>
                                        <th className="px-3 py-3 text-center">Meta IFS</th>
                                        <th className="px-3 py-3 text-center">Meta Aloj.</th>
                                        <th className="px-3 py-3 text-center">Meta Total</th>
                                        <th className="px-3 py-3 text-center">Resultado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {groupBreakdown.map(row => (
                                        <tr key={row.group} className="hover:bg-gray-50">
                                            <td className="px-3 py-3 font-semibold text-gray-900">{targetFunctionGroupLabel(row.group)}</td>
                                            <td className="px-3 py-3 text-center">{row.realIFS}</td>
                                            <td className="px-3 py-3 text-center">{row.realAlojamento}</td>
                                            <td className="px-3 py-3 text-center font-semibold">{row.realTotal}</td>
                                            <td className="px-3 py-3 text-center">{row.metaIFS}</td>
                                            <td className="px-3 py-3 text-center">{row.metaAlojamento}</td>
                                            <td className="px-3 py-3 text-center font-semibold">{row.metaTotal}</td>
                                            <td className="px-3 py-3 text-center font-semibold">{formatPercent(row.result)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded border border-gray-200 bg-white">
                        <div className="border-b border-gray-200 px-4 py-3">
                            <h2 className="text-sm font-semibold text-gray-900">Resultado individual</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        <th className="px-3 py-3">Colaborador</th>
                                        <th className="px-3 py-3">Funcao</th>
                                        <th className="px-3 py-3 text-center">Real IFS</th>
                                        <th className="px-3 py-3 text-center">Real Aloj.</th>
                                        <th className="px-3 py-3 text-center">Real Total</th>
                                        <th className="px-3 py-3 text-center">Meta IFS</th>
                                        <th className="px-3 py-3 text-center">Meta Aloj.</th>
                                        <th className="px-3 py-3 text-center">Meta Total</th>
                                        <th className="px-3 py-3 text-center">Resultado</th>
                                        <th className="px-3 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {personResults.length === 0 ? (
                                        <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">Nenhum colaborador no escopo atual.</td></tr>
                                    ) : (
                                        personResults.map(result => (
                                            <tr key={result.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-3 font-medium text-gray-900">{result.employeeNameSnapshot}</td>
                                                <td className="px-3 py-3">{targetFunctionGroupLabel(result.functionGroup)}</td>
                                                <td className="px-3 py-3 text-center">{result.realIFS}</td>
                                                <td className="px-3 py-3 text-center">{result.realAlojamento}</td>
                                                <td className="px-3 py-3 text-center font-semibold">{result.realTotal}</td>
                                                <td className="px-3 py-3 text-center">{result.metaIFS}</td>
                                                <td className="px-3 py-3 text-center">{result.metaAlojamento}</td>
                                                <td className="px-3 py-3 text-center font-semibold">{result.metaTotal}</td>
                                                <td className="px-3 py-3 text-center font-semibold">{formatPercent(result.resultadoIndividual)}</td>
                                                <td className="px-3 py-3">
                                                    <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${statusClass(result.status)}`}>
                                                        {statusLabel(result.status)}
                                                    </span>
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
        </div>
    );
};

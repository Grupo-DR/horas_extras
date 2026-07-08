import React from 'react';
import { SSMADashboardFilters } from '../../hooks/useSSMADashboard';
import { SSMACostCenter, SSMARegional } from '../../types';

interface Props {
    filters: SSMADashboardFilters;
    setFilters: (f: SSMADashboardFilters) => void;
    regionals: SSMARegional[];
    costCenters: SSMACostCenter[];
}

const currentCompetence = () => new Date().toISOString().slice(0, 7);

export const DashboardFilters: React.FC<Props> = ({ filters, setFilters, regionals, costCenters }) => {
    const filteredCostCenters = costCenters.filter(costCenter => !filters.regionalId || costCenter.regionalId === filters.regionalId);

    return (
        <div className="grid gap-3 rounded border border-gray-200 bg-white p-3 md:grid-cols-4">
            <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Competencia</span>
                <input
                    type="month"
                    value={filters.competence || currentCompetence()}
                    onChange={event => setFilters({ ...filters, competence: event.target.value })}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                />
            </label>
            <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Regional</span>
                <select
                    value={filters.regionalId || ''}
                    onChange={event => setFilters({ ...filters, regionalId: event.target.value || undefined, costCenterId: undefined })}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                >
                    <option value="">Todas</option>
                    {regionals.map(regional => <option key={regional.id} value={regional.id}>{regional.name}</option>)}
                </select>
            </label>
            <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Obra</span>
                <select
                    value={filters.costCenterId || ''}
                    onChange={event => setFilters({ ...filters, costCenterId: event.target.value || undefined })}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                >
                    <option value="">Todas</option>
                    {filteredCostCenters.map(costCenter => <option key={costCenter.id} value={costCenter.id}>{costCenter.code} - {costCenter.name}</option>)}
                </select>
            </label>
            <div className="flex items-end">
                <button
                    type="button"
                    onClick={() => setFilters({ competence: filters.competence || currentCompetence() })}
                    className="h-10 rounded border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                    Limpar filtros
                </button>
            </div>
        </div>
    );
};

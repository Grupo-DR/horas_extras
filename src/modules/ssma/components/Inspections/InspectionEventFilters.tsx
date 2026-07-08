import React from 'react';
import { SSMAInspectionEventFilters } from '../../hooks/useSSMAInspectionEvents';
import { SSMACostCenter, SSMAEmployee, SSMARegional } from '../../types';

interface Props {
    filters: SSMAInspectionEventFilters;
    regionals: SSMARegional[];
    costCenters: SSMACostCenter[];
    employees: SSMAEmployee[];
    onChange: (filters: SSMAInspectionEventFilters) => void;
}

const currentCompetence = () => new Date().toISOString().slice(0, 7);

export const InspectionEventFilters: React.FC<Props> = ({ filters, regionals, costCenters, employees, onChange }) => {
    const filteredCostCenters = costCenters.filter(costCenter => !filters.regionalId || costCenter.regionalId === filters.regionalId);

    const updateFilter = (patch: Partial<SSMAInspectionEventFilters>) => {
        onChange({ ...filters, ...patch });
    };

    return (
        <div className="grid gap-3 rounded border border-gray-200 bg-white p-3 md:grid-cols-3 xl:grid-cols-6">
            <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Competencia</span>
                <input
                    type="month"
                    value={filters.competence || currentCompetence()}
                    onChange={event => updateFilter({ competence: event.target.value })}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                />
            </label>
            <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Regional</span>
                <select
                    value={filters.regionalId || ''}
                    onChange={event => updateFilter({ regionalId: event.target.value || undefined, costCenterId: undefined })}
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
                    onChange={event => updateFilter({ costCenterId: event.target.value || undefined })}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                >
                    <option value="">Todas</option>
                    {filteredCostCenters.map(costCenter => (
                        <option key={costCenter.id} value={costCenter.id}>{costCenter.code} - {costCenter.name}</option>
                    ))}
                </select>
            </label>
            <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo</span>
                <select
                    value={filters.inspectionType || ''}
                    onChange={event => updateFilter({ inspectionType: event.target.value as any })}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                >
                    <option value="">Todos</option>
                    <option value="IFS">IFS</option>
                    <option value="ALOJAMENTO">ALOJAMENTO</option>
                </select>
            </label>
            <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Executor</span>
                <select
                    value={filters.executorUid || ''}
                    onChange={event => updateFilter({ executorUid: event.target.value || undefined })}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                >
                    <option value="">Todos</option>
                    {employees.map(employee => (
                        <option key={employee.uid || employee.id} value={employee.uid || employee.id}>{employee.name}</option>
                    ))}
                </select>
            </label>
            <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</span>
                <select
                    value={filters.status || ''}
                    onChange={event => updateFilter({ status: event.target.value as any })}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                >
                    <option value="">Todos</option>
                    <option value="VALID">Valido</option>
                    <option value="CANCELLED">Cancelado</option>
                </select>
            </label>
        </div>
    );
};

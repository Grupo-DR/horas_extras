import React from 'react';
import { SSMADashboardFilters } from '../../hooks/useSSMADashboard';
import { SSMARegional, SSMACostCenter } from '../../types';

interface Props {
    filters: SSMADashboardFilters;
    setFilters: (f: SSMADashboardFilters) => void;
    regionals: SSMARegional[];
    costCenters: SSMACostCenter[];
}

export const DashboardFilters: React.FC<Props> = ({ filters, setFilters, regionals, costCenters }) => {
    return (
        <div className="bg-white p-4 rounded shadow-sm flex flex-wrap gap-4 mb-6 items-end">
            <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Ano Base</label>
                <select
                    value={filters.year}
                    onChange={e => setFilters({ ...filters, year: Number(e.target.value) })}
                    className="border p-2 rounded text-sm w-32"
                >
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                    <option value={2028}>2028</option>
                </select>
            </div>
            
            <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Regional</label>
                <select 
                    value={filters.regionalId || ''} 
                    onChange={e => setFilters({ ...filters, regionalId: e.target.value || undefined, costCenterId: undefined })}
                    className="border p-2 rounded text-sm w-48"
                >
                    <option value="">Todas</option>
                    {regionals.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Centro de Custo</label>
                <select 
                    value={filters.costCenterId || ''} 
                    onChange={e => setFilters({ ...filters, costCenterId: e.target.value || undefined })}
                    className="border p-2 rounded text-sm w-48"
                    disabled={!filters.regionalId && costCenters.length > 50} // simplistic UX
                >
                    <option value="">Todos</option>
                    {costCenters
                        .filter(c => !filters.regionalId || c.regionalId === filters.regionalId)
                        .map(c => (
                        <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Gestor</label>
                <select 
                    value={filters.gestor || ''} 
                    onChange={e => setFilters({ ...filters, gestor: e.target.value || undefined })}
                    className="border p-2 rounded text-sm w-32"
                >
                    <option value="">Todos</option>
                    {/* Add options based on available gestores if needed */}
                </select>
            </div>
            
            <button 
                onClick={() => setFilters({ year: filters.year })} 
                className="bg-gray-100 px-4 py-2 rounded text-sm hover:bg-gray-200"
            >
                Limpar
            </button>
        </div>
    );
};

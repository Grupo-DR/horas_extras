import React from 'react';

export const InspectionEventFilters: React.FC<{ filters: any; setFilters: (f: any) => void }> = ({ filters, setFilters }) => {
    return (
        <div className="flex gap-4 mb-4">
            <input 
                type="text" 
                placeholder="Filtro Regional ID" 
                value={filters.regionalId || ''} 
                onChange={e => setFilters({ ...filters, regionalId: e.target.value })} 
                className="border p-2 rounded"
            />
            <input 
                type="text" 
                placeholder="Filtro Centro de Custo ID" 
                value={filters.costCenterId || ''} 
                onChange={e => setFilters({ ...filters, costCenterId: e.target.value })} 
                className="border p-2 rounded"
            />
            <button onClick={() => setFilters({})} className="bg-gray-200 px-4 py-2 rounded">Limpar</button>
        </div>
    );
};

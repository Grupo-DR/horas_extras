import React from 'react';

export const InspectionEventStatusBadge: React.FC<{ status: string }> = ({ status }) => {
    if (status === 'VALID') {
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Válido</span>;
    }
    return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">Cancelado</span>;
};

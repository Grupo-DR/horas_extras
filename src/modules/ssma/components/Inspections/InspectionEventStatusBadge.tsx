import React from 'react';

export const InspectionEventStatusBadge: React.FC<{ status: string }> = ({ status }) => {
    if (status === 'VALID') {
        return <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Valido</span>;
    }

    return <span className="inline-flex items-center rounded bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">Cancelado</span>;
};

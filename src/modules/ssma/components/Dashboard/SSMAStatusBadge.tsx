import React from 'react';

export const SSMAStatusBadge: React.FC<{ status: string }> = ({ status }) => {
    if (status === 'ATENDE') {
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Atende</span>;
    }
    return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">Não Atende</span>;
};

import React from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import { SSMAInspectionEvent } from '../../types';

interface Props {
    event: SSMAInspectionEvent;
    canEdit: boolean;
    canCancel: boolean;
    onEdit: (event: SSMAInspectionEvent) => void;
    onCancel: (event: SSMAInspectionEvent) => void;
}

export const InspectionEventActions: React.FC<Props> = ({ event, canEdit, canCancel, onEdit, onCancel }) => {
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => onEdit(event)}
                disabled={!canEdit}
                title="Editar lancamento"
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
                <Edit3 size={15} />
            </button>
            <button
                type="button"
                onClick={() => onCancel(event)}
                disabled={!canCancel}
                title="Apagar lancamento"
                className="inline-flex h-8 items-center gap-1 rounded border border-rose-200 px-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
                <Trash2 size={14} />
                Apagar
            </button>
        </div>
    );
};

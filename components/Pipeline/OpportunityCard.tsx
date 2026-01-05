
import React from 'react';
import { Opportunity } from '../../types';
import { Calendar, DollarSign, User, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OpportunityCardProps {
    opportunity: Opportunity;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onClick: (id: string) => void;
    onDelete?: (id: string) => void;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
    opportunity,
    onDragStart,
    onClick,
    onDelete
}) => {

    const isOverdue = new Date() > opportunity.deadline && opportunity.status === 'ATIVA';

    // Format currency
    const formattedValue = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(opportunity.estimatedValue);

    return (
        <div
            className={`
        bg-white p-4 rounded-lg shadow-sm border border-slate-200 
        hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing
        ${isOverdue ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-emerald-500'}
        group relative
      `}
            draggable
            onDragStart={(e) => onDragStart(e, opportunity.id)}
            onClick={() => onClick(opportunity.id)}
        >
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-slate-800 text-sm line-clamp-2 max-w-[85%]">
                    {opportunity.title}
                </h3>
                {onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(opportunity.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all absolute top-2 right-2"
                        title="Excluir"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
                {/* 
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {opportunity.probability}%
                </span>
                 */}
            </div>

            <div className="text-xs text-slate-500 mb-3 font-medium">
                {opportunity.clientName}
            </div>

            <div className="space-y-2">
                <div className="flex items-center text-xs text-slate-600">
                    <DollarSign className="w-3 h-3 mr-1 text-emerald-600" />
                    <span className="font-semibold">{formattedValue}</span>
                </div>

                <div className="flex items-center text-xs text-slate-500">
                    <User className="w-3 h-3 mr-1" />
                    <span className="truncate max-w-[150px]">{opportunity.responsibleId}</span>
                </div>

                <div className={`flex items-center text-xs ${isOverdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                    <Calendar className="w-3 h-3 mr-1" />
                    <span>{format(opportunity.deadline, "dd 'de' MMM", { locale: ptBR })}</span>
                </div>
            </div>
        </div>
    );
};


import React from 'react';
import { Bid } from '../../types';
import { Calendar, DollarSign, User, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserAvatar } from '../ui/UserAvatar';
import { useAuth } from '../../contexts/AuthContext';

interface BidCardProps {
    bid: Bid;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onClick: (id: string) => void;
    onDelete?: (id: string) => void;
}

export const BidCard: React.FC<BidCardProps> = ({
    bid,
    onDragStart,
    onClick,
    onDelete
}) => {
    const { users } = useAuth();

    // Resolve Internal Owner
    const internalOwner = users.find(u => u.id === bid.ownerId) || null;

    // Use current date
    const now = new Date();
    // Use 'deadline' as safe date
    const deadline = bid.deadline ? new Date(bid.deadline) : null;

    const isOverdue = deadline && now > deadline && bid.status === 'ABERTA';

    // Format currency
    const formattedValue = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(bid.estimatedValue || 0);

    return (
        <div
            className={`
        bg-white p-4 rounded-lg shadow-sm border border-slate-200 
        hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing
        ${isOverdue ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-emerald-500'}
        group relative
      `}
            draggable
            onDragStart={(e) => onDragStart(e, bid.id)}
            onClick={() => onClick(bid.id)}
        >
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-slate-800 text-sm line-clamp-2 max-w-[85%]">
                    {bid.title}
                </h3>
                {onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(bid.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all absolute top-2 right-2"
                        title="Excluir"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>

            <div className="text-xs text-slate-500 mb-3 font-medium">
                {bid.clientName || 'Cliente desconhecido'}
            </div>

            <div className="space-y-2">
                <div className="flex items-center text-xs text-slate-600">
                    <DollarSign className="w-3 h-3 mr-1 text-emerald-600" />
                    <span className="font-semibold">{formattedValue}</span>
                </div>

                {/* External Contact (Client Side) */}
                <div className="flex items-center text-xs text-slate-500">
                    <User className="w-3 h-3 mr-1" />
                    <span className="truncate max-w-[150px]" title={bid.contactName || 'N/A'}>
                        {bid.contactName || 'Contato N/A'}
                    </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <div className={`flex items-center text-xs ${isOverdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>{deadline ? format(deadline, "dd MMM", { locale: ptBR }) : 'S/P'}</span>
                    </div>

                    {/* Internal Owner Avatar */}
                    <div className="flex items-center gap-2">
                        {bid.priority && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${bid.priority === 'ALTA' ? 'bg-red-100 text-red-700' :
                                bid.priority === 'MÉDIA' ? 'bg-orange-100 text-orange-700' :
                                    'bg-emerald-100 text-emerald-700'
                                }`}>
                                {bid.priority}
                            </span>
                        )}
                        <div title={internalOwner ? internalOwner.name : 'Sem dono'}>
                            <UserAvatar user={internalOwner} size="sm" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

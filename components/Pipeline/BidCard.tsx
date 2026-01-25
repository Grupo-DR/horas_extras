
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
    const internalOwner = users.find(u => u.id === bid.ownerId) || null;
    const now = new Date();
    const creationDate = bid.date ? new Date(bid.date) : new Date(bid.createdAt);
    const daysOpen = Math.max(0, Math.floor((now.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Priority Colors & Effects
    const getPriorityStyles = () => {
        switch (bid.priority) {
            case 'ALTA':
                return {
                    border: 'border-l-4 border-l-red-500',
                    container: 'shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_20px_rgba(239,68,68,0.6)] border-red-200',
                    badge: 'bg-red-100 text-red-700',
                    neon: true
                };
            case 'MÉDIA':
                return {
                    border: 'border-l-4 border-l-amber-500',
                    container: 'hover:shadow-md border-slate-200',
                    badge: 'bg-amber-100 text-amber-700',
                    neon: false
                };
            case 'BAIXA':
            default:
                return {
                    border: 'border-l-4 border-l-emerald-500',
                    container: 'hover:shadow-md border-slate-200',
                    badge: 'bg-emerald-100 text-emerald-700',
                    neon: false
                };
        }
    };

    const styles = getPriorityStyles();

    // Format currency
    const formattedValue = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(bid.estimatedValue || 0);

    return (
        <div
            className={`
                bg-white p-4 rounded-lg transition-all duration-300 cursor-grab active:cursor-grabbing
                ${styles.border} ${styles.container}
                border-y border-r
                group relative
                ${styles.neon ? 'animate-pulse-slow' : ''} 
            `}
            style={styles.neon ? { animation: 'pulse-glow 2s infinite' } : {}}
            draggable
            onDragStart={(e) => onDragStart(e, bid.id)}
            onClick={() => onClick(bid.id)}
        >
            {/* Custom Neon Animation Style Injection */}
            {styles.neon && (
                <style>{`
                    @keyframes pulse-glow {
                        0%, 100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.3); }
                        50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); }
                    }
                `}</style>
            )}

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
                    {/* Creation Date & Duration */}
                    <div className="flex flex-col">
                        <div className="flex items-center text-[10px] text-slate-400" title="Data de Criação">
                            <Calendar className="w-3 h-3 mr-1" />
                            <span>{format(creationDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 pl-4 mt-0.5">
                            {daysOpen} dias em aberto
                        </span>
                    </div>

                    {/* Internal Owner & Priority Badge */}
                    <div className="flex items-center gap-2">
                        {bid.priority && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${styles.badge}`}>
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


import React from 'react';
import { Bid, TaskOutcome, PipelineStage } from '../../types';
import { Calendar, DollarSign, User, Trash2, Trophy } from 'lucide-react';
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
    const isWon = bid.result === TaskOutcome.SUCCESS;
    const isOutcomeStage = bid.pipelineStage === PipelineStage.RESULTADO;

    // Priority & Outcome Colors
    const getCardStyles = () => {
        // SPECIAL HANDLING FOR OUTCOME STAGE
        if (isOutcomeStage) {
            switch (bid.result) {
                case TaskOutcome.SUCCESS:
                    return {
                        border: 'border-l-4 border-transparent', // Handled by RGB Pulse
                        container: 'shadow-md border-slate-100 bg-white transition-all',
                        badge: 'bg-emerald-100 text-emerald-700',
                        neon: true, // RGB Neon
                        outcomeColor: 'rgb' // Custom flag
                    };
                case TaskOutcome.FAILURE:
                    return {
                        border: 'border-l-4 border-l-slate-400',
                        container: 'hover:shadow-md border-slate-200 bg-slate-50/50',
                        badge: 'bg-slate-100 text-slate-600',
                        neon: false
                    };
                case TaskOutcome.STUDY:
                    return {
                        border: 'border-l-4 border-l-orange-400',
                        container: 'hover:shadow-md border-slate-200',
                        badge: 'bg-orange-100 text-orange-700',
                        neon: false
                    };
                case TaskOutcome.WITHDRAWAL:
                    return {
                        border: 'border-l-4 border-l-blue-400',
                        container: 'hover:shadow-md border-slate-200',
                        badge: 'bg-blue-100 text-blue-700',
                        neon: false
                    };
                default:
                    // Fallback for Outcome stage without result (treat as inactive)
                    return {
                        border: 'border-l-4 border-l-slate-300',
                        container: 'border-slate-200',
                        badge: 'bg-slate-100 text-slate-500',
                        neon: false
                    };
            }
        }

        // STANDARD PRIORITY STYLES (Active Stages)
        switch (bid.priority) {
            case 'ALTA':
                return {
                    border: 'border-l-4 border-l-red-500',
                    container: 'shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_20px_rgba(239,68,68,0.6)] border-red-200',
                    badge: 'bg-red-100 text-red-700',
                    neon: true,
                    outcomeColor: 'red'
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

    const styles = getCardStyles();

    // Format currency
    const formattedValue = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(bid.estimatedValue || 0);

    return (
        <div
            className={`
                bg-white p-2 rounded-lg transition-all duration-300 cursor-grab active:cursor-grabbing
                ${styles.border} ${styles.container}
                border-y border-r
                group relative
                ${styles.neon && styles.outcomeColor === 'red' ? 'animate-pulse-slow' : ''} 
                ${styles.neon && styles.outcomeColor === 'rgb' ? 'animate-rgb-pulse' : ''}
            `}
            style={
                styles.neon && styles.outcomeColor === 'red' ? { animation: 'pulse-glow 2s infinite' } :
                    styles.neon && styles.outcomeColor === 'rgb' ? { animation: 'rgb-glow 3s infinite linear' } : {}
            }
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
                    @keyframes rgb-glow {
                        0% { box-shadow: 0 0 15px rgba(255, 0, 0, 0.5); border-left-color: #ff0000; }
                        33% { box-shadow: 0 0 15px rgba(0, 255, 0, 0.5); border-left-color: #00ff00; }
                        66% { box-shadow: 0 0 15px rgba(0, 0, 255, 0.5); border-left-color: #0000ff; }
                        100% { box-shadow: 0 0 15px rgba(255, 0, 0, 0.5); border-left-color: #ff0000; }
                    }
                `}</style>
            )}

            {/* Won Trophy & Badge Overlay - Compact */}
            {isWon && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none z-10 opacity-90">
                    <div className="bg-amber-100/50 p-1.5 rounded-full mb-0.5 border border-amber-200 backdrop-blur-sm">
                        <Trophy size={20} className="text-amber-600 fill-amber-500 animate-bounce" />
                    </div>
                    <span className="text-[8px] font-extrabold bg-amber-500 text-white px-1.5 py-0.5 rounded shadow-sm tracking-wider">
                        VENCEDORA
                    </span>
                </div>
            )}

            <div className="flex justify-between items-start mb-1 relative z-20">
                <h3 className={`font-semibold text-slate-800 text-[10px] line-clamp-2 leading-tight ${isWon ? 'max-w-[70%]' : 'max-w-[85%]'} flex items-center gap-1`}>
                    {bid.title}
                </h3>
                {onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(bid.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all absolute top-0 right-0"
                        title="Excluir"
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>

            <div className={`text-[10px] text-slate-500 mb-2 font-medium leading-tight ${isWon ? 'max-w-[70%]' : ''}`}>
                {bid.clientName || 'Cliente desconhecido'}
            </div>

            <div className="space-y-1">
                <div className="flex items-center text-[8px] text-slate-600">
                    <DollarSign className="w-2.5 h-2.5 mr-1 text-emerald-600" />
                    <span className="font-semibold">{formattedValue}</span>
                </div>

                {/* External Contact (Client Side) */}
                <div className="flex items-center text-[8px] text-slate-500">
                    <User className="w-2.5 h-2.5 mr-1" />
                    <span className="truncate max-w-[150px]" title={bid.contactName || 'N/A'}>
                        {bid.contactName || 'Contato N/A'}
                    </span>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-slate-100 mt-1">
                    {/* Creation Date & Duration */}
                    <div className="flex flex-col">
                        <div className="flex items-center text-[8px] text-slate-400" title="Chegada da Oportunidade">
                            <Calendar className="w-2.5 h-2.5 mr-1" />
                            <span>{format(creationDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                        </div>
                        <span className="text-[8px] font-bold text-slate-500 pl-3.5 leading-none">
                            {daysOpen} dias em aberto
                        </span>
                    </div>

                    {/* Internal Owner & Priority Badge */}
                    <div className="flex items-center gap-1">
                        {bid.priority && (
                            <span className={`text-[8px] font-bold px-1.5 py-0 rounded uppercase tracking-wider ${styles.badge}`}>
                                {bid.priority}
                            </span>
                        )}
                        <div title={internalOwner ? internalOwner.name : 'Sem dono'}>
                            <UserAvatar user={internalOwner} size="xs" />
                            {/* Might need to adjust size="xs" implementation if 32px is too big, but usually sm is 24px */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

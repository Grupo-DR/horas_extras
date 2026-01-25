import React from 'react';
import { PipelineStage, Bid, Task, User, TaskOutcome } from '../../types';
import { BidService } from '../../services/bidService';
import { PipelineColumn } from './PipelineColumn';
import { toast } from 'sonner';
import { getNextStage, getPipelineStages } from '../../domain/pipeline';
import { Filter as FilterIcon, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface PipelineBoardProps {
    bids: Bid[]; // Using Canonical Type
    refreshBids: () => void;
    onEditBid?: (bid: Bid) => void;
    onDeleteBid?: (id: string) => void;
    onTaskCreated?: (task: Task) => void;
}

export const PipelineBoard: React.FC<PipelineBoardProps> = ({ bids, refreshBids, onEditBid, onDeleteBid, onTaskCreated }) => {

    // Filter States
    const [clientFilter, setClientFilter] = React.useState('');
    const [contactFilter, setContactFilter] = React.useState('');
    const [ownerFilter, setOwnerFilter] = React.useState('');
    const [priorityFilter, setPriorityFilter] = React.useState('');

    // Derived Lists for Select Options
    const { clients = [], contacts = [] } = { clients: [], contacts: [] }; // Mock if Context not available, or derive from bids
    // Actually, deriving from BIDS is safer for "What is visible" filtering.
    // Also useAuth for Owners mapping
    const { users } = useAuth(); // Need to import useAuth

    const uniqueClients = React.useMemo(() => Array.from(new Set(bids.map(b => b.clientName).filter(Boolean))).sort(), [bids]);
    const uniqueContacts = React.useMemo(() => Array.from(new Set(bids.map(b => b.contactName).filter(Boolean))).sort(), [bids]);
    const uniqueOwners = React.useMemo(() => {
        const ownerIds = Array.from(new Set(bids.map(b => b.ownerId).filter(Boolean)));
        return ownerIds.map(id => users.find(u => u.id === id)).filter(Boolean) as User[];
    }, [bids, users]);

    // FILTER LOGIC
    const filteredBids = React.useMemo(() => {
        return bids.filter(bid => {
            if (clientFilter && bid.clientName !== clientFilter) return false;
            if (contactFilter && bid.contactName !== contactFilter) return false;
            if (ownerFilter && bid.ownerId !== ownerFilter) return false;
            if (priorityFilter && bid.priority !== priorityFilter) return false;
            return true;
        });
    }, [bids, clientFilter, contactFilter, ownerFilter, priorityFilter]);


    // Filter Opportunities/Bids by Stage and Sort by Priority
    const getBidsByStage = (stage: PipelineStage) => {
        const priorityOrder = { 'ALTA': 0, 'MÉDIA': 1, 'BAIXA': 2, undefined: 1 };

        const stageBids = filteredBids.filter(op => op.pipelineStage === stage);

        // Custom Sort for RESULTADO (Outcome) Stage
        if (stage === PipelineStage.RESULTADO) {
            return stageBids.sort((a, b) => {
                const isWinA = a.result === TaskOutcome.SUCCESS;
                const isWinB = b.result === TaskOutcome.SUCCESS;

                // 1. Winners First
                if (isWinA && !isWinB) return -1;
                if (!isWinA && isWinB) return 1;

                // 2. Sort by Date (Most Recent first) - using 'date' or 'createdAt'
                const dateA = a.date ? new Date(a.date).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const dateB = b.date ? new Date(b.date).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);

                return dateB - dateA;
            });
        }

        // Default Sort (Priority) for Active Stages
        return stageBids.sort((a, b) => {
            const pA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
            const pB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
            return pA - pB;
        });
    };

    // Drag Handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, targetStage: PipelineStage) => {
        e.preventDefault();
        const bidId = e.dataTransfer.getData('bidId'); // Changed from opportunityId
        if (!bidId) return;

        const bid = bids.find(op => op.id === bidId);
        if (!bid) return;

        if (bid.pipelineStage === targetStage) return;

        // Rule: Only allow moving to the EXACT NEXT stage.
        const nextStage = getNextStage(bid.pipelineStage);

        // SPECIAL RULE: Allow Backward "Aguardando Resultado" -> "Revisão"
        const isSpecialBackwards = bid.pipelineStage === PipelineStage.AGUARDANDO_RESULTADO && targetStage === PipelineStage.REVISAO_FINAL;
        const isForward = targetStage === nextStage;

        if (!isForward && !isSpecialBackwards) {
            toast.warning("Movimento não permitido.");
            return;
        }

        // Logic for Advancing (or Moving Back)
        try {
            // Use BidService directly
            const { updatedBid, createdTask } = await BidService.moveBid(bid.id, targetStage);

            // Update Parent State
            refreshBids();

            toast.success(`Movido para ${targetStage === PipelineStage.REVISAO_FINAL ? 'Revisão' : targetStage}`);

            // Trigger Task Modal
            if (onTaskCreated) {
                onTaskCreated(createdTask);
            }

        } catch (error: any) {
            toast.error(error.message || "Erro ao avançar etapa.");
        }
    };

    const handleCardClick = (id: string) => {
        const op = bids.find(o => o.id === id);
        if (op && onEditBid) {
            onEditBid(op);
        } else {
            toast.info("Detalhes em breve...");
        }
    };

    const stages = getPipelineStages();

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* FILTER BAR (NEW) */}
            <div className="flex items-center gap-2 p-2 border-b border-slate-200 bg-white/50 backdrop-blur-sm flex-wrap shrink-0">
                <div className="text-slate-400 mr-2">
                    <FilterIcon size={16} />
                </div>

                {/* Client Filter */}
                <select
                    className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 focus:outline-none focus:border-blue-400 max-w-[150px]"
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                >
                    <option value="">Todos Clientes</option>
                    {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {/* Contact Filter */}
                <select
                    className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 focus:outline-none focus:border-blue-400 max-w-[150px]"
                    value={contactFilter}
                    onChange={(e) => setContactFilter(e.target.value)}
                >
                    <option value="">Todos Contatos</option>
                    {uniqueContacts.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {/* Owner Filter */}
                <select
                    className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 focus:outline-none focus:border-blue-400 max-w-[150px]"
                    value={ownerFilter}
                    onChange={(e) => setOwnerFilter(e.target.value)}
                >
                    <option value="">Todos Responsáveis</option>
                    {uniqueOwners.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>

                {/* Priority Filter */}
                <select
                    className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 focus:outline-none focus:border-blue-400 max-w-[150px]"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                >
                    <option value="">Todas Prioridades</option>
                    <option value="ALTA">Alta</option>
                    <option value="MÉDIA">Média</option>
                    <option value="BAIXA">Baixa</option>
                </select>

                {/* Clear Filters (Only show if active) */}
                {(clientFilter || contactFilter || ownerFilter || priorityFilter) && (
                    <button
                        onClick={() => { setClientFilter(''); setContactFilter(''); setOwnerFilter(''); setPriorityFilter(''); }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1"
                    >
                        Limpar
                    </button>
                )}

                <div className="ml-auto text-xs text-slate-400">
                    {filteredBids.length} itens correspondentes
                </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex h-full gap-4 p-4 min-w-max">
                    {stages.map((stage) => (
                        <PipelineColumn
                            key={stage}
                            stage={stage}
                            bids={getBidsByStage(stage)} // Uses filteredBids
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onCardClick={handleCardClick}
                            onDelete={(id) => onDeleteBid && onDeleteBid(id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

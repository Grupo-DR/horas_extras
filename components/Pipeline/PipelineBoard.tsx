import React from 'react';
import { PipelineStage, Bid, Task } from '../../types';
import { BidService } from '../../services/bidService';
import { PipelineColumn } from './PipelineColumn';
import { toast } from 'sonner';
import { getNextStage, getPipelineStages } from '../../domain/pipeline';

interface PipelineBoardProps {
    bids: Bid[]; // Using Canonical Type
    refreshBids: () => void;
    onEditBid?: (bid: Bid) => void;
    onDeleteBid?: (id: string) => void;
    onTaskCreated?: (task: Task) => void;
}

export const PipelineBoard: React.FC<PipelineBoardProps> = ({ bids, refreshBids, onEditBid, onDeleteBid, onTaskCreated }) => {

    // Filter Opportunities/Bids by Stage and Sort by Priority
    const getBidsByStage = (stage: PipelineStage) => {
        const priorityOrder = { 'ALTA': 0, 'MÉDIA': 1, 'BAIXA': 2, undefined: 1 };

        return bids
            .filter(op => op.pipelineStage === stage)
            .sort((a, b) => {
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
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex h-full gap-4 p-4 min-w-max">
                    {stages.map((stage) => (
                        <PipelineColumn
                            key={stage}
                            stage={stage}
                            bids={getBidsByStage(stage)}
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

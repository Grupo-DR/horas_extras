import React, { useEffect, useState } from 'react';
import { PipelineStage, Opportunity, Task } from '../../types'; // Added Task
import { OpportunityService } from '../../services/opportunityService';
import { PipelineColumn } from './PipelineColumn';
import { toast } from 'sonner';
import { getNextStage, getPipelineStages } from '../../domain/pipeline'; // Import Domain

interface PipelineBoardProps {
    opportunities: Opportunity[]; // NEW
    refreshOpportunities: () => void; // NEW
    onEditOpportunity?: (opportunity: Opportunity) => void;
    onDeleteOpportunity?: (id: string) => void; // NEW
    onTaskCreated?: (task: Task) => void;
}

export const PipelineBoard: React.FC<PipelineBoardProps> = ({ opportunities, refreshOpportunities, onEditOpportunity, onDeleteOpportunity, onTaskCreated }) => {
    // REMOVED: Internal state and fetching




    // Filter Opportunities by Stage and Sort by Priority
    const getOpportunitiesByStage = (stage: PipelineStage) => {
        const priorityOrder = { 'ALTA': 0, 'MÉDIA': 1, 'BAIXA': 2, undefined: 1 };

        return opportunities
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
        const opportunityId = e.dataTransfer.getData('opportunityId');
        if (!opportunityId) return;

        const opportunity = opportunities.find(op => op.id === opportunityId);
        if (!opportunity) return;

        if (opportunity.pipelineStage === targetStage) return;

        // Rule: Only allow moving to the EXACT NEXT stage.
        const nextStage = getNextStage(opportunity.pipelineStage);

        // SPECIAL RULE: Allow Backward "Aguardando Resultado" -> "Revisão"
        const isSpecialBackwards = opportunity.pipelineStage === PipelineStage.AGUARDANDO_RESULTADO && targetStage === PipelineStage.REVISAO_FINAL;
        const isForward = targetStage === nextStage;

        if (!isForward && !isSpecialBackwards) {
            toast.warning("Movimento não permitido.");
            return;
        }

        // Logic for Advancing (or Moving Back)
        try {
            const { updatedOpportunity, createdTask } = await OpportunityService.moveOpportunity(opportunity.id, targetStage);

            // Update Local State
            // Update Parent State
            refreshOpportunities();

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
        const op = opportunities.find(o => o.id === id);
        if (op && onEditOpportunity) {
            onEditOpportunity(op);
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
                            opportunities={getOpportunitiesByStage(stage)}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onCardClick={handleCardClick}
                            onDelete={(id) => onDeleteOpportunity && onDeleteOpportunity(id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

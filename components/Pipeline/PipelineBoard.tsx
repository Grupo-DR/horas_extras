import React, { useEffect, useState } from 'react';
import { PipelineStage, Opportunity, Task } from '../../types'; // Added Task
import { OpportunityService } from '../../services/opportunityService';
import { PipelineColumn } from './PipelineColumn';
import { toast } from 'sonner';
import { getNextStage, getPipelineStages } from '../../domain/pipeline'; // Import Domain

interface PipelineBoardProps {
    onEditOpportunity?: (opportunity: Opportunity) => void;
    onTaskCreated?: (task: Task) => void; // New prop
}

export const PipelineBoard: React.FC<PipelineBoardProps> = ({ onEditOpportunity, onTaskCreated }) => {
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [loading, setLoading] = useState(true);

    // Load Opportunities
    const loadOpportunities = async () => {
        try {
            const data = await OpportunityService.getAll();
            setOpportunities(data);
        } catch (error) {
            console.error("Failed to load opportunities", error);
            toast.error("Erro ao carregar oportunidades.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOpportunities();
    }, []);

    // Filter Opportunities by Stage
    const getOpportunitiesByStage = (stage: PipelineStage) => {
        return opportunities.filter(op => op.pipelineStage === stage);
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

        if (targetStage !== nextStage) {
            toast.warning("Siga o fluxo: mova apenas para a próxima etapa.");
            return;
        }

        // Logic for Advancing
        try {
            const { updatedOpportunity, createdTask } = await OpportunityService.advanceOpportunityToNextStage(opportunity.id);

            // Update Local State
            setOpportunities(prev => prev.map(op =>
                op.id === opportunityId ? updatedOpportunity : op
            ));

            toast.success(`Avançou para ${targetStage}`);

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

    if (loading) return <div className="flex items-center justify-center h-full">Carregando Pipeline...</div>;

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
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

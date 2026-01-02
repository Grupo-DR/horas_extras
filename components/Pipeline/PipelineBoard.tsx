import React, { useEffect, useState } from 'react';
import { PipelineStage, Opportunity } from '../../types';
import { OpportunityService } from '../../services/opportunityService';
import { PipelineColumn } from './PipelineColumn';
import { toast } from 'sonner';

interface PipelineBoardProps {
    onEditOpportunity?: (opportunity: Opportunity) => void;
}

export const PipelineBoard: React.FC<PipelineBoardProps> = ({ onEditOpportunity }) => {
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
        e.preventDefault(); // Necessary to allow dropping
    };

    const handleDrop = async (e: React.DragEvent, targetStage: PipelineStage) => {
        e.preventDefault();
        const opportunityId = e.dataTransfer.getData('opportunityId');
        if (!opportunityId) return;

        const opportunity = opportunities.find(op => op.id === opportunityId);
        if (!opportunity) return;

        if (opportunity.pipelineStage === targetStage) return;

        // Optimistic Update? No, strict validation is safer to wait or try/catch.
        // We try to change stage in Service.
        try {
            await OpportunityService.changeStage(opportunity.id, opportunity, targetStage);

            // Update Local State (Refetching or manual update)
            // Manual update is faster
            const updatedOp = { ...opportunity, pipelineStage: targetStage };
            setOpportunities(prev => prev.map(op => op.id === opportunityId ? updatedOp : op));

            toast.success(`Movido para ${targetStage}`);
        } catch (error: any) {
            toast.error(error.message || "Não foi possível mover a oportunidade.");
            // Rollback not needed as we didn't optimistically update yet
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

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex h-full gap-4 p-4 min-w-max">
                    {Object.values(PipelineStage).map((stage) => (
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

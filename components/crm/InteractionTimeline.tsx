import React, { useEffect, useState } from 'react';
import { Interaction } from '../../types';
import { InteractionService } from '../../services/interactionService';
import { MessageSquare } from 'lucide-react';
import { TimelineItem } from './TimelineItem';
import { InteractionFormModal } from './InteractionFormModal';
import { toast } from 'sonner';

interface InteractionTimelineProps {
    clientId?: string;
    contactId?: string;
    bidId?: string;
    className?: string;
}

export const InteractionTimeline: React.FC<InteractionTimelineProps> = ({
    clientId,
    contactId,
    bidId,
    className
}) => {
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit/Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingInteraction, setEditingInteraction] = useState<Interaction | undefined>(undefined);

    useEffect(() => {
        let unsubscribe: () => void;

        setLoading(true);

        // Context Priority: Bid > Contact > Client
        if (bidId) {
            unsubscribe = InteractionService.subscribeByBid(bidId, (data) => {
                setInteractions(data);
                setLoading(false);
            });
        } else if (contactId) {
            unsubscribe = InteractionService.subscribeByContact(contactId, (data) => {
                setInteractions(data);
                setLoading(false);
            });
        } else if (clientId) {
            unsubscribe = InteractionService.subscribeByClient(clientId, (data) => {
                setInteractions(data);
                setLoading(false);
            });
        } else {
            // Fallback or empty
            setInteractions([]);
            setLoading(false);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [clientId, contactId, bidId]);

    const handleEdit = (interaction: Interaction) => {
        setEditingInteraction(interaction);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir esta interação?")) return;
        try {
            await InteractionService.delete(id);
            toast.success("Interação excluída.");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao excluir.");
        }
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingInteraction(undefined);
    };

    if (loading) {
        return <div className="p-4 text-center text-slate-500 text-sm">Carregando histórico...</div>;
    }

    if (interactions.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 ${className}`}>
                <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500 font-medium">Nenhuma interação registrada.</p>
                <p className="text-xs text-slate-400">Registre o primeiro contato para iniciar o histórico.</p>
            </div>
        );
    }

    return (
        <div className={`space-y-0 ${className}`}>
            {interactions.map((interaction, index) => (
                <TimelineItem
                    key={interaction.id}
                    interaction={interaction}
                    isLast={index === interactions.length - 1}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            ))}

            {/* Modal for Editing */}
            {isModalOpen && (
                <InteractionFormModal
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    initialData={editingInteraction}
                    // Pass IDs for context if needed, though update only needs ID usually
                    clientId={clientId || ''} // Fallback, not used for update ideally logic handles it
                    onSuccess={() => { }}
                />
            )}
        </div>
    );
};

import React, { useEffect, useState } from 'react';
import { Interaction } from '../../types';
import { InteractionService } from '../../services/interactionService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Phone, Users, Mail, MessageCircle, CalendarClock, Tag } from 'lucide-react';

interface InteractionTimelineProps {
    clientId?: string;
    contactId?: string;
    bidId?: string;
    className?: string;
}

const TYPE_ICONS: Record<string, any> = {
    'REUNIAO': Users,
    'LIGACAO': Phone,
    'VISITA': CalendarClock,
    'EMAIL': Mail,
    'WHATSAPP': MessageCircle
};

const TYPE_COLORS: Record<string, string> = {
    'REUNIAO': 'bg-purple-100 text-purple-700',
    'LIGACAO': 'bg-blue-100 text-blue-700',
    'VISITA': 'bg-orange-100 text-orange-700',
    'EMAIL': 'bg-slate-100 text-slate-700',
    'WHATSAPP': 'bg-green-100 text-green-700'
};

export const InteractionTimeline: React.FC<InteractionTimelineProps> = ({
    clientId,
    contactId,
    bidId,
    className
}) => {
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [loading, setLoading] = useState(true);

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
        <div className={`space-y-6 ${className}`}>
            {interactions.map((interaction, index) => {
                const Icon = TYPE_ICONS[interaction.type] || MessageSquare;
                const colorClass = TYPE_COLORS[interaction.type] || 'bg-gray-100 text-gray-700';
                const isFuture = new Date(interaction.date) > new Date();

                return (
                    <div key={interaction.id} className="relative pl-8 group">
                        {/* Timeline Line */}
                        {index !== interactions.length - 1 && (
                            <div className="absolute left-[15px] top-8 bottom-[-24px] w-0.5 bg-slate-200 group-hover:bg-slate-300 transition-colors" />
                        )}

                        {/* Icon Bubble */}
                        <div className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm border border-white ring-2 ring-slate-50 ${colorClass}`}>
                            <Icon className="w-4 h-4" />
                        </div>

                        {/* Content Card */}
                        <div className="bg-white border boundary-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                                        {interaction.title}
                                        {isFuture && (
                                            <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold uppercase border border-yellow-200">
                                                Agendado
                                            </span>
                                        )}
                                    </h4>
                                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                        {format(new Date(interaction.date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                        <span className="text-slate-300">•</span>
                                        Por {interaction.createdBy?.name || 'Sistema'}
                                    </span>
                                </div>
                            </div>

                            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                {interaction.notes}
                            </p>

                            {interaction.nextSteps && (
                                <div className="mt-3 bg-slate-50 border border-slate-100 rounded p-2 flex items-start gap-2">
                                    <div className="w-1 h-full min-h-[16px] bg-blue-400 rounded-full" />
                                    <p className="text-xs text-slate-700 font-medium">
                                        <span className="text-slate-500 font-normal">Próximo Passo: </span>
                                        {interaction.nextSteps}
                                    </p>
                                </div>
                            )}

                            {interaction.tags && interaction.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                    {interaction.tags.map(tag => (
                                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

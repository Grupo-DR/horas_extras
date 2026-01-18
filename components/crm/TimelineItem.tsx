import React from 'react';
import { Interaction } from '../../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, Users, Mail, MessageCircle, FileText, CheckCircle2 } from 'lucide-react';
import { useEntityLookup } from '../../hooks/useEntityLookup'; // Assumindo que este hook existe conforme sprint anterior
import { UserAvatar } from '../ui/UserAvatar'; // Assumindo componente visual existente

interface TimelineItemProps {
    interaction: Interaction;
    isLast?: boolean;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({ interaction, isLast }) => {
    const { getInternalUser } = useEntityLookup();
    const author = getInternalUser(interaction.createdBy.id);

    const getIcon = () => {
        switch (interaction.type) {
            case 'LIGACAO': return <Phone className="h-4 w-4 text-blue-600" />;
            case 'REUNIAO': return <Users className="h-4 w-4 text-purple-600" />;
            case 'EMAIL': return <Mail className="h-4 w-4 text-slate-500" />;
            case 'WHATSAPP': return <MessageCircle className="h-4 w-4 text-green-600" />;
            case 'VISITA': return <FileText className="h-4 w-4 text-orange-600" />;
            default: return <CheckCircle2 className="h-4 w-4 text-slate-400" />;
        }
    };

    return (
        <div className="relative flex gap-4 pb-8">
            {/* Linha Vertical Conectora */}
            {!isLast && (
                <span className="absolute left-[19px] top-8 h-full w-0.5 bg-slate-200" aria-hidden="true" />
            )}

            {/* Ícone Indicador */}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm z-10">
                {getIcon()}
            </div>

            {/* Conteúdo do Card */}
            <div className="flex flex-1 flex-col gap-1 pt-1">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">{interaction.title}</h4>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                        {format(parseISO(interaction.date), "d 'de' MMM, HH:mm", { locale: ptBR })}
                    </span>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                    {interaction.notes}
                </p>

                {interaction.nextSteps && (
                    <div className="mt-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 border border-blue-100">
                        <strong>Próximos Passos:</strong> {interaction.nextSteps}
                    </div>
                )}

                {/* Autor (Opcional, se quiser mostrar quem registrou) */}
                {author && (
                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">Registrado por:</span>
                        <span className="text-xs font-medium text-slate-600">{author.name}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

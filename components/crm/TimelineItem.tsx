import React from 'react';
import { Interaction } from '../../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, Users, Mail, MessageCircle, FileText, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { useEntityLookup } from '../../hooks/useEntityLookup';
import { useAuth } from '../../contexts/AuthContext';

interface TimelineItemProps {
    interaction: Interaction;
    isLast?: boolean;
    onEdit?: (interaction: Interaction) => void;
    onDelete?: (id: string) => void;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({ interaction, isLast, onEdit, onDelete }) => {
    const { getInternalUser } = useEntityLookup();
    const { user } = useAuth(); // for checking ownership if needed, or simply passed props handle it

    // Defensive check
    if (!interaction) return null;

    // Check if name is in createdBy object or resolved via hook
    const authorName = interaction.createdBy?.name || (interaction.createdBy?.id ? getInternalUser(interaction.createdBy.id)?.name : 'Sistema');

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
        <div className="relative flex gap-4 pb-8 group">
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

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                            {format(new Date(interaction.date), "d 'de' MMM, HH:mm", { locale: ptBR })}
                        </span>

                        {/* Actions (Visible on Hover) */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ml-2">
                            {onEdit && (
                                <button onClick={() => onEdit(interaction)} className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded">
                                    <Pencil size={12} />
                                </button>
                            )}
                            {onDelete && (
                                <button onClick={() => onDelete(interaction.id)} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded">
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                    {interaction.notes}
                </p>

                {interaction.nextSteps && (
                    <div className="mt-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 border border-blue-100">
                        <strong>Próximos Passos:</strong> {interaction.nextSteps}
                    </div>
                )}

                {interaction.tags && interaction.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {interaction.tags.map(tag => (
                            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Autor */}
                <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">Registrado por:</span>
                    <span className="text-xs font-medium text-slate-600">{authorName}</span>
                </div>
            </div>
        </div>
    );
};

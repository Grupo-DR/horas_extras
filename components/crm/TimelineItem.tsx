import React from 'react';
import { Interaction, Task, TaskStatus } from '../../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, Users, Mail, MessageCircle, FileText, CheckCircle2, Pencil, Trash2, PlusCircle, CheckSquare, Clock, AlertCircle } from 'lucide-react';
import { useEntityLookup } from '../../hooks/useEntityLookup';
import { useAuth } from '../../contexts/AuthContext';

interface TimelineItemProps {
    interaction: Interaction;
    tasks?: Task[]; // Linked tasks
    isLast?: boolean;
    onEdit?: (interaction: Interaction) => void;
    onDelete?: (id: string) => void;
    onCreateAction?: (interaction: Interaction) => void;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({ interaction, tasks = [], isLast, onEdit, onDelete, onCreateAction }) => {
    const { getInternalUser } = useEntityLookup();
    const { user } = useAuth();

    // Defensive check
    if (!interaction) return null;

    // Check if name is in createdBy object or resolved via hook
    const authorName = interaction.createdBy?.name || (interaction.createdBy?.id ? getInternalUser(interaction.createdBy.id)?.name : 'Sistema');

    // Filter linked tasks
    const linkedTasks = tasks.filter(t => t.interactionId === interaction.id);
    const pendingCount = linkedTasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS).length;
    const lateCount = linkedTasks.filter(t => t.status === TaskStatus.LATE).length;
    const doneCount = linkedTasks.filter(t => t.status === TaskStatus.COMPLETED).length;

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

                        {/* Actions (Always visible for better UX or keep generic group-hover) */}
                        <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {onCreateAction && (
                                <button
                                    onClick={() => onCreateAction(interaction)}
                                    className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded"
                                    title="Criar Ação Vinculada"
                                >
                                    <PlusCircle size={14} />
                                </button>
                            )}
                            {onEdit && (
                                <button
                                    onClick={() => onEdit(interaction)}
                                    className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded"
                                    title="Editar Interação"
                                >
                                    <Pencil size={14} />
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    onClick={() => onDelete(interaction.id)}
                                    className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded"
                                    title="Excluir Interação"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                    {interaction.notes}
                </p>

                {/* Next Steps / Tags */}
                <div className="flex flex-wrap gap-2 mt-2">
                    {interaction.nextSteps && (
                        <div className="max-w-fit rounded-md bg-blue-50 px-3 py-1 text-xs text-blue-700 border border-blue-100 flex items-center gap-1">
                            <strong>Próximos Passos:</strong> {interaction.nextSteps}
                        </div>
                    )}
                    {interaction.tags && interaction.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2 py-1 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            #{tag}
                        </span>
                    ))}
                </div>

                {/* Action Counters (Box) */}
                {linkedTasks.length > 0 && (
                    <div className="mt-3 flex gap-2">
                        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                            <span className="text-xs font-bold text-slate-700">Ações Vinculadas</span>
                            <div className="flex gap-3">
                                <div className="flex items-center gap-1 text-xs" title="Total">
                                    <div className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold">{linkedTasks.length}</div>
                                </div>
                                {pendingCount > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-blue-600" title="Em Andamento">
                                        <div className="px-2 py-0.5 rounded-full bg-blue-100 font-bold">{pendingCount}</div>
                                    </div>
                                )}
                                {lateCount > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-red-600" title="Atrasadas">
                                        <div className="px-2 py-0.5 rounded-full bg-red-100 font-bold">{lateCount}</div>
                                    </div>
                                )}
                                {doneCount > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-green-600" title="Concluídas">
                                        <div className="px-2 py-0.5 rounded-full bg-green-100 font-bold">{doneCount}</div>
                                    </div>
                                )}
                            </div>
                        </div>
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

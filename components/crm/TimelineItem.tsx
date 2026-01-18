import React from 'react';
import { Interaction } from '../../types'; // Root types
import { Phone, Users, Mail, MessageCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimelineItemProps {
    interaction: Interaction;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({ interaction }) => {

    const getIcon = (type: string) => {
        switch (type) {
            case 'LIGACAO': return <Phone size={16} className="text-blue-500" />;
            case 'REUNIAO': return <Users size={16} className="text-purple-500" />;
            case 'EMAIL': return <Mail size={16} className="text-slate-500" />;
            case 'WHATSAPP': return <MessageCircle size={16} className="text-emerald-500" />;
            default: return <Calendar size={16} className="text-gray-500" />;
        }
    };

    return (
        <div className="flex gap-4 group">
            {/* Timeline Line */}
            <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0 z-10 group-hover:border-blue-300 transition-colors">
                    {getIcon(interaction.type)}
                </div>
                <div className="w-px h-full bg-slate-200 group-last:hidden min-h-[30px]" />
            </div>

            {/* Content */}
            <div className="pb-8 flex-1">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">{interaction.title}</h4>
                        <span className="text-xs text-slate-400 capitalize bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                            {interaction.type.toLowerCase()}
                        </span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                        {format(new Date(interaction.date), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                </div>

                <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {interaction.notes}
                </p>

                {interaction.nextSteps && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-orange-600 font-medium">
                        <span className="px-1 py-0.5 bg-orange-50 rounded border border-orange-100">Próximos passos: {interaction.nextSteps}</span>
                    </div>
                )}

                <div className="mt-2 flex items-center gap-2">
                    {/* Avatar generator similar to UserAvatar but smaller/inline here for simplicity or render UserAvatar if imported */}
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] text-slate-500 font-bold">
                            {interaction.createdBy.name?.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs text-slate-400">{interaction.createdBy.name}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

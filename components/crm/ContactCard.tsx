import React from 'react';
import { ClientContact, ContactProfile } from '../../types';
import { User, Phone, Mail, Award, AlertCircle } from 'lucide-react';

interface ContactCardProps {
    contact: ClientContact & {
        analytics?: {
            profile: ContactProfile;
            daysSinceLastInteraction: number;
        }
    };
    onRegisterInteraction: () => void;
    onEdit?: () => void;
}

const PROFILE_CONFIG: Record<ContactProfile, { bg: string; text: string; label: string }> = {
    'CHAVE': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Contato Chave' },
    'OCASIONAL': { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Ocasional' },
    'SILENCIOSA': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Silencioso' },
};

export const ContactCard: React.FC<ContactCardProps> = ({
    contact,
    onRegisterInteraction,
    onEdit
}) => {
    const profile = contact.analytics?.profile || 'OCASIONAL';
    const cfg = PROFILE_CONFIG[profile];
    const silencePanic = profile === 'SILENCIOSA';

    return (
        <div className="group flex flex-col md:flex-row items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-200 transition-all shadow-sm">

            {/* Left: Info */}
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${contact.isActive ? 'bg-slate-100 text-slate-500' : 'bg-red-50 text-red-400'}`}>
                    <User className="w-5 h-5" />
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-semibold text-slate-800">{contact.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
                            {cfg.label}
                        </span>
                        {!contact.isActive && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Inativo</span>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 mb-1">{contact.role}</p>

                    <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                        {contact.email && (
                            <div className="flex items-center gap-1 hover:text-blue-600 transition-colors cursor-pointer" title={contact.email}>
                                <Mail className="w-3 h-3" />
                                <span className="truncate max-w-[150px]">{contact.email}</span>
                            </div>
                        )}
                        {contact.phone && (
                            <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                <span>{contact.phone}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Middle: Metrics (Mobile Hidden or Stacked) */}
            {contact.analytics && (
                <div className="my-3 md:my-0 md:mx-6 flex items-center gap-4 text-sm">
                    {silencePanic && (
                        <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                            <AlertCircle className="w-4 h-4" />
                            <span className="font-medium">
                                {contact.analytics.daysSinceLastInteraction}d sem contato
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Right: Actions */}
            <div className="w-full md:w-auto flex gap-2">
                {onEdit && (
                    <button
                        onClick={onEdit}
                        className="flex-1 md:flex-none px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Editar
                    </button>
                )}
                <button
                    onClick={onRegisterInteraction}
                    className="flex-1 md:flex-none px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                    <Phone className="w-3 h-3" />
                    Interagir
                </button>
            </div>

        </div>
    );
};

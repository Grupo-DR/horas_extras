import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle, Tag } from 'lucide-react';
import { Interaction, InteractionType } from '../../types';
import { InteractionService } from '../../services/interactionService';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

interface InteractionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId?: string;
    contactId?: string;
    bidId?: string;
    initialData?: Interaction; // For Edit Mode
    onSuccess?: () => void;
}

const INTERACTION_TYPES: { type: InteractionType; label: string; icon: string }[] = [
    { type: 'REUNIAO', label: 'Reunião', icon: '👥' },
    { type: 'LIGACAO', label: 'Ligação', icon: '📞' },
    { type: 'VISITA', label: 'Visita', icon: '🏢' },
    { type: 'EMAIL', label: 'E-mail', icon: '📧' },
    { type: 'WHATSAPP', label: 'WhatsApp', icon: '💬' },
];

export const InteractionFormModal: React.FC<InteractionFormModalProps> = ({
    isOpen,
    onClose,
    clientId,
    contactId,
    bidId,
    initialData,
    onSuccess
}) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: 'REUNIAO' as InteractionType,
        title: '',
        date: new Date().toISOString().slice(0, 16),
        notes: '',
        nextSteps: '',
        tags: ''
    });

    // Populate form on open/change
    useEffect(() => {
        if (isOpen && initialData) {
            setFormData({
                type: initialData.type,
                title: initialData.title,
                date: new Date(initialData.date).toISOString().slice(0, 16),
                notes: initialData.notes,
                nextSteps: initialData.nextSteps || '',
                tags: initialData.tags ? initialData.tags.join(', ') : ''
            });
        } else if (isOpen && !initialData) {
            // Reset if new
            setFormData({
                type: 'REUNIAO',
                title: '',
                date: new Date().toISOString().slice(0, 16),
                notes: '',
                nextSteps: '',
                tags: ''
            });
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) {
            toast.error('Erro de permissão: Usuário não autenticado.');
            return;
        }

        // Logic Check: Either we have IDs OR we are editing (so we have initialData)
        if (!clientId && !initialData) {
            toast.error('Erro: Contexto não identificado (Cliente/Bid/Contato).');
            return;
        }

        try {
            setLoading(true);
            const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(Boolean);

            const payloadBase = {
                type: formData.type,
                title: formData.title,
                date: new Date(formData.date),
                notes: formData.notes,
                nextSteps: formData.nextSteps || undefined,
                tags: tagsArray,
            };

            if (initialData?.id) {
                // UPDATE
                await InteractionService.update(initialData.id, payloadBase);
                toast.success('Interação atualizada!');
            } else {
                // CREATE
                await InteractionService.create({
                    ...payloadBase,
                    clientId: clientId!,
                    contactId,
                    bidId,
                    createdBy: {
                        id: user.uid,
                        name: user.displayName || user.email || 'Usuário',
                        email: user.email || ''
                    }
                });
                toast.success('Interação registrada!');
            }

            if (onSuccess) onSuccess();
            onClose();

        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar interação.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Panel */}
            <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl ring-1 ring-gray-200 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <h3 className="text-xl font-bold text-slate-800">
                        {initialData ? 'Editar Interação' : 'Registrar Interação'}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Type Selector */}
                    <div className="grid grid-cols-5 gap-2">
                        {INTERACTION_TYPES.map((t) => (
                            <button
                                key={t.type}
                                type="button"
                                onClick={() => setFormData({ ...formData, type: t.type })}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${formData.type === t.type
                                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <span className="text-xl mb-1">{t.icon}</span>
                                <span className="text-[10px] font-medium uppercase">{t.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Assunto / Título</label>
                        <input
                            type="text"
                            required
                            className="w-full rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500 text-sm shadow-sm"
                            placeholder="Ex: Alinhamento de proposta..."
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Data e Hora</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="datetime-local"
                                required
                                className="w-full pl-9 rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500 text-sm shadow-sm"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Resumo / Detalhes</label>
                        <textarea
                            required
                            rows={4}
                            className="w-full rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500 text-sm shadow-sm resize-none"
                            placeholder="Descreva o que foi conversado..."
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    {/* Next Steps */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Próximos Passos (Opcional)</label>
                        <div className="relative">
                            <CheckCircle className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-9 rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500 text-sm shadow-sm"
                                placeholder="Ex: Enviar orçamento revisado..."
                                value={formData.nextSteps}
                                onChange={e => setFormData({ ...formData, nextSteps: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tags (Separadas por vírgula)</label>
                        <div className="relative">
                            <Tag className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-9 rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500 text-sm shadow-sm"
                                placeholder="Ex: urgencia, diretoria, negociacao"
                                value={formData.tags}
                                onChange={e => setFormData({ ...formData, tags: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? 'Salvando...' : 'Salvar Interação'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

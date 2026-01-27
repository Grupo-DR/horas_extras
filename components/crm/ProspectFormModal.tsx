import React, { useState } from 'react';
import { X, Building2, User, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProspectService } from '../../services/prospectService';
import { Prospect } from '../../types';
import { toast } from 'sonner';

interface ProspectFormModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ProspectFormModal: React.FC<ProspectFormModalProps> = ({ isOpen, onClose }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        company: '',
        contactName: '',
        contactRole: '',
        location: '',
        strategicObservation: '',
        nextAction: '',
        nextActionDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        tags: '',
        estimatedValue: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await ProspectService.add({
                company: formData.company,
                contactName: formData.contactName,
                contactRole: formData.contactRole,
                location: formData.location || 'Não informado',
                stage: 'MAPEAR_CONTATO',

                // Owner is hardcoded for now, ideally comes from Auth Context
                owner: {
                    name: 'Vendedor', // Replace with real user
                    initials: 'V'
                },

                lastContactDate: new Date(),
                nextAction: formData.nextAction,
                nextActionDate: new Date(formData.nextActionDate),
                strategicObservation: formData.strategicObservation,
                estimatedValue: formData.estimatedValue ? Number(formData.estimatedValue) : undefined,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
            });

            toast.success('Prospect criado com sucesso!');
            onClose();
            // Reset Form
            setFormData({
                company: '',
                contactName: '',
                contactRole: '',
                location: '',
                strategicObservation: '',
                nextAction: '',
                nextActionDate: new Date().toISOString().split('T')[0],
                tags: '',
                estimatedValue: ''
            });

        } catch (error) {
            console.error(error);
            toast.error('Erro ao criar prospect.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed z-[70] bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]"
                        style={{ transform: 'translate(-50%, -50%)' }} // Force centering override if framer acts up, but framer usually handles it via layout. 
                    // Actually better to use fixed positioning strategy in CSS classes above: top-[50%] etc.
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Novo Prospect</h2>
                                <p className="text-sm text-slate-500">Adicionar empresa ao pipeline de prospecção</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <form id="prospect-form" onSubmit={handleSubmit} className="space-y-5">

                                {/* 1. Company Info */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Building2 size={12} /> Dados da Empresa
                                    </h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Nome da Empresa *</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Ex: Construtora ABC"
                                                value={formData.company}
                                                onChange={e => setFormData({ ...formData, company: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Localização</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                                <input
                                                    type="text"
                                                    className="w-full pl-9 rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="Cidade, Estado"
                                                    value={formData.location}
                                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Contact Person */}
                                <div className="space-y-3 pt-2">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <User size={12} /> Contato Principal
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Nome *</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Nome do contato"
                                                value={formData.contactName}
                                                onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Cargo *</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Cargo / Função"
                                                value={formData.contactRole}
                                                onChange={e => setFormData({ ...formData, contactRole: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Strategy & Action */}
                                <div className="space-y-3 pt-2">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        Estratégia Inicial
                                    </h3>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">Observação Estratégica *</label>
                                        <textarea
                                            required
                                            rows={2}
                                            className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Ex: Focada em obras industriais, potencial para locação de grande porte."
                                            value={formData.strategicObservation}
                                            onChange={e => setFormData({ ...formData, strategicObservation: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Próxima Ação *</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Ex: Pesquisar LinkedIn"
                                                value={formData.nextAction}
                                                onChange={e => setFormData({ ...formData, nextAction: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Data Limite *</label>
                                            <input
                                                required
                                                type="date"
                                                className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                value={formData.nextActionDate}
                                                onChange={e => setFormData({ ...formData, nextActionDate: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Potencial Estimado (R$)</label>
                                            <input
                                                type="number"
                                                className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Opicinal"
                                                value={formData.estimatedValue}
                                                onChange={e => setFormData({ ...formData, estimatedValue: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Tags (separar por vírgula)</label>
                                            <input
                                                type="text"
                                                className="w-full rounded-lg border-slate-200 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Industrial, Varejo..."
                                                value={formData.tags}
                                                onChange={e => setFormData({ ...formData, tags: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                            </form>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="prospect-form"
                                disabled={isSubmitting}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-600/20 transition-all disabled:opacity-70 flex items-center gap-2"
                            >
                                {isSubmitting ? 'Salvando...' : 'Criar Prospect'}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

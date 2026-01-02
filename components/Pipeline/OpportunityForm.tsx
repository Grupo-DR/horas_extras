
import React, { useState, useEffect } from 'react';
import { Opportunity, PipelineStage } from '../../types';
import { OpportunityService } from '../../services/opportunityService';
import { toast } from 'sonner';
import { X, Save } from 'lucide-react';

interface OpportunityFormProps {
    initialData?: Opportunity;
    onClose: () => void;
    onSave: () => void; // Trigger reload
}

export const OpportunityForm: React.FC<OpportunityFormProps> = ({ initialData, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<Opportunity>>({
        clientName: '',
        title: '',
        estimatedValue: 0,
        deadline: undefined,
        responsibleId: 'Antonio Augusto', // Mock default
        ...initialData // Override with initial if present
    });

    const [loading, setLoading] = useState(false);

    // Convert Date object to YYYY-MM-DD for input
    const formatDateForInput = (date?: Date) => {
        if (!date) return '';
        return date.toISOString().split('T')[0];
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (initialData?.id) {
                // Update
                await OpportunityService.update(initialData.id, formData);
                toast.success("Oportunidade atualizada!");
            } else {
                // Create (Validation happens in Service)
                // Ensure mandatory fields for Lead exist
                await OpportunityService.create({
                    title: formData.title || 'Nova Oportunidade',
                    clientName: formData.clientName!,
                    estimatedValue: Number(formData.estimatedValue) || 0,
                    responsibleId: formData.responsibleId!,
                    deadline: new Date(formData.deadline!)
                    // Description etc optional
                });
                toast.success("Oportunidade criada com sucesso!");
            }
            onSave(); // Reload parent
            onClose();
        } catch (error: any) {
            toast.error(error.message || "Erro ao salvar.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800">
                        {initialData ? 'Editar Oportunidade' : 'Nova Oportunidade'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                    <form id="opportunity-form" onSubmit={handleSubmit} className="space-y-4">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Title */}
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Título / Obra</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ex: Reforma Galpão Logístico"
                                />
                            </div>

                            {/* Client */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Cliente</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.clientName}
                                    onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Nome do Cliente"
                                />
                            </div>

                            {/* Responsible */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Responsável</label>
                                <select
                                    value={formData.responsibleId}
                                    onChange={e => setFormData({ ...formData, responsibleId: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="Antonio Augusto">Antonio Augusto</option>
                                    <option value="Cintia Ferreira">Cintia Ferreira</option>
                                    <option value="Nilton Camilo">Nilton Camilo</option>
                                </select>
                            </div>

                            {/* Value */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Valor Estimado (R$)</label>
                                <input
                                    type="number"
                                    value={formData.estimatedValue}
                                    onChange={e => setFormData({ ...formData, estimatedValue: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    min="0"
                                />
                            </div>

                            {/* Deadline */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Prazo Limite</label>
                                <input
                                    required
                                    type="date"
                                    value={formatDateForInput(formData.deadline)}
                                    onChange={e => setFormData({ ...formData, deadline: e.target.valueAsDate || undefined })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Stage Info (Read Only on Creation) */}
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mt-4">
                            <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Etapa do Pipeline</p>
                            <p className="text-sm font-medium text-blue-900 mt-1">
                                {initialData ? initialData.pipelineStage : 'LEAD RECEBIDO (Inicial)'}
                            </p>
                            <div className="mt-2 flex items-center text-xs text-blue-700">
                                <span className="font-bold mr-1">Probabilidade:</span>
                                {initialData ? initialData.probability : 10}%
                            </div>
                        </div>


                        {/* Decision Stage Fields */}
                        <div className="border-t border-slate-100 pt-4 mt-4">
                            <h3 className="text-sm font-bold text-slate-700 mb-3">Decisão de Participação</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Resumo do Escopo</label>
                                    <textarea
                                        rows={2}
                                        value={formData.scopeSummary || ''}
                                        onChange={e => setFormData({ ...formData, scopeSummary: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                        placeholder="Descreva brevemente o escopo..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Decisão (Go / No Go)</label>
                                    <select
                                        value={formData.decision || ''}
                                        onChange={e => setFormData({ ...formData, decision: e.target.value as 'GO' | 'NO_GO' })}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none font-bold ${formData.decision === 'GO' ? 'text-green-600 border-green-200 bg-green-50 focus:ring-green-500' :
                                                formData.decision === 'NO_GO' ? 'text-red-600 border-red-200 bg-red-50 focus:ring-red-500' :
                                                    'text-slate-500'
                                            }`}
                                    >
                                        <option value="">Pendente</option>
                                        <option value="GO">GO (Participar)</option>
                                        <option value="NO_GO">NO GO (Não Participar)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Optional Description */}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Observações</label>

                            <textarea
                                rows={3}
                                value={formData.description || ''}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            />
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="opportunity-form"
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={18} />
                        {loading ? 'Salvando...' : 'Salvar Oportunidade'}
                    </button>
                </div>

            </div>
        </div>
    );
};

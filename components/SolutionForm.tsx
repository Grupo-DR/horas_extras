import React, { useState } from 'react';
import { DataSolution, User } from '../types';
import { X, Save, Plus, Trash2 } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (solution: Omit<DataSolution, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    users: User[];
}

export const SolutionForm: React.FC<Props> = ({ isOpen, onClose, onSave, users }) => {
    const [loading, setLoading] = useState(false);

    // FORM STATE
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [deadline, setDeadline] = useState('');
    const [responsibleId, setResponsibleId] = useState('');
    const [stakeholderInput, setStakeholderInput] = useState('');
    const [stakeholders, setStakeholders] = useState<string[]>([]);

    const handleAddStakeholder = () => {
        if (stakeholderInput.trim()) {
            setStakeholders([...stakeholders, stakeholderInput.trim()]);
            setStakeholderInput('');
        }
    };

    const handleRemoveStakeholder = (idx: number) => {
        setStakeholders(stakeholders.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !responsibleId || !deadline) return;

        setLoading(true);
        try {
            const responsibleUser = users.find(u => u.id === responsibleId);

            const payload = {
                name,
                description,
                stakeholders,
                deadline: new Date(deadline + 'T12:00:00'), // Noon to avoid timezone issues
                responsibleId,
                responsibleName: responsibleUser?.name || 'Desconhecido',
                status: 'ACTIVE' as const
            };

            await onSave(payload);

            // Reset form
            setName('');
            setDescription('');
            setDeadline('');
            setResponsibleId('');
            setStakeholders([]);
            onClose();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar solução.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-slate-800">Nova Solução de Dados</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* NAME */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Nome da Solução *</label>
                        <input
                            type="text"
                            required
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ex: Dashboard de Vendas"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    {/* DESCRIPTION */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição</label>
                        <textarea
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                            placeholder="Objetivo e escopo da solução..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    {/* RESPONSIBLE */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Responsável *</label>
                        <select
                            required
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={responsibleId}
                            onChange={e => setResponsibleId(e.target.value)}
                        >
                            <option value="">Selecione...</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* DEADLINE */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Prazo de Entrega *</label>
                        <input
                            type="date"
                            required
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={deadline}
                            onChange={e => setDeadline(e.target.value)}
                        />
                    </div>

                    {/* STAKEHOLDERS */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Stakeholders</label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Nome do envolvido"
                                value={stakeholderInput}
                                onChange={e => setStakeholderInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddStakeholder())}
                            />
                            <button
                                type="button"
                                onClick={handleAddStakeholder}
                                className="bg-slate-100 px-3 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                <Plus size={20} className="text-slate-600" />
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {stakeholders.map((st, idx) => (
                                <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm flex items-center gap-1 border border-blue-100">
                                    {st}
                                    <button type="button" onClick={() => handleRemoveStakeholder(idx)} className="hover:text-red-500">
                                        <X size={14} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* FOOTER */}
                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Salvando...' : (
                                <>
                                    <Save size={18} />
                                    Criar Solução
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

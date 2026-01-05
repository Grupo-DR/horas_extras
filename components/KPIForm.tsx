import React, { useState } from 'react';
import { KPI, User } from '../types';
import { X, Save, Target } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (kpi: Omit<KPI, 'id' | 'currentValue' | 'history' | 'updatedAt'>) => Promise<void>;
    users: User[];
    initialData?: KPI;
}

export const KPIForm: React.FC<Props> = ({ isOpen, onClose, onSave, users, initialData }) => {
    const [loading, setLoading] = useState(false);

    // FORM STATE
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [unit, setUnit] = useState<KPI['unit']>('R$');
    const [targetValue, setTargetValue] = useState('');
    const [responsibleId, setResponsibleId] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);

    React.useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name);
            setDescription(initialData.description);
            setUnit(initialData.unit);
            setTargetValue(String(initialData.targetValue));
            setResponsibleId(initialData.responsibleId);
            setStartDate(initialData.startDate ? new Date(initialData.startDate) : undefined);
            setEndDate(initialData.endDate ? new Date(initialData.endDate) : undefined);
        } else if (isOpen) {
            setName('');
            setDescription('');
            setUnit('R$');
            setTargetValue('');
            setResponsibleId('');
            setStartDate(undefined);
            setEndDate(undefined);
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !responsibleId || !targetValue) return;

        setLoading(true);
        try {
            const responsibleUser = users.find(u => u.id === responsibleId);

            const payload = {
                name,
                description,
                unit,
                targetValue: Number(targetValue),
                responsibleId,
                responsibleName: responsibleUser?.name || 'Desconhecido',
                startDate,
                endDate
            };

            await onSave(payload);

            // Reset form
            setName('');
            setDescription('');
            setUnit('R$');
            setTargetValue('');
            setResponsibleId('');
            onClose();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar KPI.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Target className="text-blue-600" /> {initialData ? 'Editar Indicador' : 'Novo Indicador (KPI)'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* NAME */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Indicador *</label>
                        <input
                            type="text"
                            required
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ex: Faturamento Mensal"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    {/* DESCRIPTION */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição</label>
                        <textarea
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                            placeholder="O que este KPI mede?"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    {/* UNIT & TARGET */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Unidade *</label>
                            <select
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={unit}
                                onChange={e => setUnit(e.target.value as any)}
                            >
                                <option value="R$">Moeda (R$)</option>
                                <option value="%">Porcentagem (%)</option>
                                <option value="N">Numérico (Absoluto)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Meta *</label>
                            <input
                                type="number"
                                required
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="0.00"
                                value={targetValue}
                                onChange={e => setTargetValue(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* DATES */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Início</label>
                            <input
                                type="date"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={startDate ? startDate.toISOString().split('T')[0] : ''}
                                onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Fim / Prazo</label>
                            <input
                                type="date"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={endDate ? endDate.toISOString().split('T')[0] : ''}
                                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                            />
                        </div>
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

                    {/* FOOTER */}
                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 mt-6">
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
                                    {initialData ? 'Atualizar' : 'Criar Indicador'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

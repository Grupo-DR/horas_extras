import React, { useState } from 'react';
import { Contract, ContractStatus } from '../types';
import { X, Save } from 'lucide-react';
import { Timestamp } from 'firebase/firestore'; // Import for type awareness mainly

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (contract: any) => Promise<void>;
    initialData?: Contract;
}

export const ContractForm: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState({
        name: '',
        siteName: '',
        clientName: '',
        totalValue: 0,
        startDate: '',
        endDate: ''
    });

    React.useEffect(() => {
        if (isOpen && initialData) {
            setFormData({
                name: initialData.name,
                siteName: initialData.siteName,
                clientName: initialData.clientName,
                totalValue: initialData.totalValue || 0,
                startDate: initialData.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : '',
                endDate: initialData.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : ''
            });
        } else if (isOpen) {
            // Reset if opening in create mode
            setFormData({
                name: '',
                siteName: '',
                clientName: '',
                totalValue: 0,
                startDate: '',
                endDate: ''
            });
        }
    }, [isOpen, initialData]);

    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Safe conversion
            const contractPayload = {
                name: String(formData.name),
                siteName: String(formData.siteName),
                clientName: String(formData.clientName),
                totalValue: Number(formData.totalValue),
                // Convert strings to Dates for the Service to handle Timestamp conversion
                startDate: new Date(formData.startDate + 'T12:00:00'),
                endDate: new Date(formData.endDate + 'T12:00:00'),
                status: ContractStatus.ACTIVE
            };

            await onSave(contractPayload);
            onClose();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar contrato");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">

                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-lg">{initialData ? 'Editar Contrato' : 'Novo Contrato'}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Contrato / Obra</label>
                        <input
                            required
                            type="text"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Ex: Reforma Agência 304"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Local (Site)</label>
                            <input
                                required
                                type="text"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="Ex: São Paulo - SP"
                                value={formData.siteName}
                                onChange={e => setFormData({ ...formData, siteName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente</label>
                            <input
                                required
                                type="text"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="Ex: Banco X"
                                value={formData.clientName}
                                onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Global (R$)</label>
                        <input
                            required
                            type="number"
                            step="0.01"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                            placeholder="0,00"
                            value={formData.totalValue}
                            onChange={e => setFormData({ ...formData, totalValue: parseFloat(e.target.value) })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Início</label>
                            <input
                                required
                                type="date"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Previsão Fim</label>
                            <input
                                required
                                type="date"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={formData.endDate}
                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg mr-2 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/30"
                        >
                            {loading ? 'Salvando...' : <><Save size={18} /> {initialData ? 'Atualizar' : 'Criar Contrato'}</>}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

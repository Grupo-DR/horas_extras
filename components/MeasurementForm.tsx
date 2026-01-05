import React, { useState } from 'react';
import { X, Save, DollarSign } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (measurement: any) => Promise<void>;
    contractName: string;
}

export const MeasurementForm: React.FC<Props> = ({ isOpen, onClose, onSave, contractName }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        value: '',
        description: ''
    });

    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await onSave({
                date: new Date(formData.date + 'T12:00:00'),
                value: parseFloat(formData.value) || 0,
                description: formData.description
            });

            // Reset and close
            setFormData({
                date: new Date().toISOString().split('T')[0],
                value: '',
                description: ''
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert("Erro ao adicionar medição");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">

                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">Nova Medição</h3>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{contractName}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Medido (R$)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-slate-400 font-bold">R$</span>
                            </div>
                            <input
                                required
                                type="number"
                                step="0.01"
                                autoFocus
                                className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2 text-lg font-bold text-slate-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
                                placeholder="0.00"
                                value={formData.value}
                                onChange={e => setFormData({ ...formData, value: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Referência</label>
                        <input
                            required
                            type="date"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição / Nota Oficial</label>
                        <textarea
                            required
                            rows={2}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                            placeholder="Ex: Medição 1 - Fundações"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end pt-2">
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
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-green-500/30"
                        >
                            {loading ? 'Salvando...' : <><Save size={18} /> Confirmar</>}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

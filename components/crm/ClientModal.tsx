import React, { useState } from 'react';
import { X, Building2, Save } from 'lucide-react';
import { useCrm } from '../../contexts/CrmContext';

interface ClientModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose }) => {
    const { addClient } = useCrm();
    const [formData, setFormData] = useState({
        corporateName: '',
        tradeName: '',
        cnpj: '',
        segment: ''
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addClient({
            corporateName: formData.corporateName,
            tradeName: formData.tradeName || formData.corporateName, // Fallback if empty
            cnpj: formData.cnpj,
            segment: formData.segment,
            createdAt: new Date().toISOString()
        });
        onClose();
        setFormData({ corporateName: '', tradeName: '', cnpj: '', segment: '' }); // Reset
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Building2 size={20} className="text-blue-600" />
                        Nova Empresa
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Razão Social</label>
                        <input
                            required
                            type="text"
                            value={formData.corporateName}
                            onChange={e => setFormData({ ...formData, corporateName: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ex: Vale S.A."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Nome Fantasia</label>
                        <input
                            type="text"
                            value={formData.tradeName}
                            onChange={e => setFormData({ ...formData, tradeName: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ex: Vale"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">CNPJ</label>
                            <input
                                required
                                type="text"
                                value={formData.cnpj}
                                onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="00.000.000/0000-00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Segmento</label>
                            <input
                                type="text"
                                value={formData.segment}
                                onChange={e => setFormData({ ...formData, segment: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Ex: Mineração"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <Save size={18} />
                            Salvar Empresa
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

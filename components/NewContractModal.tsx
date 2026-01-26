import React, { useState } from 'react';
import { X, Save, Building, Calendar, DollarSign, FileText, Briefcase } from 'lucide-react';
import { Contract, ContractStatus } from '../types';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (contract: Contract) => void;
}

export const NewContractModal: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<Contract>>({
        status: ContractStatus.ACTIVE,
        contractorName: 'DR Construtora e Serviços Ltda', // Default?
    });

    const handleChange = (field: keyof Contract, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Basic Validation
        if (!formData.contractNumber || !formData.siteName || !formData.clientName || !formData.startDate || !formData.endDate || !formData.totalValue) {
            toast.error("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        const newContract: Contract = {
            id: crypto.randomUUID(),
            contractNumber: formData.contractNumber!,
            name: formData.siteName!, // Use Site Name as Contract Name for now
            status: ContractStatus.ACTIVE,
            clientName: formData.clientName!,
            siteName: formData.siteName!,
            contractorName: formData.contractorName || '',
            startDate: formData.startDate!,
            endDate: formData.endDate!,
            totalValue: Number(formData.totalValue),
            description: formData.description || '',
            measurements: [],
            events: []
        };

        onSave(newContract);
        onClose();
        toast.success("Contrato criado com sucesso!");
        // Reset form? maybe later
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* HEADER */}
                <div className="flex justify-between items-center p-6 border-b shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Briefcase className="text-blue-600" />
                            Novo Contrato
                        </h2>
                        <p className="text-sm text-slate-500">
                            Cadastre um novo contrato comercial para o sistema.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* FORM CONTENT */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[80vh]">

                    {/* SECTION 1: IDENTIFICATION */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Identificação</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nº do Contrato *</label>
                                <div className="relative">
                                    <FileText size={16} className="absolute left-3 top-3 text-slate-400" />
                                    <input
                                        type="text"
                                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                                        placeholder="Ex: CW61180"
                                        value={formData.contractNumber || ''}
                                        onChange={e => handleChange('contractNumber', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Obra *</label>
                                <div className="relative">
                                    <Building size={16} className="absolute left-3 top-3 text-slate-400" />
                                    <input
                                        type="text"
                                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                                        placeholder="Ex: Infra Norte - Trecho ZAR"
                                        value={formData.siteName || ''}
                                        onChange={e => handleChange('siteName', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: PARTIES */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Partes Envolvidas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Contratante (Cliente) *</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                                    placeholder="Ex: Rumo Malha Paulista"
                                    value={formData.clientName || ''}
                                    onChange={e => handleChange('clientName', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Contratada (Executor) *</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                                    placeholder="Ex: DR Construtora"
                                    value={formData.contractorName || ''}
                                    onChange={e => handleChange('contractorName', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: DETAILS */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Vigência e Valores</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Data Início *</label>
                                <div className="relative">
                                    <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
                                    <input
                                        type="date"
                                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                                        value={formData.startDate || ''}
                                        onChange={e => handleChange('startDate', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Data Fim *</label>
                                <div className="relative">
                                    <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
                                    <input
                                        type="date"
                                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                                        value={formData.endDate || ''}
                                        onChange={e => handleChange('endDate', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Valor do Contrato (R$) *</label>
                                <div className="relative">
                                    <DollarSign size={16} className="absolute left-3 top-3 text-slate-400" />
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                                        placeholder="0,00"
                                        value={formData.totalValue || ''}
                                        onChange={e => handleChange('totalValue', parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                </form>

                {/* FOOTER */}
                <div className="p-6 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-md transition-colors flex items-center gap-2"
                    >
                        <Save size={18} />
                        Salvar Contrato
                    </button>
                </div>

            </div>
        </div>
    );
};

import React, { useState } from 'react';
import { X, Save, Users, MapPin, User, Building } from 'lucide-react';
import { ContractTeam } from '../types';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (team: ContractTeam) => void;
}

export const ContractTeamModal: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<ContractTeam>>({
        name: '',
        location: '',
        leaderName: ''
    });

    const handleChange = (field: keyof ContractTeam, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.location || !formData.leaderName) {
            toast.error("Por favor, preencha todos os campos.");
            return;
        }

        const newTeam: ContractTeam = {
            id: crypto.randomUUID(),
            name: formData.name!,
            location: formData.location!,
            leaderName: formData.leaderName!,
            rdos: []
        };

        onSave(newTeam); // Parent handles saving to contract state
        onClose();
        setFormData({ name: '', location: '', leaderName: '' }); // Reset
        toast.success("Equipe adicionada com sucesso!");
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* HEADER */}
                <div className="flex justify-between items-center p-6 border-b shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Users className="text-blue-600" />
                            Nova Equipe
                        </h2>
                        <p className="text-sm text-slate-500">
                            Cadastre uma equipe para este contrato.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* FORM CONTENT */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Equipe *</label>
                        <div className="relative">
                            <Users size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                                placeholder="Ex: Equipe de Terraplanagem - Frente 1"
                                value={formData.name}
                                onChange={e => handleChange('name', e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Trecho / Local *</label>
                        <div className="relative">
                            <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                                placeholder="Ex: KM 120 - KM 125"
                                value={formData.location}
                                onChange={e => handleChange('location', e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Líder da Equipe *</label>
                        <div className="relative">
                            <User size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700"
                                placeholder="Ex: Engenheiro Carlos Silva"
                                value={formData.leaderName}
                                onChange={e => handleChange('leaderName', e.target.value)}
                            />
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
                        Salvar Equipe
                    </button>
                </div>

            </div>
        </div>
    );
};

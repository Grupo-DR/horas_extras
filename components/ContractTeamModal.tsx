import React, { useState, useEffect } from 'react';
import { X, Users, MapPin, Search } from 'lucide-react';
import { ContractTeam } from '../types';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (team: ContractTeam) => void;
    initialData?: ContractTeam | null;
}

export const ContractTeamModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [leaderName, setLeaderName] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setName(initialData.name);
                setLocation(initialData.location);
                setLeaderName(initialData.leaderName);
            } else {
                setName('');
                setLocation('');
                setLeaderName('');
            }
        }
    }, [isOpen, initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !location || !leaderName) {
            toast.error("Por favor, preencha todos os campos.");
            return;
        }

        onSave({
            id: initialData?.id || crypto.randomUUID(),
            name,
            location,
            leaderName,
            rdos: initialData?.rdos || []
        });

        onClose();
        setName('');
        setLocation('');
        setLeaderName('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-200">

                <div className="flex justify-between items-center p-6 border-b shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="text-blue-600" />
                        {initialData ? 'Editar Equipe' : 'Nova Equipe'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Equipe</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: Equipe Terraplanagem A"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Localização / Trecho</label>
                        <div className="relative">
                            <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Trecho ZAR - Km 20"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Líder / Encarregado</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Nome do Responsável"
                                value={leaderName}
                                onChange={e => setLeaderName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-md"
                        >
                            Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


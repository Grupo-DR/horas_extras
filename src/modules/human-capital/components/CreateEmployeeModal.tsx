
import React, { useState } from 'react';

export const CreateEmployeeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, chapa: string, cc: string, role: string) => void;
    costCenters: string[];
}> = ({ isOpen, onClose, onSave, costCenters }) => {
    const [name, setName] = useState('');
    const [chapa, setChapa] = useState('');
    const [cc, setCc] = useState('');
    const [role, setRole] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!name || !chapa || !cc) return;
        onSave(name, chapa, cc, role);
        setName(''); setChapa(''); setCc(''); setRole('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Novo Colaborador Manual</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Maria Souza" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chapa / ID</label>
                        <input type="text" value={chapa} onChange={e => setChapa(e.target.value)} className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: M-12345" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Centro de Custo</label>
                        <select value={cc} onChange={e => setCc(e.target.value)} className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Selecione...</option>
                            {costCenters.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Função / Cargo</label>
                        <input type="text" value={role} onChange={e => setRole(e.target.value)} className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Pedreiro" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-lg">Cancelar</button>
                    <button onClick={handleSubmit} disabled={!name || !chapa || !cc} className="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">Salvar Colaborador</button>
                </div>
            </div>
        </div>
    );
};

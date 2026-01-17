import React, { useState } from 'react';
import { X, Users, Save } from 'lucide-react';
import { useCrm } from '../../contexts/CrmContext';

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
    const { addContact, clients } = useCrm();
    const [formData, setFormData] = useState({
        clientId: '',
        name: '',
        role: '',
        email: '',
        phone: ''
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addContact({
            clientId: formData.clientId,
            name: formData.name,
            role: formData.role,
            email: formData.email,
            phone: formData.phone
        });
        onClose();
        setFormData({ clientId: '', name: '', role: '', email: '', phone: '' }); // Reset
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Users size={20} className="text-emerald-600" />
                        Novo Contato
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* Company Select */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Empresa Vinculada</label>
                        <select
                            required
                            value={formData.clientId}
                            onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="">Selecione a empresa...</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>
                                    {client.tradeName || client.corporateName}
                                </option>
                            ))}
                        </select>
                        {clients.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">Cadastre uma empresa primeiro.</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Nome Completo</label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="Ex: Roberto Mendes"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Cargo</label>
                        <input
                            required
                            type="text"
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="Ex: Gerente de Projetos"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
                            <input
                                required
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="email@empresa.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Telefone / Cel</label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="(00) 00000-0000"
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
                            disabled={clients.length === 0}
                            className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg shadow hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={18} />
                            Salvar Contato
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

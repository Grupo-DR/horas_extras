import React, { useState, useEffect } from 'react';
import { ClientContact } from '../../types';
import { X, Users, Save } from 'lucide-react';
import { useCrm } from '../../contexts/CrmContext';

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    contactToEdit?: ClientContact;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, contactToEdit }) => {
    // @ts-ignore
    const { addContact, updateContact, clients } = useCrm();
    const [formData, setFormData] = useState({
        clientId: '',
        name: '',
        role: '',
        department: '',
        email: '',
        phone: '',
        notes: '',
        address: {
            street: '',
            number: '',
            complement: '',
            neighborhood: '',
            city: '',
            state: '',
            zipCode: ''
        }
    });

    // Populate Form on Edit
    useEffect(() => {
        if (contactToEdit) {
            setFormData({
                clientId: contactToEdit.clientId,
                name: contactToEdit.name,
                role: contactToEdit.role,
                department: contactToEdit.department || '',
                email: contactToEdit.email || '',
                phone: contactToEdit.phone || '',
                notes: contactToEdit.notes || '',
                address: {
                    street: contactToEdit.address?.street || '',
                    number: contactToEdit.address?.number || '',
                    complement: contactToEdit.address?.complement || '',
                    neighborhood: contactToEdit.address?.neighborhood || '',
                    city: contactToEdit.address?.city || '',
                    state: contactToEdit.address?.state || '',
                    zipCode: contactToEdit.address?.zipCode || ''
                }
            });
        } else {
            // Reset
            setFormData({
                clientId: '', name: '', role: '', department: '', email: '', phone: '', notes: '',
                address: { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' }
            });
        }
    }, [contactToEdit, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (contactToEdit) {
            await updateContact(contactToEdit.id, {
                clientId: formData.clientId,
                name: formData.name,
                role: formData.role,
                department: formData.department,
                email: formData.email,
                phone: formData.phone,
                notes: formData.notes,
                address: formData.address
            });
        } else {
            await addContact({
                clientId: formData.clientId,
                name: formData.name,
                role: formData.role,
                department: formData.department,
                email: formData.email,
                phone: formData.phone,
                notes: formData.notes,
                address: formData.address,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            } as any);
        }

        onClose();
        if (!contactToEdit) {
            setFormData({
                clientId: '', name: '', role: '', department: '', email: '', phone: '', notes: '',
                address: { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' }
            });
        }
    };

    const updateAddress = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            address: { ...prev.address, [field]: value }
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Users size={20} className="text-emerald-600" />
                        Novo Contato
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">

                    {/* Company Select */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Empresa Vinculada</label>
                        <select
                            required
                            value={formData.clientId}
                            onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none block"
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

                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-900 border-b pb-2">Dados Pessoais</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Setor / Departamento</label>
                                <input
                                    type="text"
                                    value={formData.department}
                                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="Ex: Engenharia"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-900 border-b pb-2">Contato</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>

                    {/* Address Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-900 border-b pb-2">Endereço</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium text-slate-600 mb-1">CEP</label>
                                <input
                                    type="text"
                                    value={formData.address.zipCode}
                                    onChange={e => updateAddress('zipCode', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Logradouro</label>
                                <input
                                    type="text"
                                    value={formData.address.street}
                                    onChange={e => updateAddress('street', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Número</label>
                                <input
                                    type="text"
                                    value={formData.address.number}
                                    onChange={e => updateAddress('number', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Complemento</label>
                                <input
                                    type="text"
                                    value={formData.address.complement}
                                    onChange={e => updateAddress('complement', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Bairro</label>
                                <input
                                    type="text"
                                    value={formData.address.neighborhood}
                                    onChange={e => updateAddress('neighborhood', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Cidade</label>
                                <input
                                    type="text"
                                    value={formData.address.city}
                                    onChange={e => updateAddress('city', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Estado</label>
                                <input
                                    type="text"
                                    value={formData.address.state}
                                    onChange={e => updateAddress('state', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Observações</label>
                        <textarea
                            rows={3}
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="Informações adicionais sobre o contato..."
                        />
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

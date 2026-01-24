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
        segment: '',
        clientType: 'PRIVADA',
        origin: 'PROSPECCAO_INTERNA',
        primaryEmail: '',
        website: '',
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

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addClient({
            corporateName: formData.corporateName,
            tradeName: formData.tradeName || formData.corporateName,
            cnpj: formData.cnpj,
            segment: formData.segment,
            clientType: formData.clientType as any,
            origin: formData.origin as any,
            primaryEmail: formData.primaryEmail,
            website: formData.website,
            address: formData.address,
            status: 'ATIVA',
            createdAt: new Date().toISOString() as any,
            updatedAt: new Date().toISOString() as any
        });
        onClose();
        // Reset full state
        setFormData({
            corporateName: '', tradeName: '', cnpj: '', segment: '',
            clientType: 'PRIVADA', origin: 'PROSPECCAO_INTERNA', primaryEmail: '', website: '',
            address: { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' }
        });
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
                        <Building2 size={20} className="text-blue-600" />
                        Nova Empresa
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-900 border-b pb-2">Informações Básicas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Razão Social *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.corporateName}
                                    onChange={e => setFormData({ ...formData, corporateName: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Nome Fantasia</label>
                                <input
                                    type="text"
                                    value={formData.tradeName}
                                    onChange={e => setFormData({ ...formData, tradeName: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">CNPJ *</label>
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
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Empresa</label>
                                <select
                                    value={formData.clientType}
                                    onChange={e => setFormData({ ...formData, clientType: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                    <option value="PRIVADA">Privada</option>
                                    <option value="PUBLICA">Pública</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Origem</label>
                                <select
                                    value={formData.origin}
                                    onChange={e => setFormData({ ...formData, origin: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                    <option value="PROSPECCAO_INTERNA">Prospecção Interna</option>
                                    <option value="INDICACAO">Indicação</option>
                                    <option value="CONTATO_PASSIVO">Contato Passivo</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-900 border-b pb-2">Contato Digital</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Email Principal</label>
                                <input
                                    type="email"
                                    value={formData.primaryEmail}
                                    onChange={e => setFormData({ ...formData, primaryEmail: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Website</label>
                                <input
                                    type="url"
                                    value={formData.website}
                                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="https://"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-900 border-b pb-2">Localização</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium text-slate-600 mb-1">CEP</label>
                                <input
                                    type="text"
                                    value={formData.address.zipCode}
                                    onChange={e => updateAddress('zipCode', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Logradouro</label>
                                <input
                                    type="text"
                                    value={formData.address.street}
                                    onChange={e => updateAddress('street', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Número</label>
                                <input
                                    type="text"
                                    value={formData.address.number}
                                    onChange={e => updateAddress('number', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Complemento</label>
                                <input
                                    type="text"
                                    value={formData.address.complement}
                                    onChange={e => updateAddress('complement', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Bairro</label>
                                <input
                                    type="text"
                                    value={formData.address.neighborhood}
                                    onChange={e => updateAddress('neighborhood', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Cidade</label>
                                <input
                                    type="text"
                                    value={formData.address.city}
                                    onChange={e => updateAddress('city', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-600 mb-1">Estado</label>
                                <input
                                    type="text"
                                    value={formData.address.state}
                                    onChange={e => updateAddress('state', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
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

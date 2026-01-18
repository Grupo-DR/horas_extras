import React, { useState } from 'react';
import { Users, Building2, Trash2 } from 'lucide-react';
import { useCrm } from '../../contexts/CrmContext';
import { ClientModal } from '../../components/crm/ClientModal';
import { ContactModal } from '../../components/crm/ContactModal';

export const RelationshipDashboard: React.FC = () => {
    const [showClientModal, setShowClientModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);

    // Data State (Global from Context)
    const { clients, contacts, removeClient, removeContact } = useCrm();

    const handleDeleteClient = (id: string, name: string) => {
        if (window.confirm(`Tem certeza que deseja excluir a empresa "${name}"? Todos os contatos vinculados também serão excluídos.`)) {
            removeClient(id);
        }
    };

    const handleDeleteContact = (id: string, name: string) => {
        if (window.confirm(`Tem certeza que deseja excluir o contato "${name}"?`)) {
            removeContact(id);
        }
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            {/* Header with Title */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Gestão de Relacionamentos Comerciais</h1>
                    <p className="text-sm text-slate-500 mt-1">Gerencie sua base de Empresas e Contatos</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* SECTION 1: EMPRESAS (Clients) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-2 text-blue-700">
                            <Building2 size={20} />
                            <h2 className="font-bold">Base de Empresas</h2>
                            <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">{clients.length}</span>
                        </div>
                        <button
                            onClick={() => setShowClientModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1 shadow-sm"
                        >
                            + Nova Empresa
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-2 space-y-2">
                        {clients.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                <Building2 size={48} className="mb-2" />
                                <p>Nenhuma empresa cadastrada</p>
                            </div>
                        ) : (
                            clients.map(client => (
                                <div key={client.id} className="p-4 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group bg-white relative">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-slate-800">{client.tradeName}</h3>
                                            <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">{client.corporateName}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">{client.segment || 'Geral'}</span>

                                            {/* Delete Button (Visible on Hover/Always) */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id, client.tradeName); }}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Excluir Empresa"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                                        <span>CNPJ: {client.cnpj}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>


                {/* SECTION 2: PESSOAS (Contacts) */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-2 text-emerald-700">
                            <Users size={20} />
                            <h2 className="font-bold">Base de Pessoas</h2>
                            <span className="bg-emerald-100 text-emerald-600 text-xs px-2 py-0.5 rounded-full">{contacts.length}</span>
                        </div>
                        <button
                            onClick={() => setShowContactModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1 shadow-sm"
                        >
                            + Novo Contato
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-2 space-y-2">
                        {contacts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                <Users size={48} className="mb-2" />
                                <p>Nenhum contato cadastrado</p>
                            </div>
                        ) : (
                            contacts.map(contact => {
                                // Find linked client logic
                                const linkedClient = clients.find(c => c.id === contact.clientId);
                                return (
                                    <div key={contact.id} className="p-3 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all bg-white flex items-center gap-3 group relative">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm">
                                            {contact.name.charAt(0)}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-800 text-sm">{contact.name}</h3>
                                            <p className="text-xs text-emerald-600 font-medium">{contact.role}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{linkedClient?.tradeName || 'Empresa Desconhecida'}</p>
                                        </div>
                                        <div className="text-right text-xs text-slate-400 flex flex-col items-end gap-1">
                                            <div className="flex flex-col gap-1 items-end">
                                                <span>{contact.email}</span>
                                                <span>{contact.phone}</span>
                                            </div>

                                            {/* Delete Button (Visible on Hover/Always) */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteContact(contact.id, contact.name); }}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Excluir Contato"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>

            {/* Modals */}
            <ClientModal isOpen={showClientModal} onClose={() => setShowClientModal(false)} />
            <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />

        </div>
    );
};

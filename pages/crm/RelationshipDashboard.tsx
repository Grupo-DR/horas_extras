import React, { useState, useMemo } from 'react';
import { Users, Building2, Trash2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useCrm } from '../../contexts/CrmContext';
import { ClientModal } from '../../components/crm/ClientModal';
import { ContactModal } from '../../components/crm/ContactModal';
import { getClientHealth, ClientHealth } from '../../src/lib/crm-analytics';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const RelationshipDashboard: React.FC = () => {
    const [showClientModal, setShowClientModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);

    // Data State (Global from Context)
    const { clients, contacts, interactions, removeClient, removeContact } = useCrm();

    // ANALYTICS CALCULATION
    const clientHealthData = useMemo(() => {
        return clients.map(client => {
            const health = getClientHealth(client, interactions, []); // Bids optional for now
            return { client, ...health };
        }).sort((a, b) => b.daysSilence - a.daysSilence); // Sort by most silent first
    }, [clients, interactions]);

    const stats = useMemo(() => {
        return {
            totalClients: clients.length,
            riskClients: clientHealthData.filter(c => c.status === 'RISCO').length,
            attentionClients: clientHealthData.filter(c => c.status === 'ATENÇÃO').length,
            activeClients: clientHealthData.filter(c => c.status === 'ATIVO').length,
            totalInteractions: interactions.length // Global interactions loaded (6 months)
        };
    }, [clientHealthData, interactions, clients]);


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
                    <p className="text-sm text-slate-500 mt-1">Radar de Silêncio e Saúde da Carteira</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowContactModal(true)}
                        className="bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Users size={16} /> Novo Contato
                    </button>
                    <button
                        onClick={() => setShowClientModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Building2 size={16} /> Nova Empresa
                    </button>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Em Risco (&gt;60d)</p>
                        <p className="text-2xl font-black text-red-600 mt-1">{stats.riskClients}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                        <AlertTriangle size={20} />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Atenção (30-60d)</p>
                        <p className="text-2xl font-black text-orange-500 mt-1">{stats.attentionClients}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                        <Clock size={20} />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Ativos</p>
                        <p className="text-2xl font-black text-emerald-600 mt-1">{stats.activeClients}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <CheckCircle size={20} />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Interações (6m)</p>
                        <p className="text-2xl font-black text-blue-600 mt-1">{stats.totalInteractions}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <Users size={20} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LISTA PRINCIPAL: RADAR DE SILÊNCIO */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-slate-400" />
                            Radar de Relacionamento
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="p-4">Empresa</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Última Interação</th>
                                    <th className="p-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {clientHealthData.map(({ client, status, daysSilence, lastInteractionDate }) => (
                                    <tr key={client.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{client.tradeName}</div>
                                            <div className="text-xs text-slate-400">{client.corporateName}</div>
                                        </td>
                                        <td className="p-4">
                                            {status === 'RISCO' && (
                                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                                                    <AlertTriangle size={12} /> Risco ({daysSilence}d)
                                                </span>
                                            )}
                                            {status === 'ATENÇÃO' && (
                                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">
                                                    <Clock size={12} /> Atenção ({daysSilence}d)
                                                </span>
                                            )}
                                            {status === 'ATIVO' && (
                                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">
                                                    <CheckCircle size={12} /> Ativo ({daysSilence === 999 ? 'Novo' : `${daysSilence}d`})
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">
                                            {lastInteractionDate ? format(lastInteractionDate, "dd 'de' MMM, yyyy", { locale: ptBR }) : 'Nunca'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleDeleteClient(client.id, client.tradeName)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                {/* Future: Add "View Details" button linking to ClientDetailsView */}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {clientHealthData.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400">
                                            Nenhuma empresa cadastrada.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* LISTA SECUNDÁRIA: CONTATOS RECENTES */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            <Users size={18} className="text-slate-400" />
                            Contatos
                        </h2>
                    </div>
                    <div className="overflow-y-auto p-4 space-y-3 flex-1">
                        {contacts.map(contact => {
                            const linkedClient = clients.find(c => c.id === contact.clientId);
                            return (
                                <div key={contact.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all group">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                                        {contact.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between">
                                            <h4 className="font-bold text-slate-800 text-sm truncate">{contact.name}</h4>
                                            <button
                                                onClick={() => handleDeleteContact(contact.id, contact.name)}
                                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">{contact.role}</p>
                                        <p className="text-[10px] text-blue-600 mt-1 truncate font-medium">
                                            {linkedClient?.tradeName || 'S/ Empresa'}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                        {contacts.length === 0 && (
                            <div className="text-center py-10 text-slate-400 text-sm">
                                Nenhum contato.
                            </div>
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

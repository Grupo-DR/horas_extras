import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client, Interaction, Bid, ClientContact } from '../../types';
import { ClientService } from '../../services/clientService';
import { InteractionService } from '../../services/interactionService';
import { BidService } from '../../services/bidService';
import { ClientContactService } from '../../services/clientContactService';
import { calculateClientHealth } from '../../domain/relationshipAnalytics';
import { InteractionTimeline } from '../../components/crm/InteractionTimeline';
import { InteractionFormModal } from '../../components/crm/InteractionFormModal';
import { ContactCard } from '../../components/crm/ContactCard';
import { ArrowLeft, Building2, Calendar, FileText, Plus, Users } from 'lucide-react';

export const ClientDetailsView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Data
    const [client, setClient] = useState<Client | null>(null);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [bids, setBids] = useState<Bid[]>([]);
    const [contacts, setContacts] = useState<ClientContact[]>([]);

    // States
    const [activeTab, setActiveTab] = useState<'RESUMO' | 'CONCORRENCIAS' | 'PESSOAS' | 'INTERACOES'>('RESUMO');
    const [modalOpen, setModalOpen] = useState(false);

    // Fetch
    useEffect(() => {
        if (!id) return;

        const unsubClient = ClientService.subscribeById(id, setClient);
        const unsubInteractions = InteractionService.subscribeByClient(id, setInteractions);
        const unsubBids = BidService.subscribeByClient(id, setBids);
        const unsubContacts = ClientContactService.subscribeByClient(id, setContacts);

        return () => {
            unsubClient();
            unsubInteractions();
            unsubBids();
            unsubContacts();
        };
    }, [id]);

    // Analytics
    const metrics = useMemo(() => {
        return calculateClientHealth(interactions, bids, contacts);
    }, [interactions, bids, contacts]);

    if (!client) {
        return <div className="p-8 text-center text-slate-500">Carregando detalhes do cliente...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="p-6 max-w-7xl mx-auto">
                    <button
                        onClick={() => navigate('/crm/clients')}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar para Carteira
                    </button>

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="bg-slate-100 p-4 rounded-xl text-slate-600">
                                <Building2 className="w-8 h-8" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">{client.name}</h1>
                                <p className="text-slate-500 flex items-center gap-2 mt-1">
                                    {client.industry || 'Setor não informado'} •
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${metrics.status === 'ATIVA' ? 'bg-green-100 text-green-700' :
                                            metrics.status === 'ATENCAO' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                        }`}>
                                        {metrics.status}
                                    </span>
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setModalOpen(true)}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg flex items-center gap-2 font-medium hover:bg-blue-700 shadow-sm transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Registrar Interação
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-6 mt-8 overflow-x-auto">
                        {[
                            { id: 'RESUMO', label: 'Resumo', icon: FileText },
                            { id: 'CONCORRENCIAS', label: 'Concorrências', icon: Calendar },
                            { id: 'PESSOAS', label: 'Pessoas', icon: Users },
                            { id: 'INTERACOES', label: 'Interações', icon: FileText },
                        ].map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-all whitespace-nowrap ${isActive
                                            ? 'border-blue-600 text-blue-600 font-medium'
                                            : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 max-w-7xl mx-auto">

                {activeTab === 'RESUMO' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Summary Cards */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Relacionamento</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Score</span>
                                    <span className="text-2xl font-bold text-slate-800">{metrics.score}/100</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Tendência</span>
                                    <span className="font-medium text-slate-700">{metrics.bidTrend}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Dias sem contato</span>
                                    <span className={metrics.silenceDays > 60 ? 'text-red-600 font-bold' : 'text-slate-700'}>
                                        {metrics.silenceDays === 999 ? '-' : metrics.silenceDays}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Upcoming / Recent Activity */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Últimas Interações</h3>
                            {/* Mini Timeline (Limit 3) */}
                            <div className="bg-slate-50 rounded-lg p-4 h-[180px] overflow-y-auto">
                                <InteractionTimeline clientId={id} className="scale-90 origin-top-left" />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'CONCORRENCIAS' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Histórico de Bids/Convites</h3>
                        </div>
                        {bids.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 bg-white rounded-xl border">Nenhuma concorrência registrada.</div>
                        ) : (
                            <div className="grid gap-4">
                                {bids.map(bid => (
                                    <div key={bid.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                                        <div>
                                            <h4 className="font-bold text-slate-800">{bid.title}</h4>
                                            <p className="text-xs text-slate-500">{new Date(bid.date).toLocaleDateString('pt-BR')} • {bid.status}</p>
                                        </div>
                                        <div className="text-sm font-medium">
                                            {bid.value ? `R$ ${bid.value.toLocaleString('pt-BR')}` : '-'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'PESSOAS' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {contacts.map(contact => (
                            <ContactCard
                                key={contact.id}
                                contact={contact}
                                onRegisterInteraction={() => {
                                    // Open modal locked to this contact? -> TODO: Pass contactId to modal
                                    setModalOpen(true);
                                }}
                            />
                        ))}
                        {contacts.length === 0 && (
                            <div className="col-span-2 p-8 text-center text-slate-400 bg-white rounded-xl border">
                                Nenhuma pessoa de contato cadastrada.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'INTERACOES' && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <InteractionTimeline clientId={id} />
                    </div>
                )}

            </div>

            {/* Interaction Modal */}
            {modalOpen && id && (
                <InteractionFormModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    clientId={id}
                />
            )}
        </div>
    );
};

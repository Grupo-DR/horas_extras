import React, { useEffect, useState, useMemo } from 'react';
import { Search, Plus, Filter, Users } from 'lucide-react';
import { Client, Interaction, Bid, ClientContact, ClientHealthMetrics } from '../../types';
import { ClientService } from '../../services/clientService';
import { InteractionService } from '../../services/interactionService';
import { BidService } from '../../services/bidService';
import { ClientContactService } from '../../services/clientContactService';
import { calculateClientHealth } from '../../domain/relationshipAnalytics';
import { ClientCard } from '../../components/crm/ClientCard';
import { InteractionFormModal } from '../../components/crm/InteractionFormModal';
import { ClientModal } from '../../components/crm/ClientModal';
import { useNavigate } from 'react-router-dom';

export const ClientsView: React.FC = () => {
    const navigate = useNavigate();

    // Data State
    const [clients, setClients] = useState<Client[]>([]);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [bids, setBids] = useState<Bid[]>([]);
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL'); // ALL, ATIVA, ATENCAO, EM_RISCO

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);

    // 1. Fetch Data (Parallel)
    useEffect(() => {
        const unsubClients = ClientService.subscribeAll(setClients);
        // Fetch global recent history for analytics (e.g., last 6 months interactions, 12 months bids)
        const unsubInteractions = InteractionService.subscribeRecentGlobal(6, setInteractions);
        const unsubBids = BidService.subscribeRecentGlobal(12, setBids);
        const unsubContacts = ClientContactService.subscribeAll(setContacts);

        setLoading(false); // In real production, wait for first emits? For now, real-time will update.

        return () => {
            unsubClients();
            unsubInteractions();
            unsubBids();
            unsubContacts();
        };
    }, []);

    // 2. Calculate Metrics & Filter (Memoized)
    const processedClients = useMemo(() => {
        return clients.map(client => {
            // Filter subsets for this client
            const clientInteractions = interactions.filter(i => i.clientId === client.id);
            const clientBids = bids.filter(b => b.clientId === client.id);
            const clientContacts = contacts.filter(c => c.clientId === client.id);

            // Calculate Metrics
            const metrics = calculateClientHealth(clientInteractions, clientBids, clientContacts);

            return { ...client, metrics };
        }).filter(client => {
            // Text Search
            const searchLower = searchText.toLowerCase();
            const clientName = (client.tradeName || client.corporateName || client.name || '').toLowerCase();
            const clientSegment = (client.segment || client.industry || '').toLowerCase();

            const matchesText = clientName.includes(searchLower) || clientSegment.includes(searchLower);

            if (!matchesText) return false;

            // Status Filter
            if (statusFilter !== 'ALL' && client.metrics.status !== statusFilter) return false;

            return true;
        }).sort((a, b) => a.metrics.score - b.metrics.score); // Risks first (lowest score)? Or Highest? Let's sort by Score ASC (Risk first)
    }, [clients, interactions, bids, contacts, searchText, statusFilter]);

    if (loading && clients.length === 0) {
        return <div className="p-8 text-center text-slate-500">Carregando carteira...</div>;
    }

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Carteira de Clientes</h1>
                    <p className="text-slate-500">Gestão de relacionamento e monitoramento de risco</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsClientModalOpen(true)}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-slate-900 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Cliente
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        className="w-full pl-9 rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
                        placeholder="Buscar empresa ou setor..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                    {['ALL', 'ATIVA', 'ATENCAO', 'EM_RISCO'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === status
                                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-600'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {status === 'ALL' ? 'Todos' : status.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {processedClients.map(client => (
                    <ClientCard
                        key={client.id}
                        clientName={client.tradeName || client.corporateName || client.name || 'Sem Nome'}
                        metrics={client.metrics}
                        onRegisterInteraction={() => {
                            setSelectedClientId(client.id);
                            setModalOpen(true);
                        }}
                        onViewDetails={() => navigate(`/clients/${client.id}`)}
                    />
                ))}
            </div>

            {processedClients.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhuma empresa encontrada com os filtros atuais.</p>
                </div>
            )}

            {/* Interaction Modal */}
            {modalOpen && (
                <InteractionFormModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    clientId={selectedClientId}
                    onSuccess={() => {/* Optional Toast? Already handled in Modal */ }}
                />
            )}
            {/* Client Creation Modal */}
            <ClientModal
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
            />
        </div>
    );
};

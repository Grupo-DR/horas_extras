import React, { useEffect, useState, useMemo } from 'react';
import { Client, Interaction, Bid, ClientContact } from '../../types';
import { ClientService } from '../../services/clientService';
import { InteractionService } from '../../services/interactionService';
import { BidService } from '../../services/bidService';
import { ClientContactService } from '../../services/clientContactService';
import { calculateClientHealth, calculateContactAnalytics } from '../../domain/relationshipAnalytics';
import { AlertCircle, TrendingUp, Users, Building2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const RelationshipDashboard: React.FC = () => {
    const navigate = useNavigate();

    // Data State (Global Fetch)
    const [clients, setClients] = useState<Client[]>([]);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [bids, setBids] = useState<Bid[]>([]);
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const u1 = ClientService.subscribe(setClients);
        const u2 = InteractionService.subscribeRecentGlobal(12, setInteractions);
        const u3 = BidService.subscribeRecentGlobal(12, setBids);
        const u4 = ClientContactService.subscribeAll(setContacts);
        setLoading(false);
        return () => { u1(); u2(); u3(); u4(); };
    }, []);

    // Analytics Calculation
    const analytics = useMemo(() => {
        // 1. Process Clients (Risk & Silence)
        const enrichedClients = clients.map(client => {
            const clientInteractions = interactions.filter(i => i.clientId === client.id);
            const clientBids = bids.filter(b => b.clientId === client.id);
            const clientContacts = contacts.filter(c => c.clientId === client.id);
            const metrics = calculateClientHealth(clientInteractions, clientBids, clientContacts);
            return {
                ...client,
                metrics
            };
        });

        // 2. Process Contacts (Silent Key Persons)
        const enrichedContacts = contacts.map(contact => {
            const contextInteractions = interactions.filter(i => i.contactId === contact.id);
            const metrics = calculateContactAnalytics(contact, contextInteractions);
            return { ...contact, metrics };
        });

        // 3. Aggregate Lists

        // Empresas Silenciosas (> 60d)
        const silentCompanies = enrichedClients.filter(c => c.metrics.silenceDays > 60).sort((a, b) => b.metrics.silenceDays - a.metrics.silenceDays).slice(0, 10);

        // Empresas em Risco (Score < 45)
        const riskyCompanies = enrichedClients.filter(c => c.metrics.score < 45).sort((a, b) => a.metrics.score - b.metrics.score).slice(0, 10);

        // Pessoas Chave Silenciosas (> 45d e Profile=CHAVE)
        const silentKeyPersons = enrichedContacts.filter(c =>
            c.metrics.profile === 'CHAVE' && c.metrics.daysSinceLastInteraction > 45
        ).sort((a, b) => b.metrics.daysSinceLastInteraction - a.metrics.daysSinceLastInteraction).slice(0, 10);

        return {
            silentCompanies,
            riskyCompanies,
            silentKeyPersons
        };
    }, [clients, interactions, bids, contacts]);

    if (loading) return <div>Carregando dashboard...</div>;

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            {/* Header with Title and Actions */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Gestão de Relacionamentos Comerciais</h1>

                <div className="flex gap-3">
                    <button className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm"
                        onClick={() => { /* Open New Contact Modal (Future) */ alert("Novo Contato (Em Breve)"); }}
                    >
                        <Users size={18} />
                        Novo Contato
                    </button>
                    <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm shadow-sm"
                        onClick={() => { /* Open New Client Modal (Future) */ alert("Nova Empresa (Em Breve)"); }}
                    >
                        <Building2 size={18} />
                        Nova Empresa
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. Empresas em Risco */}
                <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                        <h2 className="font-bold">Empresas em Risco (Score Baixo)</h2>
                    </div>
                    {analytics.riskyCompanies.length === 0 ? (
                        <p className="text-sm text-slate-400">Nenhuma empresa em nível crítico.</p>
                    ) : (
                        <div className="space-y-3">
                            {analytics.riskyCompanies.map(c => (
                                <div key={c.id} className="flex justify-between items-center p-2 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                                    onClick={() => navigate(`/crm/clients/${c.id}`)}>
                                    <span className="text-sm font-semibold text-slate-700 truncate max-w-[150px]">{c.name}</span>
                                    <span className="text-xs font-bold text-red-700 bg-white px-2 py-0.5 rounded border border-red-200">
                                        Score {c.metrics.score}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Empresas Silenciosas */}
                <div className="bg-white p-5 rounded-xl border border-orange-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-orange-600">
                        <Clock className="w-5 h-5" />
                        <h2 className="font-bold">Empresas Silenciosas (&gt;60d)</h2>
                    </div>
                    {analytics.silentCompanies.length === 0 ? (
                        <p className="text-sm text-slate-400">Nenhuma empresa em silêncio prolongado.</p>
                    ) : (
                        <div className="space-y-3">
                            {analytics.silentCompanies.map(c => (
                                <div key={c.id} className="flex justify-between items-center p-2 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors"
                                    onClick={() => navigate(`/crm/clients/${c.id}`)}>
                                    <span className="text-sm font-semibold text-slate-700 truncate max-w-[150px]">{c.name}</span>
                                    <span className="text-xs font-bold text-orange-700 bg-white px-2 py-0.5 rounded border border-orange-200">
                                        {c.metrics.silenceDays} dias
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. Pessoas Chave Silenciosas */}
                <div className="bg-white p-5 rounded-xl border border-purple-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-purple-600">
                        <Users className="w-5 h-5" />
                        <h2 className="font-bold">Pessoas Chave Silenciosas</h2>
                    </div>
                    {analytics.silentKeyPersons.length === 0 ? (
                        <p className="text-sm text-slate-400">Nenhuma pessoa chave esquecida.</p>
                    ) : (
                        <div className="space-y-3">
                            {analytics.silentKeyPersons.map(c => (
                                <div key={c.id} className="flex justify-between items-center p-2 bg-purple-50 rounded-lg">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-700">{c.name}</span>
                                        <span className="text-[10px] text-slate-500">{c.role}</span>
                                    </div>
                                    <span className="text-xs font-bold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">
                                        {c.metrics?.daysSinceLastInteraction} dias
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

import React, { useEffect, useState, useMemo } from 'react';
import { ClientContact, Interaction } from '../../types';
import { ClientContactService } from '../../services/clientContactService';
import { InteractionService } from '../../services/interactionService';
import { calculateContactAnalytics } from '../../domain/relationshipAnalytics';
import { ContactCard } from '../../components/crm/ContactCard';
import { InteractionFormModal } from '../../components/crm/InteractionFormModal';
import { Search, Filter, Users } from 'lucide-react';

export const ContactsView: React.FC = () => {
    // Data
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter
    const [searchText, setSearchText] = useState('');
    const [profileFilter, setProfileFilter] = useState<string>('ALL'); // ALL, CHAVE, OCASIONAL, SILENCIOSA

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState<ClientContact | null>(null);

    useEffect(() => {
        const unsubContacts = ClientContactService.subscribeAll(setContacts);
        const unsubInteractions = InteractionService.subscribeRecentGlobal(6, setInteractions); // 6 months check
        setLoading(false);
        return () => {
            unsubContacts();
            unsubInteractions();
        };
    }, []);

    const processedContacts = useMemo(() => {
        return contacts.map(contact => {
            const myInteractions = interactions.filter(i => i.contactId === contact.id || i.clientId === contact.clientId); // Broad match? Or strict contactId? 
            // Better strict contactId for profile calculation.
            const strictInteractions = interactions.filter(i => i.contactId === contact.id);

            const analytics = calculateContactAnalytics(contact, strictInteractions);
            return { ...contact, analytics };
        }).filter(c => {
            // Search
            const search = searchText.toLowerCase();
            const matches = c.name.toLowerCase().includes(search) ||
                (c.role && c.role.toLowerCase().includes(search)) ||
                (c.email && c.email.toLowerCase().includes(search));

            if (!matches) return false;

            // Profile Filter
            if (profileFilter !== 'ALL' && c.analytics.profile !== profileFilter) return false;

            return true;
        }).sort((a, b) => {
            // Sort Priority: Silent First, then Key, then Occasional
            const priority = { 'SILENCIOSA': 0, 'CHAVE': 1, 'OCASIONAL': 2 };
            return priority[a.analytics.profile] - priority[b.analytics.profile];
        });
    }, [contacts, interactions, searchText, profileFilter]);

    if (loading && contacts.length === 0) return <div className="p-8 text-center text-slate-500">Carregando contatos...</div>;

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Pessoas de Contato</h1>
                <p className="text-slate-500">Diretório geral de stakeholders</p>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        className="w-full pl-9 rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
                        placeholder="Buscar por nome, cargo ou e-mail..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                    {['ALL', 'CHAVE', 'SILENCIOSA', 'OCASIONAL'].map(p => (
                        <button
                            key={p}
                            onClick={() => setProfileFilter(p)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${profileFilter === p
                                    ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-600'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {p === 'ALL' ? 'Todos' : p}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {processedContacts.map(contact => (
                    <ContactCard
                        key={contact.id}
                        contact={contact}
                        onRegisterInteraction={() => {
                            setSelectedContact(contact);
                            setModalOpen(true);
                        }}
                    />
                ))}
            </div>

            {processedContacts.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhum contato encontrado.</p>
                </div>
            )}

            {modalOpen && selectedContact && (
                <InteractionFormModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    clientId={selectedContact.clientId}
                    contactId={selectedContact.id} // Lock contact
                />
            )}
        </div>
    );
};

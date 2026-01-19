import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Client, ClientContact, Bid, Interaction } from '../types';
import { ClientService } from '../services/clientService';
import { ContactService } from '../services/contactService';
import { BidService } from '../services/bidService';
import { InteractionService } from '../services/interactionService';
import { where } from 'firebase/firestore'; // Import needed if using query directly, but services handle it.

interface CrmContextData {
    clients: Client[];
    contacts: ClientContact[];
    bids: Bid[]; // Canonical "bids"
    opportunities: Bid[]; // Alias for backward compatibility
    interactions: Interaction[];
    loading: boolean;

    addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    addContact: (contact: Omit<ClientContact, 'id'>) => Promise<void>;
    addInteraction: (data: Omit<Interaction, 'id' | 'createdAt'>) => Promise<void>;
    removeClient: (id: string) => Promise<void>;
    removeContact: (id: string) => Promise<void>;
    getContactsByClientId: (clientId: string) => ClientContact[];
    refresh: () => void;
}

const CrmContext = createContext<CrmContextData>({} as CrmContextData);

export const CrmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // State
    const [clients, setClients] = useState<Client[]>([]);
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [bids, setBids] = useState<Bid[]>([]);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const refresh = () => setRefreshTrigger(prev => prev + 1);

    // Initial Fetch (Ideally switch to realtime subscriptions later)
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Parallel fetching
                const [fetchedClients, fetchedContacts, fetchedBids, fetchedRecents] = await Promise.all([
                    ClientService.getAll(),
                    ContactService.getAll(),
                    BidService.getAll(),
                    // For global context, maybe we fetch only recent interactions or all?
                    // Fetching ALL interactions might be heavy. 
                    // For now, let's fetch recent global interactions (e.g., last 6 months) for dashboard.
                    // Or iterate client-by-client if needed.
                    // Start with "Recent Global" for the dashboard view.
                    new Promise<Interaction[]>(resolve => {
                        const unsubscribe = InteractionService.subscribeRecentGlobal(6, (data) => {
                            resolve(data);
                            unsubscribe(); // One-off fetch for now to match Promise.all pattern
                        });
                    })
                ]);

                setClients(fetchedClients);
                setContacts(fetchedContacts);
                setBids(fetchedBids);
                setInteractions(fetchedRecents);

            } catch (error) {
                console.error("Failed to fetch CRM data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [refreshTrigger]);

    // --- ACTIONS ---

    const addClient = async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            // @ts-ignore - Validating omitted fields later if needed
            const id = await ClientService.create(clientData);
            const newClient = { ...clientData, id, createdAt: new Date() } as Client;
            setClients(prev => [...prev, newClient]);
        } catch (error) {
            console.error("Error adding client:", error);
            throw error;
        }
    };

    const addContact = async (contactData: Omit<ClientContact, 'id'>) => {
        try {
            const id = await ContactService.create(contactData);
            const newContact = { ...contactData, id } as ClientContact;
            setContacts(prev => [...prev, newContact]);
        } catch (error) {
            console.error("Error adding contact:", error);
            throw error;
        }
    };

    const addInteraction = async (data: Omit<Interaction, 'id' | 'createdAt'>) => {
        try {
            await InteractionService.create(data);
            refresh(); // Simple refresh for now
        } catch (error) {
            console.error("Error adding interaction:", error);
            throw error;
        }
    }

    const removeClient = async (id: string) => {
        try {
            await ClientService.delete(id);
            setClients(prev => prev.filter(c => c.id !== id));
            setContacts(prev => prev.filter(c => c.clientId !== id));
        } catch (error) {
            console.error("Error removing client:", error);
            throw error;
        }
    };

    const removeContact = async (id: string) => {
        try {
            await ContactService.delete(id);
            setContacts(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error("Error removing contact:", error);
            throw error;
        }
    };

    const getContactsByClientId = (clientId: string) => {
        return contacts.filter(c => c.clientId === clientId);
    };

    return (
        <CrmContext.Provider value={{
            clients,
            contacts,
            bids,
            opportunities: bids, // Alias
            interactions,
            loading,
            addClient,
            addContact,
            addInteraction,
            removeClient,
            removeContact,
            getContactsByClientId,
            refresh
        }}>
            {children}
        </CrmContext.Provider>
    );
};

export const useCrm = () => useContext(CrmContext);

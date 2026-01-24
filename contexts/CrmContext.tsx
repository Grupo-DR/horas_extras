import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Client, ClientContact, Bid, Interaction } from '../types';
import { ClientService } from '../services/clientService';
import { ClientContactService } from '../services/clientContactService'; // Canonical
import { BidService } from '../services/bidService';
import { InteractionService } from '../services/interactionService';

interface CrmContextData {
    clients: Client[];
    contacts: ClientContact[];
    bids: Bid[]; // Canonical "bids"

    interactions: Interaction[]; // Global recent
    loading: boolean;

    addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    addContact: (contact: Omit<ClientContact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateContact: (id: string, contact: Partial<ClientContact>) => Promise<void>;
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
                // Initialize Subscriptions or simple Fetch
                // For simplicity and stability, we fetch all once or stick to Promise.all
                // But subscription is better. Converting to Promise-based for initial load.

                const [fetchedClients, fetchedContacts, fetchedBids] = await Promise.all([
                    ClientService.getAll(),
                    ClientContactService.getAll(),
                    BidService.getAll()
                ]);

                // Interactions: fetch recent global (e.g., 6 months)
                // We'll use a promise wrapper around the subscription for the first load
                const fetchedRecents = await new Promise<Interaction[]>(resolve => {
                    const unsubscribe = InteractionService.subscribeRecentGlobal(6, (data) => {
                        resolve(data);
                        unsubscribe();
                    });
                });

                setClients(fetchedClients);
                setContacts(fetchedContacts);
                setBids(fetchedBids);
                setInteractions(fetchedRecents);

                // Setup realtime listeners? 
                // Creating full realtime context for everything might be heavy.
                // Let's rely on refreshTrigger for now, or components subscribing individually.
                // However, the requirement implies "Context consolidado".
                // If we want detailed lists to update automatically, we should use subscriptions.
                // But let's check current architecture. It used getAll().
                // We will stick to getAll() + manual refresh for stability unless requested otherwise.

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
            await ClientService.create(clientData);
            refresh();
        } catch (error) {
            console.error("Error adding client:", error);
            throw error;
        }
    };

    const addContact = async (contactData: Omit<ClientContact, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            await ClientContactService.create(contactData);
            refresh();
        } catch (error) {
            console.error("Error adding contact:", error);
            throw error;
        }
    };

    const addInteraction = async (data: Omit<Interaction, 'id' | 'createdAt'>) => {
        try {
            await InteractionService.create(data);
            refresh();
        } catch (error) {
            console.error("Error adding interaction:", error);
            throw error;
        }
    }

    const updateContact = async (id: string, contactData: Partial<ClientContact>) => {
        try {
            await ClientContactService.update(id, contactData);
            refresh();
        } catch (error) {
            console.error("Error updating contact:", error);
            throw error;
        }
    };

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
            await ClientContactService.delete(id);
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

            interactions,
            loading,
            addClient,
            addContact,
            updateContact,
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

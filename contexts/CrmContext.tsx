import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Client, Contact } from '../types/crm';
import { ClientService } from '../services/clientService';
import { ContactService } from '../services/contactService';

interface CrmContextData {
    clients: Client[];
    contacts: Contact[];
    // opportunities: CrmOpportunity[]; // Future integration
    addClient: (client: Omit<Client, 'id'>) => void;
    addContact: (contact: Omit<Contact, 'id'>) => void;
    removeClient: (id: string) => void;
    removeContact: (id: string) => void;
    getContactsByClientId: (clientId: string) => Contact[];
}

const CrmContext = createContext<CrmContextData>({} as CrmContextData);

export const CrmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // State
    const [clients, setClients] = useState<Client[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [fetchedClients, fetchedContacts] = await Promise.all([
                    ClientService.getAll(),
                    ContactService.getAll()
                ]);
                setClients(fetchedClients);
                setContacts(fetchedContacts);
            } catch (error) {
                console.error("Failed to fetch CRM data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const addClient = async (clientData: Omit<Client, 'id'>) => {
        try {
            const id = await ClientService.create(clientData);
            const newClient = { ...clientData, id, createdAt: new Date().toISOString() };
            setClients(prev => [...prev, newClient]);
        } catch (error) {
            console.error("Error adding client:", error);
            throw error;
        }
    };

    const addContact = async (contactData: Omit<Contact, 'id'>) => {
        try {
            const id = await ContactService.create(contactData);
            const newContact = { ...contactData, id };
            setContacts(prev => [...prev, newContact]);
        } catch (error) {
            console.error("Error adding contact:", error);
            throw error;
        }
    };

    const removeClient = async (id: string) => {
        try {
            await ClientService.delete(id);
            setClients(prev => prev.filter(c => c.id !== id));

            // Cascading delete for contacts locally (Firestore doesn't auto-cascade unless configured via Cloud Functions)
            // Ideally should query and delete contacts from Firestore too.
            // For now, we update local state.
            setContacts(prev => prev.filter(c => c.clientId !== id));

            // Note: In production, consider a batch delete of contacts where clientId == id
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
        <CrmContext.Provider value={{ clients, contacts, addClient, addContact, removeClient, removeContact, getContactsByClientId }}>
            {children}
        </CrmContext.Provider>
    );
};

export const useCrm = () => useContext(CrmContext);

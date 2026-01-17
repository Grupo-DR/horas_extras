import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Client, Contact } from '../types/crm';

interface CrmContextData {
    clients: Client[];
    contacts: Contact[];
    // opportunities: CrmOpportunity[]; // Future integration
    addClient: (client: Omit<Client, 'id'>) => void;
    addContact: (contact: Omit<Contact, 'id'>) => void;
    getContactsByClientId: (clientId: string) => Contact[];
}

const CrmContext = createContext<CrmContextData>({} as CrmContextData);

export const CrmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Mock Data Initialization - CLEARED as per user request
    const [clients, setClients] = useState<Client[]>([]);

    const [contacts, setContacts] = useState<Contact[]>([]);

    const addClient = (clientData: Omit<Client, 'id'>) => {
        const newClient = { ...clientData, id: crypto.randomUUID() };
        setClients(prev => [...prev, newClient]);
    };

    const addContact = (contactData: Omit<Contact, 'id'>) => {
        const newContact = { ...contactData, id: crypto.randomUUID() };
        setContacts(prev => [...prev, newContact]);
    };

    const getContactsByClientId = (clientId: string) => {
        return contacts.filter(c => c.clientId === clientId);
    };

    return (
        <CrmContext.Provider value={{ clients, contacts, addClient, addContact, getContactsByClientId }}>
            {children}
        </CrmContext.Provider>
    );
};

export const useCrm = () => useContext(CrmContext);

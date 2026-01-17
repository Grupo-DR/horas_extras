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
    // Mock Data Initialization
    const [clients, setClients] = useState<Client[]>([
        {
            id: '1',
            corporateName: 'Vale S.A.',
            tradeName: 'Vale',
            cnpj: '33.592.510/0001-54',
            segment: 'Mineração',
            createdAt: new Date().toISOString()
        },
        {
            id: '2',
            corporateName: 'Petróleo Brasileiro S.A.',
            tradeName: 'Petrobras',
            cnpj: '33.000.167/0001-01',
            segment: 'Óleo e Gás',
            createdAt: new Date().toISOString()
        }
    ]);

    const [contacts, setContacts] = useState<Contact[]>([
        { id: '101', clientId: '1', name: 'Roberto Mendes', role: 'Gerente de Engenharia', email: 'roberto@vale.com', phone: '3199999999' },
        { id: '102', clientId: '1', name: 'Ana Souza', role: 'Coord. Suprimentos', email: 'ana@vale.com', phone: '3198888888' },
        { id: '201', clientId: '2', name: 'Carlos Silva', role: 'Engenheiro Senior', email: 'carlos@petrobras.com', phone: '2197777777' }
    ]);

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

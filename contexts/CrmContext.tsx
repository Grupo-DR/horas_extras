import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Client, Contact } from '../types/crm';

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
    // Data Initialization - Mock Data for Production/Final Implementation Phase
    const [clients, setClients] = useState<Client[]>([
        { id: 'c1', corporateName: 'Vale S.A.', tradeName: 'Vale', cnpj: '33.592.510/0001-54', createdAt: new Date().toISOString() },
        { id: 'c2', corporateName: 'Rumo Logística S.A.', tradeName: 'Rumo', cnpj: '02.387.241/0001-60', createdAt: new Date().toISOString() },
        { id: 'c3', corporateName: 'MRS Logística S.A.', tradeName: 'MRS', cnpj: '01.427.036/0001-59', createdAt: new Date().toISOString() }
    ]);

    const [contacts, setContacts] = useState<Contact[]>([
        { id: 'p1', clientId: 'c1', name: 'Roberto (Vale)', email: 'roberto@vale.com', role: 'Gerente de Projetos', phone: '99999-9999', active: true },
        { id: 'p2', clientId: 'c1', name: 'Ana (Vale)', email: 'ana.souza@vale.com', role: 'Coord. Engenharia', phone: '98888-8888', active: true },
        { id: 'p3', clientId: 'c2', name: 'Carlos (Rumo)', email: 'carlos@rumo.com', role: 'Diretor Operacional', phone: '97777-7777', active: true },
        { id: 'p4', clientId: 'c3', name: 'Fernanda (MRS)', email: 'fernanda@mrs.com', role: 'Gerente Compras', phone: '96666-6666', active: true },
    ]);

    const addClient = (clientData: Omit<Client, 'id'>) => {
        const newClient = { ...clientData, id: crypto.randomUUID() };
        setClients(prev => [...prev, newClient]);
    };

    const addContact = (contactData: Omit<Contact, 'id'>) => {
        const newContact = { ...contactData, id: crypto.randomUUID() };
        setContacts(prev => [...prev, newContact]);
    };

    const removeClient = (id: string) => {
        setClients(prev => prev.filter(c => c.id !== id));
        // Cascading delete: Remove contacts associated with this client
        setContacts(prev => prev.filter(c => c.clientId !== id));
    };

    const removeContact = (id: string) => {
        setContacts(prev => prev.filter(c => c.id !== id));
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

export interface Client {
    id: string;
    corporateName: string; // Razão Social
    tradeName: string; // Nome Fantasia
    cnpj?: string;
    segment?: string;
}

export interface Contact {
    id: string;
    clientId: string; // Link com a empresa
    name: string;
    email: string;
    phone: string;
    role: string; // Cargo (ex: Gerente de Engenharia)
}

// Extension of the existing Opportunity interface or re-definition if needed
// Assuming we are extending/using the one in types/index.ts usually, but here we define the CRM specific structure
export interface CrmOpportunity {
    id: string;
    title: string;
    value: number;
    stage: 'prospection' | 'budget' | 'proposal' | 'negotiation' | 'closed';
    clientId: string; // Empresa dona da oportunidade
    contactId?: string; // Pessoa responsável pelo BID
    createdAt: string;
}

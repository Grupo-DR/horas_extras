export interface Client {
    id: string; // UUID
    corporateName: string; // Razão Social
    tradeName: string; // Nome Fantasia
    cnpj: string;
    segment?: string;
    createdAt: string; // ISO Date
}

export interface Contact {
    id: string; // UUID
    clientId: string; // Foreign Key (Link com a empresa)
    name: string;
    email: string;
    phone: string;
    role: string; // Cargo (ex: Gerente de Engenharia)
}

// Re-exporting Opportunity types extension if needed, though mostly handled in main types
export interface CrmOpportunityExtension {
    clientId: string;
    contactId?: string;
}

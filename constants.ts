import { User } from './types';

export const OFFICIAL_USERS: User[] = [
    { id: 'u1', name: 'Antonio Augusto da Silva', role: 'Desenvolvedor', email: 'antonio.silva@grupodr.com.br' },
    { id: 'u2', name: 'Cintia Ferreira', role: 'Engenheira Orçamentista', email: 'cintia.ferreira@grupodr.com.br' },
    { id: 'u3', name: 'Tatiana Guimarães', role: 'Engenheira Auxiliar', email: 'tatiana.guimaraes@grupodr.com.br' },
    { id: 'u4', name: 'Nilton Camilo', role: 'Gerente Comercial', email: 'nilton.camilo@grupodr.com.br' },
    { id: 'u5', name: 'Maria Tereza', role: 'Engenheiro Trainee', email: 'maria.tereza@grupodr.com.br' },
    { id: 'u6', name: 'Isabela Costa', role: 'Assistente Comercial', email: 'isabela.costa@grupodr.com.br' },
    { id: 'u7', name: 'Fabiana Fernandes', role: 'Analista Comercial Jr', email: 'fabiana.fernandes@grupodr.com.br' },
    { id: 'u8', name: 'Clara Santos', role: 'Jovem Aprendiz', email: 'clara.santos@grupodr.com.br' },
];

export const CRM_SILENCE = {
    CONTACT_DAYS: 30, // Updated to 30 as per plan
    CLIENT_INTERACTION_DAYS: 60,
    CLIENT_BID_DAYS: 120,
    WINDOW_CONTACT_ACTIVE_DAYS: 90,
    WINDOW_TREND_MONTHS: 6,
};

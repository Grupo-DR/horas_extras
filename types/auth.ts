export type SystemRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

export interface User {
    id: string;
    name: string;
    email: string;
    role: string; // Cargo original (ex: 'Diretor Comercial')
    systemRole: SystemRole; // Mapeado (ex: 'ADMIN')
    avatarUrl?: string;
}

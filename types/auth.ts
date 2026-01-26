export type SystemRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

export type AccessLevel = 'VIEW' | 'EDIT' | 'NONE';

// Define the modules available in the system
export type ModuleKey =
    | 'crm'
    | 'commercial_dashboard'
    | 'financial'
    | 'strategic_planning'
    | 'operational_planning'
    | 'settings'
    | 'users'
    | 'contracts';

export interface ModuleAccess {
    crm: AccessLevel;
    commercial_dashboard: AccessLevel;
    financial: AccessLevel;
    strategic_planning: AccessLevel;
    operational_planning: AccessLevel;
    settings: AccessLevel;
    users: AccessLevel;
    contracts: AccessLevel;
}

export const DEFAULT_MODULE_ACCESS: ModuleAccess = {
    crm: 'VIEW',
    commercial_dashboard: 'VIEW',
    financial: 'VIEW',
    strategic_planning: 'VIEW',
    operational_planning: 'VIEW',
    settings: 'NONE',
    users: 'NONE',
    contracts: 'VIEW'
};

export interface User {
    id: string;
    name: string;
    email: string;
    role: string; // Cargo original (ex: 'Diretor Comercial')
    systemRole: SystemRole; // Mapeado (ex: 'ADMIN')
    permissions: ModuleAccess;
    mustChangePassword?: boolean;
    avatarUrl?: string;
    createdAt?: string;
    lastLoginAt?: string;
}

export type ScopeType = 'ALL' | 'REGIONAL' | 'COST_CENTER';

export type Scope =
    | { type: 'ALL' }
    | { type: 'REGIONAL'; regionals: string[] }
    | { type: 'COST_CENTER'; costCenters: string[] };

export type CommercialRole = 'COMMERCIAL_ADMIN' | 'COMMERCIAL_VIEWER' | 'IAM_ADMIN';

export type CHRole =
    | 'CH_ADMIN'              // Type 01: All access + Plan + CRUD Profiles
    | 'CH_MANAGER'            // Type 02: Regional + Plan
    | 'CH_COSTCENTER_PLANNER' // Type 03: CostCenter + Plan
    | 'CH_APPROVER'           // Type 04: Approver Level
    | 'CH_AUDITOR_VIEWER';    // Type 05: All + Read Only

export type LegacyCHRole =
    | CHRole
    | 'HC_ADMIN'
    | 'HC_MANAGER'
    | 'HC_COSTCENTER_PLANNER'
    | 'HC_APPROVER'
    | 'HC_AUDITOR_VIEWER';

export type ConstructionRole =
    | 'CONSTRUCTION_ADMIN'
    | 'CONSTRUCTION_MANAGER'
    | 'CONSTRUCTION_VIEWER';

export type SSMARole =
    | 'SSMA_ADMIN'            // Super Admin (sistema) — não exposto na UI
    | 'SSMA_MANAGER'           // Gerente de SSMA
    | 'SSMA_REGIONAL_MANAGER'  // Gerente Regional
    | 'SSMA_SITE_MANAGER'      // Gestor de Obra
    | 'SSMA_SUPERVISOR'        // Supervisor de SSMA
    | 'SSMA_TECHNICIAN'        // Técnico de Segurança (TST)
    | 'SSMA_FOREMAN'           // Encarregado
    | 'SSMA_VIEWER';           // Visualizador (Apenas Leitura)

export interface ModuleAccess<R> {
    enabled: boolean;
    role: R;
    scope?: Scope; // Required if enabled for HC
}

export interface UserProfileDoc {
    uid: string;
    email: string;
    displayName: string;

    jobTitle?: string;
    department?: string;
    avatarUrl?: string;

    isSuperAdmin?: boolean; // Developer/Backup

    status?: 'invited' | 'active' | 'disabled';

    modules: {
        commercial?: {
            enabled: boolean;
            role: CommercialRole;
        };
        human_capital?: {
            enabled: boolean;
            role: CHRole;
            scope: Scope;
        };
        construction_vli?: {
            enabled: boolean;
            role: ConstructionRole;
        };
        construction_rdo?: {
            enabled: boolean;
            role: ConstructionRole;
        };
        ssma?: {
            enabled: boolean;
            role: SSMARole;
            scope: Scope;
        };
        bi_reports?: string[];
    };

    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;

    disabledAt?: string;
    disabledBy?: string;
    disableReason?: string;
}

// Helpers

export const normalizeCHRole = (role?: string): CHRole | undefined => {
    if (!role) return undefined;

    // Temporary compatibility for user_profiles created before the CH_* standard.
    const normalized = role.startsWith('HC_') ? role.replace('HC_', 'CH_') : role;
    return ['CH_ADMIN', 'CH_MANAGER', 'CH_COSTCENTER_PLANNER', 'CH_APPROVER', 'CH_AUDITOR_VIEWER'].includes(normalized)
        ? normalized as CHRole
        : undefined;
};

export const canPlan = (role?: LegacyCHRole): boolean => {
    const normalizedRole = normalizeCHRole(role);
    if (!normalizedRole) return false;
    return ['CH_ADMIN', 'CH_MANAGER', 'CH_COSTCENTER_PLANNER', 'CH_APPROVER'].includes(normalizedRole);
};

export const canManageProfiles = (profile: UserProfileDoc | null | undefined): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    return (
        profile.modules.human_capital?.role === 'CH_ADMIN' ||
        profile.modules.commercial?.role === 'COMMERCIAL_ADMIN' ||
        profile.modules.commercial?.role === 'IAM_ADMIN' ||
        profile.modules.construction_vli?.role === 'CONSTRUCTION_ADMIN' ||
        profile.modules.construction_rdo?.role === 'CONSTRUCTION_ADMIN'
    );
};

export const canReadAll = (role?: LegacyCHRole): boolean => {
    const normalizedRole = normalizeCHRole(role);
    if (!normalizedRole) return false;
    return ['CH_ADMIN', 'CH_AUDITOR_VIEWER', 'CH_APPROVER'].includes(normalizedRole);
};

export const canApprove = (role?: LegacyCHRole): boolean => {
    const normalizedRole = normalizeCHRole(role);
    if (!normalizedRole) return false;
    return ['CH_ADMIN', 'CH_APPROVER'].includes(normalizedRole);
};

export const canAccessSettings = (role?: LegacyCHRole): boolean => {
    return normalizeCHRole(role) === 'CH_ADMIN';
};

export const canManageHeadcount = (role?: LegacyCHRole): boolean => {
    return normalizeCHRole(role) === 'CH_ADMIN';
};

export const canManageBudgets = (role?: LegacyCHRole): boolean => {
    return normalizeCHRole(role) === 'CH_ADMIN';
};

// SSMA Helpers

export const canViewSSMA = (profile: UserProfileDoc | null | undefined): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    if (!profile.modules.ssma?.enabled) return false;
    return true; // All roles with module enabled can at least view (within scope)
};

export const canEditSSMA = (profile: UserProfileDoc | null | undefined): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    if (!profile.modules.ssma?.enabled) return false;
    const role = profile.modules.ssma.role;
    return ['SSMA_ADMIN', 'SSMA_MANAGER', 'SSMA_REGIONAL_MANAGER', 'SSMA_SITE_MANAGER', 'SSMA_SUPERVISOR', 'SSMA_TECHNICIAN', 'SSMA_FOREMAN'].includes(role);
};

export const canManageSSMA = (profile: UserProfileDoc | null | undefined): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    if (!profile.modules.ssma?.enabled) return false;
    return profile.modules.ssma.role === 'SSMA_ADMIN';
};

export const getSSMAScope = (profile: UserProfileDoc | null | undefined): Scope | null => {
    if (!profile) return null;
    if (profile.isSuperAdmin) return { type: 'ALL' };
    if (!profile.modules.ssma?.enabled) return null;
    return profile.modules.ssma.scope;
};

export const canManageSSMARegisters = (profile: UserProfileDoc | null | undefined): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    if (!profile.modules.ssma?.enabled) return false;
    const role = profile.modules.ssma.role;
    return ['SSMA_ADMIN', 'SSMA_MANAGER'].includes(role);
};

export const canManageSSMATargets = (profile: UserProfileDoc | null | undefined): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    if (!profile.modules.ssma?.enabled) return false;
    const role = profile.modules.ssma.role;
    return ['SSMA_ADMIN', 'SSMA_MANAGER'].includes(role);
};

export const isSSMAOperationalRole = (profile: UserProfileDoc | null | undefined): boolean => {
    if (!profile) return false;
    if (!profile.modules.ssma?.enabled) return false;
    const role = profile.modules.ssma.role;
    return ['SSMA_SITE_MANAGER', 'SSMA_SUPERVISOR', 'SSMA_TECHNICIAN', 'SSMA_FOREMAN', 'SSMA_VIEWER'].includes(role);
};

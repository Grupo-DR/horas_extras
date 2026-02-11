export type ScopeType = 'ALL' | 'REGIONAL' | 'COST_CENTER';

export type Scope =
    | { type: 'ALL' }
    | { type: 'REGIONAL'; regionals: string[] }
    | { type: 'COST_CENTER'; costCenters: string[] };

export type CommercialRole = 'COMMERCIAL_ADMIN' | 'COMMERCIAL_VIEWER' | 'IAM_ADMIN';

export type HCRole =
    | 'HC_ADMIN'              // Type 01: All access + Plan + CRUD Profiles
    | 'HC_MANAGER'            // Type 02: Regional + Plan
    | 'HC_COSTCENTER_PLANNER' // Type 03: CostCenter + Plan
    | 'HC_AUDITOR_VIEWER';    // Type 04: All + Read Only

export type ConstructionRole =
    | 'CONSTRUCTION_ADMIN'
    | 'CONSTRUCTION_MANAGER'
    | 'CONSTRUCTION_VIEWER';

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

    isSuperAdmin?: boolean; // Developer/Backup

    modules: {
        commercial?: {
            enabled: boolean;
            role: CommercialRole;
        };
        human_capital?: {
            enabled: boolean;
            role: HCRole;
            scope: Scope;
        };
        construction?: {
            enabled: boolean;
            role: ConstructionRole;
        };
    };

    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
}

// Helpers

export const canPlan = (role?: HCRole): boolean => {
    if (!role) return false;
    return ['HC_ADMIN', 'HC_MANAGER', 'HC_COSTCENTER_PLANNER'].includes(role);
};

export const canManageProfiles = (role?: HCRole): boolean => {
    if (!role) return false;
    return role === 'HC_ADMIN';
};

export const canReadAll = (role?: HCRole): boolean => {
    if (!role) return false;
    return ['HC_ADMIN', 'HC_AUDITOR_VIEWER'].includes(role);
};

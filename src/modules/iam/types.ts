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

type HCLegacyRole = CHRole | 'DEV_MASTER' | 'MASTER';

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

export const canPlan = (role?: CHRole): boolean => {
    if (!role) return false;
    return ['CH_ADMIN', 'CH_MANAGER', 'CH_COSTCENTER_PLANNER', 'CH_APPROVER'].includes(role);
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

export const canReadAll = (role?: CHRole): boolean => {
    if (!role) return false;
    return ['CH_ADMIN', 'CH_AUDITOR_VIEWER', 'CH_APPROVER'].includes(role);
};

export const canApprove = (role?: CHRole): boolean => {
    if (!role) return false;
    return ['CH_ADMIN', 'CH_APPROVER'].includes(role);
};

export const canAccessSettings = (role?: HCLegacyRole): boolean => {
    if (!role) return false;
    return ['CH_ADMIN', 'DEV_MASTER', 'MASTER'].includes(role);
};

export const canManageHeadcount = (role?: HCLegacyRole): boolean => {
    if (!role) return false;
    return ['CH_ADMIN', 'DEV_MASTER', 'MASTER'].includes(role);
};

export const canManageBudgets = (role?: HCLegacyRole): boolean => {
    if (!role) return false;
    return ['CH_ADMIN', 'DEV_MASTER', 'MASTER'].includes(role);
};

import { UserProfileDoc, Scope } from '../../iam/types';
import { SSMACostCenter, SSMAInspection, SSMAInspectionEvent, SSMARegional } from '../types';

const isScopeMatch = (scope: Scope | undefined, regionalId: string, costCenterId: string): boolean => {
    if (!scope) return false;
    if (scope.type === 'ALL') return true;
    if (scope.type === 'REGIONAL' && scope.regionals) {
        return scope.regionals.includes(regionalId);
    }
    if (scope.type === 'COST_CENTER' && scope.costCenters) {
        return scope.costCenters.includes(costCenterId);
    }
    return false;
};

const getRole = (profile: UserProfileDoc | null): string | null => {
    if (!profile) return null;
    if (profile.isSuperAdmin) return 'SSMA_MANAGER';
    if (!profile.modules?.ssma?.enabled) return null;
    return profile.modules.ssma.role;
};

const canWriteSSMAEvents = (profile: UserProfileDoc | null): boolean => {
    const role = getRole(profile);
    if (!role) return false;
    return role !== 'SSMA_VIEWER';
};

const hasFullEventScope = (profile: UserProfileDoc | null): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    const role = getRole(profile);
    return role === 'SSMA_ADMIN' || role === 'SSMA_MANAGER' || role === 'Gerente de SSMA';
};

const getSSMAScopeForProfile = (profile: UserProfileDoc | null): Scope | undefined => {
    if (!profile) return undefined;
    if (profile.isSuperAdmin) return { type: 'ALL' };
    return profile.modules?.ssma?.scope;
};

export const hasSSMAAccess = (profile: UserProfileDoc | null): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    return !!profile.modules?.ssma?.enabled;
};

export const isSSMAAdmin = (profile: UserProfileDoc | null): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    return !!profile.modules?.ssma?.enabled && ['SSMA_ADMIN'].includes(profile.modules.ssma.role);
};

export const isSSMAManager = (profile: UserProfileDoc | null): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    return !!profile.modules?.ssma?.enabled && ['SSMA_MANAGER', 'Gerente de SSMA'].includes(profile.modules.ssma.role);
};

export const isSSMAOperationalRole = (profile: UserProfileDoc | null): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    if (!profile.modules?.ssma?.enabled) return false;
    return ['SSMA_ADMIN', 'SSMA_MANAGER', 'SSMA_REGIONAL_MANAGER', 'SSMA_SITE_MANAGER', 'SSMA_SUPERVISOR', 'SSMA_TECHNICIAN', 'SSMA_FOREMAN',
            'Gerente de SSMA', 'Gerente Regional', 'Engenheiro de Obra', 'Supervisor de SSMA', 'Técnico de Segurança', 'Encarregado'].includes(profile.modules.ssma.role);
};

export const isSSMAViewer = (profile: UserProfileDoc | null): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return false; // Super admin é operacional
    if (!profile.modules?.ssma?.enabled) return false;
    return profile.modules.ssma.role === 'SSMA_VIEWER';
};

export const canViewSSMAData = (profile: UserProfileDoc | null, costCenterId: string, regionalId: string): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    
    const ssma = profile.modules?.ssma;
    if (!ssma || !ssma.enabled) return false;

    return isScopeMatch(ssma.scope, regionalId, costCenterId);
};

export const canCreateSSMAInspection = (profile: UserProfileDoc | null, costCenterId: string, regionalId: string): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    
    const ssma = profile.modules?.ssma;
    if (!ssma || !ssma.enabled) return false;

    if (!isScopeMatch(ssma.scope, regionalId, costCenterId)) return false;

    const role = ssma.role;
    return ['SSMA_ADMIN', 'SSMA_MANAGER', 'SSMA_REGIONAL_MANAGER', 'SSMA_SITE_MANAGER', 'SSMA_SUPERVISOR', 'SSMA_TECHNICIAN', 'SSMA_FOREMAN',
            'Gerente de SSMA', 'Gerente Regional', 'Engenheiro de Obra', 'Supervisor de SSMA', 'Técnico de Segurança', 'Encarregado'].includes(role);
};

export const canEditSSMAInspection = (profile: UserProfileDoc | null, inspection: SSMAInspection): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    
    const ssma = profile.modules?.ssma;
    if (!ssma || !ssma.enabled) return false;

    if (!isScopeMatch(ssma.scope, (inspection as any).regionalId || '', (inspection as any).costCenterId || '')) return false;

    const role = ssma.role;
    // Administradores e gerentes podem editar qualquer inspeção do seu escopo
    if (['SSMA_ADMIN', 'SSMA_MANAGER', 'SSMA_REGIONAL_MANAGER', 'SSMA_SITE_MANAGER', 'Gerente de SSMA', 'Gerente Regional', 'Engenheiro de Obra'].includes(role)) return true;
    
    // Outras funções apenas se forem os criadores/executores e se a regra de negócio permitir 
    if (['SSMA_SUPERVISOR', 'SSMA_TECHNICIAN', 'SSMA_FOREMAN', 'Supervisor de SSMA', 'Técnico de Segurança', 'Encarregado'].includes(role)) {
        return inspection.createdBy === profile.uid || (inspection as any).executorUid || '' === profile.uid;
    }

    return false;
};

export const canCancelSSMAInspection = (profile: UserProfileDoc | null, inspection: SSMAInspection): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    
    const ssma = profile.modules?.ssma;
    if (!ssma || !ssma.enabled) return false;

    if (!isScopeMatch(ssma.scope, (inspection as any).regionalId || '', (inspection as any).costCenterId || '')) return false;

    // Apenas papéis gerenciais ou o próprio autor podem cancelar
    const role = ssma.role;
    if (['SSMA_ADMIN', 'SSMA_MANAGER', 'SSMA_REGIONAL_MANAGER', 'SSMA_SITE_MANAGER', 'Gerente de SSMA', 'Gerente Regional', 'Engenheiro de Obra'].includes(role)) return true;

    return inspection.createdBy === profile.uid;
};

export const canUploadSSMAEvidence = (profile: UserProfileDoc | null, inspection: SSMAInspection): boolean => {
    // Mesma regra de edição
    return canEditSSMAInspection(profile, inspection);
};

export const canDisableSSMAEvidence = (profile: UserProfileDoc | null, evidence: any): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    
    const ssma = profile.modules?.ssma;
    if (!ssma || !ssma.enabled) return false;

    if (!isScopeMatch(ssma.scope, evidence.regionalId, evidence.costCenterId)) return false;

    const role = ssma.role;
    if (['SSMA_ADMIN', 'SSMA_MANAGER', 'SSMA_REGIONAL_MANAGER', 'SSMA_SITE_MANAGER', 'Gerente de SSMA', 'Gerente Regional', 'Engenheiro de Obra'].includes(role)) return true;

    return evidence.uploadedBy === profile.uid;
};

export const canManageSSMARules = (profile: UserProfileDoc | null): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    
    const ssma = profile.modules?.ssma;
    if (!ssma || !ssma.enabled) return false;

    return ['SSMA_ADMIN', 'SSMA_MANAGER', 'Gerente de SSMA'].includes(ssma.role);
};

export const canManageSSMARegisters = (profile: UserProfileDoc | null): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    
    const ssma = profile.modules?.ssma;
    if (!ssma || !ssma.enabled) return false;

    return ['SSMA_ADMIN', 'SSMA_MANAGER', 'Gerente de SSMA'].includes(ssma.role);
};

export const canReadSSMAAuditLogs = (profile: UserProfileDoc | null): boolean => {
    if (!profile) return false;
    if (profile.isSuperAdmin) return true;
    
    const ssma = profile.modules?.ssma;
    if (!ssma || !ssma.enabled) return false;

    return ['SSMA_ADMIN', 'SSMA_MANAGER', 'Gerente de SSMA'].includes(ssma.role);
};

export const canViewEvent = (profile: UserProfileDoc | null, event: SSMAInspectionEvent): boolean => {
    if (!profile) return false;
    if (hasFullEventScope(profile)) return true;
    if (!profile.modules?.ssma?.enabled) return false;
    return isScopeMatch(profile.modules.ssma.scope, event.regionalId, event.costCenterId);
};

export const canCreateEvent = (
    profile: UserProfileDoc | null,
    target: { regionalId: string; costCenterId: string }
): boolean => {
    if (!canWriteSSMAEvents(profile)) return false;
    if (hasFullEventScope(profile)) return true;
    const scope = getSSMAScopeForProfile(profile);
    return isScopeMatch(scope, target.regionalId, target.costCenterId);
};

export const canEditEvent = (profile: UserProfileDoc | null, event: SSMAInspectionEvent): boolean => {
    if (event.status === 'CANCELLED') return false;
    if (!canWriteSSMAEvents(profile)) return false;
    return canViewEvent(profile, event);
};

export const canCancelEvent = (profile: UserProfileDoc | null, event: SSMAInspectionEvent): boolean => {
    if (event.status === 'CANCELLED') return false;
    if (!canWriteSSMAEvents(profile)) return false;
    return canViewEvent(profile, event);
};

export const canSelectExecutor = (profile: UserProfileDoc | null): boolean => {
    const role = getRole(profile);
    return role === 'SSMA_ADMIN' || role === 'SSMA_MANAGER' || role === 'SSMA_REGIONAL_MANAGER' || role === 'Gerente de SSMA' || role === 'Gerente Regional';
};

export const getAllowedCostCenters = (
    profile: UserProfileDoc | null,
    costCenters: SSMACostCenter[]
): SSMACostCenter[] => {
    if (!profile) return [];
    if (hasFullEventScope(profile)) return costCenters;
    if (!profile.modules?.ssma?.enabled) return [];

    const scope = profile.modules.ssma.scope;
    if (!scope) return [];
    if (scope.type === 'ALL') return costCenters;
    if (scope.type === 'REGIONAL') {
        return costCenters.filter(costCenter => scope.regionals.includes(costCenter.regionalId));
    }
    return costCenters.filter(costCenter => scope.costCenters.includes(costCenter.id));
};

export const getAllowedRegionals = (
    profile: UserProfileDoc | null,
    regionals: SSMARegional[],
    costCenters: SSMACostCenter[]
): SSMARegional[] => {
    if (!profile) return [];
    if (hasFullEventScope(profile)) return regionals;
    if (!profile.modules?.ssma?.enabled) return [];

    const scope = profile.modules.ssma.scope;
    if (!scope) return [];
    if (scope.type === 'ALL') return regionals;
    if (scope.type === 'REGIONAL') {
        return regionals.filter(regional => scope.regionals.includes(regional.id));
    }

    const allowedRegionalIds = new Set(
        costCenters
            .filter(costCenter => scope.costCenters.includes(costCenter.id))
            .map(costCenter => costCenter.regionalId)
    );
    return regionals.filter(regional => allowedRegionalIds.has(regional.id));
};

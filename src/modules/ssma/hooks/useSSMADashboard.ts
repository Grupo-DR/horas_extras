import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { Scope } from '../../iam/types';
import { getAllProfiles } from '../../iam/profileService';
import { calculateCollectiveMonthlyResult, calculatePersonMonthlyResult } from '../domain/calculateSSMAResults';
import { getAllowedCostCenters, getAllowedRegionals, hasSSMAAccess } from '../domain/permissions';
import { roleToTargetFunctionGroup } from '../domain/inspectionEventHelpers';
import { ssmaCostCenterService } from '../services/ssmaCostCenterService';
import { ssmaInspectionEventService } from '../services/ssmaInspectionEventService';
import { ssmaMonthlyTargetService } from '../services/ssmaMonthlyTargetService';
import { ssmaRegionalService } from '../services/ssmaRegionalService';
import {
    SSMACostCenter,
    SSMAEmployee,
    SSMAFunctionGroup,
    SSMAInspectionEvent,
    SSMAMonthlyCollectiveResult,
    SSMAMonthlyPersonResult,
    SSMAMonthlyTarget,
    SSMARegional
} from '../types';

export interface SSMADashboardFilters {
    year?: number;
    competences?: string[];
    regionalId?: string;
    costCenterId?: string;
}

const currentCompetence = () => new Date().toISOString().slice(0, 7);

const mapRoleToLegacyFunctionGroup = (role: string): SSMAFunctionGroup => {
    switch (role) {
        case 'SSMA_REGIONAL_MANAGER':
            return 'MANAGER';
        case 'SSMA_SITE_MANAGER':
            return 'SITE_MANAGER';
        case 'SSMA_SUPERVISOR':
            return 'SUPERVISOR';
        case 'SSMA_FOREMAN':
            return 'FOREMAN';
        case 'SSMA_TECHNICIAN':
        default:
            return 'TECHNICIAN';
    }
};

const isAssignedToCostCenter = (employee: SSMAEmployee, costCenter: SSMACostCenter): boolean => {
    return (
        employee.costCenterIds?.includes(costCenter.id) ||
        costCenter.engenheiroId === employee.id ||
        costCenter.supervisorId === employee.id ||
        costCenter.tstIds?.includes(employee.id) ||
        costCenter.encarregadoIds?.includes(employee.id)
    );
};

const employeeMatchesRegionals = (employee: SSMAEmployee, regionalIds: string[], costCenters: SSMACostCenter[]): boolean => {
    if (employee.regionalIds?.some(regionalId => regionalIds.includes(regionalId))) return true;
    return costCenters.some(costCenter => regionalIds.includes(costCenter.regionalId) && isAssignedToCostCenter(employee, costCenter));
};

const employeeMatchesCostCenters = (employee: SSMAEmployee, costCenterIds: string[], costCenters: SSMACostCenter[]): boolean => {
    if (employee.costCenterIds?.some(costCenterId => costCenterIds.includes(costCenterId))) return true;
    return costCenters.some(costCenter => costCenterIds.includes(costCenter.id) && isAssignedToCostCenter(employee, costCenter));
};

const buildScopeFromFilters = (filters: SSMADashboardFilters): Scope => {
    if (filters.costCenterId) return { type: 'COST_CENTER', costCenters: [filters.costCenterId] };
    if (filters.regionalId) return { type: 'REGIONAL', regionals: [filters.regionalId] };
    return { type: 'ALL' };
};

export const useSSMADashboard = (initialFilters: SSMADashboardFilters) => {
    const { profile } = useAuth();
    const [filters, setFilters] = useState<SSMADashboardFilters>({
        ...initialFilters,
        competences: initialFilters.competences || (initialFilters.year ? [`${initialFilters.year}-01`] : [currentCompetence()])
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [regionals, setRegionals] = useState<SSMARegional[]>([]);
    const [costCenters, setCostCenters] = useState<SSMACostCenter[]>([]);
    const [employees, setEmployees] = useState<SSMAEmployee[]>([]);
    const [events, setEvents] = useState<SSMAInspectionEvent[]>([]);
    const [targets, setTargets] = useState<SSMAMonthlyTarget[]>([]);
    const [personResults, setPersonResults] = useState<SSMAMonthlyPersonResult[]>([]);
    const [collectiveResult, setCollectiveResult] = useState<SSMAMonthlyCollectiveResult | null>(null);

    const loadData = useCallback(async () => {
        if (!hasSSMAAccess(profile)) {
            setError('Usuario sem acesso ao modulo SSMA.');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const competences = filters.competences && filters.competences.length > 0 ? filters.competences : [currentCompetence()];
            const userScope = profile?.isSuperAdmin || profile?.modules?.ssma?.role === 'SSMA_MANAGER' || profile?.modules?.ssma?.role === 'SSMA_ADMIN'
                ? { type: 'ALL' as const }
                : profile?.modules?.ssma?.scope;

            const [fetchedRegionals, fetchedCostCenters, fetchedProfiles, fetchedEvents, fetchedTargets, fetchedForemen] = await Promise.all([
                ssmaRegionalService.list(),
                ssmaCostCenterService.listByScope(userScope),
                getAllProfiles(),
                profile ? ssmaInspectionEventService.listByCompetenceForUser(competences, profile) : Promise.resolve([]),
                ssmaMonthlyTargetService.listByCompetence(competences),
                import('../services/ssmaForemanService').then(m => m.ssmaForemanService.list())
            ]);

            const mappedEmployees: SSMAEmployee[] = fetchedProfiles
                .filter(user => user.modules?.ssma?.enabled && user.status === 'active' && user.modules.ssma!.role !== 'SSMA_VIEWER' && user.modules.ssma!.role !== 'SSMA_MANAGER' && user.modules.ssma!.role !== 'SSMA_ADMIN')
                .map(user => ({
                    id: user.uid,
                    uid: user.uid,
                    name: user.displayName || user.email,
                    email: user.email,
                    functionGroup: mapRoleToLegacyFunctionGroup(user.modules.ssma!.role),
                    roleSnapshot: user.modules.ssma!.role,
                    regionalIds: user.modules.ssma!.scope?.type === 'REGIONAL' ? user.modules.ssma!.scope.regionals : undefined,
                    costCenterIds: user.modules.ssma!.scope?.type === 'COST_CENTER' ? user.modules.ssma!.scope.costCenters : undefined,
                    active: true
                }));

            const mappedForemen: SSMAEmployee[] = fetchedForemen
                .filter(f => f.active !== false)
                .map(f => ({
                    id: f.id,
                    uid: f.id,
                    name: f.name,
                    email: '',
                    functionGroup: 'FOREMAN',
                    roleSnapshot: 'SSMA_FOREMAN' as any,
                    costCenterIds: fetchedCostCenters.filter(cc => cc.encarregadoIds?.includes(f.id)).map(cc => cc.id),
                    active: true
                }));
                
            mappedEmployees.push(...mappedForemen);

            const activeCostCenters = fetchedCostCenters.filter(costCenter => costCenter.active !== false);
            const activeRegionals = fetchedRegionals.filter(regional => regional.active !== false);
            const allowedCostCenters = getAllowedCostCenters(profile, activeCostCenters);
            const allowedRegionals = getAllowedRegionals(profile, activeRegionals, activeCostCenters);
            const allowedCostCenterIds = new Set(allowedCostCenters.map(costCenter => costCenter.id));
            const allowedRegionalIds = new Set(allowedRegionals.map(regional => regional.id));

            const selectedScope = buildScopeFromFilters(filters);
            let scopedEvents = fetchedEvents.filter(event => event.status === 'VALID');
            if (!profile?.isSuperAdmin && profile?.modules?.ssma?.role !== 'SSMA_MANAGER' && profile?.modules?.ssma?.role !== 'SSMA_ADMIN') {
                scopedEvents = scopedEvents.filter(event => allowedCostCenterIds.has(event.costCenterId) || allowedRegionalIds.has(event.regionalId));
            }
            if (filters.regionalId) scopedEvents = scopedEvents.filter(event => event.regionalId === filters.regionalId);
            if (filters.costCenterId) scopedEvents = scopedEvents.filter(event => event.costCenterId === filters.costCenterId);

            const scopeCostCenters = filters.costCenterId
                ? activeCostCenters.filter(costCenter => costCenter.id === filters.costCenterId)
                : filters.regionalId
                    ? activeCostCenters.filter(costCenter => costCenter.regionalId === filters.regionalId)
                    : allowedCostCenters;
            const scopeRegionalIds = filters.regionalId
                ? [filters.regionalId]
                : Array.from(new Set(scopeCostCenters.map(costCenter => costCenter.regionalId)));
            const scopeCostCenterIds = scopeCostCenters.map(costCenter => costCenter.id);

            const collectiveEmployees = mappedEmployees.filter(employee => {
                if (profile?.isSuperAdmin || profile?.modules?.ssma?.role === 'SSMA_MANAGER' || profile?.modules?.ssma?.role === 'SSMA_ADMIN') {
                    if (filters.costCenterId) return employeeMatchesCostCenters(employee, scopeCostCenterIds, activeCostCenters);
                    if (filters.regionalId) return employeeMatchesRegionals(employee, scopeRegionalIds, activeCostCenters);
                    return true;
                }
                if (filters.costCenterId) return employeeMatchesCostCenters(employee, scopeCostCenterIds, activeCostCenters);
                if (filters.regionalId || profile?.modules?.ssma?.role === 'SSMA_REGIONAL_MANAGER') return employeeMatchesRegionals(employee, scopeRegionalIds, activeCostCenters);
                return employeeMatchesCostCenters(employee, scopeCostCenterIds, activeCostCenters) || employee.uid === profile?.uid;
            });

            const individualEmployees = profile?.isSuperAdmin || profile?.modules?.ssma?.role === 'SSMA_MANAGER' || profile?.modules?.ssma?.role === 'SSMA_ADMIN' || profile?.modules?.ssma?.role === 'SSMA_REGIONAL_MANAGER'
                ? collectiveEmployees
                : collectiveEmployees.filter(employee => employee.uid === profile?.uid);

            const targetsByUid = new Map<string, SSMAMonthlyTarget[]>();
            fetchedTargets.filter(t => t.active !== false).forEach(target => {
                const existing = targetsByUid.get(target.employeeUid) || [];
                existing.push(target);
                targetsByUid.set(target.employeeUid, existing);
            });
            const calculatedPersonResults = individualEmployees.map(employee => calculatePersonMonthlyResult({ ...employee, competences } as any, fetchedEvents, targetsByUid.get(employee.uid || employee.id)));
            const collectiveEmployeeUids = collectiveEmployees.map(employee => employee.uid || employee.id);
            const calculatedCollective = calculateCollectiveMonthlyResult(scopedEvents, fetchedTargets, {
                competences,
                scope: selectedScope,
                employeeUids: collectiveEmployeeUids
            });

            setRegionals(allowedRegionals);
            setCostCenters(allowedCostCenters);
            setEmployees(collectiveEmployees);
            setEvents(scopedEvents);
            setTargets(fetchedTargets);
            setPersonResults(calculatedPersonResults);
            setCollectiveResult(calculatedCollective);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar dashboard SSMA.');
        } finally {
            setLoading(false);
        }
    }, [filters, profile]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const inspections = useMemo(() => [], []);

    return {
        filters,
        setFilters,
        loading,
        error,
        refetch: loadData,
        regionals,
        costCenters,
        employees,
        events,
        targets,
        personResults,
        collectiveResult,
        inspections,
        rules: []
    };
};

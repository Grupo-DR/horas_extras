import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { getSSMAScope } from '../../iam/types';
import { hasSSMAAccess } from '../domain/permissions';
import { ssmaInspectionService } from '../services/ssmaInspectionService';
import { ssmaRegionalService } from '../services/ssmaRegionalService';
import { ssmaCostCenterService } from '../services/ssmaCostCenterService';
import { ssmaRuleService } from '../services/ssmaRuleService';
import { SSMAInspection, SSMARegional, SSMACostCenter, SSMARule, SSMAEmployee, SSMAFunctionGroup } from '../types';
import { calculateInspecoesFields } from '../domain/calculateSSMAResults';
import { getAllProfiles } from '../../iam/profileService';

export interface SSMADashboardFilters {
    year: number;
    regionalId?: string;
    costCenterId?: string;
    gestor?: string;
    encarregado?: string;
    supssma?: string;
    tst?: string;
}

export const useSSMADashboard = (initialFilters: SSMADashboardFilters) => {
    const { profile } = useAuth();
    const [filters, setFilters] = useState<SSMADashboardFilters>(initialFilters);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [inspections, setInspections] = useState<SSMAInspection[]>([]);
    const [regionals, setRegionals] = useState<SSMARegional[]>([]);
    const [costCenters, setCostCenters] = useState<SSMACostCenter[]>([]);
    const [rules, setRules] = useState<SSMARule[]>([]);
    const [employees, setEmployees] = useState<SSMAEmployee[]>([]);

    const loadData = useCallback(async () => {
        if (!hasSSMAAccess(profile)) {
            setError('Usuário sem acesso ao módulo SSMA.');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Fetch base data
            const [fetchedRegionals, fetchedCostCenters, fetchedRules, fetchedProfiles] = await Promise.all([
                ssmaRegionalService.list(),
                ssmaCostCenterService.list(),
                ssmaRuleService.list(),
                getAllProfiles()
            ]);

            const mappedEmployees = fetchedProfiles
                .filter(p => p.modules?.ssma?.enabled && p.status === 'active' && p.modules.ssma!.role !== 'SSMA_VIEWER' && p.modules.ssma!.role !== 'SSMA_MANAGER' && p.modules.ssma!.role !== 'SSMA_ADMIN')
                .map(p => {
                    const role = p.modules.ssma!.role;
                    let functionGroup: SSMAFunctionGroup = 'TECHNICIAN';
                    
                    if (role === 'SSMA_REGIONAL_MANAGER') {
                        functionGroup = 'MANAGER';
                    } else if (role === 'SSMA_SITE_MANAGER') {
                        functionGroup = 'SITE_MANAGER';
                    } else if (role === 'SSMA_SUPERVISOR') {
                        functionGroup = 'SUPERVISOR';
                    } else if (role === 'SSMA_FOREMAN') {
                        functionGroup = 'FOREMAN';
                    } else {
                        functionGroup = 'TECHNICIAN';
                    }

                    return {
                        id: p.uid,
                        uid: p.uid,
                        name: p.displayName || p.email,
                        email: p.email,
                        functionGroup,
                        active: p.status === 'active',
                    } as SSMAEmployee;
                });

            setRegionals(fetchedRegionals);
            setCostCenters(fetchedCostCenters);
            setRules(fetchedRules.filter(r => r.active));
            setEmployees(mappedEmployees);

            let rawInspections = await ssmaInspectionService.list(filters.year);

            // CLEANUP MOCK DATA FROM PREVIOUS MVP VERSION
            rawInspections = rawInspections.map(i => {
                const cleaned = {
                    ...i,
                    gestor: i.gestor === 'Ricardo Santos' ? 'Não atribuído' : i.gestor,
                    supssma: i.supssma === 'Aline Martins' ? 'Não atribuído' : i.supssma,
                    encarregado: i.encarregado === 'José Silva' ? 'Não atribuído' : i.encarregado,
                    tst: i.tst === 'Eduardo Reis' ? 'Não atribuído' : i.tst,
                    greg: i.greg === 'GREG Norte' ? 'Não atribuído' : i.greg
                };
                return calculateInspecoesFields(cleaned as any, mappedEmployees);
            });

            // Apply IAM scope filtering based on prototype rules
            const scope = getSSMAScope(profile as any);
            const userRole = profile?.modules?.ssma?.role;

            if (userRole && !profile.isSuperAdmin) {
                // If they are not super admin, we must apply the prototype governance rules:
                // Gerente Regional -> only his regionals
                // Engenheiro de Obra -> only his cost centers
                // Supervisor -> only his cost centers
                // TST -> only his cost centers
                // Encarregado -> only his own records
                
                if (scope && scope.type === 'REGIONAL') {
                    const myEmployeeRecord = mappedEmployees.find(e => e.name.trim().toLowerCase() === profile.displayName.trim().toLowerCase() || e.email === profile.email);
                    rawInspections = rawInspections.filter(i => {
                        const cc = fetchedCostCenters.find(c => c.code === i.cc);
                        if (!cc) return false;
                        const reg = fetchedRegionals.find(r => r.id === cc.regionalId);
                        const inScopeList = scope.regionals.includes(cc.regionalId);
                        const isAssigned = myEmployeeRecord && reg?.responsavelId === myEmployeeRecord.id;
                        const isCreator = i.createdBy === profile.uid;
                        return inScopeList || isAssigned || isCreator;
                    });
                } else if (scope && scope.type === 'COST_CENTER') {
                    const myEmployeeRecord = mappedEmployees.find(e => e.name.trim().toLowerCase() === profile.displayName.trim().toLowerCase() || e.email === profile.email);
                    rawInspections = rawInspections.filter(i => {
                        const cc = fetchedCostCenters.find(c => c.code === i.cc);
                        if (!cc) return false;
                        const inScopeList = scope.costCenters.includes(cc.id);
                        const isAssigned = myEmployeeRecord && (
                            cc.engenheiroId === myEmployeeRecord.id ||
                            cc.supervisorId === myEmployeeRecord.id ||
                            cc.tstIds?.includes(myEmployeeRecord.id) ||
                            cc.encarregadoIds?.includes(myEmployeeRecord.id)
                        );
                        const matchesNameFallback = (
                            i.gestor === profile.displayName ||
                            i.encarregado === profile.displayName ||
                            i.supssma === profile.displayName ||
                            i.tst === profile.displayName
                        );
                        const isCreator = i.createdBy === profile.uid;
                        return inScopeList || isAssigned || matchesNameFallback || isCreator;
                    });
                } else {
                    rawInspections = rawInspections.filter(i => 
                        i.gestor === profile.displayName ||
                        i.encarregado === profile.displayName ||
                        i.supssma === profile.displayName ||
                        i.tst === profile.displayName ||
                        i.createdBy === profile.uid
                    );
                }
            }

            // Apply Dashboard user filters
            if (filters.regionalId) {
                const reg = fetchedRegionals.find(r => r.id === filters.regionalId);
                if (reg) rawInspections = rawInspections.filter(i => i.greg === reg.name);
            }
            if (filters.costCenterId) {
                const cc = fetchedCostCenters.find(c => c.id === filters.costCenterId);
                if (cc) rawInspections = rawInspections.filter(i => i.cc === cc.code);
            }
            if (filters.gestor) {
                rawInspections = rawInspections.filter(i => i.gestor === filters.gestor);
            }
            if (filters.encarregado) {
                rawInspections = rawInspections.filter(i => i.encarregado === filters.encarregado);
            }
            if (filters.supssma) {
                rawInspections = rawInspections.filter(i => i.supssma === filters.supssma);
            }
            if (filters.tst) {
                rawInspections = rawInspections.filter(i => i.tst === filters.tst);
            }

            setInspections(rawInspections);

        } catch (err: any) {
            setError(err.message || 'Erro ao carregar dados do dashboard.');
        } finally {
            setLoading(false);
        }
    }, [filters, profile]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return {
        filters,
        setFilters,
        loading,
        error,
        refetch: loadData,
        regionals,
        costCenters,
        employees,
        inspections,
        rules
    };
};

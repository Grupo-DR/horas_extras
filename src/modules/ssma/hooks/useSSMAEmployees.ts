import { useState, useEffect, useCallback } from 'react';
import { SSMAEmployee, SSMAFunctionGroup } from '../types';
import { getAllProfiles } from '../../iam/profileService';

export const useSSMAEmployees = () => {
    const [data, setData] = useState<SSMAEmployee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const profiles = await getAllProfiles();
            
            const ssmaUsers = profiles
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
                        name: p.displayName || p.email,
                        email: p.email,
                        functionGroup,
                        active: p.status === 'active',
                    } as SSMAEmployee;
                });
                
            setData(ssmaUsers);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar colaboradores do IAM');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const create = async (input: any) => { throw new Error('Criação movida para Gestão de Acessos (IAM)'); };
    const update = async (id: string, input: any) => { throw new Error('Edição movida para Gestão de Acessos (IAM)'); };
    const disable = async (id: string, reason: string) => { throw new Error('Desativação movida para Gestão de Acessos (IAM)'); };

    return { data, loading, error, refetch: loadData, create, update, disable };
};

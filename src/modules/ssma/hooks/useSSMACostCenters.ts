import { useState, useEffect, useCallback } from 'react';
import { SSMACostCenter } from '../types';
import { ssmaCostCenterService } from '../services/ssmaCostCenterService';
import { useAuth } from '../../../../contexts/AuthContext';

export const useSSMACostCenters = () => {
    const { profile } = useAuth();
    const [data, setData] = useState<SSMACostCenter[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await ssmaCostCenterService.list();
            setData(res);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar centros de custo');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const create = async (input: any) => {
        if (!profile) throw new Error('Usuário não autenticado');
        const id = await ssmaCostCenterService.create(input, profile as any);
        await loadData();
        return id;
    };

    const update = async (id: string, input: any) => {
        if (!profile) throw new Error('Usuário não autenticado');
        await ssmaCostCenterService.update(id, input, profile as any);
        await loadData();
    };

    const disable = async (id: string, reason: string) => {
        if (!profile) throw new Error('Usuário não autenticado');
        await ssmaCostCenterService.disable(id, reason, profile as any);
        await loadData();
    };

    const remove = async (id: string) => {
        if (!profile) throw new Error('Usuário não autenticado');
        await ssmaCostCenterService.remove(id, profile as any);
        await loadData();
    };

    return { data, loading, error, refetch: loadData, create, update, disable, remove };
};

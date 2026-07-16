import { useState, useEffect, useCallback } from 'react';
import { SSMAForeman } from '../types';
import { ssmaForemanService } from '../services/ssmaForemanService';
import { useAuth } from '../../../../contexts/AuthContext';

export const useSSMAForemen = () => {
    const { profile } = useAuth();
    const [data, setData] = useState<SSMAForeman[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await ssmaForemanService.list();
            setData(res);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar encarregados');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const create = async (input: any) => {
        if (!profile) throw new Error('Usuário não autenticado');
        const id = await ssmaForemanService.create(input, profile as any);
        await loadData();
        return id;
    };

    const update = async (id: string, input: any) => {
        if (!profile) throw new Error('Usuário não autenticado');
        await ssmaForemanService.update(id, input, profile as any);
        await loadData();
    };

    const disable = async (id: string, reason: string) => {
        if (!profile) throw new Error('Usuário não autenticado');
        await ssmaForemanService.disable(id, reason, profile as any);
        await loadData();
    };

    const remove = async (id: string) => {
        if (!profile) throw new Error('Usuário não autenticado');
        await ssmaForemanService.remove(id, profile as any);
        await loadData();
    };

    return { data, loading, error, refetch: loadData, create, update, disable, remove };
};

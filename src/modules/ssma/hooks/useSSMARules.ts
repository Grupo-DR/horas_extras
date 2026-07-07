import { useState, useEffect, useCallback } from 'react';
import { SSMARule } from '../types';
import { ssmaRuleService } from '../services/ssmaRuleService';
import { useAuth } from '../../../../contexts/AuthContext';

export const useSSMARules = () => {
    const { profile } = useAuth();
    const [data, setData] = useState<SSMARule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await ssmaRuleService.list();
            setData(res);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar regras');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const create = async (input: any) => {
        if (!profile) throw new Error('Usuário não autenticado');
        const id = await ssmaRuleService.create(input, profile as any);
        await loadData();
        return id;
    };

    const update = async (id: string, input: any) => {
        if (!profile) throw new Error('Usuário não autenticado');
        await ssmaRuleService.update(id, input, profile as any);
        await loadData();
    };

    const disable = async (id: string, reason: string) => {
        if (!profile) throw new Error('Usuário não autenticado');
        await ssmaRuleService.disable(id, reason, profile as any);
        await loadData();
    };

    return { data, loading, error, refetch: loadData, create, update, disable };
};

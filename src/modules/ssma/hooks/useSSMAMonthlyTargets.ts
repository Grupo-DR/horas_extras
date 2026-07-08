import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ssmaMonthlyTargetService } from '../services/ssmaMonthlyTargetService';
import { SSMAMonthlyTarget } from '../types';
import { validateMonthlyTargetInput } from '../domain/validators';

export type MonthlyTargetUpsertInput = Omit<
    SSMAMonthlyTarget,
    'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot' | 'updatedAt' | 'updatedBy' | 'updatedByNameSnapshot'
>;

const getPreviousCompetence = (competence: string): string => {
    const [year, month] = competence.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const useSSMAMonthlyTargets = (competence: string) => {
    const { profile } = useAuth();
    const [targets, setTargets] = useState<SSMAMonthlyTarget[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const listByCompetence = useCallback(async (targetCompetence = competence): Promise<SSMAMonthlyTarget[]> => {
        try {
            setLoading(true);
            setError(null);
            const data = await ssmaMonthlyTargetService.listByCompetence(targetCompetence);
            if (targetCompetence === competence) {
                setTargets(data);
            }
            return data;
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar metas mensais.');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [competence]);

    useEffect(() => {
        listByCompetence().catch(() => undefined);
    }, [listByCompetence]);

    const bulkUpsertTargets = async (inputs: MonthlyTargetUpsertInput[]): Promise<void> => {
        if (!profile) throw new Error('Usuario nao autenticado.');
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);
            inputs.forEach(validateMonthlyTargetInput);
            await ssmaMonthlyTargetService.bulkUpsertTargets(inputs, profile);
            await listByCompetence();
            setSuccess('Metas salvas.');
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar metas mensais.');
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const copyFromPreviousCompetence = async (
        buildTargets: (previousTargets: SSMAMonthlyTarget[]) => MonthlyTargetUpsertInput[]
    ): Promise<void> => {
        const previousCompetence = getPreviousCompetence(competence);
        const previousTargets = await ssmaMonthlyTargetService.listByCompetence(previousCompetence);
        const nextTargets = buildTargets(previousTargets);
        await bulkUpsertTargets(nextTargets);
        setSuccess(`Metas copiadas de ${previousCompetence}.`);
    };

    return {
        targets,
        loading,
        saving,
        error,
        success,
        listByCompetence,
        bulkUpsertTargets,
        copyFromPreviousCompetence,
        refetch: listByCompetence
    };
};

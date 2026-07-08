import { useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { canCreateEvent } from '../domain/permissions';
import { validateInspectionEventInput } from '../domain/validators';
import { ssmaInspectionEventService } from '../services/ssmaInspectionEventService';
import { SSMAInspectionEvent } from '../types';

export type CreateSSMAInspectionEventInput = Omit<SSMAInspectionEvent, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot'>;

export const useCreateSSMAInspectionEvent = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createEvent = async (input: CreateSSMAInspectionEventInput): Promise<string> => {
        if (!profile) throw new Error('Usuario nao autenticado.');
        if (!canCreateEvent(profile, input)) {
            throw new Error('Usuario sem permissao para criar lancamento nesta obra.');
        }
        validateInspectionEventInput(input);

        try {
            setLoading(true);
            setError(null);
            // TODO: mover auditoria para Cloud Function quando a regra sair do client-side.
            return await ssmaInspectionEventService.createEvent(input, profile);
        } catch (err: any) {
            setError(err.message || 'Erro ao criar lancamento.');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { createEvent, loading, error };
};

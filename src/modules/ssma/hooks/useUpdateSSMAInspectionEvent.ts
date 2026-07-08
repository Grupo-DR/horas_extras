import { useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { canEditEvent } from '../domain/permissions';
import { validateInspectionEventInput } from '../domain/validators';
import { ssmaInspectionEventService } from '../services/ssmaInspectionEventService';
import { SSMAInspectionEvent } from '../types';

export type UpdateSSMAInspectionEventInput = Partial<Omit<SSMAInspectionEvent, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot'>>;

export const useUpdateSSMAInspectionEvent = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateEvent = async (
        event: SSMAInspectionEvent,
        input: UpdateSSMAInspectionEventInput
    ): Promise<void> => {
        if (!profile) throw new Error('Usuario nao autenticado.');
        if (!canEditEvent(profile, event)) {
            throw new Error('Usuario sem permissao para editar este lancamento.');
        }
        validateInspectionEventInput({ ...event, ...input });

        try {
            setLoading(true);
            setError(null);
            // TODO: mover auditoria para Cloud Function quando a regra sair do client-side.
            await ssmaInspectionEventService.updateEvent(event.id, input, profile);
        } catch (err: any) {
            setError(err.message || 'Erro ao editar lancamento.');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { updateEvent, loading, error };
};

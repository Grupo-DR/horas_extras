import { useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { canCancelEvent } from '../domain/permissions';
import { validateCancelReason } from '../domain/validators';
import { ssmaInspectionEventService } from '../services/ssmaInspectionEventService';
import { SSMAInspectionEvent } from '../types';

export const useCancelSSMAInspectionEvent = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cancelEvent = async (event: SSMAInspectionEvent, reason: string): Promise<void> => {
        if (!profile) throw new Error('Usuario nao autenticado.');
        validateCancelReason(reason);
        if (!canCancelEvent(profile, event)) {
            throw new Error('Usuario sem permissao para cancelar este lancamento.');
        }

        try {
            setLoading(true);
            setError(null);
            // TODO: mover auditoria para Cloud Function quando a regra sair do client-side.
            await ssmaInspectionEventService.cancelEvent(event.id, reason.trim(), profile);
        } catch (err: any) {
            setError(err.message || 'Erro ao cancelar lancamento.');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { cancelEvent, loading, error };
};

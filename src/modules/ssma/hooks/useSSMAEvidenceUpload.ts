import { useCallback, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { canEditEvent, canViewEvent } from '../domain/permissions';
import { ssmaEvidenceMetadataService } from '../services/ssmaEvidenceMetadataService';
import { ssmaEvidenceService } from '../services/ssmaEvidenceService';
import { SSMAEvidence, SSMAInspectionEvent } from '../types';
import { validateEvidenceFile } from '../domain/validators';

export const validateSSMAEvidenceFile = (file: File): string | null => {
    try {
        validateEvidenceFile(file);
        return null;
    } catch (err: any) {
        return err.message || 'Arquivo invalido.';
    }
};

export const useSSMAEvidenceUpload = () => {
    const { profile } = useAuth();
    const [evidences, setEvidences] = useState<SSMAEvidence[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const listByEvent = useCallback(async (event: SSMAInspectionEvent): Promise<SSMAEvidence[]> => {
        if (!profile) return [];
        if (!canViewEvent(profile, event)) return [];

        try {
            setLoading(true);
            setError(null);
            const data = await ssmaEvidenceMetadataService.listByEvent(event.id);
            setEvidences(data);
            return data;
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar evidencias.');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [profile]);

    const uploadEvidence = async (event: SSMAInspectionEvent, file: File): Promise<SSMAEvidence> => {
        if (!profile) throw new Error('Usuario nao autenticado.');
        if (!canEditEvent(profile, event)) {
            throw new Error('Usuario sem permissao para adicionar evidencia neste lancamento.');
        }

        validateEvidenceFile(file);

        try {
            setUploading(true);
            setError(null);
            // TODO: mover auditoria/metadados para Cloud Function quando a regra sair do client-side.
            const evidence = await ssmaEvidenceService.uploadInspectionEventEvidence(event, file, profile);
            setEvidences(prev => [evidence, ...prev]);
            return evidence;
        } catch (err: any) {
            setError(err.message || 'Erro ao enviar evidencia.');
            throw err;
        } finally {
            setUploading(false);
        }
    };

    const disableEvidence = async (event: SSMAInspectionEvent, evidence: SSMAEvidence): Promise<void> => {
        if (!profile) throw new Error('Usuario nao autenticado.');
        if (!canEditEvent(profile, event)) {
            throw new Error('Usuario sem permissao para remover evidencia neste lancamento.');
        }

        try {
            setLoading(true);
            setError(null);
            await ssmaEvidenceMetadataService.disable(evidence.id, profile);
            setEvidences(prev => prev.filter(item => item.id !== evidence.id));
        } catch (err: any) {
            setError(err.message || 'Erro ao remover evidencia.');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        evidences,
        loading,
        uploading,
        error,
        listByEvent,
        uploadEvidence,
        disableEvidence
    };
};

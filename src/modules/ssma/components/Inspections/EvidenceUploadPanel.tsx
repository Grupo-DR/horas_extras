import React, { useEffect, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { useSSMAEvidenceUpload, validateSSMAEvidenceFile } from '../../hooks/useSSMAEvidenceUpload';
import { SSMAInspectionEvent } from '../../types';
import { EvidenceList } from './EvidenceList';

interface Props {
    event: SSMAInspectionEvent;
    canManage: boolean;
    onChanged?: () => void;
}

export const EvidenceUploadPanel: React.FC<Props> = ({ event, canManage, onChanged }) => {
    const { evidences, loading, uploading, listByEvent, uploadEvidence, disableEvidence } = useSSMAEvidenceUpload();
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    useEffect(() => {
        listByEvent(event).catch(err => toast.error(err.message || 'Erro ao carregar evidencias.'));
    }, [event, listByEvent]);

    const handleSelectFiles = (files: FileList | null) => {
        const nextFiles = Array.from(files || []);
        const invalid = nextFiles.map(validateSSMAEvidenceFile).find(Boolean);
        if (invalid) {
            toast.error(invalid);
            return;
        }
        setSelectedFiles(nextFiles);
    };

    const handleUpload = async () => {
        if (!selectedFiles.length) return;
        try {
            for (const file of selectedFiles) {
                await uploadEvidence(event, file);
            }
            setSelectedFiles([]);
            toast.success('Evidencia adicionada.');
            onChanged?.();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao enviar evidencia.');
        }
    };

    const handleRemove = async (evidence: any) => {
        try {
            await disableEvidence(event, evidence);
            toast.success('Evidencia removida.');
            onChanged?.();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao remover evidencia.');
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h4 className="text-sm font-semibold text-gray-900">Evidencias</h4>
                    <p className="text-xs text-gray-500">JPEG, PNG, WEBP ou PDF ate 10MB.</p>
                </div>
                {loading && <span className="text-xs text-gray-500">Carregando...</span>}
            </div>

            {canManage && (
                <div className="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center">
                    <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={event => handleSelectFiles(event.target.files)}
                        className="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-700"
                    />
                    <button
                        type="button"
                        onClick={handleUpload}
                        disabled={!selectedFiles.length || uploading}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded bg-gray-900 px-3 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <UploadCloud size={16} />
                        {uploading ? 'Enviando' : 'Enviar'}
                    </button>
                </div>
            )}

            <EvidenceList evidences={evidences} canRemove={canManage} onRemove={handleRemove} />
        </div>
    );
};

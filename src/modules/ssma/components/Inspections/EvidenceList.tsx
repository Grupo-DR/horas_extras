import React from 'react';
import { ExternalLink, FileText, Trash2 } from 'lucide-react';
import { SSMAEvidence } from '../../types';

interface Props {
    evidences: SSMAEvidence[];
    canRemove: boolean;
    onRemove: (evidence: SSMAEvidence) => void;
}

const formatFileSize = (sizeBytes: number): string => {
    if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
    return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
};

export const EvidenceList: React.FC<Props> = ({ evidences, canRemove, onRemove }) => {
    if (!evidences.length) {
        return <div className="rounded border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">Nenhuma evidencia vinculada.</div>;
    }

    return (
        <div className="divide-y divide-gray-100 rounded border border-gray-200 bg-white">
            {evidences.map(evidence => (
                <div key={evidence.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-600">
                            <FileText size={16} />
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-800">{evidence.fileName}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(evidence.sizeBytes)} - {evidence.mimeType}</p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <a
                            href={evidence.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir evidencia"
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                        >
                            <ExternalLink size={15} />
                        </a>
                        <button
                            type="button"
                            onClick={() => onRemove(evidence)}
                            disabled={!canRemove}
                            title="Remover evidencia"
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

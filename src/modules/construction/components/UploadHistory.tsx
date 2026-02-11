import React, { useState, useEffect } from 'react';
import { constructionService } from '../services/firestore';
import { UploadMetadata, ConstructionRecord } from '../types';
import { History, FileText, Calendar, Package, ChevronRight, X, Loader2, Trash2 } from 'lucide-react';
import DataTable from './DataTable';

interface UploadHistoryProps {
    workId?: string;
}

export const UploadHistory: React.FC<UploadHistoryProps> = ({ workId = 'OBRA-01' }) => {
    const [uploads, setUploads] = useState<UploadMetadata[]>([]);
    const [selectedUpload, setSelectedUpload] = useState<any | null>(null);
    const [showRecords, setShowRecords] = useState(false);
    const [records, setRecords] = useState<ConstructionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingRecords, setIsLoadingRecords] = useState(false);

    useEffect(() => {
        loadUploads();
    }, [workId]);

    const loadUploads = async () => {
        try {
            setIsLoading(true);
            const data = await constructionService.getUploads(workId);
            setUploads(data);
        } catch (error) {
            console.error('Error loading uploads:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectUpload = async (upload: UploadMetadata) => {
        try {
            const detail = await constructionService.getUpload(upload.id);
            setSelectedUpload(detail);
            setShowRecords(false);
            setRecords([]);
        } catch (error) {
            console.error('Error loading upload detail:', error);
        }
    };

    const handleViewRecords = async () => {
        if (!selectedUpload) return;

        try {
            setIsLoadingRecords(true);
            // Fallback: query records by cycleKey and workId
            const cycleRecords = await constructionService.getRecords(
                selectedUpload.cycleKey,
                selectedUpload.workId
            );
            setRecords(cycleRecords);
            setShowRecords(true);
        } catch (error) {
            console.error('Error loading records:', error);
        } finally {
            setIsLoadingRecords(false);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center gap-3">
                <History className="w-6 h-6 text-amber-500" />
                <h2 className="text-2xl font-bold">Histórico de RDOs</h2>
            </div>

            {uploads.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-12 text-center">
                    <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhum upload encontrado</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {uploads.map((upload) => (
                        <div
                            key={upload.id}
                            className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition-all group relative"
                        >
                            <div className="flex items-center justify-between" onClick={() => handleSelectUpload(upload)}>
                                <div className="flex-1 cursor-pointer">
                                    <div className="flex items-center gap-3 mb-2">
                                        <FileText className="w-5 h-5 text-amber-500" />
                                        <h3 className="font-semibold text-lg">{upload.fileName}</h3>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Calendar className="w-4 h-4" />
                                            <span>Ciclo: {upload.cycleKey}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Package className="w-4 h-4" />
                                            <span>{upload.recordCount} registros</span>
                                        </div>
                                        <div className="text-slate-500">
                                            {formatDate(upload.uploadedAt)}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
                            </div>

                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Tem certeza que deseja apagar TODOS os dados do ciclo ${upload.cycleKey}? Isso não pode ser desfeito.`)) {
                                        try {
                                            setIsLoading(true);
                                            await constructionService.deleteCycleData(upload.cycleKey, workId);
                                            await loadUploads(); // Refresh list
                                        } catch (error) {
                                            alert("Erro ao apagar dados.");
                                        } finally {
                                            setIsLoading(false);
                                        }
                                    }
                                }}
                                className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                title="Apagar dados deste ciclo (Cuidado!)"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Detalhes */}
            {selectedUpload && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold">{selectedUpload.fileName}</h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Enviado em {formatDate(selectedUpload.uploadedAt)}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedUpload(null);
                                    setShowRecords(false);
                                    setRecords([]);
                                }}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 flex-1 overflow-y-auto">
                            {!showRecords ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-lg">
                                            <p className="text-sm text-slate-600 mb-1">Ciclo</p>
                                            <p className="font-semibold">{selectedUpload.cycleKey}</p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-lg">
                                            <p className="text-sm text-slate-600 mb-1">Obra</p>
                                            <p className="font-semibold">{selectedUpload.workId}</p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-lg">
                                            <p className="text-sm text-slate-600 mb-1">Total de Registros</p>
                                            <p className="font-semibold text-2xl text-amber-600">
                                                {selectedUpload.recordCount}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-lg">
                                            <p className="text-sm text-slate-600 mb-1">Data do Upload</p>
                                            <p className="font-semibold">
                                                {formatDate(selectedUpload.uploadedAt)}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleViewRecords}
                                        disabled={isLoadingRecords}
                                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isLoadingRecords ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Carregando...
                                            </>
                                        ) : (
                                            <>
                                                <FileText className="w-5 h-5" />
                                                Ver Registros Deste Upload
                                            </>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="mb-4 flex items-center justify-between">
                                        <h4 className="font-semibold text-lg">
                                            Registros ({records.length})
                                        </h4>
                                        <button
                                            onClick={() => setShowRecords(false)}
                                            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                                        >
                                            ← Voltar aos Detalhes
                                        </button>
                                    </div>
                                    <DataTable data={records} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

import React, { useState, useCallback } from 'react';
import { X, Upload, CheckCircle, XCircle, AlertCircle, Loader2, FileJson } from 'lucide-react';
import { ImportedData, ExtractedBM, ExtractedRDO, ContractTeam } from '../types';
import { isoToBrazilianDate } from '../utils/dateUtils';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onBatchImport: (files: ImportedData[]) => void;
    teams?: ContractTeam[];
}

interface FileStatus {
    file: File;
    status: 'pending' | 'validating' | 'valid' | 'invalid';
    data?: ImportedData;
    error?: string;
}

export const BatchImportModal: React.FC<Props> = ({ isOpen, onClose, onBatchImport, teams }) => {
    const [files, setFiles] = useState<FileStatus[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);

    // Auto-select first team
    React.useEffect(() => {
        if (teams && teams.length > 0 && !selectedTeamId) {
            setSelectedTeamId(teams[0].id);
        }
    }, [teams, selectedTeamId]);

    const validateAndParseFile = async (file: File): Promise<{ data?: ImportedData; error?: string }> => {
        try {
            const text = await file.text();
            const json = JSON.parse(text);

            let extractedData: ImportedData;

            if (json.itens) {
                // It's a BM
                extractedData = {
                    ...json,
                    type: 'BM'
                } as ExtractedBM;
            } else if (json.relatorio) {
                // It's an RDO
                extractedData = {
                    ...json,
                    type: 'RDO'
                } as ExtractedRDO;

                // Convert ISO date to Brazilian format
                if (extractedData.relatorio?.data) {
                    extractedData.relatorio.data = isoToBrazilianDate(extractedData.relatorio.data) || extractedData.relatorio.data;
                }
            } else {
                return { error: "Formato JSON inválido. Precisa ter 'itens' (BM) ou 'relatorio' (RDO)." };
            }

            return { data: extractedData };
        } catch (error: any) {
            return { error: error.message || 'Erro ao processar JSON' };
        }
    };

    const processFiles = async (fileList: FileList | File[]) => {
        const fileArray = Array.from(fileList);
        const jsonFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.json'));

        if (jsonFiles.length === 0) {
            toast.error('Nenhum arquivo JSON encontrado');
            return;
        }

        if (jsonFiles.length > 100) {
            toast.warning('Muitos arquivos! Recomendamos até 100 por vez.');
        }

        // Initialize file statuses
        const initialStatuses: FileStatus[] = jsonFiles.map(file => ({
            file,
            status: 'pending'
        }));

        setFiles(initialStatuses);

        // Process files in chunks of 10 to avoid blocking UI
        const chunkSize = 10;
        for (let i = 0; i < jsonFiles.length; i += chunkSize) {
            const chunk = jsonFiles.slice(i, i + chunkSize);

            await Promise.all(
                chunk.map(async (file, index) => {
                    const globalIndex = i + index;

                    // Update to validating
                    setFiles(prev => {
                        const updated = [...prev];
                        updated[globalIndex] = { ...updated[globalIndex], status: 'validating' };
                        return updated;
                    });

                    // Validate
                    const result = await validateAndParseFile(file);

                    // Update with result
                    setFiles(prev => {
                        const updated = [...prev];
                        updated[globalIndex] = {
                            ...updated[globalIndex],
                            status: result.data ? 'valid' : 'invalid',
                            data: result.data,
                            error: result.error
                        };
                        return updated;
                    });
                })
            );
        }

        toast.success(`${jsonFiles.length} arquivos processados!`);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleImport = () => {
        const validFiles = files.filter(f => f.status === 'valid' && f.data);

        if (validFiles.length === 0) {
            toast.error('Nenhum arquivo válido para importar');
            return;
        }

        // Check if RDOs need team selection
        const hasRDO = validFiles.some(f => f.data?.type === 'RDO');
        if (hasRDO && teams && teams.length > 0 && !selectedTeamId) {
            toast.error('Selecione uma equipe para os RDOs');
            return;
        }

        // Add team ID to RDOs
        const dataToImport = validFiles.map(f => ({
            ...f.data!,
            teamId: f.data!.type === 'RDO' ? selectedTeamId : undefined,
            sourceFile: f.file.name
        }));

        onBatchImport(dataToImport);
        toast.success(`${validFiles.length} arquivo(s) importado(s) com sucesso!`);

        // Reset and close
        setFiles([]);
        onClose();
    };

    const stats = {
        total: files.length,
        valid: files.filter(f => f.status === 'valid').length,
        invalid: files.filter(f => f.status === 'invalid').length,
        pending: files.filter(f => f.status === 'pending' || f.status === 'validating').length
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col">

                {/* HEADER */}
                <div className="flex justify-between items-center p-6 border-b shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Upload className="text-blue-600" />
                            Importação em Lote
                        </h2>
                        <p className="text-sm text-slate-500">
                            Carregue múltiplos arquivos JSON de uma vez
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-hidden p-6 flex flex-col gap-4">

                    {/* TEAM SELECTION FOR RDOs */}
                    {teams && teams.length > 0 && (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <label className="block text-xs font-bold text-blue-700 uppercase mb-2">
                                Equipe para RDOs (Obrigatório)
                            </label>
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="w-full p-2 border border-blue-200 rounded-lg bg-white text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                {teams.map(team => (
                                    <option key={team.id} value={team.id}>{team.name} - {team.location}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* UPLOAD AREA */}
                    {files.length === 0 ? (
                        <label
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${isDragging
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'
                                }`}
                        >
                            <div className="p-6 bg-white rounded-full shadow-sm mb-4">
                                <FileJson size={48} className={isDragging ? 'text-blue-500' : 'text-slate-400'} />
                            </div>
                            <span className="text-lg font-semibold text-slate-700 mb-2">
                                {isDragging ? 'Solte os arquivos aqui' : 'Arraste arquivos JSON ou clique para selecionar'}
                            </span>
                            <span className="text-sm text-slate-500">
                                Suporta até 100 arquivos por vez
                            </span>
                            <input
                                type="file"
                                accept=".json"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </label>
                    ) : (
                        <>
                            {/* STATISTICS */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-slate-100 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-slate-700">{stats.total}</div>
                                    <div className="text-xs text-slate-500 uppercase">Total</div>
                                </div>
                                <div className="bg-green-100 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-green-700">{stats.valid}</div>
                                    <div className="text-xs text-green-600 uppercase">Válidos</div>
                                </div>
                                <div className="bg-red-100 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-red-700">{stats.invalid}</div>
                                    <div className="text-xs text-red-600 uppercase">Inválidos</div>
                                </div>
                                <div className="bg-blue-100 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-blue-700">{stats.pending}</div>
                                    <div className="text-xs text-blue-600 uppercase">Processando</div>
                                </div>
                            </div>

                            {/* FILE LIST */}
                            <div className="flex-1 overflow-y-auto bg-slate-50 rounded-xl border border-slate-200">
                                <div className="p-4 space-y-2">
                                    {files.map((fileStatus, index) => (
                                        <div
                                            key={index}
                                            className={`p-3 rounded-lg border-2 transition-all ${fileStatus.status === 'valid'
                                                    ? 'bg-green-50 border-green-200'
                                                    : fileStatus.status === 'invalid'
                                                        ? 'bg-red-50 border-red-200'
                                                        : fileStatus.status === 'validating'
                                                            ? 'bg-blue-50 border-blue-200'
                                                            : 'bg-white border-slate-200'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    {fileStatus.status === 'valid' && <CheckCircle size={20} className="text-green-600 shrink-0" />}
                                                    {fileStatus.status === 'invalid' && <XCircle size={20} className="text-red-600 shrink-0" />}
                                                    {fileStatus.status === 'validating' && <Loader2 size={20} className="text-blue-600 animate-spin shrink-0" />}
                                                    {fileStatus.status === 'pending' && <AlertCircle size={20} className="text-slate-400 shrink-0" />}

                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-slate-700 truncate" title={fileStatus.file.name}>
                                                            {fileStatus.file.name}
                                                        </div>
                                                        {fileStatus.data && (
                                                            <div className="text-xs text-slate-500">
                                                                {fileStatus.data.type === 'RDO'
                                                                    ? `RDO - ${fileStatus.data.relatorio?.data || 'Sem data'}`
                                                                    : `BM - ${fileStatus.data.itens?.length || 0} itens`
                                                                }
                                                            </div>
                                                        )}
                                                        {fileStatus.error && (
                                                            <div className="text-xs text-red-600 mt-1">
                                                                {fileStatus.error}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-slate-400 ml-2">
                                                    {(fileStatus.file.size / 1024).toFixed(1)} KB
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ADD MORE BUTTON */}
                            <label className="px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg text-center text-slate-600 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors">
                                + Adicionar mais arquivos
                                <input
                                    type="file"
                                    accept=".json"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            processFiles(e.target.files);
                                        }
                                    }}
                                />
                            </label>
                        </>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-6 border-t bg-slate-50 flex justify-between items-center shrink-0">
                    <button
                        onClick={() => {
                            setFiles([]);
                            onClose();
                        }}
                        className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium"
                    >
                        Cancelar
                    </button>

                    {files.length > 0 && (
                        <button
                            onClick={handleImport}
                            disabled={stats.valid === 0 || stats.pending > 0}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center gap-2 shadow-sm transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CheckCircle size={18} />
                            Importar {stats.valid} arquivo{stats.valid !== 1 ? 's' : ''} válido{stats.valid !== 1 ? 's' : ''}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

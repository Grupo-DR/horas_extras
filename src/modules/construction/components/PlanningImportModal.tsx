import React, { useState, useCallback, useRef } from 'react';
import { PlanningAssignment, ServicePrice } from '../types';
import { parsePlanningExcel, PlanningParseResult } from '../utils/excelPlanningParser';
import {
    Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle2,
    ChevronRight, ChevronLeft, Loader2, Info, RefreshCw, GitMerge
} from 'lucide-react';

interface PlanningImportModalProps {
    onClose: () => void;
    onImport: (assignments: PlanningAssignment[], mode: 'replace' | 'merge') => Promise<void>;
    servicePrices: ServicePrice[];
    cycleYear: number; // Year of the current planning cycle
    cycleName: string; // Display name like "Fevereiro 2026"
}

type Step = 'upload' | 'preview' | 'confirm';
type ImportMode = 'replace' | 'merge';

const PlanningImportModal: React.FC<PlanningImportModalProps> = ({
    onClose, onImport, servicePrices, cycleYear, cycleName
}) => {
    const [step, setStep] = useState<Step>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [parseResult, setParseResult] = useState<PlanningParseResult | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<ImportMode>('replace');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (file: File) => {
        setError(null);
        const validExtensions = ['.xlsx', '.xls'];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!validExtensions.includes(ext)) {
            setError('Formato inválido. Use arquivos .xlsx ou .xls.');
            return;
        }

        setSelectedFile(file);
        setIsProcessing(true);
        try {
            const result = await parsePlanningExcel(file, cycleYear, servicePrices);
            setParseResult(result);
            setStep('preview');
        } catch (err) {
            setError(`Erro ao processar o arquivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
        } finally {
            setIsProcessing(false);
        }
    }, [cycleYear, servicePrices]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    const handleConfirmImport = async () => {
        if (!parseResult || parseResult.assignments.length === 0) return;
        setIsSaving(true);
        try {
            await onImport(parseResult.assignments, importMode);
            onClose();
        } catch (err) {
            setError(`Erro ao salvar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
            setIsSaving(false);
        }
    };

    // Group assignments by date for preview
    const previewByDate = parseResult
        ? Array.from(
            parseResult.assignments.reduce((map, a) => {
                const existing = map.get(a.date) ?? [];
                map.set(a.date, [...existing, a]);
                return map;
            }, new Map<string, PlanningAssignment[]>())
        ).sort(([a], [b]) => a.localeCompare(b))
        : [];

    const stepIndex = { upload: 0, preview: 1, confirm: 2 };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 p-3 rounded-2xl text-white">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Importar Planejamento via Excel</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase">Ciclo: {cycleName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2">
                    {(['upload', 'preview', 'confirm'] as Step[]).map((s, idx) => (
                        <React.Fragment key={s}>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all
                ${step === s ? 'bg-indigo-600 text-white' : stepIndex[step] > idx ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                {stepIndex[step] > idx ? <CheckCircle2 className="w-3 h-3" /> : <span>{idx + 1}</span>}
                                {s === 'upload' ? 'Upload' : s === 'preview' ? 'Preview' : 'Confirmar'}
                            </div>
                            {idx < 2 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                        </React.Fragment>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">

                    {/* STEP 1: UPLOAD */}
                    {step === 'upload' && (
                        <div className="p-8 flex flex-col items-center gap-6">
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`w-full border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all
                  ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
                            >
                                {isProcessing ? (
                                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                                ) : (
                                    <Upload className={`w-12 h-12 ${isDragging ? 'text-indigo-500' : 'text-slate-300'}`} />
                                )}
                                <div className="text-center">
                                    <p className="font-black text-slate-700 text-sm">
                                        {isProcessing ? 'Processando...' : 'Arraste o arquivo aqui ou clique para selecionar'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">Aceita .xlsx · .xls</p>
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileInput}
                                className="hidden"
                            />
                            {error && (
                                <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700 font-semibold">{error}</p>
                                </div>
                            )}

                            {/* Format guide */}
                            <div className="w-full bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <Info className="w-4 h-4 text-indigo-500" />
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-600">Estrutura esperada do arquivo</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[10px] font-bold">
                                        <thead>
                                            <tr className="text-slate-400 uppercase tracking-widest border-b border-slate-200">
                                                <th className="pb-2 pr-3 text-left">Col A</th>
                                                <th className="pb-2 pr-3 text-left">Col B</th>
                                                <th className="pb-2 pr-3 text-left">Col C</th>
                                                <th className="pb-2 pr-3 text-left">Col D</th>
                                                <th className="pb-2 pr-3 text-left">Col E</th>
                                                <th className="pb-2 pr-3 text-left">Col F</th>
                                                <th className="pb-2 text-left text-slate-300">Col G</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="text-slate-600 border-b border-slate-100">
                                                <td className="py-2 pr-3 text-indigo-600">Frota</td>
                                                <td className="py-2 pr-3">Tipo Equip.</td>
                                                <td className="py-2 pr-3 text-emerald-600">Qtd KM</td>
                                                <td className="py-2 pr-3 text-blue-600">Qtd HP</td>
                                                <td className="py-2 pr-3 text-amber-600">Qtd HI</td>
                                                <td className="py-2 pr-3 text-indigo-600">Data</td>
                                                <td className="py-2 text-slate-300">Dia Sem.</td>
                                            </tr>
                                            <tr className="text-slate-500">
                                                <td className="py-1 pr-3">CB001</td>
                                                <td className="py-1 pr-3">Caminhão Basculante</td>
                                                <td className="py-1 pr-3">180</td>
                                                <td className="py-1 pr-3">8</td>
                                                <td className="py-1 pr-3">0</td>
                                                <td className="py-1 pr-3">21/02/2026</td>
                                                <td className="py-1 text-slate-300">Sáb</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: PREVIEW */}
                    {step === 'preview' && parseResult && (
                        <div className="p-6 space-y-4">
                            {/* Summary cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-indigo-50 rounded-2xl p-4 text-center">
                                    <div className="text-2xl font-black text-indigo-700">{parseResult.summary.totalRows}</div>
                                    <div className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mt-1">Linhas lidas</div>
                                </div>
                                <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                                    <div className="text-2xl font-black text-emerald-700">{parseResult.summary.totalAssignments}</div>
                                    <div className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mt-1">Lançamentos</div>
                                </div>
                                <div className={`rounded-2xl p-4 text-center ${parseResult.summary.skippedRows > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                                    <div className={`text-2xl font-black ${parseResult.summary.skippedRows > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                                        {parseResult.summary.skippedRows}
                                    </div>
                                    <div className={`text-[10px] font-black uppercase tracking-widest mt-1 ${parseResult.summary.skippedRows > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                                        Ignoradas
                                    </div>
                                </div>
                            </div>

                            {/* Warnings */}
                            {parseResult.warnings.length > 0 && (
                                <details className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                    <summary className="flex items-center gap-2 cursor-pointer">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                        <span className="text-xs font-black uppercase text-amber-700 tracking-widest">
                                            {parseResult.warnings.length} aviso(s) — clique para ver
                                        </span>
                                    </summary>
                                    <ul className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                                        {parseResult.warnings.map((w, i) => (
                                            <li key={i} className="text-[10px] text-amber-800 font-semibold pl-2 border-l-2 border-amber-300">{w}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}

                            {/* Assignments preview (grouped by date) */}
                            {parseResult.assignments.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 italic text-xs uppercase tracking-widest font-bold">
                                    Nenhum lançamento válido encontrado no arquivo.
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {previewByDate.map(([date, dayAssignments]) => (
                                        <div key={date} className="bg-slate-50 rounded-xl p-3">
                                            <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">
                                                {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {dayAssignments.map(a => (
                                                    <div key={a.id} className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-1 rounded-lg uppercase flex items-center gap-1">
                                                        {a.frota}
                                                        <span className="bg-indigo-200 text-indigo-600 px-1 rounded text-[9px]">{a.services.length}svc</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: CONFIRM */}
                    {step === 'confirm' && parseResult && (
                        <div className="p-8 space-y-6">
                            <p className="text-sm text-slate-600 font-semibold text-center">
                                Você está prestes a importar <span className="text-indigo-600 font-black">{parseResult.summary.totalAssignments} lançamentos</span> para o ciclo <span className="text-indigo-600 font-black">{cycleName}</span>.
                            </p>

                            {/* Mode selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setImportMode('replace')}
                                    className={`p-5 rounded-2xl border-2 text-left transition-all ${importMode === 'replace' ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <RefreshCw className={`w-5 h-5 ${importMode === 'replace' ? 'text-red-500' : 'text-slate-400'}`} />
                                        <span className={`font-black text-sm uppercase tracking-tight ${importMode === 'replace' ? 'text-red-700' : 'text-slate-600'}`}>Substituir</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-semibold">Apaga o planejamento atual do ciclo e substitui completamente pelo arquivo importado.</p>
                                </button>
                                <button
                                    onClick={() => setImportMode('merge')}
                                    className={`p-5 rounded-2xl border-2 text-left transition-all ${importMode === 'merge' ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <GitMerge className={`w-5 h-5 ${importMode === 'merge' ? 'text-indigo-500' : 'text-slate-400'}`} />
                                        <span className={`font-black text-sm uppercase tracking-tight ${importMode === 'merge' ? 'text-indigo-700' : 'text-slate-600'}`}>Mesclar</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-semibold">Adiciona os novos lançamentos ao planejamento existente, sem remover os já cadastrados.</p>
                                </button>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700 font-semibold">{error}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer with navigation */}
                <div className="p-6 bg-slate-900 text-white flex items-center justify-between gap-4">
                    {/* Back button */}
                    <button
                        onClick={() => {
                            if (step === 'preview') { setStep('upload'); setParseResult(null); setSelectedFile(null); }
                            else if (step === 'confirm') setStep('preview');
                            else onClose();
                        }}
                        className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {step === 'upload' ? 'Cancelar' : 'Voltar'}
                    </button>

                    {/* File info */}
                    {selectedFile && (
                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase truncate flex-1 text-center justify-center">
                            <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{selectedFile.name}</span>
                        </div>
                    )}

                    {/* Next / Confirm button */}
                    {step === 'preview' && (
                        <button
                            onClick={() => setStep('confirm')}
                            disabled={!parseResult || parseResult.assignments.length === 0}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-30"
                        >
                            Próximo <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                    {step === 'confirm' && (
                        <button
                            onClick={handleConfirmImport}
                            disabled={isSaving}
                            className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg
                ${importMode === 'replace' ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-900'}`}
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {isSaving ? 'Salvando...' : importMode === 'replace' ? 'Substituir e Importar' : 'Mesclar e Importar'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlanningImportModal;

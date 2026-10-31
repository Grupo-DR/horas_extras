import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, FileSpreadsheet, Loader2, Save, Upload, XCircle } from 'lucide-react';
import { UserProfile } from '../../types';
import { ClockinImportMeta, ClockinParseResult } from '../domain/clockinTypes';
import { saveClockinPunches } from '../services/clockinStore';
import type { ClockinWorkerResponse } from '../workers/clockinWorkerMessages';
import { formatInt, formatPunchDate } from './clockinFormat';

type Stage = 'idle' | 'reading' | 'normalizing' | 'parsed' | 'saving' | 'saved' | 'error';

const newImportId = (): string =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `imp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/** Lê o Excel numa Web Worker (o arquivo de um mês passa de 50 MB). */
const parseInWorker = (file: File, onStage: (stage: 'reading' | 'normalizing') => void): Promise<ClockinParseResult> =>
    new Promise((resolve, reject) => {
        const worker = new Worker(new URL('../workers/clockinParse.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<ClockinWorkerResponse>) => {
            const message = event.data;
            if (message.type === 'progress') onStage(message.stage);
            else {
                worker.terminate();
                if (message.type === 'done') resolve(message.result);
                else reject(new Error(message.message));
            }
        };
        worker.onerror = event => {
            worker.terminate();
            reject(new Error(event.message || 'Falha ao ler o arquivo.'));
        };
        file.arrayBuffer().then(buffer => worker.postMessage({ buffer }, [buffer]), reject);
    });

interface Props {
    user: UserProfile;
    canSave: boolean;
    /** Mostra o resultado na tela sem gravar (pré-visualização). */
    onPreview: (result: ClockinParseResult, fileName: string) => void;
    onSaved: (meta: ClockinImportMeta) => void;
}

const ClockinImport: React.FC<Props> = ({ user, canSave, onPreview, onSaved }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [stage, setStage] = useState<Stage>('idle');
    const [fileName, setFileName] = useState('');
    const [result, setResult] = useState<ClockinParseResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);
    const [savedInfo, setSavedInfo] = useState<{ newPunches: number } | null>(null);

    const handleFile = async (file: File) => {
        setFileName(file.name);
        setResult(null);
        setError(null);
        setSavedInfo(null);
        setStage('reading');
        try {
            const parsed = await parseInWorker(file, setStage);
            setResult(parsed);
            if (parsed.punches.length === 0) {
                setError(parsed.issues[0]?.message || 'Nenhuma batida encontrada no arquivo.');
                setStage('error');
                return;
            }
            setStage('parsed');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Falha ao ler o arquivo.');
            setStage('error');
        }
    };

    const handleSave = async () => {
        if (!result || !result.periodStart || !result.periodEnd) return;
        const meta: ClockinImportMeta = {
            importId: newImportId(),
            fileName,
            uploadedAt: new Date().toISOString(),
            uploadedBy: user.email,
            periodStart: result.periodStart,
            periodEnd: result.periodEnd,
            punchCount: result.punches.length
        };
        setStage('saving');
        setSaveProgress({ done: 0, total: 1 });
        try {
            const info = await saveClockinPunches(result.punches, meta, user, setSaveProgress);
            setSavedInfo(info);
            setStage('saved');
            onSaved(meta);
        } catch (e) {
            console.error('Falha ao salvar auditoria de ponto', e);
            setError(e instanceof Error ? e.message : 'Falha ao salvar no portal.');
            setStage('error');
        }
    };

    const busy = stage === 'reading' || stage === 'normalizing' || stage === 'saving';

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div>
                <h3 className="text-base font-bold text-[#1e3a8a] flex items-center gap-2">
                    <FileSpreadsheet size={18} className="text-blue-500" />
                    Importar marcações do Carol Clock In
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                    Exporte a aba "Marcações" na Carol e envie o .xlsx. O arquivo é lido no seu navegador; o hash biométrico do rosto é descartado.
                    Reimportar um período já enviado não duplica batidas.
                </p>
            </div>

            <div
                onClick={() => !busy && inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file && !busy) void handleFile(file);
                }}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${busy ? 'border-gray-200 bg-gray-50 cursor-wait' : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer'}`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) void handleFile(file);
                        e.target.value = '';
                    }}
                />
                {busy ? (
                    <div className="flex flex-col items-center gap-2 text-blue-700">
                        <Loader2 size={28} className="animate-spin" />
                        <span className="text-sm font-semibold">
                            {stage === 'reading' && 'Lendo a planilha...'}
                            {stage === 'normalizing' && 'Normalizando batidas...'}
                            {stage === 'saving' && `Salvando no portal... ${saveProgress ? `${saveProgress.done}/${saveProgress.total} dias` : ''}`}
                        </span>
                        <span className="text-xs text-gray-500">{fileName}</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                        <Upload size={28} className="text-blue-500" />
                        <span className="text-sm font-semibold text-gray-700">Clique ou arraste o arquivo carol_clockin.xlsx</span>
                    </div>
                )}
            </div>

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
                    <XCircle size={18} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {result && result.punches.length > 0 && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            ['Linhas lidas', formatInt(result.totalRows)],
                            ['Batidas válidas', formatInt(result.punches.length)],
                            ['Duplicadas removidas', formatInt(result.duplicates)],
                            ['Linhas com erro', formatInt(result.issues.length)],
                            ['Período', `${formatPunchDate(result.periodStart!)} a ${formatPunchDate(result.periodEnd!)}`]
                        ].map(([label, value]) => (
                            <div key={label} className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                                <div className="text-[10px] text-gray-500 font-bold uppercase">{label}</div>
                                <div className="text-sm font-bold text-gray-900 mt-1">{value}</div>
                            </div>
                        ))}
                    </div>

                    {result.issues.length > 0 && (
                        <details className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                            <summary className="cursor-pointer font-semibold flex items-center gap-2">
                                <AlertTriangle size={14} /> {result.issues.length} linha(s) ignorada(s)
                            </summary>
                            <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                                {result.issues.slice(0, 200).map((issue, i) => (
                                    <li key={i}>{issue.row ? `Linha ${issue.row}: ` : ''}{issue.message}</li>
                                ))}
                            </ul>
                        </details>
                    )}

                    {stage === 'saved' && savedInfo && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
                            <CheckCircle2 size={18} />
                            Salvo no portal: {formatInt(savedInfo.newPunches)} batida(s) nova(s) de {formatInt(result.punches.length)}.
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => onPreview(result, fileName)}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-bold disabled:opacity-50"
                        >
                            <Eye size={16} /> Ver auditoria deste arquivo
                        </button>
                        {canSave && stage !== 'saved' && (
                            <button
                                onClick={() => void handleSave()}
                                disabled={busy}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a8a] hover:bg-blue-900 text-white text-sm font-bold disabled:opacity-50"
                            >
                                <Save size={16} /> Salvar no portal
                            </button>
                        )}
                    </div>
                    {!canSave && (
                        <p className="text-xs text-gray-500">Só administradores do Capital Humano com escopo total podem salvar a importação.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClockinImport;

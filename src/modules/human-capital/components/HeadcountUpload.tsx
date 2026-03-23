import React, { useState, useCallback, useRef } from 'react';
import {
    UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
    Info, Loader2, RotateCcw, ClipboardCheck, ChevronDown, ChevronUp, X
} from 'lucide-react';
import {
    HeadcountUploadStatus,
    HeadcountUploadResult,
    HeadcountValidationError,
    UserProfile,
} from '../types';
import { parseHeadcountXlsx } from '../utils/headcount';
import { runFullValidation } from '../utils/headcountValidator';
import { saveHeadcount } from '../services/planning';

// ─── Props ────────────────────────────────────────────────────────────────────

interface HeadcountUploadProps {
    user: UserProfile;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateUploadId = (): string => {
    // crypto.randomUUID() está disponível em todos os browsers modernos
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback simples
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const formatDate = (iso?: string): string => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const StatCard: React.FC<{
    label: string;
    value: string | number;
    color?: 'slate' | 'emerald' | 'rose' | 'amber' | 'blue';
    icon?: React.ReactNode;
}> = ({ label, value, color = 'slate', icon }) => {
    const colors = {
        slate: 'bg-slate-50 text-slate-700 border-slate-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        rose: 'bg-rose-50 text-rose-700 border-rose-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
    };

    return (
        <div className={`rounded-xl border p-4 flex flex-col gap-1 ${colors[color]}`}>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider opacity-70">
                {icon}
                {label}
            </div>
            <span className="text-2xl font-bold font-mono">{value}</span>
        </div>
    );
};

const ErrorAccordion: React.FC<{
    title: string;
    errors: HeadcountValidationError[];
    defaultOpen?: boolean;
    variant: 'structural' | 'business';
}> = ({ title, errors, defaultOpen = false, variant }) => {
    const [open, setOpen] = useState(defaultOpen);
    if (errors.length === 0) return null;

    const bg = variant === 'business' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50';
    const headerColor = variant === 'business' ? 'text-rose-700' : 'text-amber-700';
    const badge = variant === 'business'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-amber-100 text-amber-700';
    const rowHover = variant === 'business' ? 'hover:bg-rose-100/40' : 'hover:bg-amber-100/40';

    return (
        <div className={`rounded-xl border overflow-hidden ${bg}`}>
            <button
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold ${headerColor}`}
            >
                <div className="flex items-center gap-2">
                    {variant === 'business' ? <XCircle size={16} /> : <AlertTriangle size={16} />}
                    {title}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge}`}>
                        {errors.length}
                    </span>
                </div>
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {open && (
                <div className="max-h-64 overflow-y-auto divide-y divide-current/10 text-xs">
                    {errors.map((err, i) => (
                        <div
                            key={i}
                            className={`px-4 py-2.5 flex items-start gap-3 ${rowHover} transition-colors`}
                        >
                            <span className="shrink-0 font-mono text-[10px] opacity-50 mt-0.5">
                                {err.row ? `L${err.row}` : err.chapa ? `#${err.chapa}` : '—'}
                            </span>
                            <span className="text-slate-700">{err.message}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Componente Principal ─────────────────────────────────────────────────────

const HeadcountUpload: React.FC<HeadcountUploadProps> = ({ user }) => {
    const [status, setStatus] = useState<HeadcountUploadStatus>('idle');
    const [result, setResult] = useState<HeadcountUploadResult | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // ── Processamento ─────────────────────────────────────────────────────────

    const processFile = useCallback(async (file: File) => {
        if (!file.name.match(/\.(xlsx?|csv)$/i)) {
            setSaveError('Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV.');
            setStatus('idle');
            return;
        }

        setFileName(file.name);
        setSaveError(null);
        setResult(null);
        setStatus('parsing');

        try {
            const parsed = await parseHeadcountXlsx(file);
            setStatus('validating');
            // defer um tick para deixar o React atualizar o status na tela
            await new Promise(r => setTimeout(r, 30));
            const validationResult = runFullValidation(parsed);
            setResult(validationResult);
            setStatus('ready');
        } catch (e) {
            console.error('Erro ao processar arquivo de headcount:', e);
            setSaveError(`Erro ao processar o arquivo: ${e instanceof Error ? e.message : String(e)}`);
            setStatus('error');
        }
    }, []);

    // ── Event Handlers ────────────────────────────────────────────────────────

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        // Limpa o input para permitir re-upload do mesmo arquivo
        e.target.value = '';
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, [processFile]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOver(true);
    };

    const handleDragLeave = () => setIsDraggingOver(false);

    const handleReset = () => {
        setStatus('idle');
        setResult(null);
        setFileName(null);
        setSaveError(null);
    };

    const handleConfirm = async () => {
        if (!result || !result.isBusinessValid || result.validRecords.length === 0) return;
        setStatus('saving');
        setSaveError(null);
        const meta = {
            uploadId: generateUploadId(),
            uploadedAt: new Date().toISOString(),
            uploadedBy: user.email,
            recordCount: result.validRecords.length,
        };
        try {
            await saveHeadcount(result.validRecords, meta, user);
            setStatus('saved');
        } catch (e) {
            console.error('Falha ao salvar headcount:', e);
            setSaveError(`Erro ao salvar: ${e instanceof Error ? e.message : String(e)}`);
            setStatus('ready');
        }
    };

    // ── Render: Drop Zone ─────────────────────────────────────────────────────

    const isProcessing = status === 'parsing' || status === 'validating' || status === 'saving';

    if (status === 'idle' || status === 'error') {
        return (
            <div className="space-y-4">
                {/* Cabeçalho */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                    <Info size={18} className="shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="font-semibold">Importação de Headcount por Centro de Custo</p>
                        <p className="text-blue-600 text-xs">
                            Faça upload de uma planilha Excel com as colunas:{' '}
                            <span className="font-mono font-bold">data_inicio · data_fim · chapa · centro_custo · distribuicao</span>
                        </p>
                        <p className="text-blue-600 text-xs">
                            A distribuição deve ser decimal (0.5, 0.33, 1) e a soma por colaborador + dia deve ser igual a 1.
                        </p>
                    </div>
                </div>

                {saveError && (
                    <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                        <XCircle size={16} className="shrink-0 mt-0.5" />
                        {saveError}
                    </div>
                )}

                {/* Drop Zone */}
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => inputRef.current?.click()}
                    className={`
                        border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
                        flex flex-col items-center gap-4 group
                        ${isDraggingOver
                            ? 'border-blue-400 bg-blue-50/80 scale-[1.01]'
                            : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/40'
                        }
                    `}
                >
                    <div className={`
                        p-5 rounded-2xl transition-colors
                        ${isDraggingOver ? 'bg-blue-100' : 'bg-slate-100 group-hover:bg-blue-100'}
                    `}>
                        <UploadCloud
                            size={36}
                            className={`transition-colors ${isDraggingOver ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-500'}`}
                        />
                    </div>
                    <div>
                        <p className="text-base font-semibold text-slate-700">
                            {isDraggingOver ? 'Solte o arquivo aqui' : 'Arraste e solte o arquivo'}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                            ou <span className="text-blue-600 font-medium">clique para selecionar</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-2">Formatos suportados: .xlsx, .xls, .csv</p>
                    </div>
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>
        );
    }

    // ── Render: Processando ───────────────────────────────────────────────────

    if (isProcessing) {
        const labels = {
            parsing: 'Lendo arquivo Excel...',
            validating: 'Executando validações...',
            saving: 'Salvando no Firestore...',
        };
        return (
            <div className="flex flex-col items-center justify-center gap-5 py-16 text-slate-500">
                <div className="relative">
                    <FileSpreadsheet size={48} className="text-slate-300" />
                    <Loader2 size={22} className="absolute -bottom-1 -right-1 text-blue-500 animate-spin" />
                </div>
                <div className="text-center">
                    <p className="font-semibold text-slate-700">{labels[status as keyof typeof labels]}</p>
                    {fileName && <p className="text-xs text-slate-400 mt-1">{fileName}</p>}
                </div>
            </div>
        );
    }

    // ── Render: Salvo com sucesso ─────────────────────────────────────────────

    if (status === 'saved') {
        return (
            <div className="flex flex-col items-center gap-5 py-16 text-center">
                <div className="p-5 rounded-full bg-emerald-100">
                    <CheckCircle2 size={42} className="text-emerald-600" />
                </div>
                <div>
                    <p className="text-lg font-bold text-slate-800">Headcount importado com sucesso!</p>
                    <p className="text-sm text-slate-500 mt-1">
                        {result?.validRecords.length} registro(s) salvo(s) no Firestore.
                    </p>
                </div>
                <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                    <RotateCcw size={15} />
                    Novo Upload
                </button>
            </div>
        );
    }

    // ── Render: Preview do Resultado ──────────────────────────────────────────

    if (status === 'ready' && result) {
        const totalErrors = result.structuralErrors.length + result.businessErrors.length;
        const canImport = result.isBusinessValid && result.validRecords.length > 0;
        const hasStructuralInvalid = result.invalidRecords.length > 0 || result.structuralErrors.length > 0;

        return (
            <div className="space-y-5">
                {/* Cabeçalho do arquivo */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet size={18} className="text-slate-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 truncate">{fileName}</span>
                    </div>
                    <button
                        onClick={handleReset}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 shrink-0"
                        title="Cancelar e fazer novo upload"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Cards de métricas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                        label="Total de linhas"
                        value={result.totalRows}
                        color="slate"
                        icon={<FileSpreadsheet size={12} />}
                    />
                    <StatCard
                        label="Linhas válidas"
                        value={result.validRecords.length}
                        color={result.validRecords.length > 0 ? 'emerald' : 'rose'}
                        icon={<CheckCircle2 size={12} />}
                    />
                    <StatCard
                        label="Chapas únicas"
                        value={result.uniqueChapas}
                        color="blue"
                        icon={<ClipboardCheck size={12} />}
                    />
                    <StatCard
                        label="Erros encontrados"
                        value={totalErrors}
                        color={totalErrors === 0 ? 'emerald' : result.businessErrors.length > 0 ? 'rose' : 'amber'}
                        icon={<AlertTriangle size={12} />}
                    />
                </div>

                {/* Período coberto */}
                {result.periodStart && result.periodEnd && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                        <Info size={13} className="text-slate-400 shrink-0" />
                        <span>
                            Período coberto pelos registros válidos:{' '}
                            <span className="font-semibold text-slate-700 font-mono">
                                {formatDate(result.periodStart)} → {formatDate(result.periodEnd)}
                            </span>
                        </span>
                    </div>
                )}

                {/* Status geral */}
                {canImport && (
                    <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
                        <CheckCircle2 size={16} className="shrink-0" />
                        <span>
                            <span className="font-semibold">Validação aprovada!</span>{' '}
                            {hasStructuralInvalid
                                ? `${result.invalidRecords.length} linha(s) com erro estrutural serão ignoradas. Os ${result.validRecords.length} registros válidos podem ser importados.`
                                : `Todos os ${result.validRecords.length} registros estão aptos para importação.`
                            }
                        </span>
                    </div>
                )}

                {!canImport && result.businessErrors.length > 0 && (
                    <div className="flex items-start gap-2 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                        <XCircle size={16} className="shrink-0 mt-0.5" />
                        <span>
                            <span className="font-semibold">Importação bloqueada por erros de negócio.</span>{' '}
                            Corrija as distribuições indicadas abaixo e faça o upload novamente.
                        </span>
                    </div>
                )}

                {!canImport && result.validRecords.length === 0 && result.businessErrors.length === 0 && (
                    <div className="flex items-start gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span>
                            <span className="font-semibold">Nenhum registro válido encontrado.</span>{' '}
                            Verifique o formato e as colunas da planilha.
                        </span>
                    </div>
                )}

                {/* Acordeões de erro */}
                <div className="space-y-3">
                    <ErrorAccordion
                        title="Erros de Negócio (distribuição ≠ 1)"
                        errors={result.businessErrors}
                        defaultOpen={result.businessErrors.length > 0}
                        variant="business"
                    />
                    <ErrorAccordion
                        title="Erros Estruturais (formato / campos)"
                        errors={result.structuralErrors}
                        defaultOpen={result.businessErrors.length === 0 && result.structuralErrors.length > 0}
                        variant="structural"
                    />
                </div>

                {saveError && (
                    <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                        <XCircle size={16} className="shrink-0 mt-0.5" />
                        {saveError}
                    </div>
                )}

                {/* Ações */}
                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        <RotateCcw size={14} />
                        Novo Upload
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!canImport}
                        className={`
                            flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                            ${canImport
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200 hover:shadow-lg'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }
                        `}
                    >
                        <ClipboardCheck size={15} />
                        Importar {result.validRecords.length} registro(s)
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

export default HeadcountUpload;

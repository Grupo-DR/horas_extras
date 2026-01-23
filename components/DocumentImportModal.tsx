
import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, AlertTriangle, ArrowRight, Save, Database, Eye } from 'lucide-react';
import { LocalBMParser, ExtractedData } from '../services/LocalBMParser';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onImport: (data: any) => void;
}

export const DocumentImportModal: React.FC<Props> = ({ isOpen, onClose, onImport }) => {
    const [step, setStep] = useState<'UPLOAD' | 'REVIEW'>('UPLOAD');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ExtractedData | null>(null);

    // Form State (Editable)
    const [formData, setFormData] = useState<any>({});

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setLoading(true);

            try {
                const result = await LocalBMParser.parsePDF(selectedFile);
                setData(result);
                setFormData(result.fields); // Initialize form with extracted fields
                setStep('REVIEW');
            } catch (error) {
                console.error(error);
                toast.error("Erro ao ler PDF. Verifique se é um arquivo válido.");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSave = () => {
        onImport({
            ...formData,
            // Keep specific metadata useful for the system
            sourceFile: file?.name,
            documentType: data?.type
        });
        onClose();
        // Reset state
        setStep('UPLOAD');
        setFile(null);
        setData(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className={`bg-white rounded-2xl shadow-2xl w-full transition-all duration-300 ${step === 'REVIEW' ? 'max-w-6xl h-[85vh]' : 'max-w-md'
                } flex flex-col`}>

                {/* HEADER */}
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            {step === 'UPLOAD' ? <Upload className="text-blue-600" /> : <Eye className="text-purple-600" />}
                            {step === 'UPLOAD' ? 'Importar Documento' : 'Validar Leitura (Human-in-the-Loop)'}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {step === 'UPLOAD' ? 'Carregue um PDF de Medição ou RDO.' : 'Compare o texto extraído com os dados detectados e corrija se necessário.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-hidden p-0 relative">
                    {step === 'UPLOAD' ? (
                        <div className="p-8 flex flex-col items-center justify-center h-full space-y-6">
                            <label className="w-full h-48 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group">
                                {loading ? (
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                                ) : (
                                    <>
                                        <div className="p-4 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                            <FileText size={32} className="text-slate-400 group-hover:text-blue-500" />
                                        </div>
                                        <span className="text-slate-600 font-medium">Clique para selecionar o PDF</span>
                                        <span className="text-slate-400 text-xs mt-1">Medições ou RDOs (PDF)</span>
                                    </>
                                )}
                                <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} disabled={loading} />
                            </label>

                            <div className="flex gap-4 text-xs text-slate-400">
                                <span className="flex items-center gap-1"><Database size={12} /> Processamento 100% Local</span>
                                <span className="flex items-center gap-1"><CheckCircle size={12} /> Gratuito</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full">
                            {/* --- LEFT: RAW TEXT PREVIEW --- */}
                            <div className="w-1/2 border-r bg-slate-50 flex flex-col">
                                <div className="p-3 bg-slate-100 border-b text-xs font-bold text-slate-500 uppercase tracking-wide flex justify-between">
                                    <span>Texto Extraído (Leitura Bruta)</span>
                                    <span className="bg-slate-200 px-2 rounded text-slate-600">Confiança: {(data?.confidence || 0) * 100}%</span>
                                </div>
                                <textarea
                                    className="flex-1 w-full p-4 font-mono text-xs text-slate-600 bg-transparent resize-none focus:outline-none"
                                    value={data?.rawText}
                                    readOnly
                                />
                            </div>

                            {/* --- RIGHT: FORM EDITOR --- */}
                            <div className="w-1/2 flex flex-col bg-white">
                                <div className="p-3 bg-white border-b text-xs font-bold text-slate-500 uppercase tracking-wide border-l-4 border-l-purple-500">
                                    Dados Detectados (Editável)
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* TYPE DETECTION */}
                                    <div className="mb-4">
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tipo de Documento</label>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${data?.type === 'BM' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                {data?.type === 'BM' ? 'Boletim de Medição' : data?.type === 'RDO' ? 'Relatório Diário de Obra' : 'Desconhecido'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* DYNAMIC FORM BASED ON TYPE */}
                                    {data?.type === 'BM' ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Contrato / Pedido</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border border-slate-300 rounded bg-slate-50 focus:bg-white transition-colors"
                                                        value={formData.contractId || ''}
                                                        onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Entidade</label>
                                                    <select
                                                        className="w-full p-2 border border-slate-300 rounded"
                                                        value={formData.entityType || 'CONSTRUTORA'}
                                                        onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                                                    >
                                                        <option value="CONSTRUTORA">DR Construtora</option>
                                                        <option value="RENTAL">DR Rental</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Data Referência</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border border-slate-300 rounded"
                                                        placeholder="DD/MM/AAAA"
                                                        value={formData.date || ''}
                                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total (R$)</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border border-slate-300 rounded font-bold text-slate-800"
                                                        value={formData.value || ''}
                                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            {formData.possibleValues && Array.isArray(formData.possibleValues) && (
                                                <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-100">
                                                    <p className="text-xs font-bold text-yellow-700 mb-1">Outros valores encontrados:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {formData.possibleValues.slice(0, 5).map((v: string, i: number) => (
                                                            <button
                                                                key={i}
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, value: v })}
                                                                className="text-xs bg-white border border-yellow-200 px-2 py-1 rounded hover:bg-yellow-100"
                                                            >
                                                                {v}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Data do RDO</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border border-slate-300 rounded"
                                                        placeholder="DD/MM/AAAA"
                                                        value={formData.date || ''}
                                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Número RDO</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border border-slate-300 rounded"
                                                        value={formData.number || ''}
                                                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Obra / Local</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2 border border-slate-300 rounded"
                                                    value={formData.siteName || ''}
                                                    onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                </div>

                                {/* FOOTER ACTIONS */}
                                <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                                    <button
                                        onClick={() => setStep('UPLOAD')}
                                        className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center gap-2 shadow-sm transform active:scale-95 transition-all"
                                    >
                                        <CheckCircle size={18} />
                                        Confirmar e Importar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

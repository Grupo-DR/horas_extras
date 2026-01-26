import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, AlertTriangle, ArrowRight, Save, Database, Eye, ChevronRight, ChevronDown } from 'lucide-react';
import { LocalBMParser, ExtractedData } from '../services/LocalBMParser';
import { RemoteBMParser } from '../services/RemoteBMParser';
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

    // UI State
    const [expandedItems, setExpandedItems] = useState<boolean>(true);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setLoading(true);

            try {
                if (selectedFile.name.toLowerCase().endsWith('.json')) {
                    // Handle JSON Direct Upload
                    const text = await selectedFile.text();
                    const json = JSON.parse(text);

                    // Auto-detect type from JSON content if possible
                    const type = json.type || (json.filename?.includes('RDO') ? 'RDO' : 'BM');

                    const extractedData: ExtractedData = {
                        type: type as any,
                        rawText: "Importado via JSON",
                        confidence: 1.0,
                        fields: {
                            ...json,
                            // Ensure mapping if the JSON structure varies slightly
                            // But assuming the user uploads the EXACT JSON their script generates, which matches what we designed in Python backend
                        }
                    };

                    // For BM, ensure audit matrix is mapped if keys differ
                    if (extractedData.type === 'BM' && json.itens && !extractedData.fields.auditMatrix) {
                        extractedData.fields.auditMatrix = json.itens;
                    }
                    // For RDO, ensure fields map
                    if (extractedData.type === 'RDO' && !extractedData.fields.rdoDetails) {
                        extractedData.fields.rdoDetails = json; // Store full object as details
                    }

                    setData(extractedData);
                    setFormData(extractedData.fields);
                    setStep('REVIEW');
                } else {
                    // Try Remote Parsing First (Python Backend)
                    const result = await RemoteBMParser.parsePDF(selectedFile);
                    setData(result);
                    setFormData(result.fields);
                    setStep('REVIEW');
                }
            } catch (error) {
                console.error(error);
                toast.error("Erro ao processar arquivo. Se for PDF, verifique o backend. Se for JSON, verifique a formatação.");
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

    const updateItemValue = (index: number, field: string, value: string) => {
        const newItems = [...(formData.auditMatrix || [])];
        // Handle numeric conversion
        const numVal = parseFloat(value.replace(/\./g, '').replace(',', '.')); // Input format specific? Or standard HTML number input?
        // Let's assume standard text input for currency editing or number input

        // If it's a direct property on the item
        newItems[index] = { ...newItems[index], [field]: numVal };
        setFormData({ ...formData, auditMatrix: newItems });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className={`bg-white rounded-2xl shadow-2xl w-full transition-all duration-300 ${step === 'REVIEW' ? 'max-w-[95vw] h-[90vh]' : 'max-w-md'
                } flex flex-col`}>

                {/* HEADER */}
                <div className="flex justify-between items-center p-6 border-b shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            {step === 'UPLOAD' ? <Upload className="text-blue-600" /> : <Eye className="text-purple-600" />}
                            {step === 'UPLOAD' ? 'Importar Documento' : 'Validar Leitura (Human-in-the-Loop)'}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {step === 'UPLOAD' ? 'Carregue um PDF de Medição ou RDO.' : 'Compare o JSON gerado com os dados editáveis.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-hidden p-0 relative flex flex-col">
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
                                        <span className="text-slate-600 font-medium">Clique para selecionar</span>
                                        <span className="text-slate-400 text-xs mt-1">PDF (Medição/RDO) ou JSON</span>
                                    </>
                                )}
                                <input type="file" accept=".pdf,.json" className="hidden" onChange={handleFileChange} disabled={loading} />
                            </label>

                            <div className="flex gap-4 text-xs text-slate-400">
                                <span className="flex items-center gap-1"><Database size={12} /> JSON Direto</span>
                                <span className="flex items-center gap-1"><CheckCircle size={12} /> Processamento Instantâneo</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-1 overflow-hidden">
                            {/* --- LEFT: JSON PREVIEW (READ ONLY) --- */}
                            <div className="w-1/3 border-r bg-slate-900 text-slate-300 flex flex-col overflow-hidden">
                                <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs font-bold uppercase tracking-wide flex justify-between items-center shrink-0">
                                    <span className="flex items-center gap-2"><FileText size={14} /> JSON Gerado (Read-Only)</span>
                                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-400">{(data?.confidence || 0) * 100}% Confiança</span>
                                </div>
                                <div className="flex-1 overflow-auto p-4">
                                    <pre className="text-xs font-mono font-medium leading-relaxed">
                                        {JSON.stringify(data?.fields, null, 2)}
                                    </pre>
                                </div>
                            </div>

                            {/* --- RIGHT: FORM EDITOR (EDITABLE) --- */}
                            <div className="w-2/3 flex flex-col bg-slate-50 overflow-hidden">
                                <div className="p-3 bg-white border-b text-xs font-bold text-slate-500 uppercase tracking-wide border-l-4 border-l-purple-500 shrink-0 shadow-sm flex justify-between items-center">
                                    <span>Dados Editáveis para Importação</span>
                                    <span className="text-xs font-normal normal-case text-slate-400">Edite os valores abaixo se a leitura estiver incorreta</span>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                                    {/* HEADER CARD */}
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                        <div className="grid grid-cols-4 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tipo Identificado</label>
                                                <div className="font-bold text-blue-600">{data?.type}</div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Período</label>
                                                <input
                                                    type="text"
                                                    className="w-full text-sm font-semibold text-slate-700 border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent"
                                                    value={formData.period || ''}
                                                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Valor Medição (R$)</label>
                                                <input
                                                    type="number"
                                                    className="w-full text-lg font-bold text-green-600 border-b border-dashed border-slate-300 focus:border-green-500 focus:outline-none bg-transparent"
                                                    value={formData.value || 0}
                                                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Saldo Final</label>
                                                <div className="font-bold text-slate-400">Calculado Automaticamente</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* AUDIT MATRIX EDITOR */}
                                    {formData.auditMatrix && (
                                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                            <div
                                                className="p-4 bg-slate-50 border-b flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                                onClick={() => setExpandedItems(!expandedItems)}
                                            >
                                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                                    {expandedItems ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                    Itens da Medição ({formData.auditMatrix.length})
                                                </h3>
                                            </div>

                                            {expandedItems && (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                                            <tr>
                                                                <th className="px-4 py-3">Item</th>
                                                                <th className="px-4 py-3">Cód. VLI</th>
                                                                <th className="px-4 py-3 w-1/3">Descrição</th>
                                                                <th className="px-4 py-3 text-right">Qtd Mês</th>
                                                                <th className="px-4 py-3 text-right">Valor Unit.</th>
                                                                <th className="px-4 py-3 text-right">Valor Mês (R$)</th>
                                                                <th className="px-4 py-3 text-right">Saldo (R$)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {formData.auditMatrix.map((item: any, idx: number) => (
                                                                <tr key={idx} className="hover:bg-slate-50 group">
                                                                    <td className="px-4 py-2 font-medium text-slate-600">{item.item}</td>
                                                                    <td className="px-4 py-2 text-blue-600 font-mono text-xs">{item.codeVLI}</td>
                                                                    <td className="px-4 py-2 text-slate-600 max-w-xs truncate" title={item.description}>
                                                                        <input
                                                                            type="text"
                                                                            value={item.description}
                                                                            onChange={(e) => {
                                                                                const newItems = [...formData.auditMatrix];
                                                                                newItems[idx].description = e.target.value;
                                                                                setFormData({ ...formData, auditMatrix: newItems });
                                                                            }}
                                                                            className="w-full bg-transparent border-none focus:ring-0 text-slate-600 p-0 text-sm"
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right">
                                                                        <input
                                                                            type="number"
                                                                            value={item.qtyMonth}
                                                                            onChange={(e) => updateItemValue(idx, 'qtyMonth', e.target.value)}
                                                                            className="w-16 text-right bg-slate-50 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1 py-0.5"
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-slate-500">
                                                                        {item.unitPrice?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right font-bold text-slate-700">
                                                                        <input
                                                                            type="number"
                                                                            value={item.currentMonth}
                                                                            onChange={(e) => updateItemValue(idx, 'currentMonth', e.target.value)}
                                                                            className="w-24 text-right bg-slate-50 border border-transparent hover:border-slate-300 focus:border-green-500 rounded px-1 py-0.5 font-bold text-slate-700"
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-slate-400">
                                                                        {item.balance?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* RDO SECTIONS (Dynamic) */}
                                    {data?.type === 'RDO' && (
                                        <div className="space-y-4">
                                            {/* Similar logic for RDO tables if needed, for now just JSON on left covers it, 
                                                but we can add specific editable tables for 'mao_de_obra' etc later */}
                                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800 text-sm">
                                                Para RDOs, verifique os dados no JSON à esquerda. A edição tabular completa de RDO estará disponível em breve.
                                            </div>
                                        </div>
                                    )}

                                </div>

                                {/* FOOTER ACTIONS */}
                                <div className="p-6 border-t bg-slate-50 flex justify-end gap-3 shrink-0">
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

import React, { useState } from 'react';
import { Upload, Check, Loader2 } from 'lucide-react';
import { LocalBMParser } from '../services/LocalBMParser';
import { toast } from 'sonner';

interface MeasurementFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    contractName: string;
}

export const MeasurementForm: React.FC<MeasurementFormProps> = ({ isOpen, onClose, onSave, contractName }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        try {
            const data = await LocalBMParser.parsePDF(file);
            // Adapt data structure if needed, or just set it
            setPreviewData(data.fields); // LocalBMParser returns { fields: ... }
            toast.success("Dados extraídos com sucesso (Versão Local)!");
        } catch (error) {
            toast.error("Erro ao ler PDF. Tente novamente.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800">Nova Medição Automatizada</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {!previewData ? (
                        <div className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-4 transition-colors ${isProcessing ? 'border-blue-400 bg-blue-50' : 'border-slate-300'}`}>
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                                    <p className="text-blue-700 font-medium">IA analisando Matriz de Auditoria...</p>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-12 h-12 text-slate-400" />
                                    <div className="text-center">
                                        <p className="text-slate-700 font-bold text-lg">Arraste a Medição em PDF</p>
                                        <p className="text-slate-500 text-sm">Ou clique para selecionar o arquivo</p>
                                    </div>
                                    <input type="file" className="hidden" id="pdf-upload" accept=".pdf" onChange={handleFileUpload} />
                                    <label htmlFor="pdf-upload" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold cursor-pointer hover:bg-blue-700 transition-all">Selecionar PDF</label>
                                </>
                            )}
                        </div>
                    ) : (
                        /* REVIEW TABLE (Matriz de Auditoria) */
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div><p className="text-[10px] text-slate-500 uppercase font-bold">Tipo</p><p className="font-bold text-blue-700">{previewData?.entityType || '-'}</p></div>
                                <div><p className="text-[10px] text-slate-500 uppercase font-bold">Período</p><p className="font-bold">{previewData?.period || previewData?.date || '-'}</p></div>
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Valor Medição</p>
                                    <p className="font-bold text-emerald-600">
                                        {/* Robust number formatting */}
                                        {typeof previewData?.value === 'number'
                                            ? `R$ ${previewData.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                            : typeof previewData?.value === 'string'
                                                ? previewData.value
                                                : '-'}
                                    </p>
                                </div>
                                <div><p className="text-[10px] text-slate-500 uppercase font-bold">Saldo Restante</p><p className="font-bold">R$ 0,00</p></div>
                            </div>

                            {previewData?.auditMatrix && Array.isArray(previewData.auditMatrix) ? (
                                <div className="overflow-x-auto border rounded-xl">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 text-slate-600 uppercase">
                                            <tr>
                                                <th className="p-2">Cód. VLI</th>
                                                <th className="p-2">Descrição</th>
                                                <th className="p-2 text-right">Do Mês (R$)</th>
                                                <th className="p-2 text-right">Saldo (R$)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.auditMatrix.map((item: any, idx: number) => (
                                                <tr key={idx} className="border-b hover:bg-slate-50">
                                                    <td className="p-2 font-mono text-blue-600">{item.codeVLI}</td>
                                                    <td className="p-2 max-w-[200px] truncate">{item.description}</td>
                                                    <td className="p-2 text-right font-bold text-slate-700">R$ {(item.currentMonth || 0).toLocaleString()}</td>
                                                    <td className="p-2 text-right text-slate-500">R$ {(item.balance || 0).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-4 bg-yellow-50 text-yellow-700 text-sm rounded-lg border border-yellow-200">
                                    Não foi possível extrair a Matriz de Auditoria detalhada deste PDF.
                                    Verifique os valores totais acima.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 text-slate-600 font-bold">Cancelar</button>
                    <button
                        disabled={!previewData}
                        onClick={() => onSave(previewData)}
                        className="px-8 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Check size={18} /> Confirmar e Registrar
                    </button>
                </div>
            </div>
        </div>
    );
};

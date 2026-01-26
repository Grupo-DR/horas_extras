import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, AlertTriangle, ArrowRight, Save, Database, Eye, ChevronRight, ChevronDown } from 'lucide-react';
import { LocalBMParser } from '../services/LocalBMParser';

import { ImportedData, ExtractedBM, ExtractedRDO } from '../types';
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
    const [data, setData] = useState<ImportedData | null>(null);

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

                    // Check if it's BM or RDO based on keys
                    let extractedData: ImportedData;

                    if (json.itens) {
                        // It's likely a BM
                        extractedData = {
                            ...json,
                            type: 'BM' // Force tag if missing
                        } as ExtractedBM;
                    } else if (json.relatorio) {
                        // It's likely an RDO
                        extractedData = {
                            ...json,
                            type: 'RDO' // Force tag if missing
                        } as ExtractedRDO;
                    } else {
                        throw new Error("Formato JSON desconhecido. Precisa ter 'itens' (BM) ou 'relatorio' (RDO).");
                    }

                    setData(extractedData);
                    setFormData(extractedData); // Flattened state is just the object itself now
                    setStep('REVIEW');
                } else {
                    toast.error("Formato de arquivo não suportado. Por favor, carregue um arquivo .json.");
                }
            } catch (error) {
                console.error(error);
                toast.error("Erro ao processar arquivo. Verifique se é um JSON válido.");
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
        // Only applicable for BM Itens currently
        if (data?.type !== 'BM') return;

        const newItems = [...(formData.itens || [])];
        // Handle numeric conversion
        // Brazilian format to float
        const numVal = parseFloat(value.replace(/\./g, '').replace(',', '.'));

        newItems[index] = { ...newItems[index], [field]: numVal };
        setFormData({ ...formData, itens: newItems });
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
                                        <span className="text-slate-400 text-xs mt-1">JSON (Medição/RDO)</span>
                                    </>
                                )}
                                <input type="file" accept=".json" className="hidden" onChange={handleFileChange} disabled={loading} />
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
                                    <span className="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-400">100% Confiança</span>
                                </div>
                                <div className="flex-1 overflow-auto p-4">
                                    <pre className="text-xs font-mono font-medium leading-relaxed">
                                        {JSON.stringify(data, null, 2)}
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
                                                <div className="font-bold text-blue-600">{data?.type || (formData.itens ? 'BM' : 'RDO?')}</div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Período</label>
                                                <input
                                                    type="text"
                                                    className="w-full text-sm font-semibold text-slate-700 border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent"
                                                    value={formData.periodo || ''}
                                                    onChange={(e) => setFormData({ ...formData, periodo: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Valor Medição (R$)</label>
                                                <input
                                                    type="number"
                                                    className="w-full text-lg font-bold text-green-600 border-b border-dashed border-slate-300 focus:border-green-500 focus:outline-none bg-transparent"
                                                    value={formData.valor_medicao_cabecalho || 0}
                                                    onChange={(e) => setFormData({ ...formData, valor_medicao_cabecalho: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Contrato</label>
                                                <div className="font-bold text-slate-400">{formData.contrato}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* AUDIT MATRIX EDITOR (BM Only) */}
                                    {formData.itens && (
                                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                            <div
                                                className="p-4 bg-slate-50 border-b flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                                onClick={() => setExpandedItems(!expandedItems)}
                                            >
                                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                                    {expandedItems ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                    Itens da Medição ({formData.itens.length})
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
                                                            {formData.itens.map((item: any, idx: number) => (
                                                                <tr key={idx} className="hover:bg-slate-50 group">
                                                                    <td className="px-4 py-2 font-medium text-slate-600">{item.item}</td>
                                                                    <td className="px-4 py-2 text-blue-600 font-mono text-xs">{item.codigo}</td>
                                                                    <td className="px-4 py-2 text-slate-600 max-w-xs truncate" title={item.description}>
                                                                        <input
                                                                            type="text"
                                                                            value={item.description}
                                                                            onChange={(e) => {
                                                                                const newItems = [...formData.itens];
                                                                                newItems[idx].description = e.target.value;
                                                                                setFormData({ ...formData, itens: newItems });
                                                                            }}
                                                                            className="w-full bg-transparent border-none focus:ring-0 text-slate-600 p-0 text-sm"
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right">
                                                                        <input
                                                                            type="number"
                                                                            value={item.qtd_mes}
                                                                            onChange={(e) => updateItemValue(idx, 'qtd_mes', e.target.value)}
                                                                            className="w-16 text-right bg-slate-50 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1 py-0.5"
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-slate-500">
                                                                        {item.preco_unitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right font-bold text-slate-700">
                                                                        <input
                                                                            type="number"
                                                                            value={item.valor_mes}
                                                                            onChange={(e) => updateItemValue(idx, 'valor_mes', e.target.value)}
                                                                            className="w-24 text-right bg-slate-50 border border-transparent hover:border-slate-300 focus:border-green-500 rounded px-1 py-0.5 font-bold text-slate-700"
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-slate-400">
                                                                        {item.saldo?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                                        <div className="space-y-6">

                                            {/* 1. Header Info Override (Since the generic header might miss deep RDO fields) */}
                                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 border-b pb-2">Detalhes do Relatório</h4>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-slate-400 font-bold">RDO Nº</label>
                                                        <div className="font-bold text-slate-700">{formData.relatorio?.numero || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-slate-400 font-bold">Dia da Semana</label>
                                                        <div className="font-bold text-slate-700">{formData.relatorio?.dia_semana || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-slate-400 font-bold">Obra (Local)</label>
                                                        <div className="font-bold text-slate-700 truncate" title={formData.relatorio?.obra}>{formData.relatorio?.obra || '-'}</div>
                                                        {formData.relatorio?.local && <div className="text-[10px] text-slate-500 truncate" title={formData.relatorio.local}>{formData.relatorio.local}</div>}
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-slate-400 font-bold">Horário</label>
                                                        <div className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block">
                                                            {formData.horario_trabalho?.entrada_saida || '-'}
                                                            <span className="text-slate-400 mx-1">|</span>
                                                            {formData.horario_trabalho?.horas_trabalhadas || '-'}h
                                                        </div>
                                                    </div>

                                                    {/* Row 2: Contract Details */}
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-slate-400 font-bold">Contratante</label>
                                                        <div className="font-bold text-slate-700 truncate" title={formData.relatorio?.contratante}>{formData.relatorio?.contratante || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-slate-400 font-bold">Responsável</label>
                                                        <div className="font-bold text-slate-700 truncate" title={formData.relatorio?.responsavel}>{formData.relatorio?.responsavel || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-slate-400 font-bold">Prazo Contratual</label>
                                                        <div className="font-bold text-slate-700">{formData.relatorio?.prazo_contratual || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] uppercase text-slate-400 font-bold">A Vencer / Decorrido</label>
                                                        <div className="text-xs font-bold text-slate-700">
                                                            <span className="text-orange-600">{formData.relatorio?.prazo_a_vencer || '-'}</span>
                                                            <span className="text-slate-300 mx-1">/</span>
                                                            <span className="text-slate-500">{formData.relatorio?.prazo_decorrido || '-'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 2. Weather */}
                                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 border-b pb-2 flex items-center gap-2">
                                                    <span className="p-1 bg-sky-100 text-sky-600 rounded"><Database size={12} /></span>
                                                    Condições Climáticas
                                                </h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-sky-50 p-3 rounded-lg border border-sky-100">
                                                        <div className="text-xs font-bold text-sky-700 uppercase mb-1">Manhã</div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm font-medium text-slate-700">{formData.clima?.manha?.tempo || '-'}</span>
                                                            <span className="text-xs bg-white px-2 py-0.5 rounded text-slate-500 border">{formData.clima?.manha?.condicao || '-'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                                        <div className="text-xs font-bold text-orange-700 uppercase mb-1">Tarde</div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm font-medium text-slate-700">{formData.clima?.tarde?.tempo || '-'}</span>
                                                            <span className="text-xs bg-white px-2 py-0.5 rounded text-slate-500 border">{formData.clima?.tarde?.condicao || '-'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 3. Manpower (Labor) */}
                                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                <div
                                                    className="p-3 bg-slate-50 border-b flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                                    onClick={() => setExpandedItems(!expandedItems)}
                                                >
                                                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                        <ChevronDown size={16} className={`transform transition-transform ${expandedItems ? '' : '-rotate-90'}`} />
                                                        Mão de Obra
                                                        <span className="text-xs font-normal bg-slate-200 px-2 py-0.5 rounded text-slate-600">
                                                            {formData.mao_de_obra?.length || 0}
                                                        </span>
                                                    </h3>
                                                </div>
                                                {expandedItems && (
                                                    <div className="overflow-x-auto max-h-60 overflow-y-auto custom-scrollbar">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b sticky top-0">
                                                                <tr>
                                                                    <th className="px-4 py-2">Colaborador</th>
                                                                    <th className="px-4 py-2">Função</th>
                                                                    <th className="px-4 py-2 text-right">Horas</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {formData.mao_de_obra?.map((mo: any, idx: number) => (
                                                                    <tr key={idx} className="hover:bg-slate-50">
                                                                        <td className="px-4 py-2 font-medium text-slate-700">{mo.nome}</td>
                                                                        <td className="px-4 py-2 text-xs text-slate-500">{mo.funcao}</td>
                                                                        <td className="px-4 py-2 text-right font-mono text-slate-600">{mo.horas}</td>
                                                                    </tr>
                                                                )) || (
                                                                        <tr><td colSpan={3} className="p-4 text-center text-slate-400 italic">Nenhum registro found.</td></tr>
                                                                    )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 4. Equipment */}
                                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 border-b pb-2">Equipamentos</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {formData.equipamentos?.length > 0 ? (
                                                        formData.equipamentos.map((eq: string, idx: number) => (
                                                            <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200 font-medium">
                                                                {eq}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Nenhum equipamento listado.</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 5. Activities */}
                                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                                                    <h3 className="font-bold text-slate-700 text-sm">Atividades Executadas</h3>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                                            <tr>
                                                                <th className="px-4 py-2">Descrição</th>
                                                                <th className="px-4 py-2 w-20">Unid.</th>
                                                                <th className="px-4 py-2 w-32">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {formData.atividades?.map((act: any, idx: number) => (
                                                                <tr key={idx} className="hover:bg-slate-50">
                                                                    <td className="px-4 py-2 text-slate-700">{act.descricao}</td>
                                                                    <td className="px-4 py-2 text-xs text-slate-500">{act.unidade}</td>
                                                                    <td className="px-4 py-2">
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 uppercase">
                                                                            {act.status || 'EXEC'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            )) || (
                                                                    <tr><td colSpan={3} className="p-4 text-center text-slate-400 italic">Nenhuma atividade registrada.</td></tr>
                                                                )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* 6. Occurrences & Comments */}
                                            {(formData.ocorrencias?.length > 0 || formData.comentarios?.length > 0) && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {formData.ocorrencias?.length > 0 && (
                                                        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                                            <h4 className="text-xs font-bold text-red-700 uppercase mb-2 flex items-center gap-2">
                                                                <AlertTriangle size={12} /> Ocorrências
                                                            </h4>
                                                            <ul className="list-disc list-inside space-y-1 text-xs text-red-800">
                                                                {formData.ocorrencias.map((oc: string, i: number) => (
                                                                    <li key={i}>{oc}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {formData.comentarios?.length > 0 && (
                                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                            <h4 className="text-xs font-bold text-slate-600 uppercase mb-2">Comentários</h4>
                                                            <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
                                                                {formData.comentarios.map((c: string, i: number) => (
                                                                    <li key={i}>{c}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
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

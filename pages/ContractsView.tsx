import React, { useState } from 'react';
import { Upload, FileText, BarChart3, Calculator, Building, Calendar, DollarSign, ArrowRight } from 'lucide-react';
import { ExtractedBM } from '../types';
import { DocumentImportModal } from '../components/DocumentImportModal';
import { toast } from 'sonner';

export const ContractsView: React.FC = () => {
    const [importedData, setImportedData] = useState<ExtractedBM | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                setImportedData(json);
            } catch (error) {
                console.error("Erro ao ler JSON:", error);
                alert("Erro ao ler o arquivo JSON. Verifique o formato.");
            }
        };
        reader.readAsText(file);
    };

    const handleImportSuccess = (data: any) => {
        console.log("Imported Data:", data);
        if (data.type === 'RDO' || data.documentType === 'RDO' || data.relatorio) { // Robust check
            toast.success("RDO Visualizado com Sucesso!", {
                description: `Obra: ${data.relatorio?.obra || 'N/A'} - Data: ${data.relatorio?.data || 'N/A'}`
            });
            // We could also setImportedData(data) if we wanted to show it in the main view, 
            // but the main view is designed for BM currently. 
            // The Modal already showed the "Projected Data".
        }
        setIsImportModalOpen(false);
    };

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

    return (
        <div className="flex h-full flex-col bg-slate-50 overflow-hidden">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" />
                        Módulo de Contratos
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Visualização de Boletins e RDOs
                    </p>
                </div>

                {/* HEADER ACTIONS */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors shadow-sm"
                    >
                        <FileText size={18} />
                        Importar RDO
                    </button>

                    {!importedData && (
                        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer font-medium transition-colors shadow-sm active:translate-y-px">
                            <Upload size={18} />
                            Carregar BM (JSON)
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </label>
                    )}
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-auto p-8">
                {importedData ? (
                    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* CONTRACT SUMMARY CARD */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Building size={12} /> Contrato
                                </label>
                                <p className="text-lg font-bold text-slate-800">{importedData.contrato || 'N/A'}</p>
                                <p className="text-sm text-slate-500">{importedData.contratada}</p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Calendar size={12} /> Período
                                </label>
                                <p className="text-lg font-medium text-slate-800">{importedData.periodo}</p>
                                <p className="text-xs text-slate-400">Emissão: {importedData.data_emissao}</p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <DollarSign size={12} /> Valor Medido
                                </label>
                                <p className="text-2xl font-bold text-green-600">{formatCurrency(importedData.valor_medicao_cabecalho)}</p>
                            </div>

                            <div className="flex items-end justify-end">
                                <button
                                    onClick={() => setImportedData(null)}
                                    className="text-sm text-red-600 hover:text-red-800 font-medium underline"
                                >
                                    Remover / Carregar Outro
                                </button>
                            </div>
                        </div>

                        {/* ITEMS TABLE */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <Calculator size={18} className="text-slate-400" />
                                    Itens da Medição
                                </h3>
                                <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
                                    {importedData.itens?.length || 0} Itens
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                        <tr className="uppercase text-[10px] tracking-wider text-slate-400">
                                            <th colSpan={5} className="px-6 py-2 border-r border-slate-200">Básico</th>
                                            <th colSpan={4} className="px-6 py-2 text-center border-r border-slate-200 bg-blue-50/20">Quantidades</th>
                                            <th colSpan={5} className="px-6 py-2 text-center bg-green-50/20">Valores (R$)</th>
                                        </tr>
                                        <tr>
                                            <th className="px-4 py-3 min-w-[60px]">Item</th>
                                            <th className="px-4 py-3 min-w-[100px]">Código</th>
                                            <th className="px-4 py-3 min-w-[300px]">Descrição</th>
                                            <th className="px-4 py-3">Unid.</th>
                                            <th className="px-4 py-3 text-right">Preço Unit.</th>

                                            {/* Quantities */}
                                            <th className="px-4 py-3 text-right bg-blue-50/10 text-blue-700">Contrato</th>
                                            <th className="px-4 py-3 text-right bg-blue-50/10 text-slate-500">Anterior</th>
                                            <th className="px-4 py-3 text-right bg-blue-50/30 text-blue-700 font-bold border-l border-r border-blue-100">Mês</th>
                                            <th className="px-4 py-3 text-right bg-blue-50/10 text-slate-700">Acum.</th>

                                            {/* Values */}
                                            <th className="px-4 py-3 text-right bg-green-50/10 text-green-700">Contrato</th>
                                            <th className="px-4 py-3 text-right bg-green-50/10 text-slate-500">Anterior</th>
                                            <th className="px-4 py-3 text-right bg-green-50/30 text-green-700 font-bold border-l border-r border-green-100">Mês</th>
                                            <th className="px-4 py-3 text-right bg-green-50/10 text-slate-700">Acum.</th>
                                            <th className="px-4 py-3 text-right text-slate-500 font-bold">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {importedData.itens?.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-4 py-2 font-medium text-slate-600">{item.item}</td>
                                                <td className="px-4 py-2 font-mono text-xs text-slate-400">{item.codigo}</td>
                                                <td className="px-4 py-2 text-slate-700 max-w-xs truncate" title={item.descricao}>
                                                    {item.descricao}
                                                </td>
                                                <td className="px-4 py-2 text-slate-500 text-xs">{item.unidade}</td>
                                                <td className="px-4 py-2 text-right font-mono text-slate-600 border-r border-slate-100">{formatCurrency(item.preco_unitario)}</td>

                                                {/* Quantities */}
                                                <td className="px-4 py-2 text-right font-mono text-xs text-blue-900 bg-blue-50/10">{item.qtd_contrato}</td>
                                                <td className="px-4 py-2 text-right font-mono text-xs text-slate-400 bg-blue-50/10">{item.qtd_anterior}</td>
                                                <td className="px-4 py-2 text-right font-mono text-sm text-blue-700 font-bold bg-blue-50/30 border-l border-r border-blue-100">{item.qtd_mes}</td>
                                                <td className="px-4 py-2 text-right font-mono text-xs text-slate-600 bg-blue-50/10 border-r border-slate-100">{item.qtd_acumulado}</td>

                                                {/* Values */}
                                                <td className="px-4 py-2 text-right font-mono text-xs text-green-800 bg-green-50/10">{formatCurrency(item.valor_contrato)}</td>
                                                <td className="px-4 py-2 text-right font-mono text-xs text-slate-400 bg-green-50/10">{formatCurrency(item.valor_anterior)}</td>
                                                <td className="px-4 py-2 text-right font-mono text-sm text-green-700 font-bold bg-green-50/30 border-l border-r border-green-100">{formatCurrency(item.valor_mes)}</td>
                                                <td className="px-4 py-2 text-right font-mono text-xs text-slate-600 bg-green-50/10">{formatCurrency(item.valor_acumulado)}</td>
                                                <td className="px-4 py-2 text-right font-mono text-xs text-slate-400 font-bold border-l border-slate-100">{formatCurrency(item.saldo)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 font-bold text-slate-700 border-t border-slate-200">
                                        <tr>
                                            <td colSpan={6} className="px-6 py-3 text-right">Total Validado:</td>
                                            <td className="px-6 py-3 text-right text-green-700">{formatCurrency(importedData.total_extraido || importedData.valor_medicao_cabecalho)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                    </div>
                ) : (
                    /* EMPTY STATE */
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 pb-20 animate-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <Upload size={48} className="text-slate-300" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-600 mb-2">Nenhum Contrato Carregado</h2>
                        <p className="text-slate-400 max-w-sm text-center mb-8">
                            Faça o upload de um BM (JSON) para visualizar o contrato ou teste a importação de RDO.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setIsImportModalOpen(true)}
                                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 cursor-pointer font-bold shadow-sm transition-all flex items-center gap-2"
                            >
                                <FileText size={18} />
                                Testar Importação RDO
                            </button>

                            <label className="px-6 py-3 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-400 cursor-pointer font-bold shadow-sm transition-all flex items-center gap-2">
                                <Upload size={18} />
                                Selecionar Arquivo JSON
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>
                )}
            </div>

            <DocumentImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImportSuccess}
            />
        </div>
    );
};

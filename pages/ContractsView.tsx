import React, { useState } from 'react';
import { Upload, FileText, BarChart3, Calculator, Building, Calendar, DollarSign, ArrowRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NewContractModal } from '../components/NewContractModal';
import { ExtractedBM, Contract } from '../types';
import { DocumentImportModal } from '../components/DocumentImportModal';
import { toast } from 'sonner';
import { useContracts } from '../contexts/ContractsContext';

export const ContractsView: React.FC = () => {
    const navigate = useNavigate();
    const { contracts, addContract } = useContracts();
    const [importedData, setImportedData] = useState<ExtractedBM | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isNewContractModalOpen, setIsNewContractModalOpen] = useState(false);

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
        if (data.type === 'RDO' || data.documentType === 'RDO' || data.relatorio) {
            toast.success("RDO Importado com Sucesso!", {
                description: `Obra: ${data.relatorio?.obra || 'N/A'} - Data: ${data.relatorio?.data || 'N/A'}`
            });
        }
        setIsImportModalOpen(false);
    };

    const handleCreateContract = (contract: Contract) => {
        addContract(contract);
        setIsNewContractModalOpen(false);
        toast.success("Contrato cadastrado com sucesso!");
    };

    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // --- RENDER HELPERS ---

    const renderEmptyState = () => (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 pb-20 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <Building size={48} className="text-slate-300" />
            </div>
            <h2 className="text-xl font-bold text-slate-600 mb-2">Nenhum Contrato Ativo</h2>
            <p className="text-slate-400 max-w-sm text-center mb-8">
                Cadastre seu primeiro contrato comercial ou faça upload de um BM para começar.
            </p>
            <div className="flex gap-4">
                <button
                    onClick={() => setIsNewContractModalOpen(true)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer font-bold shadow-sm transition-all flex items-center gap-2"
                >
                    <Plus size={18} />
                    Cadastrar Contrato
                </button>
            </div>
        </div>
    );

    const calculateTimeProgress = (start: string, end: string) => {
        const startDate = new Date(start).getTime();
        const endDate = new Date(end).getTime();
        const today = new Date().getTime();

        if (today < startDate) return 0;
        if (today > endDate) return 100;

        const totalDuration = endDate - startDate;
        const elapsed = today - startDate;
        return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    };

    const calculateFinancialProgress = (contract: Contract) => {
        if (!contract.totalValue || contract.totalValue === 0) return 0;
        // Assuming measurements have a 'value' field and we sum them up. 
        // If measurements are undefined, it's 0.
        const totalMeasured = contract.measurements?.reduce((acc, m) => acc + m.value, 0) || 0;
        return Math.min(100, (totalMeasured / contract.totalValue) * 100);
    };

    const renderContractList = () => (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contracts.map(contract => {
                    const timeProgress = calculateTimeProgress(contract.startDate, contract.endDate);
                    const financialProgress = calculateFinancialProgress(contract);

                    return (
                        <div
                            key={contract.id}
                            onClick={() => navigate(`/contratos/${contract.id}`)}
                            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col justify-between h-full"
                        >
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-100 transition-opacity">
                                <ArrowRight size={20} className="text-blue-500" />
                            </div>

                            <div>
                                <div className="mb-4">
                                    <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded mb-2">
                                        {contract.contractNumber}
                                    </span>
                                    <h3 className="text-lg font-bold text-slate-800 truncate" title={contract.siteName}>
                                        {contract.siteName}
                                    </h3>
                                    <p className="text-sm text-slate-500 truncate">{contract.clientName}</p>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Building size={14} className="text-slate-400" />
                                        <span className="truncate">{contract.contractorName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Calendar size={14} className="text-slate-400" />
                                        <span>{new Date(contract.startDate).toLocaleDateString('pt-BR')} - {new Date(contract.endDate).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 space-y-4">
                                {/* Time Progress */}
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-500 font-medium">Prazo Decorrido</span>
                                        <span className="text-slate-700 font-bold">{timeProgress.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${timeProgress > 90 ? 'bg-red-500' : timeProgress > 75 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                            style={{ width: `${timeProgress}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Financial Progress */}
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-500 font-medium">Saldo Financeiro</span>
                                        <span className="text-slate-700 font-bold">{formatCurrency(contract.totalValue)}</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 rounded-full"
                                            style={{ width: `${financialProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 text-right">
                                        Medido: {formatCurrency((contract.measurements?.reduce((acc, m) => acc + m.value, 0) || 0))}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderImportedPreview = () => (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* CONTRACT SUMMARY CARD */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Building size={12} /> Contrato
                    </label>
                    <p className="text-lg font-bold text-slate-800">{importedData?.contrato || 'N/A'}</p>
                    <p className="text-sm text-slate-500">{importedData?.contratada}</p>
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Calendar size={12} /> Período
                    </label>
                    <p className="text-lg font-medium text-slate-800">{importedData?.periodo}</p>
                    <p className="text-xs text-slate-400">Emissão: {importedData?.data_emissao}</p>
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <DollarSign size={12} /> Valor Medido
                    </label>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(importedData!.valor_medicao_cabecalho)}</p>
                </div>

                <div className="flex items-end justify-end">
                    <button
                        onClick={() => setImportedData(null)}
                        className="text-sm text-red-600 hover:text-red-800 font-medium underline"
                    >
                        Fechar Visualização
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
                        {importedData?.itens?.length || 0} Itens
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
                            {importedData?.itens?.map((item, idx) => (
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
                                <td className="px-6 py-3 text-right text-green-700">{formatCurrency(importedData!.total_extraido || importedData!.valor_medicao_cabecalho)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

        </div>
    );

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
                        Gerencie seus contratos, medições e RDOs
                    </p>
                </div>

                {/* HEADER ACTIONS */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsNewContractModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Novo Contrato
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors shadow-sm"
                    >
                        <FileText size={18} />
                        Importar RDO
                    </button>
                    {!importedData && (
                        <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer font-medium transition-colors shadow-sm">
                            <Upload size={18} />
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
                {importedData ? renderImportedPreview() : (contracts.length > 0 ? renderContractList() : renderEmptyState())}
            </div>

            <DocumentImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImportSuccess}
            />

            <NewContractModal
                isOpen={isNewContractModalOpen}
                onClose={() => setIsNewContractModalOpen(false)}
                onSave={handleCreateContract}
            />
        </div>
    );
};

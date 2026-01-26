import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, DollarSign, Plus, Trash2, TrendingUp, FileText, AlertTriangle, Activity, BadgeCheck, Building2, Truck } from 'lucide-react';
import { Contract, ContractMeasurement } from '../types';
import { ContractService } from '../services/contractService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MeasurementForm } from './MeasurementForm';
import { ContractFinancialChart } from './ContractFinancialChart';
import { DocumentImportModal } from './DocumentImportModal';
import { ContractEventForm } from './ContractEventForm';

interface ContractAnalyticsProps {
    contract: Contract;
    history: ContractMeasurement[];
    onAddMeasurement: (contractId: string, measurement: any) => Promise<void>;
    onRemoveMeasurement: (contractId: string, measurementId: string) => Promise<void>;
    refreshHistory: () => void;
}

export const ContractAnalytics: React.FC<ContractAnalyticsProps> = ({
    contract,
    history,
    onAddMeasurement,
    onRemoveMeasurement,
    refreshHistory
}) => {
    const [isMeasurementFormOpen, setIsMeasurementFormOpen] = useState(false);
    const [isEventFormOpen, setIsEventFormOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importType, setImportType] = useState<'BM' | 'RDO'>('BM');
    const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);

    const handleImportSuccess = async (data: any) => {
        if (data.documentType === 'RDO') {
            toast.success("RDO Importado e Validado!", { description: `Data: ${data.date} - Obra: ${data.siteName}` });
        } else if (data.documentType === 'BM') {
            toast.success("Medição Importada");
        }
        setIsImportModalOpen(false);
    };

    // Derived States
    const activeMeasurement = useMemo(() => {
        if (!selectedMeasurementId) return history[0]; // Default to latest
        return history.find(m => m.id === selectedMeasurementId) || history[0];
    }, [history, selectedMeasurementId]);

    const activeAuditMatrix = activeMeasurement?.auditMatrix || [];

    // KPI Stats
    const totalValue = contract?.totalValue || 0;
    const executedValue = history.length > 0
        ? history.reduce((prev, current) => (prev.date > current.date) ? prev : current).contractTotalValue -
        history.reduce((prev, current) => (prev.date > current.date) ? prev : current).contractBalance
        : 0;

    // Fallback if measurement data is missing totalValue/Balance logic (Legacy support)
    // Actually, let's trust the latest measurement state if available.
    // Ideally we recalculate executedValue based on simple logic if needed:
    // const executedValue = history.reduce((acc, m) => acc + m.value, 0); // Risky if measurements are snapshots.
    // Stick to your previous robust logic from DetailsModal:
    const latestMeasurement = history.length > 0 ? history.reduce((prev, current) => (prev.date > current.date) ? prev : current) : null;
    const robustExecutedValue = latestMeasurement
        ? (latestMeasurement.contractTotalValue - latestMeasurement.contractBalance)
        : 0;

    const currentBalance = totalValue - robustExecutedValue;
    const progress = totalValue > 0 ? (robustExecutedValue / totalValue) * 100 : 0;

    const entityType = activeMeasurement?.entityType || 'CONSTRUTORA';
    const isRental = entityType === 'RENTAL';

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">

            {/* 1. HEADER DASHBOARD */}
            <div className="flex-none p-6 bg-white border-b border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 ${isRental ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                {isRental ? <Truck size={12} /> : <Building2 size={12} />}
                                {entityType}
                            </span>
                            <span className="text-slate-400 text-sm font-medium flex items-center gap-1">
                                <Calendar size={14} /> {format(new Date(contract.startDate), 'dd/MM/yyyy')} - {format(new Date(contract.endDate), 'dd/MM/yyyy')}
                            </span>
                        </div>
                        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{contract.name}</h2>
                        <p className="text-slate-500">{contract.siteName}</p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <button
                            onClick={() => setIsMeasurementFormOpen(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all transform hover:scale-105 active:scale-95"
                        >
                            <Plus size={18} /> Nova Medição
                        </button>
                        <button
                            onClick={() => { setImportType('RDO'); setIsImportModalOpen(true); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-600/20 transition-all transform hover:scale-105 active:scale-95"
                        >
                            <FileText size={18} /> Inserir RDO
                        </button>
                        <button
                            onClick={() => setIsEventFormOpen(true)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors flex items-center gap-2"
                            title="Adicionar Aditivo ou Reajuste"
                        >
                            <TrendingUp size={18} /> Aditivo
                        </button>
                    </div>
                </div>

                {/* KPIS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Total Value */}
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative overflow-hidden group hover:border-blue-200 transition-colors">
                        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <DollarSign size={40} className="text-slate-800" />
                        </div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Valor Contratual</p>
                        <p className="text-xl md:text-2xl font-bold text-slate-800 mt-1">
                            {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>

                    {/* Executed (Circular Progress) */}
                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center gap-4">
                        <div className="relative w-14 h-14 flex-none">
                            <svg className="w-full h-full" viewBox="0 0 36 36">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#d1fae5" strokeWidth="3" />
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray={`${progress}, 100`} className="animate-[spin_1s_ease-out_reverse]" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                                {progress.toFixed(0)}%
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Total Medido</p>
                            <p className="text-lg font-bold text-emerald-900 leading-tight">
                                {robustExecutedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    </div>

                    {/* Balance */}
                    <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl flex items-center gap-4">
                        <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">Saldo a Executar</p>
                            <p className="text-lg font-bold text-amber-900 leading-tight">
                                {currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    </div>

                    {/* Last Measurement Info */}
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Última Medição</p>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-700">{activeMeasurement?.period || '-'}</span>
                            <span className="text-sm font-mono text-slate-500">
                                {(activeMeasurement?.value || (activeMeasurement as any)?.measurementValue)?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}
                            </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 truncate">
                            {`Medição ${activeMeasurement?.period || ''}`}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. MAIN CONTENT (Scrollable) */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                {/* LEFT: Charts & Matrix (2/3) */}
                <div className="flex-1 overflow-y-auto p-6 md:pr-0 custom-scrollbar">

                    {/* CHART */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 min-h-[400px]">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Activity size={20} className="text-blue-600" />
                            Curva de Evolução Financeira
                        </h3>
                        <div className="h-[400px] w-full">
                            <ContractFinancialChart contract={contract} />
                        </div>
                    </div>

                    {/* AUDIT MATRIX */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Matriz de Auditoria de Escopo</h3>
                                    <p className="text-xs text-slate-500">
                                        Visualizando: <span className="font-bold text-slate-700">{activeMeasurement?.period || 'Sem dados'}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2 text-xs">
                                <span className="flex items-center gap-1 text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">
                                    <div className="w-2 h-2 rounded-full bg-slate-300"></div> No Prazo
                                </span>
                                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 font-bold">
                                    <AlertTriangle size={10} /> Escopo Excedido
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 border-b border-slate-200 w-24">Cód. VLI</th>
                                        <th className="p-4 border-b border-slate-200 min-w-[200px]">Descrição do Serviço</th>
                                        <th className="p-4 border-b border-slate-200 text-right text-slate-400">Acum. Ant.</th>
                                        <th className="p-4 border-b border-slate-200 text-right bg-blue-50/50 text-blue-700">No Mês</th>
                                        <th className="p-4 border-b border-slate-200 text-right">Total Acum.</th>
                                        <th className="p-4 border-b border-slate-200 text-right text-slate-400">Previsto</th>
                                        <th className="p-4 border-b border-slate-200 text-right">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-slate-100">
                                    {activeAuditMatrix.length > 0 ? (
                                        activeAuditMatrix.map((item, idx) => {
                                            const isOverBudget = item.totalAccumulated > item.plannedContract && item.plannedContract > 0;
                                            const rowClass = isOverBudget ? 'bg-amber-50' : 'hover:bg-slate-50';
                                            const textClass = isOverBudget ? 'text-amber-700 font-bold' : 'text-slate-600';

                                            return (
                                                <tr key={idx} className={`transition-colors ${rowClass}`}>
                                                    <td className="p-4 font-mono text-xs font-bold text-slate-500">{item.codeVLI || '-'}</td>
                                                    <td className="p-4 font-medium text-slate-800 max-w-sm truncate" title={item.description}>
                                                        {item.description}
                                                    </td>
                                                    <td className="p-4 text-right text-slate-400 font-mono text-xs">
                                                        {item.prevAccumulated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-4 text-right bg-blue-50/30 font-bold text-blue-700 font-mono">
                                                        {item.currentMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className={`p-4 text-right font-mono ${textClass}`}>
                                                        {item.totalAccumulated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        {isOverBudget && <AlertTriangle size={12} className="inline ml-1 text-amber-500" />}
                                                    </td>
                                                    <td className="p-4 text-right text-slate-400 font-mono text-xs">
                                                        {item.plannedContract.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-4 text-right font-bold text-slate-700 font-mono">
                                                        {item.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="p-10 text-center text-slate-400 italic bg-slate-50/30">
                                                <FileText size={32} className="mx-auto mb-2 opacity-20" />
                                                Nenhuma matriz de auditoria disponível para esta medição.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

                {/* RIGHT: History Sidebar (1/3) */}
                <div className="w-full md:w-80 bg-slate-50 border-l border-slate-200 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">

                    {/* EVENT HISTORY */}
                    <div className="mb-4">
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-3 flex items-center justify-between">
                            Eventos Contratuais
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{contract.events?.length || 0}</span>
                        </h3>
                        <div className="space-y-2">
                            {(contract.events || []).length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Nenhum aditivo ou reajuste.</p>
                            ) : (
                                [...contract.events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(event => (
                                    <div key={event.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm group hover:border-amber-300 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-bold text-amber-700 uppercase bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                                {event.type.replace('ADITIVO_', 'ADIT. ')}
                                            </span>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm("Remover este evento? O valor do contrato será recalculado.")) {
                                                        await ContractService.removeEvent(contract.id, event.id);
                                                        toast.success("Evento removido.");
                                                        refreshHistory();
                                                    }
                                                }}
                                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-500 font-medium">{format(new Date(event.date), 'dd/MM/yy')}</span>
                                            <span className={`font-mono font-bold ${event.valueDelta >= 0 ? 'text-slate-700' : 'text-red-500'}`}>
                                                {event.valueDelta !== 0 ? event.valueDelta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                            </span>
                                        </div>
                                        {event.termDeltaDays !== 0 && (
                                            <div className="text-[10px] text-blue-600 font-semibold mb-1">
                                                +{event.termDeltaDays} dias de prazo
                                            </div>
                                        )}
                                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight" title={event.description}>
                                            {event.description}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <hr className="border-slate-200" />

                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-2">Histórico de Medições</h3>

                    {history.length === 0 ? (
                        <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl">
                            <p className="text-slate-400 text-sm">Nenhuma medição registrada.</p>
                        </div>
                    ) : (
                        history.map((m) => (
                            <div
                                key={m.id}
                                className={`p-4 rounded-xl border transition-all cursor-pointer group ${(selectedMeasurementId === m.id || (!selectedMeasurementId && m.id === history[0].id))
                                    ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500'
                                    : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                                    }`}
                                onClick={() => setSelectedMeasurementId(m.id)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                        {m.period}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm('Excluir esta medição?')) {
                                                onRemoveMeasurement(contract.id, m.id);
                                            }
                                        }}
                                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <p className="font-bold text-slate-800 mb-1">
                                    {(m.value || (m as any).measurementValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <BadgeCheck size={10} className="text-blue-500" />
                                    {m.auditMatrix?.length || 0} Itens Auditados
                                </div>
                                {m.entityType && (
                                    <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase">
                                        {m.entityType}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Measurement Form Modal */}
            <MeasurementForm
                isOpen={isMeasurementFormOpen}
                onClose={() => setIsMeasurementFormOpen(false)}
                onSave={async (measurement) => {
                    await onAddMeasurement(contract.id, measurement);
                    toast.success("Medição salva com sucesso!");
                    setIsMeasurementFormOpen(false);
                    refreshHistory();
                }}
                contractName={contract.name}
            />

            <ContractEventForm
                isOpen={isEventFormOpen}
                onClose={() => setIsEventFormOpen(false)}
                onSave={async (event) => {
                    await ContractService.addEvent(contract.id, event);
                    toast.success("Evento registrado com sucesso!");
                    refreshHistory();
                }}
            />

            <DocumentImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImportSuccess}
            />
        </div>
    );
};

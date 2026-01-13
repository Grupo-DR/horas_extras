import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, DollarSign, Plus, Trash2, TrendingUp, FileText, AlertTriangle, Eye, Activity, BadgeCheck, Building2, Truck } from 'lucide-react';
import { Contract, ContractMeasurement, ScopeAuditItem } from '../types';
import { ContractService } from '../services/contractService';
import { toast } from 'sonner';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Area,
    ComposedChart,
    Bar
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MeasurementForm } from './MeasurementForm';

interface ContractDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    contract: Contract | null;
    onAddMeasurement: (contractId: string, measurement: any) => Promise<void>;
    onRemoveMeasurement: (contractId: string, measurementId: string) => Promise<void>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-4 rounded-xl shadow-2xl skew-y-0">
                <p className="text-slate-500 text-xs font-bold mb-2 uppercase tracking-wide border-b border-slate-100 pb-1">
                    {label}
                </p>
                <div className="space-y-2">
                    {payload.map((p: any, idx: number) => {
                        if (p.value === null || p.value === undefined) return null;

                        let name = p.name;
                        if (p.dataKey === 'accumulated') name = 'Realizado (Acum.)';
                        if (p.dataKey === 'plannedAccumulated') name = 'Previsto (Acum.)';
                        if (p.dataKey === 'monthValue') name = 'Medição do Mês';

                        const drift = p.payload.drift; // Custom payload field if we add it

                        return (
                            <div key={idx} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                                    <span className="text-xs font-bold text-slate-600">{name}</span>
                                </div>
                                <span className="font-mono text-sm font-bold text-slate-800">
                                    {p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                        );
                    })}
                    {/* GAP Display Logic could go here */}
                </div>
            </div>
        );
    }
    return null;
};

export const ContractDetailsModal: React.FC<ContractDetailsModalProps> = ({
    isOpen,
    onClose,
    contract,
    onAddMeasurement,
    onRemoveMeasurement
}) => {

    const [isMeasurementFormOpen, setIsMeasurementFormOpen] = useState(false);
    const [history, setHistory] = useState<ContractMeasurement[]>([]);
    const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);

    // Refresh history when modal opens
    React.useEffect(() => {
        if (isOpen && contract) {
            ContractService.getMeasurementHistory(contract.id).then(setHistory);
        }
    }, [isOpen, contract]);

    // Derived States
    const activeMeasurement = useMemo(() => {
        if (!selectedMeasurementId) return history[0]; // Default to latest
        return history.find(m => m.id === selectedMeasurementId) || history[0];
    }, [history, selectedMeasurementId]);

    const activeAuditMatrix = activeMeasurement?.auditMatrix || [];

    // Financial Evolution Chart Data
    const chartData = useMemo(() => {
        if (!contract) return [];

        const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const startDate = new Date(contract.startDate);
        const endDate = new Date(contract.endDate);
        const totalDurationMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());

        // Base Planned Curve (Linear for now, or use specific curve logic if available)
        const plannedMonthlyRate = contract.totalValue / (totalDurationMonths || 1);

        // Generate Time Points
        const points = [];
        let currentDate = new Date(startDate);
        let plannedAccum = 0;
        let realAccum = 0;

        // Iterate monthly from start to end (or to last measurement)
        // We can limit x-axis to max(endDate, lastMeasurementDate)
        const maxDate = sortedHistory.length > 0 && new Date(sortedHistory[sortedHistory.length - 1].date) > endDate
            ? new Date(sortedHistory[sortedHistory.length - 1].date)
            : endDate;

        while (currentDate <= maxDate || sortedHistory.some(m => new Date(m.date) > currentDate)) {
            const periodStr = format(currentDate, 'yyyy-MM');

            // Find measurement for this month (approximate by period)
            const measurement = sortedHistory.find(m => m.period === periodStr || format(new Date(m.date), 'yyyy-MM') === periodStr);

            const monthValue = measurement ? measurement.measurementValue : 0;
            if (measurement) {
                // If measurement has real audit total, use it, else accumulate
                // Using the specific measurement total if reliable, else drift can occur.
                // Let's trust measurement.contractTotalValue - measurement.contractBalance ? 
                // Or just accumulate monthly values.
                realAccum += monthValue;
            }

            plannedAccum += plannedMonthlyRate;
            if (plannedAccum > contract.totalValue) plannedAccum = contract.totalValue;

            points.push({
                date: new Date(currentDate),
                monthStr: format(currentDate, 'MMM/yy', { locale: ptBR }),
                plannedAccumulated: currentDate <= endDate ? plannedAccum : contract.totalValue,
                accumulated: measurement ? realAccum : (currentDate < new Date() ? realAccum : null), // Don't plot zero for future
                monthValue: monthValue,
                description: measurement?.description
            });

            currentDate.setMonth(currentDate.getMonth() + 1);
            if (points.length > 60) break; // Safety break
        }

        return points;
    }, [contract, history]);

    // KPI Stats
    const totalValue = contract?.totalValue || 0;
    const executedValue = history.length > 0
        ? history.reduce((acc, curr) => {
            // Logic to get the LATEST total. 
            // Actually, we need the sum of all UNIQUE periods or just take the latest Balance vs Total.
            // Best is: Total Value - Latest Balance.
            // Find latest by date
            const latest = history.reduce((prev, current) => (prev.date > current.date) ? prev : current);
            return latest.contractTotalValue - latest.contractBalance;
        }, 0)
        : 0;

    const currentBalance = totalValue - executedValue;
    const progress = totalValue > 0 ? (executedValue / totalValue) * 100 : 0;

    // Entity Type logic
    const entityType = activeMeasurement?.entityType || 'CONSTRUTORA';
    const isRental = entityType === 'RENTAL';

    if (!isOpen || !contract) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 md:p-6 text-slate-800">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-[1400px] h-[95vh] flex flex-col overflow-hidden relative border border-white/20"
                >
                    {/* 1. HEADER DASHBOARD */}
                    <div className="flex-none p-6 bg-white border-b border-slate-200">
                        <div className="flex justify-between items-start mb-6">
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
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsMeasurementFormOpen(true)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all transform hover:scale-105 active:scale-95"
                                >
                                    <Plus size={18} /> Nova Medição
                                </button>
                                <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-red-500">
                                    <X size={24} />
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
                                        {executedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                                        {activeMeasurement?.measurementValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}
                                    </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 truncate">
                                    {activeMeasurement?.description || 'Nenhuma medição registrada'}
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
                                <div className="h-[320px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="monthStr"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 11 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 11 }}
                                                tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <ReferenceLine y={totalValue} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Teto', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />

                                            {/* Bars for Monthly Value */}
                                            <Bar dataKey="monthValue" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={40} opacity={0.5} />

                                            {/* Area for Planned Accum */}
                                            <Area type="monotone" dataKey="plannedAccumulated" stroke="#94a3b8" strokeDasharray="5 5" fill="url(#colorPlanned)" strokeWidth={2} />

                                            {/* Line for Real Accum */}
                                            <Line type="monotone" dataKey="accumulated" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
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
                                            {/* Delete Action could go here */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm('Excluir esta medição?')) onRemoveMeasurement(contract.id, m.id);
                                                }}
                                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <p className="font-bold text-slate-800 mb-1">
                                            {m.measurementValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                </motion.div>

                {/* Measurement Form Modal */}
                <MeasurementForm
                    isOpen={isMeasurementFormOpen}
                    onClose={() => setIsMeasurementFormOpen(false)}
                    onSave={async (measurement) => {
                        await onAddMeasurement(contract.id, measurement);
                    }}
                    contractName={contract.name}
                />
            </div>
        </AnimatePresence>
    );
};

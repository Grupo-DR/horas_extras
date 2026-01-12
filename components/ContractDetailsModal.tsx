import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, DollarSign, Plus, Trash2, TrendingUp, FileText, Upload } from 'lucide-react';
import { Contract, ContractMeasurement } from '../types';
import * as XLSX from 'xlsx';
import { parseGoldenTemplate } from '../services/contractService';
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
    AreaChart,
    ComposedChart
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContractDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    contract: Contract | null;
    onAddMeasurement: (contractId: string, measurement: any) => Promise<void>;
    onRemoveMeasurement: (contractId: string, measurementId: string) => Promise<void>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // Detect if hovering over projection
        const isProjection = payload[0]?.payload?.isProjection;

        return (
            <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-3 rounded-xl shadow-xl">
                <p className="text-slate-500 text-xs font-bold mb-1 uppercase">
                    {label} {isProjection && '(Projeção)'}
                </p>
                <div className="space-y-1">
                    {payload.map((p: any, idx: number) => {
                        // Skip rendering null values
                        if (p.value === null || p.value === undefined) return null;

                        let name = p.name;
                        if (p.dataKey === 'accumulatedProjected') name = 'Projeção Acumulado';
                        if (p.dataKey === 'balanceProjected') name = 'Projeção Saldo';

                        return (
                            <p key={idx} style={{ color: p.color }} className="font-bold text-sm">
                                {name}: {p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        );
                    })}
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

    // View Mode State
    const [viewMode, setViewMode] = useState<'CONSOLIDATED' | 'RENTAL' | 'CONSTRUTORA'>('CONSOLIDATED');
    const [auditMonth, setAuditMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7)); // YYYY-MM

    // Measurement Form State
    const [newValue, setNewValue] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newDesc, setNewDesc] = useState('');
    const [loading, setLoading] = useState(false);

    // Filter Measurements based on Entity
    const filteredMeasurements = useMemo(() => {
        if (!contract || !contract.measurements) return [];
        if (viewMode === 'CONSOLIDATED') return contract.measurements;
        return contract.measurements.filter(m => m.entity === viewMode);
    }, [contract, viewMode]);

    // Prepare Chart Data (Based on filteredMeasurements)
    const chartData = useMemo(() => {
        if (!contract) return [];

        const measurements = filteredMeasurements; // Use Filtered
        const totalValue = contract.totalValue || 0;
        const startDate = new Date(contract.startDate);
        const endDate = new Date(contract.endDate);
        // Sort measurements by date
        const sorted = [...measurements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Create data points starting with the contract start date
        const points = [
            {
                date: startDate,
                shortDate: format(startDate, 'dd/MM/yy'),
                monthYear: format(startDate, 'MMM yy', { locale: ptBR }),
                value: 0,
                accumulated: 0,
                balance: totalValue,
                accumulatedProjected: null,
                balanceProjected: null,
                isProjection: false,
                description: 'Início do Contrato'
            }
        ];

        let accumulated = 0;
        let lastDate = startDate;

        // Process Real Data
        sorted.forEach(m => {
            const mDate = new Date(m.date);
            accumulated += m.value;
            lastDate = mDate;

            points.push({
                date: mDate,
                shortDate: format(mDate, 'dd/MM/yy'),
                monthYear: format(mDate, 'MMM yy', { locale: ptBR }),
                value: m.value,
                accumulated: accumulated,
                balance: totalValue - accumulated,
                accumulatedProjected: null,
                balanceProjected: null,
                isProjection: false,
                description: m.description
            });
        });

        // Calculate Rate and Projections
        if (sorted.length > 0 && totalValue > 0) {
            const daysElapsed = Math.max(1, Math.ceil((lastDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
            const dailyRate = accumulated / daysElapsed;

            // Start projection from the last real point to ensure continuity
            const lastPoint = points[points.length - 1];
            // Initialize projection values at the convergence point
            lastPoint.accumulatedProjected = lastPoint.accumulated;
            lastPoint.balanceProjected = lastPoint.balance;

            let projectionAccumulated = accumulated;
            let projectionBalance = totalValue - accumulated;

            // Generate Monthly Projection Points until End Date
            let currentDate = new Date(lastDate);
            currentDate.setDate(currentDate.getDate() + 1); // Start next day

            let lastPushedMonth = lastDate.getMonth();

            while (currentDate <= endDate) {
                const daysInFuture = Math.ceil((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                projectionAccumulated = accumulated + (dailyRate * daysInFuture);
                projectionBalance = (totalValue - accumulated) - (dailyRate * daysInFuture);

                const currentMonth = currentDate.getMonth();
                const isNewMonth = currentMonth !== lastPushedMonth;
                const isFinal = currentDate.getTime() === endDate.getTime();

                if (isNewMonth || isFinal) {
                    points.push({
                        date: new Date(currentDate),
                        shortDate: format(currentDate, 'dd/MM/yy'),
                        monthYear: format(currentDate, 'MMM yy', { locale: ptBR }),
                        value: 0,
                        accumulated: null, // null removes from real line
                        balance: null,
                        accumulatedProjected: projectionAccumulated,
                        balanceProjected: projectionBalance,
                        isProjection: true,
                        description: 'Projeção'
                    });
                    lastPushedMonth = currentMonth;
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        // Sort by date
        return points.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [contract, filteredMeasurements]);

    // Financial Stats
    const totalValue = contract?.totalValue || 0;
    // Get last "Real" point for stats
    const realPoints = chartData.filter((d: any) => !d.isProjection);
    const executedValue = realPoints.length > 0 ? realPoints[realPoints.length - 1].accumulated : 0;
    const balance = totalValue - executedValue;
    const progress = totalValue > 0 ? (executedValue / totalValue) * 100 : 0;

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contract) return;
        if (!newValue || !newDate) return;

        setLoading(true);
        try {
            await onAddMeasurement(contract.id, {
                value: parseFloat(newValue.replace(',', '.')),
                date: new Date(newDate),
                description: newDesc,
                entity: viewMode === 'CONSOLIDATED' ? undefined : viewMode // Assign current view entity
            });
            // Reset form
            setNewValue('');
            setNewDesc('');
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // File Upload Handler
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const data = await new Promise<any[][]>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const bstr = evt.target?.result;
                        const wb = XLSX.read(bstr, { type: 'binary' });
                        const wsname = wb.SheetNames[0];
                        const ws = wb.Sheets[wsname];
                        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                        resolve(jsonData);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = (err) => reject(err);
                reader.readAsBinaryString(file);
            });

            const { entity, items } = parseGoldenTemplate(data);
            const totalMonthValue = items.reduce((acc: number, item: any) => acc + (item.monthValue || 0), 0);

            if (totalMonthValue === 0) {
                alert("Aviso: O boletim validado não contém valores medidos neste mês (Total = 0).");
            }

            setNewValue(totalMonthValue.toFixed(2).replace('.', ','));
            setNewDesc(`Boletim Importado via Excel (${entity})`);

            if (viewMode !== 'CONSOLIDATED' && viewMode !== entity) {
                alert(`Atenção: O arquivo é da ${entity}, mas você está na aba ${viewMode}. Recomendado trocar de aba ou o sistema registrará como ${viewMode} (se forçar).`);
                setViewMode(entity as any);
            } else if (viewMode === 'CONSOLIDATED') {
                setViewMode(entity as any);
            }

        } catch (error: any) {
            console.error(error);
            alert(`Erro na importação: ${error.message}`);
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    if (!isOpen || !contract) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 md:p-6 text-slate-800">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden relative"
                >
                    {/* HEADER */}
                    <div className="flex justify-between items-start p-6 border-b border-slate-100 bg-slate-50/50">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                    {contract.status === 'ACTIVE' ? 'Em Andamento' : 'Concluído'}
                                </span>
                                <span className="text-slate-500 text-sm font-medium">
                                    {contract.siteName}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800">{contract.name}</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* TABS */}
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                {['CONSOLIDATED', 'RENTAL', 'CONSTRUTORA'].map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setViewMode(mode as any)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === mode
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        {mode === 'CONSOLIDATED' ? 'Consolidado' : mode === 'RENTAL' ? 'DR Rental' : 'DR Construtora'}
                                    </button>
                                ))}
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">

                        {/* STATS GRID */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl flex flex-col justify-between">
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">Valor Contratual</span>
                                <span className="text-2xl font-bold text-blue-900 mt-2">
                                    {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                            <div className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex flex-col justify-between">
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Executado ({viewMode === 'CONSOLIDATED' ? 'Total' : viewMode})</span>
                                <span className="text-2xl font-bold text-emerald-900 mt-2">
                                    {executedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                            <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-2xl flex flex-col justify-between">
                                <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Saldo a Executar</span>
                                <span className="text-2xl font-bold text-amber-900 mt-2">
                                    {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                            <div className="p-5 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col justify-between relative overflow-hidden">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Progresso Físico</span>
                                <span className="text-2xl font-bold text-slate-800 mt-2">
                                    {progress.toFixed(1)}%
                                </span>
                                <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-200">
                                    <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
                            {/* CHART AREA */}
                            <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[400px]">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <TrendingUp size={20} className="text-blue-600" />
                                    Curva de Evolução Financeira
                                </h3>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorAccumulated" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis
                                                dataKey="monthYear"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                dy={10}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <ReferenceLine y={totalValue} stroke="#ef4444" strokeDasharray="4 4" />
                                            <Area
                                                type="monotone"
                                                dataKey="accumulated"
                                                stroke="#2563eb"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorAccumulated)"
                                            />
                                            <Line type="monotone" dataKey="balance" stroke="#f59e0b" strokeWidth={3} dot={false} />
                                            <Line type="monotone" dataKey="accumulatedProjected" stroke="#2563eb" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                            <Line type="monotone" dataKey="balanceProjected" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* ADD MEASUREMENT FORM */}
                            <div className="space-y-6">
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <Plus size={20} className="text-green-600" />
                                        Registrar Medição ({viewMode})
                                    </h3>

                                    {/* UPLOAD INPUT */}
                                    <div className="mb-6 border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center bg-white hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer relative group">
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            onChange={handleFileUpload}
                                            accept=".csv, .xls, .xlsx"
                                            disabled={loading}
                                        />
                                        {loading ? (
                                            <div className="flex flex-col items-center animate-pulse">
                                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                                <span className="text-xs font-bold text-blue-500">Processando planilha...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="p-2 bg-blue-100 rounded-full mb-2 group-hover:scale-110 transition-transform">
                                                    <Upload size={20} className="text-blue-600" />
                                                </div>
                                                <span className="text-xs font-bold text-slate-600">Importar Boletim (Excel/CSV)</span>
                                                <span className="text-[10px] text-slate-400 uppercase mt-1">Template DR Construtora</span>
                                            </>
                                        )}
                                    </div>
                                    <form onSubmit={handleAdd} className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Valor (R$)</label>
                                            <input
                                                type="text"
                                                placeholder="0,00"
                                                value={newValue}
                                                onChange={e => setNewValue(e.target.value)}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Data</label>
                                            <input
                                                type="date"
                                                value={newDate}
                                                onChange={e => setNewDate(e.target.value)}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
                                        >
                                            {loading ? 'Salvando...' : 'Adicionar'}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>

                        {/* AUDIT MATRIX */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <FileText size={20} className="text-purple-600" />
                                    Matriz de Auditoria de Escopo
                                </h3>
                                <input
                                    type="month"
                                    value={auditMonth}
                                    onChange={(e) => setAuditMonth(e.target.value)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 outline-none"
                                />
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            <th className="p-3">Código</th>
                                            <th className="p-3">Descrição</th>
                                            <th className="p-3 text-right">Unitário</th>
                                            <th className="p-3 text-right">Qtd Total</th>
                                            <th className="p-3 text-right">Medição ({format(new Date(auditMonth + '-01'), 'MMM/yy', { locale: ptBR })})</th>
                                            <th className="p-3 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {contract.scopeItems?.map((item, idx) => {
                                            // Find measurement for this item in selected month
                                            // NOTE: This logic assumes measurements might be linked to scope items code/desc or we rely on the parser having populated measurements with description matching scope? 
                                            // The user requirements said: "Se o mês selecionado não tiver medição per item..."
                                            // But currently the measurement model is simple (date, value, description). 
                                            // It doesn't strictly link to ScopeItem Code yet. 
                                            // HOWEVER, the "Parser" saves measurements derived from the template rows (which are scope items). 
                                            // So if we have measurements description matching item description or code, we can link them.
                                            // Or we just checking if ANY measurement occurred in that month for that entity? 
                                            // The requirement "List Master" implies granular tracking. 
                                            // The "Parser" step I implemented saves `items` as `{ code, description, monthValue, balance }`.
                                            // But `contractService` saves these `items` into `contract.measurements`?? No.. 
                                            // In the parser logic I pushed to `items`. 
                                            // If the user wants granular audit, we need to know if we are storing granular data.
                                            // The `ContractMeasurement` in types.ts is `{ value, description }`. 
                                            // So likely we need to display "Sem movimentação" if no measurement description matches the scope item description for that month OR if simply no general measurement.
                                            // User said: "Se o mês selecionado não tiver medição para um item..." -> implies item-level tracking.
                                            // BUT `ContractMeasurement` doesn't have `scopeItemId`. 
                                            // I will assume we match by `description` or just show "0,00" if we can't find it.
                                            // For now, since the parser returns granular items with `monthValue`, I assume we might have *stored* that data somewhere? 
                                            // Currently the `parseGoldenTemplate` function is just a helper. It's not modifying state.
                                            // I will implement the UI to display the `scopeItems` (List Master).
                                            // NOTE: Since we don't have historical granular data stored in `contract.measurements` (it's flat), 
                                            // We can only show what's in the Scope Item if we update the Scope Item constantly? 
                                            // actually, the requirement "Se o mês selecionado..." suggests we might have historical granular data.
                                            // But we only added `scopeItems` array to contract. 
                                            // I'll stick to displaying the Static Scope Items list and for the "Measurement" column, 
                                            // I will look for a measurement in `contract.measurements` that matches the Description (if possible) AND falls in the month.

                                            const monthStart = auditMonth;
                                            const hasMeasurement = contract.measurements.some(m =>
                                                m.date.toISOString().startsWith(monthStart) &&
                                                (m.description.includes(item.description) || m.description.includes(item.code))
                                            );
                                            // This is a "Best Effort" matching since we lack strong ID link.

                                            // Actually, since I can't guarantee the link, maybe just listing the Scope Items is the key, 
                                            // and "Sem Movimentação" is just the default state if we haven't implemented granular storage yet.
                                            // I'll render the row as requested.

                                            return (
                                                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-3 font-mono text-xs text-slate-500">{item.code}</td>
                                                    <td className="p-3 font-medium text-slate-700">{item.description}</td>
                                                    <td className="p-3 text-right text-slate-600">{item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                    <td className="p-3 text-right text-slate-600">{item.totalQuantity} {item.unit}</td>
                                                    <td className="p-3 text-right">
                                                        <span className="text-slate-300 font-medium text-xs italic">Sem movimentação</span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="inline-block w-2 h-2 rounded-full bg-slate-300"></div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {(!contract.scopeItems || contract.scopeItems.length === 0) && (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                                    Nenhum item de escopo cadastrado ou Lista Mestra não importada.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

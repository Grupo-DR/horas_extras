import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, DollarSign, Plus, Trash2, TrendingUp, FileText, PieChart } from 'lucide-react';
import { Contract, ContractMeasurement } from '../types';
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

const CustomTooltip = ({ active, payload, label, crossoverDate }: any) => {
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
                {isProjection && crossoverDate && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                        <p className="text-xs text-slate-500">
                            Tendência de Cruzamento: <br />
                            <span className="font-bold text-slate-700">
                                {format(new Date(crossoverDate), 'dd/MM/yyyy')}
                            </span>
                        </p>
                    </div>
                )}
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

    // Measurement Form State
    const [newValue, setNewValue] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newDesc, setNewDesc] = useState('');
    const [loading, setLoading] = useState(false);

    // Prepare Chart Data
    const { chartData, crossoverDate } = useMemo(() => {
        if (!contract) return { chartData: [], crossoverDate: null };

        const measurements = contract.measurements || [];
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
        let foundCrossover = null;

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

            // Generate Weekly Projection Points until End Date
            // We iterate day by day but push weekly to keep chart clean? 
            // Better: Iterate by larger steps or strict daily? Let's do roughly 10 points or weekly.
            // Let's do daily simulation for accurate crossover, but only push points occasionally?
            // User requested "daily or weekly". Let's do weekly to avoid thousands of points if long contract.

            let currentDate = new Date(lastDate);
            currentDate.setDate(currentDate.getDate() + 1); // Start next day

            while (currentDate <= endDate) {
                const daysInFuture = Math.ceil((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                projectionAccumulated = accumulated + (dailyRate * daysInFuture);
                projectionBalance = (totalValue - accumulated) - (dailyRate * daysInFuture);

                // Detect crossover (First time Accumulated >= Balance)
                if (!foundCrossover && projectionAccumulated >= projectionBalance) {
                    foundCrossover = new Date(currentDate);
                }

                // Push points every 7 days OR if it's the endDate OR if it's the crossover date (for precision)
                // Actually, let's just do every 7 days + End Date.
                // Recharts handles gaps fine.
                const isWeekly = Math.ceil((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) % 7 === 0;
                const isFinal = currentDate.getTime() === endDate.getTime();

                if (isWeekly || isFinal) {
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
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        // Sort by date
        const finalChartData = points.sort((a, b) => a.date.getTime() - b.date.getTime());
        return { chartData: finalChartData, crossoverDate: foundCrossover };
    }, [contract]);

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
                date: new Date(newDate), // Simplified, might need timezone handling if strict
                description: newDesc
            });
            // Reset form
            setNewValue('');
            setNewDesc('');
            // Keep date or reset? Let's keep date for sequential entry convenience or reset to today
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
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
                            <p className="text-slate-500 text-sm">{contract.clientName}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                            <X size={24} />
                        </button>
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
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Executado (Medido)</span>
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

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

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
                                                dataKey="shortDate"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                                            />
                                            <Tooltip content={<CustomTooltip crossoverDate={crossoverDate} />} />

                                            <ReferenceLine
                                                y={totalValue}
                                                stroke="#ef4444"
                                                strokeDasharray="4 4"
                                                label={{
                                                    value: 'VALOR TOTAL',
                                                    position: 'insideTopRight',
                                                    fill: '#ef4444',
                                                    fontSize: 10,
                                                    fontWeight: 'bold'
                                                }}
                                            />

                                            <ReferenceLine
                                                y={totalValue / 2}
                                                stroke="#94a3b8"
                                                strokeDasharray="2 2"
                                                label={{
                                                    value: '50%',
                                                    position: 'insideLeft',
                                                    fill: '#94a3b8',
                                                    fontSize: 10
                                                }}
                                            />

                                            <Area
                                                type="monotone"
                                                dataKey="accumulated"
                                                name="Valor Medido Acumulado"
                                                stroke="#2563eb"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorAccumulated)"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="balance"
                                                name="Saldo Remanescente"
                                                stroke="#f59e0b"
                                                strokeWidth={3}
                                                dot={false}
                                            />

                                            {/* PROJECTIONS */}
                                            <Line
                                                type="monotone"
                                                dataKey="accumulatedProjected"
                                                name="Projeção Acumulado"
                                                stroke="#2563eb"
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                                dot={false}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="balanceProjected"
                                                name="Projeção Saldo"
                                                stroke="#f59e0b"
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                                dot={false}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* ADD MEASUREMENT FORM */}
                            <div className="space-y-6">
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <Plus size={20} className="text-green-600" />
                                        Registrar Medição
                                    </h3>
                                    <form onSubmit={handleAdd} className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Valor (R$)</label>
                                            <div className="relative">
                                                <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="0,00"
                                                    value={newValue}
                                                    onChange={e => setNewValue(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Data de Referência</label>
                                            <div className="relative">
                                                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="date"
                                                    value={newDate}
                                                    onChange={e => setNewDate(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-600 font-medium"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Descrição (Opcional)</label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Medição ref. concretagem..."
                                                value={newDesc}
                                                onChange={e => setNewDesc(e.target.value)}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-600 text-sm"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={loading || !newValue || !newDate}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? 'Salvando...' : 'Adicionar Medição'}
                                        </button>
                                    </form>
                                </div>

                                {/* HISTORY TABLE SNEAK PEAK */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex-1 overflow-hidden">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">
                                        Histórico Recente
                                    </h3>
                                    <div className="overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                                        {contract.measurements && contract.measurements.length > 0 ? (
                                            <div className="space-y-3">
                                                {[...contract.measurements].sort((a, b) => b.date.getTime() - a.date.getTime()).map(m => (
                                                    <div key={m.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 group">
                                                        <div>
                                                            <p className="font-bold text-slate-700">{m.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                            <p className="text-xs text-slate-400 flex items-center gap-1">
                                                                <Calendar size={10} /> {format(m.date, 'dd/MM/yyyy')}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => onRemoveMeasurement(contract.id, m.id)}
                                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Excluir Medição"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-slate-400 text-sm italic">Nenhuma medição registrada.</p>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, TrendingUp, Calendar, User, History } from 'lucide-react';
import { KPI } from '../types';
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

interface KPIDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    kpi: KPI | null;
}

const CustomTooltip = ({ active, payload, label, unit }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-3 rounded-xl shadow-xl">
                <p className="text-slate-500 text-xs font-bold mb-1 uppercase">{label}</p>
                <p className="text-blue-600 font-bold text-lg">
                    {payload[0].value.toLocaleString('pt-BR')} <span className="text-xs">{unit}</span>
                </p>
                {payload[0].payload.updatedBy && (
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <User size={10} />
                        {payload[0].payload.updatedBy}
                    </div>
                )}
            </div>
        );
    }
    return null;
};

export const KPIDetailsModal: React.FC<KPIDetailsModalProps> = ({ isOpen, onClose, kpi }) => {
    if (!isOpen || !kpi) return null;

    const chartData = useMemo(() => {
        if (!kpi.history || kpi.history.length === 0) return [];

        // Ensure sorted by date
        return [...kpi.history].sort((a, b) => a.referenceDate.getTime() - b.referenceDate.getTime()).map(h => ({
            date: h.referenceDate,
            dateStr: format(h.referenceDate, 'dd/MM/yyyy'),
            shortDate: format(h.referenceDate, 'MMM yy', { locale: ptBR }),
            value: h.value,
            updatedBy: h.updatedBy
        }));
    }, [kpi.history]);

    const formatValue = (val: number) => {
        if (kpi.unit === 'R$' || kpi.unit === 'BRL') return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (kpi.unit === '%') return `${val.toFixed(1)}%`;
        return val.toLocaleString('pt-BR');
    };

    const percentage = kpi.targetValue > 0 ? (kpi.currentValue / kpi.targetValue) * 100 : 0;
    const isMet = kpi.currentValue >= kpi.targetValue;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 md:p-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden relative"
                >
                    {/* GLASS HEADER */}
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-blue-600 to-indigo-700 opacity-10 pointer-events-none"></div>

                    <div className="flex justify-between items-start p-8 relative z-10">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                    Indicador Estratégico
                                </span>
                                <span className="text-slate-400 text-sm flex items-center gap-1">
                                    <User size={14} />
                                    {kpi.responsibleName}
                                </span>
                            </div>
                            <h2 className="text-3xl font-bold text-slate-800">{kpi.name}</h2>
                            <p className="text-slate-500 mt-2 max-w-2xl">{kpi.description}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">

                        {/* KEY METRICS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 relative overflow-hidden group hover:border-blue-200 transition-colors">
                                <div className="absolute right-4 top-4 text-slate-200 group-hover:text-blue-100 transition-colors">
                                    <TrendingUp size={48} />
                                </div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-1">Resultado Atual</p>
                                <p className={`text-4xl font-bold ${isMet ? 'text-green-600' : 'text-slate-800'}`}>
                                    {formatValue(kpi.currentValue)}
                                </p>
                                <p className="text-xs text-slate-400 mt-2">
                                    Última atualização: {format(kpi.updatedAt || new Date(), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 relative overflow-hidden">
                                <div className="absolute right-4 top-4 text-slate-200">
                                    <Target size={48} />
                                </div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-1">Meta Definida</p>
                                <p className="text-4xl font-bold text-slate-600">
                                    {formatValue(kpi.targetValue)}
                                </p>
                                <p className="text-xs text-slate-400 mt-2">
                                    Gap: {formatValue(kpi.targetValue - kpi.currentValue)}
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 relative overflow-hidden">
                                <div className="absolute right-4 top-4 text-slate-200">
                                    <History size={48} />
                                </div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-1">Performance</p>
                                <p className={`text-4xl font-bold ${isMet ? 'text-green-600' : 'text-blue-600'}`}>
                                    {percentage.toFixed(1)}%
                                </p>
                                <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${isMet ? 'bg-green-500' : 'bg-blue-500'}`}
                                        style={{ width: `${Math.min(percentage, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* CHART SECTION */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <TrendingUp size={20} className="text-blue-600" />
                                Evolução Histórica
                            </h3>

                            <div className="h-[400px] w-full">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
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
                                                tickFormatter={(val) => kpi.unit === '%' ? `${val}%` : val > 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                                            />
                                            <Tooltip content={<CustomTooltip unit={kpi.unit} />} />

                                            <ReferenceLine
                                                y={kpi.targetValue}
                                                stroke="#ef4444"
                                                strokeDasharray="4 4"
                                                label={{
                                                    value: 'META',
                                                    position: 'right',
                                                    fill: '#ef4444',
                                                    fontSize: 10,
                                                    fontWeight: 'bold'
                                                }}
                                            />

                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#2563eb"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorValue)"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#2563eb"
                                                strokeWidth={3}
                                                dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#2563eb' }}
                                                activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <History size={48} className="mb-2 opacity-50" />
                                        <p>Sem dados históricos suficientes para gerar o gráfico.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* HISTORY TABLE (Optional, but good for details) */}
                        {kpi.history && kpi.history.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-lg font-bold text-slate-800 mb-4">Registro de Atualizações</h3>
                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                            <tr>
                                                <th className="px-6 py-3 text-left">Data de Referência</th>
                                                <th className="px-6 py-3 text-left">Valor</th>
                                                <th className="px-6 py-3 text-left">Responsável</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {[...kpi.history].sort((a, b) => b.referenceDate.getTime() - a.referenceDate.getTime()).map((h, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4 text-slate-800 font-medium">
                                                        {format(h.referenceDate, 'dd/MM/yyyy')}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-slate-700">
                                                        {formatValue(h.value)}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500">
                                                        {h.updatedBy || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

import React from 'react';
import { KPI } from '../types';
import { TrendingUp, TrendingDown, Minus, Target, Award, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
    kpi: KPI;
    onExplore: (kpiId: string) => void;
    onUpdate: (kpiId: string) => void;
    onEdit: (kpi: KPI) => void;
    onDelete: (kpiId: string) => void;
}

export const KPICard: React.FC<Props> = ({ kpi, onExplore, onUpdate, onEdit, onDelete }) => {
    const percentage = kpi.targetValue > 0 ? (kpi.currentValue / kpi.targetValue) * 100 : 0;
    const gap = kpi.targetValue - kpi.currentValue;
    const isMet = kpi.currentValue >= kpi.targetValue;

    // Trend logic: Compare last 2 history items
    const history = kpi.history || [];
    const lastValue = history.length > 0 ? history[history.length - 1].value : 0;
    const prevValue = history.length > 1 ? history[history.length - 2].value : 0;

    const trend = lastValue > prevValue ? 'up' : lastValue < prevValue ? 'down' : 'flat';

    const formatValue = (val: number) => {
        if (kpi.unit === 'R$' || kpi.unit === 'BRL') return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (kpi.unit === '%') return `${val.toFixed(1)}%`;
        return val.toLocaleString('pt-BR');
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden"
        >
            {/* BACKGROUND DECORATION */}
            <div className={`absolute top-0 left-0 w-1.5 h-full ${isMet ? 'bg-green-500' : 'bg-blue-500'}`}></div>

            <div className="flex justify-between items-start mb-4 pl-3">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg leading-tight">{kpi.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">
                        {kpi.responsibleName || 'Responsável'}
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(kpi); }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(kpi.id); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                    <div className={`p-2 rounded-full ${trend === 'up' ? 'bg-green-100 text-green-600' :
                        trend === 'down' ? 'bg-red-100 text-red-600' :
                            'bg-slate-100 text-slate-500'
                        }`}>
                        {trend === 'up' && <TrendingUp size={20} />}
                        {trend === 'down' && <TrendingDown size={20} />}
                        {trend === 'flat' && <Minus size={20} />}
                    </div>
                </div>
            </div>

            <p className="text-slate-500 text-sm mb-6 pl-3 flex-1 line-clamp-2">
                {kpi.description}
            </p>

            {/* METRIC BOX */}
            <div className="bg-slate-50 rounded-lg p-4 mb-6 relative">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <span className="text-xs font-bold text-slate-400 block mb-1">ATUAL</span>
                        <span className={`text-2xl font-bold ${isMet ? 'text-green-600' : 'text-slate-800'}`}>
                            {formatValue(kpi.currentValue)}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 block mb-1">META</span>
                        <span className="text-lg font-bold text-slate-600">
                            {formatValue(kpi.targetValue)}
                        </span>
                    </div>
                </div>

                {/* PROGRESS BAR */}
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden mb-2">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(percentage, 100)}%` }}
                        className={`h-full rounded-full ${isMet ? 'bg-green-500' : 'bg-blue-600'}`}
                    />
                </div>

                <div className="flex justify-between text-xs font-medium">
                    <span className="text-blue-600">{percentage.toFixed(1)}% Concluído</span>
                    <span className="text-slate-400">Gap: {formatValue(gap)}</span>
                </div>
            </div>

            {/* ACTIONS */}
            <div className="flex gap-2 mt-auto pl-3">
                <button
                    onClick={() => onUpdate(kpi.id)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-bold transition-colors"
                >
                    Atualizar
                </button>
                <button
                    onClick={() => onExplore(kpi.id)}
                    className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 transition-colors group"
                >
                    Ações
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </motion.div>
    );
};

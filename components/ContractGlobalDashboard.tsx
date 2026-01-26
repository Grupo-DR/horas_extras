import React, { useMemo } from 'react';
import { Contract, ContractStatus } from '../types';
import { DollarSign, BarChart3, AlertTriangle, Briefcase, Building2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
    contracts: Contract[];
}

export const ContractGlobalDashboard: React.FC<Props> = ({ contracts }) => {

    const metrics = useMemo(() => {
        const totalContracts = contracts.length;
        const activeContracts = contracts.filter(c => c.status === ContractStatus.ACTIVE).length;
        const totalValue = contracts.reduce((acc, c) => acc + (c.totalValue || 0), 0);

        // Approx executed calculation (can be refined to be sum of latest balance diffs if data available)
        // For global dash, summing 'measurements' total value might be enough for a quick view
        const totalExecuted = contracts.reduce((acc, c) => {
            const executed = (c.measurements || []).reduce((sum, m) => sum + (m.value || 0), 0);
            return acc + executed;
        }, 0);

        const pending = totalValue - totalExecuted;
        const performance = totalValue > 0 ? (totalExecuted / totalValue) * 100 : 0;

        return { totalContracts, activeContracts, totalValue, totalExecuted, pending, performance };
    }, [contracts]);

    const dataPie = [
        { name: 'Executado', value: metrics.totalExecuted, color: '#10b981' },
        { name: 'Saldo', value: metrics.pending, color: '#f59e0b' }
    ];

    return (
        <div className="p-8 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Visão Geral da Carteira</h2>

            {/* CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                            <Briefcase size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Contratos Ativos</p>
                            <p className="text-2xl font-bold text-slate-800">{metrics.activeContracts}/{metrics.totalContracts}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Volume sob Gestão</p>
                            <p className="text-xl font-bold text-slate-800">
                                {metrics.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Volume Executado</p>
                            <p className="text-xl font-bold text-slate-800">
                                {metrics.totalExecuted.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-gradient-to-b from-blue-500 to-indigo-600"></div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Performance Global</p>
                    <p className="text-4xl font-bold text-slate-800 mb-1">{metrics.performance.toFixed(1)}%</p>
                    <p className="text-xs text-slate-400">avanço financeiro ponderado</p>
                </div>
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[300px] flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Composição da Carteira</h3>
                    <div className="flex-1 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={dataPie}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {dataPie.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-col gap-2 ml-4">
                            {dataPie.map((entry, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                    <span className="text-sm font-bold text-slate-600">{entry.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-center justify-center flex-col text-center">
                    <Building2 size={48} className="text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-700">Mais métricas em breve</h3>
                    <p className="text-slate-400 max-w-xs">Futuramente: Curva S Global, Fluxo de Caixa Agregado e Previsões.</p>
                </div>
            </div>
        </div>
    );
};

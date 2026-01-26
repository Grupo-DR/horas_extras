import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContracts } from '../contexts/ContractsContext';
import { RDOAnalytics } from '../services/RDOAnalytics';
import {
    Users, Tractor, AlertTriangle, TrendingUp, Calendar,
    Droplets, CloudRain, Sun, Clock, HardHat, FileText, ArrowLeft
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    BarChart, Bar, Legend, LineChart, Line
} from 'recharts';

export const ConstructionSiteView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { contracts } = useContracts();
    const [activeTab, setActiveTab] = useState<'geral' | 'mao_de_obra' | 'equipamentos' | 'avanco' | 'riscos'>('geral');

    const contract = contracts.find(c => c.id === id);

    // Aggregate RDOs from all teams
    const rdos = useMemo(() => {
        if (!contract || !contract.teams) return [];
        return contract.teams.flatMap(t => t.rdos || []);
    }, [contract]);

    // Compute Analytics
    const dailyData = useMemo(() => RDOAnalytics.getDailyKPIs(rdos), [rdos]);
    const stats = useMemo(() => RDOAnalytics.getExecutiveStats(rdos), [rdos]);
    const activities = useMemo(() => RDOAnalytics.getActivityProgress(rdos), [rdos]);

    // Helper for formatting dates in charts
    const formatDate = (dateStr: string) => {
        // Input: 18/11/2025 -> Output: 18/Nov
        const parts = dateStr.split('/');
        if (parts.length < 2) return dateStr;
        return `${parts[0]}/${parts[1]}`;
    };

    if (!contract) {
        return <div className="p-8">Contrato não encontrado.</div>;
    }

    if (rdos.length === 0) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-full text-center">
                <HardHat size={64} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700">Nenhum RDO encontrado</h2>
                <p className="text-slate-500 max-w-md mt-2">
                    Este contrato ainda não possui RDOs importados. Importe arquivos na tela do contrato para ver a análise aqui.
                </p>
                <button onClick={() => navigate(-1)} className="mt-6 text-blue-600 font-bold hover:underline">Voltar</button>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-slate-50 overflow-hidden">

            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-8 py-6">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4 text-sm font-medium transition-colors"
                >
                    <ArrowLeft size={16} /> Voltar
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <HardHat className="text-orange-600" />
                        Visão da Obra: {contract.name}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Inteligência baseada em {rdos.length} Relatórios Diários de Obra (RDOs)
                    </p>
                </div>

                {/* TABS */}
                <div className="flex gap-1 mt-6 border-b border-slate-100 overflow-x-auto">
                    {[
                        { id: 'geral', label: '1. Visão Executiva', icon: TrendingUp },
                        { id: 'mao_de_obra', label: '2. Mão de Obra', icon: Users },
                        { id: 'equipamentos', label: '3. Equipamentos', icon: Tractor },
                        { id: 'avanco', label: '4. Avanço Físico', icon: FileText },
                        { id: 'riscos', label: '5. Ocorrências', icon: AlertTriangle },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? 'border-orange-600 text-orange-700 bg-orange-50'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-auto p-8">

                {/* LAYER 1: EXECUTIVE VIEW (SUMMARY) */}
                {activeTab === 'geral' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* KPI CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Users size={20} /></div>
                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">Média/Dia</span>
                                </div>
                                <h3 className="text-3xl font-bold text-slate-800">{stats.avgPeople}</h3>
                                <p className="text-sm text-slate-500">Colaboradores ativos</p>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600"><Tractor size={20} /></div>
                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">Média/Dia</span>
                                </div>
                                <h3 className="text-3xl font-bold text-slate-800">{stats.avgEquipment}</h3>
                                <p className="text-sm text-slate-500">Equipamentos mobilizados</p>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-red-100 rounded-lg text-red-600"><AlertTriangle size={20} /></div>
                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">Total</span>
                                </div>
                                <h3 className="text-3xl font-bold text-slate-800">{stats.totalOccurrences}</h3>
                                <p className="text-sm text-slate-500">Ocorrências registradas</p>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><CloudRain size={20} /></div>
                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">Impacto</span>
                                </div>
                                <h3 className="text-3xl font-bold text-slate-800">{stats.badWeatherDays}</h3>
                                <p className="text-sm text-slate-500">Dias impraticáveis (Chuva)</p>
                            </div>
                        </div>

                        {/* EXECUTIVE CHART */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <TrendingUp size={18} className="text-blue-500" />
                                Evolução: Pessoas x Equipamentos
                            </h3>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={dailyData}>
                                        <defs>
                                            <linearGradient id="colorPeople" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorEq" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#eab308" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" tickFormatter={formatDate} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                                        />
                                        <Legend />
                                        <Area
                                            type="monotone"
                                            dataKey="totalPeople"
                                            name="Pessoas"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorPeople)"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="equipmentCount"
                                            name="Equipamentos"
                                            stroke="#eab308"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorEq)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* LAYER 2: LABOR */}
                {activeTab === 'mao_de_obra' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Users size={18} className="text-blue-500" />
                            Histórico de Mão de Obra (Pessoas/Dia)
                        </h3>
                        <div className="h-96 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tickFormatter={formatDate} stroke="#94a3b8" fontSize={12} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                                    <Legend />
                                    <Bar dataKey="totalPeople" name="Qtd Colaboradores" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <h4 className="font-bold text-slate-700 mb-2">Produtividade de Campo</h4>
                                <p className="text-sm text-slate-500">
                                    Total de Horas Homem (Estimado): <span className="font-bold text-slate-800">{Math.round(stats.totalManHours)}h</span>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* LAYER 3: EQUIPMENT */}
                {activeTab === 'equipamentos' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Tractor size={18} className="text-yellow-500" />
                            Mobilização de Equipamentos (Qtd Diária)
                        </h3>
                        <div className="h-96 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tickFormatter={formatDate} stroke="#94a3b8" fontSize={12} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                                    <Legend />
                                    <Bar dataKey="equipmentCount" name="Máquinas no Canteiro" fill="#eab308" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* LAYER 4: PHYSICAL PROGRESS */}
                {activeTab === 'avanco' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <FileText size={18} className="text-green-600" />
                                Atividades Recentes e Avanço Físico (Último Status reportado no RDO)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3">Código / Atividade</th>
                                            <th className="px-4 py-3">Unidade</th>
                                            <th className="px-4 py-3">Progresso (%)</th>
                                            <th className="px-4 py-3">Status RDO string</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {activities.map((act) => (
                                            <tr key={act.code} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-700">
                                                    <span className="block text-xs text-slate-400 mb-1">{act.code}</span>
                                                    {act.fullDescription.length > 80 ? act.fullDescription.substring(0, 80) + '...' : act.fullDescription}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">{act.unit}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className="h-2 bg-green-500 rounded-full"
                                                                style={{ width: `${Math.min(act.percentage, 100)}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="font-bold text-slate-700">{act.percentage}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-400 max-w-xs truncate" title={act.lastStatus}>
                                                    {act.lastStatus}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* LAYER 5: RISKS / OCCURRENCES */}
                {activeTab === 'riscos' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-red-500" />
                            Histórico de Ocorrências (Interferências, Trens, Chuva)
                        </h3>
                        <div className="h-80 w-full mb-8">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tickFormatter={formatDate} stroke="#94a3b8" fontSize={12} />
                                    <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="occurrenceCount" name="Qtd Ocorrências" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 0, fill: '#ef4444' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <CloudRain size={16} />
                                Análise Climática
                            </h4>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                    <span className="text-sm text-slate-600">Dias Praticáveis: <strong>{dailyData.length - stats.badWeatherDays}</strong></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                                    <span className="text-sm text-slate-600">Dias Impraticáveis: <strong>{stats.badWeatherDays}</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

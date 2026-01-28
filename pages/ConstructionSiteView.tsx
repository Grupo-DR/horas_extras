import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContracts } from '../contexts/ContractsContext';
import { RDOAnalytics } from '../services/RDOAnalytics';
import { SiteCalendar } from '../components/production/SiteCalendar';
import { ResourceMatrix } from '../components/production/ResourceMatrix';
import {
    Users, Tractor, AlertTriangle, TrendingUp, Calendar,
    Droplets, CloudRain, Sun, Clock, HardHat, FileText, ArrowLeft, Filter
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    BarChart, Bar, Legend, LineChart, Line
} from 'recharts';

export const ConstructionSiteView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { contracts } = useContracts();

    // UI State
    const [activeTab, setActiveTab] = useState<'geral' | 'calendario' | 'mao_de_obra' | 'equipamentos' | 'avanco' | 'riscos'>('geral');

    // Filter State
    const [activeTeamId, setActiveTeamId] = useState<string>('ALL');
    const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
    const [selectedYear, setSelectedYear] = useState<string>('ALL');

    const contract = contracts.find(c => c.id === id);

    // 1. Raw RDOs from all teams
    const allRdos = useMemo(() => {
        if (!contract || !contract.teams) return [];
        return contract.teams.flatMap(t => t.rdos || []);
    }, [contract]);

    // 2. Extract Filter Options (Teams, Years)
    const filterOptions = useMemo(() => {
        if (!contract) return { teams: [], years: [] };

        const teams = contract.teams?.map(t => ({ id: t.id, name: t.name })) || [];

        const years = Array.from(new Set(allRdos.map(r => {
            if (!r.relatorio?.data) return null;
            try {
                // Handle DD/MM/YYYY
                const parts = r.relatorio.data.split('/');
                if (parts.length === 3) return parts[2];
                // Handle YYYY-MM-DD
                return r.relatorio.data.split('-')[0];
            } catch { return null; }
        }).filter(Boolean))).sort().reverse();

        return { teams, years };
    }, [contract, allRdos]);

    // 3. Filter Logic (Updated with Month/Year, Removed Site)
    const processedRdos = useMemo(() => {
        if (!contract || !contract.teams) return [];

        const result = [];
        for (const team of contract.teams) {
            const teamRdos = team.rdos || [];
            for (const rdo of teamRdos) {
                // Apply Filters Here
                const matchesTeam = activeTeamId === 'ALL' || team.id === activeTeamId;

                let matchesDate = true;
                if (rdo.relatorio?.data) {
                    let rdoDateParts = rdo.relatorio.data.split('/'); // Assumes DD/MM/YYYY usually
                    if (rdoDateParts.length !== 3) rdoDateParts = rdo.relatorio.data.split('-'); // Try ISO

                    if (rdoDateParts.length >= 2) {
                        const rdoMonth = rdoDateParts.length === 3 && rdo.relatorio.data.includes('/') ? rdoDateParts[1] : rdoDateParts[1]; // Index 1 is month
                        const rdoYear = rdoDateParts.length === 3 && rdo.relatorio.data.includes('/') ? rdoDateParts[2] : rdoDateParts[0];

                        // Normalize Month to 0-11
                        if (selectedMonth !== 'ALL') {
                            const rdoMonthIndex = parseInt(rdoMonth) - 1;
                            if (String(rdoMonthIndex) !== selectedMonth) matchesDate = false;
                        }

                        if (selectedYear !== 'ALL') {
                            if (rdoYear !== selectedYear) matchesDate = false;
                        }
                    }
                }

                if (matchesTeam && matchesDate) {
                    result.push(rdo);
                }
            }
        }
        return result;
    }, [contract, activeTeamId, selectedMonth, selectedYear]);


    // Compute Analytics on Filtered Data
    const dailyData = useMemo(() => RDOAnalytics.getDailyKPIs(processedRdos), [processedRdos]);
    const stats = useMemo(() => RDOAnalytics.getExecutiveStats(processedRdos), [processedRdos]);
    // REMOVED DUPLICATE LINES HERE

    const activities = useMemo(() => RDOAnalytics.getActivityProgress(processedRdos), [processedRdos]);

    // Helper for formatting dates in charts
    const formatDate = (dateStr: string) => {
        const parts = dateStr.split('/');
        if (parts.length < 2) return dateStr;
        return `${parts[0]}/${parts[1]}`;
    };

    // Helper to normalize date to ISO YYYY-MM-DD for Matrix
    const normalizeDateToISO = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('-')) return dateStr; // Already ISO likely

        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // "DD/MM/YYYY" -> "YYYY-MM-DD"
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
    }

    // Helper to safely parse numbers (handles "2,5", "10", number type)
    const parseQty = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        if (typeof val === 'string') {
            // Replace comma with dot for BR locale
            const clean = val.replace(',', '.');
            const parsed = parseFloat(clean);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    };

    // Data for Resource Matrix (Labor) - Refined for 1-31 Days and Aggregation
    const laborMatrixData = useMemo(() => {
        // Mode Check: Is Specific Filter Active?
        const isExactMode = selectedMonth !== 'ALL'; // If specific month is selected, we show exact values. If ALL months, we show averages.

        // Pre-aggregate by Resource + Day (1-31)
        const aggregation = new Map<string, { sumObj: number, daysWithData: Set<string> }>();

        processedRdos.forEach(rdo => {
            if (!rdo.relatorio?.data) return;
            const dateParts = rdo.relatorio.data.split('/'); // DD/MM/YYYY
            if (dateParts.length < 1) return;

            // Extract Day (1-31)
            const dayStr = dateParts[0]; // "01", "15" etc
            // Remove leading zero for cleaner matrix headers (1 instead of 01)
            const dayNum = parseInt(dayStr);
            const dayKey = String(dayNum);

            (rdo.mao_de_obra || []).forEach(mo => {
                if (!mo.funcao) return;
                const resourceName = mo.funcao.trim();
                const key = `${resourceName}::${dayKey}`;

                if (!aggregation.has(key)) {
                    aggregation.set(key, { sumObj: 0, daysWithData: new Set() });
                }
                const record = aggregation.get(key)!;

                // Safe Parse Quantity
                const qty = parseQty(mo.quantidade);

                record.sumObj += qty;
                // Track unique full dates to calculate average correctly
                record.daysWithData.add(rdo.relatorio.data);
            });
        });

        // Convert Map to Array
        const result: { resourceName: string, date: string, quantity: number }[] = [];

        aggregation.forEach((value, key) => {
            const [resourceName, dayKey] = key.split('::');

            let finalQty = value.sumObj;

            if (!isExactMode) {
                // Average Mode
                const count = value.daysWithData.size;
                if (count > 0) {
                    finalQty = Math.round(finalQty / count);
                }
            }

            if (finalQty > 0) {
                result.push({
                    resourceName,
                    date: dayKey, // "1", "2", ... "31"
                    quantity: finalQty
                });
            }
        });

        return result;
    }, [processedRdos, selectedMonth]);

    // Data for Resource Matrix (Equipment)
    const equipmentMatrixData = useMemo(() => {
        const isExactMode = selectedMonth !== 'ALL';
        const aggregation = new Map<string, { sumObj: number, daysWithData: Set<string> }>();

        processedRdos.forEach(rdo => {
            if (!rdo.relatorio?.data) return;
            const dateParts = rdo.relatorio.data.split('/');
            if (dateParts.length < 1) return;
            const dayNum = parseInt(dateParts[0]);
            const dayKey = String(dayNum);

            (rdo.equipamentos || []).forEach(eq => {
                // If eq is string or object
                const rawName = typeof eq === 'string' ? eq : (eq as any).nome || 'Equipamento';
                const resourceName = rawName.trim();
                const key = `${resourceName}::${dayKey}`;

                if (!aggregation.has(key)) {
                    aggregation.set(key, { sumObj: 0, daysWithData: new Set() });
                }
                const record = aggregation.get(key)!;

                // For equipment, check quantitative property or default to 1
                const qty = typeof eq === 'object' && (eq as any).quantidade ? parseQty((eq as any).quantidade) : 1;

                record.sumObj += qty;
                record.daysWithData.add(rdo.relatorio.data);
            });
        });

        const result: { resourceName: string, date: string, quantity: number }[] = [];
        aggregation.forEach((value, key) => {
            const [resourceName, dayKey] = key.split('::');
            let finalQty = value.sumObj;

            if (!isExactMode) {
                const count = value.daysWithData.size;
                if (count > 0) finalQty = Math.round(finalQty / count);
            }

            if (finalQty > 0) {
                result.push({ resourceName, date: dayKey, quantity: finalQty });
            }
        });

        return result;
    }, [processedRdos, selectedMonth]);

    if (!contract) return <div className="p-8">Contrato não encontrado.</div>;

    if (allRdos.length === 0) {
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

    // RENDER BEGINS

    return (
        <div className="flex h-full flex-col bg-slate-50 overflow-hidden">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 shrink-0">
                {/* Top Row: Back + Title + Filter Bar */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-6">
                    <div>
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-2 text-sm font-medium transition-colors"
                        >
                            <ArrowLeft size={16} /> Voltar
                        </button>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <HardHat className="text-orange-600" />
                            Visão da Obra: {contract?.name}
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Analisando <strong>{processedRdos.length}</strong> relatórios filtrados (Total: {allRdos.length})
                        </p>
                    </div>

                    {/* FILTERS */}
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2 text-slate-400 text-sm font-bold uppercase tracking-wider px-2">
                            <Filter size={14} /> Filtros:
                        </div>

                        {/* Year Filter */}
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
                        >
                            <option value="ALL">Todos os Anos</option>
                            {filterOptions.years.map(y => (
                                <option key={y} value={y as string}>{y}</option>
                            ))}
                        </select>

                        {/* Month Filter */}
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
                        >
                            <option value="ALL">Todos os Meses</option>
                            <option value="0">Janeiro</option>
                            <option value="1">Fevereiro</option>
                            <option value="2">Março</option>
                            <option value="3">Abril</option>
                            <option value="4">Maio</option>
                            <option value="5">Junho</option>
                            <option value="6">Julho</option>
                            <option value="7">Agosto</option>
                            <option value="8">Setembro</option>
                            <option value="9">Outubro</option>
                            <option value="10">Novembro</option>
                            <option value="11">Dezembro</option>
                        </select>

                        {/* Team Filter */}
                        <select
                            value={activeTeamId}
                            onChange={(e) => setActiveTeamId(e.target.value)}
                            className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
                        >
                            <option value="ALL">Todas as Turmas</option>
                            {filterOptions.teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex gap-1 border-b border-slate-100 overflow-x-auto">
                    {[
                        { id: 'geral', label: '1. Visão Executiva', icon: TrendingUp },
                        { id: 'calendario', label: '2. Calendário', icon: Calendar },
                        { id: 'mao_de_obra', label: '3. Mão de Obra', icon: Users },
                        { id: 'equipamentos', label: '4. Equipamentos', icon: Tractor },
                        { id: 'avanco', label: '5. Avanço Físico', icon: FileText },
                        { id: 'riscos', label: '6. Ocorrências', icon: AlertTriangle },
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
            <div className="flex-1 overflow-auto p-8 relative">

                {/* GLOBAL EMPTY STATE FOR FILTER */}
                {processedRdos.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10 p-8 text-center animate-in fade-in duration-300">
                        <Filter size={48} className="text-slate-300 mb-4" />
                        <h3 className="text-lg font-bold text-slate-600">Nenhum resultado para os filtros selecionados</h3>
                        <p className="text-slate-400">Tente ajustar a Turma ou a Obra para ver os dados.</p>
                        <button
                            onClick={() => { setActiveTeamId('ALL'); setSelectedMonth('ALL'); setSelectedYear('ALL'); }}
                            className="mt-4 text-blue-600 font-bold hover:underline text-sm"
                        >
                            Limpar Filtros
                        </button>
                    </div>
                )}

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

                {/* NEW LAYER: CALENDAR */}
                {activeTab === 'calendario' && (
                    <div className="h-full min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <SiteCalendar rdos={processedRdos} />
                    </div>
                )}

                {/* LAYER 2: LABOR */}
                {activeTab === 'mao_de_obra' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Users size={18} className="text-blue-500" />
                                Histórico de Mão de Obra (Matriz de Recursos)
                            </h3>
                        </div>

                        {/* Resource Matrix: Labor */}
                        <div className="mb-8">
                            <ResourceMatrix
                                data={laborMatrixData}
                                title="Alocação de Colaboradores por dia"
                                resourceLabel="Função / Cargo"
                                colorTheme="blue"
                            />
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
                            Histórico de Equipamentos (Matriz de Recursos)
                        </h3>

                        {/* Resource Matrix: Equipment */}
                        <div className="mb-8">
                            <ResourceMatrix
                                data={equipmentMatrixData}
                                title="Alocação de Equipamentos por dia"
                                resourceLabel="Equipamento"
                                colorTheme="yellow"
                            />
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

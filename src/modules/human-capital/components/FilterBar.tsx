import React, { useEffect } from 'react';
import { Search, RotateCcw, Filter, CalendarDays, Building2, Briefcase, CalendarRange, ArrowRightLeft, CalendarClock } from 'lucide-react';
import { formatDateForApi } from '../utils/formatters';

export interface FilterState {
    startDate: string;
    endDate: string;
    searchTerm: string;
    type: string;
    costCenter: string;
    function: string;
    year: string;
    month: string;
    dateMode: 'CALENDAR' | 'PAYROLL' | 'ANNUAL' | 'CUSTOM';
}

interface FilterBarProps {
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
    options: {
        years: string[];
        costCenters: string[];
        functions: string[];
        types: string[];
    };
    onClear: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, setFilters, options, onClear }) => {

    const calculateDates = (yearStr: string, monthStr: string, mode: FilterState['dateMode']) => {
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);

        if (mode === 'ANNUAL') {
            return {
                startDate: `${year}-01-01`,
                endDate: `${year}-12-31`
            };
        }

        if (mode === 'CALENDAR') {
            // Mês Civil: 1 a Último dia
            const lastDay = new Date(year, month, 0).getDate();
            return {
                startDate: `${year}-${String(month).padStart(2, '0')}-01`,
                endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
            };
        }

        if (mode === 'PAYROLL') {
            // Competência (Regra de Negócio):
            // Mês de Referência: Janeiro
            // Período: 21 de Dezembro (ano anterior) a 20 de Janeiro

            // Data Fim: 20 do mês atual
            const end = new Date(year, month - 1, 20);

            // Data Início: 21 do mês anterior
            const start = new Date(year, month - 2, 21);

            // Ajuste manual de formatação para garantir YYYY-MM-DD local sem fuso
            const format = (d: Date) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };

            return {
                startDate: format(start),
                endDate: format(end)
            };
        }

        // Modo Customizado mantém o que o usuário digitou
        return { startDate: filters.startDate, endDate: filters.endDate };
    };

    const handleModeChange = (newMode: FilterState['dateMode']) => {
        setFilters(prev => {
            const dates = calculateDates(prev.year, prev.month, newMode);
            return { ...prev, dateMode: newMode, ...dates };
        });
    };

    const handleYearMonthChange = (key: 'year' | 'month', value: string) => {
        setFilters(prev => {
            const next = { ...prev, [key]: value };
            if (prev.dateMode !== 'CUSTOM') {
                const dates = calculateDates(next.year, next.month, prev.dateMode);
                return { ...next, ...dates };
            }
            return next;
        });
    };

    // Helper para exibir o período da competência no dropdown
    const getMonthLabel = (m: number) => {
        const monthName = new Date(0, m - 1).toLocaleString('pt-BR', { month: 'long' });
        if (filters.dateMode === 'PAYROLL') {
            // Ex: Janeiro (21/12 a 20/01)
            const prevMonth = new Date(0, m - 2).toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
            const currMonth = monthName.substring(0, 3);
            return `${monthName} (21/${prevMonth} a 20/${currMonth})`;
        }
        return monthName; // Ex: Janeiro
    };

    return (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-5">

            {/* Seletor de Modo (Abas) */}
            <div className="flex flex-wrap items-center justify-between pb-4 border-b border-gray-50 gap-4">
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <Filter size={16} className="text-blue-600" />
                    Período de Análise
                </h3>
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => handleModeChange('PAYROLL')}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase whitespace-nowrap transition-all flex items-center gap-2 ${filters.dateMode === 'PAYROLL' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <ArrowRightLeft size={12} /> Competência (Folha)
                    </button>
                    <button
                        onClick={() => handleModeChange('CALENDAR')}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase whitespace-nowrap transition-all flex items-center gap-2 ${filters.dateMode === 'CALENDAR' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <CalendarDays size={12} /> Mês Civil
                    </button>
                    <button
                        onClick={() => handleModeChange('ANNUAL')}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase whitespace-nowrap transition-all flex items-center gap-2 ${filters.dateMode === 'ANNUAL' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <CalendarClock size={12} /> Anual
                    </button>
                    <button
                        onClick={() => handleModeChange('CUSTOM')}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase whitespace-nowrap transition-all flex items-center gap-2 ${filters.dateMode === 'CUSTOM' ? 'bg-white text-orange-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <CalendarRange size={12} /> Personalizado
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">

                {/* Controles de Data Dinâmicos */}
                {filters.dateMode === 'CUSTOM' ? (
                    <>
                        <div className="lg:col-span-1 space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data Início</label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-orange-50/30 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                            />
                        </div>
                        <div className="lg:col-span-1 space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data Fim</label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-orange-50/30 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="lg:col-span-1 space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ano</label>
                            <select
                                value={filters.year}
                                onChange={(e) => handleYearMonthChange('year', e.target.value)}
                                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 bg-gray-50/50 focus:bg-white transition-all"
                            >
                                {options.years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>

                        {filters.dateMode !== 'ANNUAL' && (
                            <div className="lg:col-span-1 space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    {filters.dateMode === 'PAYROLL' ? 'Mês Competência' : 'Mês'}
                                </label>
                                <select
                                    value={filters.month}
                                    onChange={(e) => handleYearMonthChange('month', e.target.value)}
                                    className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 bg-gray-50/50 focus:bg-white transition-all"
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <option key={m} value={String(m).padStart(2, '0')}>
                                            {getMonthLabel(m)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </>
                )}

                {/* Filtros Comuns (CC, Função, Busca) */}
                <div className="lg:col-span-1 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Building2 size={10} /> Centro de Custo
                    </label>
                    <select
                        value={filters.costCenter}
                        onChange={(e) => setFilters(prev => ({ ...prev, costCenter: e.target.value }))}
                        className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                        <option value="">Todos</option>
                        {options.costCenters.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                    </select>
                </div>

                <div className="lg:col-span-1 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Briefcase size={10} /> Função
                    </label>
                    <select
                        value={filters.function}
                        onChange={(e) => setFilters(prev => ({ ...prev, function: e.target.value }))}
                        className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                        <option value="">Todas</option>
                        {options.functions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>

                <div className="lg:col-span-1 flex items-end">
                    <button
                        onClick={onClear}
                        className="w-full h-10 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={14} />
                        Limpar
                    </button>
                </div>
            </div>

            {/* Indicador visual do período exato sendo filtrado */}
            <div className="text-xs text-center text-gray-400 font-mono bg-gray-50 py-1.5 rounded-lg border border-gray-100 flex items-center justify-center gap-2">
                <span className="uppercase font-bold tracking-wider text-[10px]">Intervalo de Dados:</span>
                <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">{new Date(filters.startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                até
                <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">{new Date(filters.endDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
            </div>
        </div>
    );
};

export default FilterBar;

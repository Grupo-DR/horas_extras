
import React, { useState, useEffect } from 'react';
import { Search, RotateCcw, Filter, CalendarDays, Building2, Briefcase, SlidersHorizontal, ArrowRightLeft } from 'lucide-react';
import { formatDateForApi, formatDateForInput } from '../utils/formatters';

export interface FilterState {
    startDate: string;
    endDate: string;
    searchTerm: string;
    type: string;
    costCenter: string;
    function: string;
    year: string;
    month: string;
    dateMode: 'CALENDAR' | 'PAYROLL';
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

    const calculateDates = (yearStr: string, monthStr: string, mode: 'CALENDAR' | 'PAYROLL') => {
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);

        if (mode === 'CALENDAR') {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0);
            return {
                startDate: formatDateForApi(`${year}-${String(month).padStart(2, '0')}-01`),
                endDate: formatDateForApi(`${year}-${String(month).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`)
            };
        } else {
            // Competência Pagamento: 21 do mês anterior até 20 do mês atual
            // Ex: Comp Março (3) -> 21/02 a 20/03
            const end = new Date(year, month - 1, 20); // 20 do mês atual
            const start = new Date(year, month - 2, 21); // 21 do mês anterior

            const startY = start.getFullYear();
            const startM = String(start.getMonth() + 1).padStart(2, '0');
            const startD = String(start.getDate()).padStart(2, '0');

            const endY = end.getFullYear();
            const endM = String(end.getMonth() + 1).padStart(2, '0');
            const endD = String(end.getDate()).padStart(2, '0');

            return {
                startDate: formatDateForApi(`${startY}-${startM}-${startD}`),
                endDate: formatDateForApi(`${endY}-${endM}-${endD}`)
            };
        }
    };

    const handleChange = (key: keyof FilterState, value: string) => {
        setFilters(prev => {
            const next = { ...prev, [key]: value };

            // Se mudar Ano, Mês ou Modo, recalcula as datas exatas
            if (key === 'year' || key === 'month' || key === 'dateMode') {
                const { startDate, endDate } = calculateDates(next.year, next.month, next.dateMode as 'CALENDAR' | 'PAYROLL');
                return { ...next, startDate, endDate };
            }

            return next;
        });
    };

    // Efeito inicial para garantir datas sincronizadas
    useEffect(() => {
        const { startDate, endDate } = calculateDates(filters.year, filters.month, filters.dateMode);
        setFilters(prev => ({ ...prev, startDate, endDate }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-5">

            <div className="flex items-center justify-between pb-4 border-b border-gray-50">
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <Filter size={16} className="text-blue-600" />
                    Filtros e Seleção de Período
                </h3>
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => handleChange('dateMode', 'PAYROLL')}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${filters.dateMode === 'PAYROLL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        title="De 21 a 20"
                    >
                        <ArrowRightLeft size={12} /> Competência (Folha)
                    </button>
                    <button
                        onClick={() => handleChange('dateMode', 'CALENDAR')}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${filters.dateMode === 'CALENDAR' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        title="De 1 a 30/31"
                    >
                        <CalendarDays size={12} /> Calendário (Civil)
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* Date Controls */}
                <div className="lg:col-span-1 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ano</label>
                    <select
                        value={filters.year}
                        onChange={(e) => handleChange('year', e.target.value)}
                        className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/50"
                    >
                        {options.years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                <div className="lg:col-span-1 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mês</label>
                    <select
                        value={filters.month}
                        onChange={(e) => handleChange('month', e.target.value)}
                        className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/50"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={String(m).padStart(2, '0')}>
                                {new Date(0, m - 1).toLocaleString('pt-BR', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Filters */}
                <div className="lg:col-span-1 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Building2 size={10} /> Centro de Custo
                    </label>
                    <select
                        value={filters.costCenter}
                        onChange={(e) => handleChange('costCenter', e.target.value)}
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
                        onChange={(e) => handleChange('function', e.target.value)}
                        className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                        <option value="">Todas</option>
                        {options.functions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>

                {/* Search */}
                <div className="lg:col-span-1 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Search size={10} /> Buscar
                    </label>
                    <input
                        type="text"
                        placeholder="Nome ou Chapa..."
                        value={filters.searchTerm}
                        onChange={(e) => handleChange('searchTerm', e.target.value)}
                        className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
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
        </div>
    );
};

export default FilterBar;

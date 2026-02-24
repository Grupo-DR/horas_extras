import React from 'react';
import { RotateCcw, CalendarDays, Building2, Briefcase, CalendarRange, ArrowRightLeft, CalendarClock, MapPin } from 'lucide-react';

export interface FilterState {
    startDate: string;
    endDate: string;
    searchTerm: string;
    type: string;
    costCenter: string;
    function: string;
    regional: string;
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
        regionals: string[];
    };
    onClear: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, setFilters, options, onClear }) => {

    const calculateDates = (yearStr: string, monthStr: string, mode: FilterState['dateMode']) => {
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        if (mode === 'ANNUAL') return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
        if (mode === 'CALENDAR') {
            const lastDay = new Date(year, month, 0).getDate();
            return {
                startDate: `${year}-${String(month).padStart(2, '0')}-01`,
                endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
            };
        }
        if (mode === 'PAYROLL') {
            const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return { startDate: fmt(new Date(year, month - 2, 21)), endDate: fmt(new Date(year, month - 1, 20)) };
        }
        return { startDate: filters.startDate, endDate: filters.endDate };
    };

    const handleModeChange = (newMode: FilterState['dateMode']) => {
        setFilters(prev => ({ ...prev, dateMode: newMode, ...calculateDates(prev.year, prev.month, newMode) }));
    };

    const handleYearMonthChange = (key: 'year' | 'month', value: string) => {
        setFilters(prev => {
            const next = { ...prev, [key]: value };
            return prev.dateMode !== 'CUSTOM' ? { ...next, ...calculateDates(next.year, next.month, prev.dateMode) } : next;
        });
    };

    const getMonthLabel = (m: number) => {
        const name = new Date(0, m - 1).toLocaleString('pt-BR', { month: 'long' });
        if (filters.dateMode === 'PAYROLL') {
            const prev = new Date(0, m - 2).toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
            return `${name} (21/${prev} a 20/${name.substring(0, 3)})`;
        }
        return name;
    };

    const sel = "h-7 px-2 border border-gray-200 rounded-md text-[11px] text-gray-700 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all";
    const divider = <div className="h-4 w-px bg-gray-200 shrink-0" />;

    return (
        <div className="bg-white px-3 py-2 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar">

                {/* Botões de modo */}
                <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-md shrink-0">
                    {([
                        { mode: 'PAYROLL' as const, icon: <ArrowRightLeft size={10} />, label: 'Competência (Folha)', active: 'text-blue-600' },
                        { mode: 'CALENDAR' as const, icon: <CalendarDays size={10} />, label: 'Mês Civil', active: 'text-emerald-600' },
                        { mode: 'ANNUAL' as const, icon: <CalendarClock size={10} />, label: 'Anual', active: 'text-purple-600' },
                        { mode: 'CUSTOM' as const, icon: <CalendarRange size={10} />, label: 'Personalizado', active: 'text-orange-600' },
                    ]).map(({ mode, icon, label, active }) => (
                        <button
                            key={mode}
                            onClick={() => handleModeChange(mode)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap transition-all flex items-center gap-1 ${filters.dateMode === mode ? `bg-white shadow-sm ${active}` : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {icon} {label}
                        </button>
                    ))}
                </div>

                {divider}

                {/* Controles de Data */}
                {filters.dateMode === 'CUSTOM' ? (
                    <div className="flex items-center gap-1 border border-orange-200 rounded-md bg-orange-50/30 px-2 h-7 shrink-0">
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                            className="text-[11px] font-bold text-gray-700 bg-transparent border-none focus:outline-none w-[118px]"
                        />
                        <span className="text-gray-400 text-[10px] font-bold">→</span>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                            className="text-[11px] font-bold text-gray-700 bg-transparent border-none focus:outline-none w-[118px]"
                        />
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <select value={filters.year} onChange={(e) => handleYearMonthChange('year', e.target.value)} className={sel}>
                            {options.years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        {filters.dateMode !== 'ANNUAL' && (
                            <select value={filters.month} onChange={(e) => handleYearMonthChange('month', e.target.value)} className={sel + ' max-w-[160px]'}>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={String(m).padStart(2, '0')}>{getMonthLabel(m)}</option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {divider}

                {/* Regional */}
                <div className="flex items-center gap-1 shrink-0">
                    <MapPin size={11} className="text-gray-400 shrink-0" />
                    <select value={filters.regional} onChange={(e) => setFilters(prev => ({ ...prev, regional: e.target.value, costCenter: '' }))} className={sel}>
                        <option value="">Todas</option>
                        {options.regionals.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>

                {/* Centro de Custo */}
                <div className="flex items-center gap-1 shrink-0">
                    <Building2 size={11} className="text-gray-400 shrink-0" />
                    <select value={filters.costCenter} onChange={(e) => setFilters(prev => ({ ...prev, costCenter: e.target.value }))} className={sel}>
                        <option value="">Todos</option>
                        {options.costCenters.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                    </select>
                </div>

                {/* Função */}
                <div className="flex items-center gap-1 shrink-0">
                    <Briefcase size={11} className="text-gray-400 shrink-0" />
                    <select value={filters.function} onChange={(e) => setFilters(prev => ({ ...prev, function: e.target.value }))} className={sel}>
                        <option value="">Todas</option>
                        {options.functions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>

                {/* Botão Limpar */}
                <button
                    onClick={onClear}
                    className="h-7 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors flex items-center gap-1.5 shrink-0"
                >
                    <RotateCcw size={11} /> Limpar
                </button>
            </div>
        </div>
    );
};

export default FilterBar;

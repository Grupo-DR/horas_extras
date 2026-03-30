import React from 'react';
import { RotateCcw, Building2, Briefcase, CalendarRange, ArrowRightLeft, CalendarClock, MapPin } from 'lucide-react';

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

type ActiveDateMode = 'PAYROLL' | 'ANNUAL' | 'CUSTOM';

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

const normalizeDateMode = (mode: FilterState['dateMode']): ActiveDateMode =>
    mode === 'ANNUAL' || mode === 'CUSTOM' ? mode : 'PAYROLL';

const formatDateInput = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const calculateDates = (
    yearStr: string,
    monthStr: string,
    mode: FilterState['dateMode'],
    currentDates: Pick<FilterState, 'startDate' | 'endDate'>
) => {
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (mode === 'ANNUAL') {
        return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
    }

    if (mode === 'PAYROLL' || mode === 'CALENDAR') {
        return {
            startDate: formatDateInput(new Date(year, month - 2, 21)),
            endDate: formatDateInput(new Date(year, month - 1, 20)),
        };
    }

    return currentDates;
};

const FilterBar: React.FC<FilterBarProps> = ({ filters, setFilters, options, onClear }) => {
    const currentMode = normalizeDateMode(filters.dateMode);

    React.useEffect(() => {
        if (filters.dateMode !== 'CALENDAR') return;

        setFilters(prev => {
            if (prev.dateMode !== 'CALENDAR') return prev;

            return {
                ...prev,
                dateMode: 'PAYROLL',
                ...calculateDates(prev.year, prev.month, 'PAYROLL', prev),
            };
        });
    }, [filters.dateMode, setFilters]);

    const handleModeChange = (newMode: ActiveDateMode) => {
        setFilters(prev => ({
            ...prev,
            dateMode: newMode,
            ...calculateDates(prev.year, prev.month, newMode, {
                startDate: prev.startDate,
                endDate: prev.endDate,
            }),
        }));
    };

    const handleYearMonthChange = (key: 'year' | 'month', value: string) => {
        setFilters(prev => {
            const next = { ...prev, [key]: value };
            return normalizeDateMode(prev.dateMode) !== 'CUSTOM'
                ? { ...next, ...calculateDates(next.year, next.month, prev.dateMode, next) }
                : next;
        });
    };

    const getMonthLabel = (monthNumber: number) => {
        const name = new Date(0, monthNumber - 1).toLocaleString('pt-BR', { month: 'long' });
        if (currentMode === 'PAYROLL') {
            const previous = new Date(0, monthNumber - 2).toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
            return `${name} (21/${previous} a 20/${name.substring(0, 3)})`;
        }
        return name;
    };

    const sel = 'h-7 px-2 border border-gray-200 rounded-md text-[11px] text-gray-700 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all';
    const divider = <div className="h-4 w-px bg-gray-200 shrink-0" />;
    const modeButtons = [
        { mode: 'PAYROLL' as const, icon: <ArrowRightLeft size={10} />, label: 'Compet\u00eancia (Folha)', active: 'text-blue-600' },
        { mode: 'ANNUAL' as const, icon: <CalendarClock size={10} />, label: 'Anual', active: 'text-purple-600' },
        { mode: 'CUSTOM' as const, icon: <CalendarRange size={10} />, label: 'Personalizado', active: 'text-orange-600' },
    ];

    return (
        <div className="bg-white px-3 py-2 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-md shrink-0">
                    {modeButtons.map(({ mode, icon, label, active }) => (
                        <button
                            key={mode}
                            onClick={() => handleModeChange(mode)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap transition-all flex items-center gap-1 ${currentMode === mode ? `bg-white shadow-sm ${active}` : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {icon} {label}
                        </button>
                    ))}
                </div>

                {divider}

                {currentMode === 'CUSTOM' ? (
                    <div className="flex items-center gap-1 border border-orange-200 rounded-md bg-orange-50/30 px-2 h-7 shrink-0">
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                            className="text-[11px] font-bold text-gray-700 bg-transparent border-none focus:outline-none w-[118px]"
                        />
                        <span className="text-gray-400 text-[10px] font-bold">-&gt;</span>
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
                            {options.years.map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                        {currentMode !== 'ANNUAL' && (
                            <select value={filters.month} onChange={(e) => handleYearMonthChange('month', e.target.value)} className={sel + ' max-w-[160px]'}>
                                {Array.from({ length: 12 }, (_, index) => index + 1).map(monthNumber => (
                                    <option key={monthNumber} value={String(monthNumber).padStart(2, '0')}>
                                        {getMonthLabel(monthNumber)}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {divider}

                <div className="flex items-center gap-1 shrink-0">
                    <MapPin size={11} className="text-gray-400 shrink-0" />
                    <select value={filters.regional} onChange={(e) => setFilters(prev => ({ ...prev, regional: e.target.value, costCenter: '' }))} className={sel}>
                        <option value="">Todas</option>
                        {options.regionals.map(regional => <option key={regional} value={regional}>{regional}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <Building2 size={11} className="text-gray-400 shrink-0" />
                    <select value={filters.costCenter} onChange={(e) => setFilters(prev => ({ ...prev, costCenter: e.target.value }))} className={sel}>
                        <option value="">Todos</option>
                        {options.costCenters.map(costCenter => <option key={costCenter} value={costCenter}>{costCenter}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <Briefcase size={11} className="text-gray-400 shrink-0" />
                    <select value={filters.function} onChange={(e) => setFilters(prev => ({ ...prev, function: e.target.value }))} className={sel}>
                        <option value="">Todas</option>
                        {options.functions.map(func => <option key={func} value={func}>{func}</option>)}
                    </select>
                </div>

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

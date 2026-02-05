
import React from 'react';
import { Search, Filter, Calendar, Briefcase, Building2, Clock, X, CalendarDays, CalendarRange } from 'lucide-react';

export interface FilterState {
  searchTerm: string;
  startDate: string;
  endDate: string;
  selectedFunction: string;
  selectedCostCenter: string;
  selectedEvent: string;
  selectedYear: string;
  selectedMonth: string;
  periodMode: 'CALENDAR' | 'PAYROLL';
}

interface FilterBarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  options: {
    functions: string[];
    costCenters: string[];
    events: string[];
  };
  onClear: () => void;
}

const MONTH_OPTIONS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const YEAR_OPTIONS = [
  { value: '2023', label: '2023' },
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
];

const FilterBar: React.FC<FilterBarProps> = ({ filters, setFilters, options, onClear }) => {
  
  const calculateDates = (yearStr: string, monthStr: string, mode: 'CALENDAR' | 'PAYROLL') => {
    if (!yearStr || !monthStr) return { start: '', end: '' };
    const year = parseInt(yearStr);
    const month = parseInt(monthStr); // 1-12
    
    if (mode === 'CALENDAR') {
      const lastDay = new Date(year, month, 0).getDate();
      return {
        start: `${year}-${monthStr.padStart(2, '0')}-01`,
        end: `${year}-${monthStr.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      };
    } else {
      // Mês Folha: 21 do mês anterior ao 20 do mês atual
      const prevDate = new Date(year, month - 2, 21);
      const currDate = new Date(year, month - 1, 20);
      
      const format = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      return {
        start: format(prevDate),
        end: format(currDate)
      };
    }
  };

  const handleChange = (key: keyof FilterState, value: string) => {
    if (key === 'periodMode') {
      const mode = value as 'CALENDAR' | 'PAYROLL';
      const { start, end } = calculateDates(filters.selectedYear, filters.selectedMonth, mode);
      setFilters(prev => ({
        ...prev,
        periodMode: mode,
        startDate: start || prev.startDate,
        endDate: end || prev.endDate
      }));
      return;
    }

    if (key === 'selectedMonth') {
      if (value && filters.selectedYear) {
        const { start, end } = calculateDates(filters.selectedYear, value, filters.periodMode);
        setFilters(prev => ({
          ...prev,
          selectedMonth: value,
          startDate: start,
          endDate: end
        }));
      } else {
        setFilters(prev => ({ 
          ...prev, 
          selectedMonth: '',
          startDate: '',
          endDate: ''
        }));
      }
      return;
    }

    if (key === 'selectedYear') {
      if (value) {
        const monthToUse = filters.selectedMonth || '';
        const { start, end } = calculateDates(value, monthToUse, filters.periodMode);
        setFilters(prev => ({ 
          ...prev, 
          selectedYear: value, 
          startDate: monthToUse ? start : '', 
          endDate: monthToUse ? end : '' 
        }));
      } else {
        setFilters(prev => ({ ...prev, selectedYear: '', selectedMonth: '', startDate: '', endDate: '' }));
      }
      return;
    }

    if (key === 'startDate' || key === 'endDate') {
      setFilters(prev => ({ ...prev, [key]: value, selectedMonth: '' }));
      return;
    }

    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const isMonthSelected = !!filters.selectedMonth;
  const isYearSelected = !!filters.selectedYear;
  const isManualDateActive = (!!filters.startDate || !!filters.endDate) && !isMonthSelected;

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center space-x-2 mb-4 text-gray-700">
        <Filter size={18} />
        <span className="font-semibold text-sm uppercase tracking-wider">Painel de Filtros Avançados</span>
        <div className="flex-1" />
        <button 
          onClick={onClear}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors font-bold uppercase"
        >
          <X size={14} />
          <span>Limpar Filtros</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9 gap-4">
        {/* Novo Filtro: Modo de Período */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <CalendarRange size={16} className="text-blue-500" />
          </div>
          <select
            className="w-full pl-9 pr-3 py-2 text-[11px] border border-blue-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-blue-50/30 font-bold text-blue-800 uppercase tracking-tight"
            value={filters.periodMode}
            onChange={(e) => handleChange('periodMode', e.target.value)}
          >
            <option value="CALENDAR">Mês Civil (01-31)</option>
            <option value="PAYROLL">Mês Folha (21-20)</option>
          </select>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <CalendarDays size={16} className="text-gray-400" />
          </div>
          <select
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white font-medium"
            value={filters.selectedYear}
            onChange={(e) => handleChange('selectedYear', e.target.value)}
          >
            <option value="">Ano (Todos)</option>
            {YEAR_OPTIONS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
          </select>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <CalendarDays size={16} className="text-gray-400" />
          </div>
          <select
            className={`w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white font-medium ${(isManualDateActive || !isYearSelected) ? 'bg-gray-50 opacity-50 cursor-not-allowed' : ''}`}
            value={filters.selectedMonth}
            onChange={(e) => handleChange('selectedMonth', e.target.value)}
            disabled={isManualDateActive || !isYearSelected}
          >
            <option value="">Mês (Todos)</option>
            {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Calendar size={16} className="text-gray-400" />
          </div>
          <input
            type="date"
            className={`w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 font-mono ${isMonthSelected ? 'bg-gray-100 opacity-50 cursor-not-allowed' : ''}`}
            value={filters.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            disabled={isMonthSelected}
          />
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Calendar size={16} className="text-gray-400" />
          </div>
          <input
            type="date"
            className={`w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 font-mono ${isMonthSelected ? 'bg-gray-100 opacity-50 cursor-not-allowed' : ''}`}
            value={filters.endDate}
            onChange={(e) => handleChange('endDate', e.target.value)}
            disabled={isMonthSelected}
          />
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Nome ou Chapa..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
            value={filters.searchTerm}
            onChange={(e) => handleChange('searchTerm', e.target.value)}
          />
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Building2 size={16} className="text-gray-400" />
          </div>
          <select
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white truncate"
            value={filters.selectedCostCenter}
            onChange={(e) => handleChange('selectedCostCenter', e.target.value)}
          >
            <option value="">C. Custo (Todos)</option>
            {options.costCenters.map(cc => <option key={cc} value={cc}>{cc}</option>)}
          </select>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Briefcase size={16} className="text-gray-400" />
          </div>
          <select
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white truncate"
            value={filters.selectedFunction}
            onChange={(e) => handleChange('selectedFunction', e.target.value)}
          >
            <option value="">Função (Todas)</option>
            {options.functions.map(fn => <option key={fn} value={fn}>{fn}</option>)}
          </select>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Clock size={16} className="text-gray-400" />
          </div>
          <select
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white truncate"
            value={filters.selectedEvent}
            onChange={(e) => handleChange('selectedEvent', e.target.value)}
          >
            <option value="">Evento (Todos)</option>
            {options.events.map(evt => <option key={evt} value={evt}>{evt}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;

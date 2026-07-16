import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';
import { SSMADashboardFilters } from '../../hooks/useSSMADashboard';
import { SSMACostCenter, SSMARegional } from '../../types';

interface Props {
    filters: SSMADashboardFilters;
    setFilters: (f: SSMADashboardFilters) => void;
    regionals: SSMARegional[];
    costCenters: SSMACostCenter[];
}

const currentCompetence = () => new Date().toISOString().slice(0, 7);

const generateRecentMonths = (count = 24) => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        months.push(`${y}-${m}`);
    }
    return months;
};

const formatMonth = (yyyyMM: string) => {
    const [yyyy, mm] = yyyyMM.split('-');
    const date = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
    const formatted = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

export const DashboardFilters: React.FC<Props> = ({ filters, setFilters, regionals, costCenters }) => {
    const [isMonthsOpen, setIsMonthsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const filteredCostCenters = costCenters.filter(costCenter => !filters.regionalId || costCenter.regionalId === filters.regionalId);
    
    const recentMonths = generateRecentMonths(24);
    const selectedMonths = filters.competences || [currentCompetence()];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsMonthsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleMonth = (month: string) => {
        const isSelected = selectedMonths.includes(month);
        let newSelection;
        if (isSelected) {
            newSelection = selectedMonths.filter(m => m !== month);
            if (newSelection.length === 0) newSelection = [currentCompetence()]; // Prevent empty
        } else {
            newSelection = [...selectedMonths, month].sort((a, b) => b.localeCompare(a));
        }
        setFilters({ ...filters, competences: newSelection });
    };

    return (
        <div className="grid gap-3 rounded border border-gray-200 bg-white p-3 md:grid-cols-4">
            <label className="space-y-1 relative" ref={dropdownRef}>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Competências</span>
                
                <button
                    type="button"
                    onClick={() => setIsMonthsOpen(!isMonthsOpen)}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm bg-white flex items-center justify-between hover:border-gray-400 focus:outline-none"
                >
                    <span className="truncate pr-2">
                        {selectedMonths.length === 1 
                            ? formatMonth(selectedMonths[0]) 
                            : `${selectedMonths.length} meses selecionados`}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {isMonthsOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                        <div className="p-1 space-y-0.5">
                            {recentMonths.map(month => {
                                const isSelected = selectedMonths.includes(month);
                                return (
                                    <label
                                        key={month}
                                        className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-slate-50 text-slate-700'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={isSelected}
                                            onChange={() => toggleMonth(month)}
                                        />
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}>
                                            {isSelected && <Check className="w-3 h-3" />}
                                        </div>
                                        <span className="truncate">{formatMonth(month)}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}
            </label>
            <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Regional</span>
                <select
                    value={filters.regionalId || ''}
                    onChange={event => setFilters({ ...filters, regionalId: event.target.value || undefined, costCenterId: undefined })}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                >
                    <option value="">Todas</option>
                    {regionals.map(regional => <option key={regional.id} value={regional.id}>{regional.name}</option>)}
                </select>
            </label>
            <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Obra</span>
                <select
                    value={filters.costCenterId || ''}
                    onChange={event => setFilters({ ...filters, costCenterId: event.target.value || undefined })}
                    className="h-10 w-full rounded border border-gray-300 px-3 text-sm"
                >
                    <option value="">Todas</option>
                    {filteredCostCenters.map(costCenter => <option key={costCenter.id} value={costCenter.id}>{costCenter.code} - {costCenter.name}</option>)}
                </select>
            </label>
            <div className="flex items-end">
                <button
                    type="button"
                    onClick={() => setFilters({ competences: [currentCompetence()] })}
                    className="h-10 rounded border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                    Limpar filtros
                </button>
            </div>
        </div>
    );
};


import React, { useMemo } from 'react';
import { PlanningRecord, SalaryAllocation, OvertimeRecord } from '../types';
import { formatDecimalHours, parseTimeToDecimal } from '../utils/formatters';
import { AlertTriangle } from 'lucide-react';

interface PlanningTableProps {
    employees: Array<{
        chapa: string;
        nome: string;
        regional: string;
        cc: string;
    }>;
    plans: Record<string, number>; // Key: chapa_YYYY-MM-DD or chapa (monthly)
    salaries: Record<string, number>;
    mode: 'MONTHLY' | 'DAILY';
    periodStart: Date;
    periodEnd: Date;
    weekDays?: Date[]; // For daily view
    onPlanChange: (chapa: string, dateKey: string, value: string) => void;
    onEmployeeClick: (emp: { nome: string; chapa: string }) => void;
    readOnly?: boolean;
}

const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const PlanningTable: React.FC<PlanningTableProps> = ({
    employees,
    plans,
    salaries,
    mode,
    periodStart,
    periodEnd,
    weekDays,
    onPlanChange,
    onEmployeeClick,
    readOnly = false
}) => {

    const calculatePersonStats = (chapa: string) => {
        let totalHours = 0;
        let totalValue = 0;
        const salary = salaries[chapa];

        if (mode === 'MONTHLY') {
            totalHours = plans[chapa] || 0;
            if (salary) totalValue = (salary / 220) * 1.6 * totalHours;
        } else {
            const curr = new Date(periodStart);
            while (curr <= periodEnd) {
                const key = `${chapa}_${formatDateKey(curr)}`;
                const hours = plans[key] || 0;
                totalHours += hours;

                if (salary && hours > 0) {
                    const isSunday = curr.getDay() === 0;
                    const baseHour = salary / 220;
                    const multiplier = isSunday ? 2.0 : 1.6;
                    totalValue += baseHour * multiplier * hours;
                }
                curr.setDate(curr.getDate() + 1);
            }
        }
        return { totalHours, totalValue };
    };

    if (employees.length === 0) {
        return <div className="p-8 text-center text-gray-400 text-sm">Nenhum colaborador nesta equipe.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-[10px] tracking-widest border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-4 w-64">Colaborador</th>
                        {mode === 'MONTHLY' ? (
                            <th className="px-6 py-4 text-center">Horas Planejadas</th>
                        ) : (
                            weekDays?.map(day => {
                                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                const isSunday = day.getDay() === 0;
                                const isOutsidePeriod = day < periodStart || day > periodEnd;
                                return (
                                    <th key={day.toISOString()} className={`px-2 py-4 text-center min-w-[60px] border-r border-gray-200 ${isSunday ? 'bg-red-50 text-red-800' : isWeekend ? 'bg-orange-50 text-orange-800' : ''} ${isOutsidePeriod ? 'opacity-30' : ''}`}>
                                        <div className="flex flex-col">
                                            <span>{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                                            <span className="font-normal opacity-60">{day.getDate()}</span>
                                        </div>
                                    </th>
                                );
                            })
                        )}
                        <th className="px-6 py-4 text-center bg-gray-100 text-gray-800 min-w-[100px] border-l border-gray-200">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {employees.map(emp => {
                        const stats = calculatePersonStats(emp.chapa);
                        const exceedsLimit = stats.totalHours > 44;

                        return (
                            <tr key={emp.chapa} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-3 border-r border-gray-100">
                                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onEmployeeClick(emp)}>
                                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            {emp.nome.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-gray-900 truncate max-w-[180px] group-hover:text-blue-600 transition-colors">{emp.nome}</div>
                                            <div className="text-[9px] text-gray-400 font-mono uppercase tracking-tighter">
                                                {emp.chapa} • {emp.cc}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {mode === 'MONTHLY' ? (
                                    <td className="px-6 py-3 text-center">
                                        <input
                                            type="text"
                                            placeholder="00:00"
                                            disabled={readOnly}
                                            onBlur={(e) => onPlanChange(emp.chapa, '', e.target.value)}
                                            defaultValue={formatDecimalHours(plans[emp.chapa])}
                                            key={`monthly-${plans[emp.chapa]}`}
                                            className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-center font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 disabled:bg-gray-100"
                                        />
                                    </td>
                                ) : (
                                    weekDays?.map(day => {
                                        const dateKey = formatDateKey(day);
                                        const rawVal = plans[`${emp.chapa}_${dateKey}`];
                                        const isSunday = day.getDay() === 0;
                                        const isOutsidePeriod = day < periodStart || day > periodEnd;
                                        return (
                                            <td key={dateKey} className={`px-1 py-3 text-center border-r border-gray-100 ${isSunday ? 'bg-red-50/20' : ''}`}>
                                                <input
                                                    type="text"
                                                    placeholder="-"
                                                    disabled={isOutsidePeriod || readOnly}
                                                    onBlur={(e) => onPlanChange(emp.chapa, dateKey, e.target.value)}
                                                    defaultValue={rawVal !== undefined ? formatDecimalHours(rawVal) : ''}
                                                    key={`${dateKey}-${rawVal}`}
                                                    className={`w-12 border rounded px-1 py-1 text-center font-mono text-[11px] focus:ring-2 focus:ring-blue-500 outline-none transition-all ${rawVal ? (isSunday ? 'border-red-300 bg-red-50 ring-1 ring-red-100' : 'border-blue-300 bg-blue-50 ring-1 ring-blue-100') : 'border-gray-200'} ${isOutsidePeriod ? 'opacity-20 cursor-not-allowed bg-gray-50' : ''}`}
                                                />
                                            </td>
                                        );
                                    })
                                )}

                                <td className={`px-4 py-3 text-center bg-gray-50 border-l border-gray-100 ${exceedsLimit ? 'bg-red-50' : ''}`}>
                                    <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-1">
                                            <span className={`font-bold font-mono text-sm ${exceedsLimit ? 'text-red-600' : 'text-gray-800'}`}>
                                                {formatDecimalHours(stats.totalHours)}
                                            </span>
                                            {exceedsLimit && (
                                                <span title="Acima de 44h">
                                                    <AlertTriangle size={12} className="text-red-600" />
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] font-bold text-emerald-600 font-mono mt-1">
                                            R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

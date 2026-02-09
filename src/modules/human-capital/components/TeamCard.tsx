import React, { useMemo, useState } from 'react';
import { WorkTeam } from '../types';
import { PlanningTable } from './PlanningTable';
import { Calculator, Clock, UserPlus, Trash2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDecimalHours } from '../utils/formatters';

interface TeamCardProps {
    team: WorkTeam;
    employees: Array<{
        chapa: string;
        nome: string;
        regional: string;
        cc: string;
    }>;
    plans: Record<string, number>;
    salaries: Record<string, number>;
    mode: 'MONTHLY' | 'DAILY';
    periodStart: Date;
    periodEnd: Date;
    weekDays: Date[];
    onPlanChange: (chapa: string, dateKey: string, value: string) => void;
    onEmployeeClick: (emp: { nome: string; chapa: string }) => void;
    onAddMember: (teamId: string) => void;
    onDeleteTeam: (teamId: string) => void;
}

export const TeamCard: React.FC<TeamCardProps> = ({
    team,
    employees,
    plans,
    salaries,
    mode,
    periodStart,
    periodEnd,
    weekDays,
    onPlanChange,
    onEmployeeClick,
    onAddMember,
    onDeleteTeam
}) => {
    const [expanded, setExpanded] = useState(true);

    const stats = useMemo(() => {
        let totalHours = 0;
        let totalCost = 0;
        let hasComplianceIssue = false;

        employees.forEach(emp => {
            let empHours = 0;
            let empCost = 0;
            const salary = salaries[emp.chapa];

            if (mode === 'MONTHLY') {
                empHours = plans[emp.chapa] || 0;
                if (salary) empCost = (salary / 220) * 1.6 * empHours;
            } else {
                const curr = new Date(periodStart);
                while (curr <= periodEnd) {
                    const dateKey = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
                    const key = `${emp.chapa}_${dateKey}`;
                    const hours = plans[key] || 0;
                    empHours += hours;

                    if (salary && hours > 0) {
                        const isSunday = curr.getDay() === 0;
                        const baseHour = salary / 220;
                        const multiplier = isSunday ? 2.0 : 1.6;
                        empCost += baseHour * multiplier * hours;
                    }
                    curr.setDate(curr.getDate() + 1);
                }
            }

            totalHours += empHours;
            totalCost += empCost;

            if (empHours > 44) hasComplianceIssue = true;
        });

        return { totalHours, totalCost, hasComplianceIssue };
    }, [employees, plans, salaries, mode, periodStart, periodEnd]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md mb-6">
            <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-4 flex-1">
                    <div className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-400">
                        {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-gray-800">{team.name}</h3>
                            {stats.hasComplianceIssue && (
                                <span title="Atenção: Limites excedidos nesta equipe" className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                    <AlertTriangle size={10} /> Check
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 font-mono flex items-center gap-2 mt-0.5">
                            <span className="font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{team.costCenter}</span>
                            <span>• Gestor: {team.managerName || 'N/A'}</span>
                            <span>• {employees.length} membros</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6" onClick={e => e.stopPropagation()}>
                    <div className="text-right flex flex-col items-end">
                        <p className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1"><Clock size={10} /> Horas</p>
                        <p className="font-mono font-bold text-lg text-gray-700 leading-none">{formatDecimalHours(stats.totalHours)}</p>
                    </div>
                    <div className="text-right border-l border-gray-200 pl-6 flex flex-col items-end min-w-[100px]">
                        <p className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1"><Calculator size={10} /> Custo</p>
                        <p className="font-mono font-bold text-lg text-emerald-600 leading-none">R$ {stats.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                        <button onClick={() => onAddMember(team.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Adicionar Membro">
                            <UserPlus size={18} />
                        </button>
                        <button
                            onClick={() => {
                                if (window.confirm('Tem certeza que deseja excluir esta equipe?')) {
                                    onDeleteTeam(team.id);
                                }
                            }}
                            className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                            title="Excluir Equipe"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="border-t border-gray-100 bg-white">
                    <PlanningTable
                        employees={employees}
                        plans={plans}
                        salaries={salaries}
                        mode={mode}
                        periodStart={periodStart}
                        periodEnd={periodEnd}
                        weekDays={weekDays}
                        onPlanChange={onPlanChange}
                        onEmployeeClick={onEmployeeClick}
                    />
                </div>
            )}
        </div>
    );
};

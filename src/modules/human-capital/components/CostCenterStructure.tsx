import React, { useMemo, useState } from 'react';
import { HeadcountRecord } from '../types';
import { Users, DollarSign, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { getCCRegional, normalizeCC } from '../data/ccMaster';
import { getSalariesSync } from '../services/planning';

interface Props {
  headcountRecords: HeadcountRecord[];
  costCenterFilter?: string;
  regionalFilter?: string;
  roleFilter?: string;
  periodStart?: Date;
  periodEnd?: Date;
  selectedMonth: string;
}

interface EmployeeStat {
  chapa: string;
  nome: string;
  baseSalary: number | null;
  allocation: number | null;
  proportionalSalary: number | null;
}

interface RoleStats {
  role: string;
  headcount: number;
  salary: number;
  employees: EmployeeStat[];
}

interface CCStats {
  costCenter: string;
  roles: RoleStats[];
  totalHeadcount: number;
  totalSalary: number;
}

export default function CostCenterStructure({ headcountRecords, costCenterFilter, regionalFilter, roleFilter, periodStart, periodEnd, selectedMonth }: Props) {
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  const toggleRole = (cc: string, role: string) => {
    const key = `${cc}-${role}`;
    setExpandedRoles(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const data = useMemo(() => {
    const ccMap = new Map<string, Map<string, RoleStats>>();

    const startStr = periodStart ? periodStart.toISOString().split('T')[0] : null;
    const endStr = periodEnd ? periodEnd.toISOString().split('T')[0] : null;

    // Fetch salaries for the selected month
    const salaries = getSalariesSync(selectedMonth);
    const salaryMap = new Map<string, number>();
    salaries.forEach(s => salaryMap.set(s.chapa, s.salary));

    const normalizeRoleStr = (s?: string) => s ? s.trim().replace(/\s+/g, ' ') : 'Não Informado';
    
    // Filter records based on active period and cost center
    const activeRecords = headcountRecords.filter(record => {
      const ccNorm = normalizeCC(record.centroCusto);
      const recRole = normalizeRoleStr(record.funcao);
      if (getCCRegional(ccNorm) === 'Sede') return false;
      if (regionalFilter && getCCRegional(ccNorm) !== regionalFilter) return false;
      if (costCenterFilter && ccNorm !== normalizeCC(costCenterFilter)) return false;
      
      const roleFilterNorm = roleFilter ? normalizeRoleStr(roleFilter).toLowerCase() : null;
      if (roleFilterNorm && recRole.toLowerCase() !== roleFilterNorm) return false;
      
      if (startStr && record.dataFim < startStr) return false;
      if (endStr && record.dataInicio > endStr) return false;
      return true;
    });

    activeRecords.forEach(record => {
      const cc = record.centroCusto || 'Sem CC';
      const role = normalizeRoleStr(record.funcao);
      const alloc = record.distribuicao != null ? record.distribuicao : null;
      
      const parsedRecordSalary = Number(record.salario);
      const fallbackSalary = isNaN(parsedRecordSalary) ? null : parsedRecordSalary;
      const baseSalary = salaryMap.get(record.chapa) ?? fallbackSalary;
      const salary = (baseSalary !== null && alloc !== null) ? baseSalary * alloc : null;

      if (!ccMap.has(cc)) {
        ccMap.set(cc, new Map());
      }
      const roleMap = ccMap.get(cc)!;
      if (!roleMap.has(role)) {
        roleMap.set(role, { role, headcount: 0, salary: 0, employees: [] });
      }
      
      const stats = roleMap.get(role)!;
      if (alloc !== null) {
        stats.headcount += alloc;
      }
      if (salary !== null) {
        stats.salary += salary;
      }

      stats.employees.push({
        chapa: record.chapa,
        nome: record.nome || 'Não informado',
        baseSalary,
        allocation: alloc,
        proportionalSalary: salary
      });
    });

    const result: CCStats[] = [];
    ccMap.forEach((roleMap, cc) => {
      const roles = Array.from(roleMap.values()).sort((a, b) => b.headcount - a.headcount);
      const totalHeadcount = roles.reduce((sum, r) => sum + r.headcount, 0);
      const totalSalary = roles.reduce((sum, r) => sum + r.salary, 0);
      result.push({ costCenter: cc, roles, totalHeadcount, totalSalary });
    });

    return result.sort((a, b) => b.totalHeadcount - a.totalHeadcount);
  }, [headcountRecords, costCenterFilter, regionalFilter, roleFilter, periodStart, periodEnd, selectedMonth]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-200">
        <Users className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-700">Sem dados de estrutura</h3>
        <p className="text-slate-500 mt-2 text-center max-w-md">
          Não há registros de headcount ativos. Por favor, faça o upload dos dados na aba Configurações.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-blue-600" />
          Estrutura dos Centros de Custo
        </h2>
        
        <div className="space-y-6">
          {data.map(cc => (
            <div key={cc.costCenter} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-lg">{cc.costCenter}</h3>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">
                      {cc.totalHeadcount.toFixed(1)} HC
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">
                      {cc.totalSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-0">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-3 font-medium">Cargo</th>
                      <th className="px-6 py-3 font-medium text-right w-32">Headcount</th>
                      <th className="px-6 py-3 font-medium text-right w-48">Salário (Proporcional)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cc.roles.map(role => {
                      const isExpanded = expandedRoles.has(`${cc.costCenter}-${role.role}`);
                      return (
                        <React.Fragment key={role.role}>
                          <tr 
                            onClick={() => toggleRole(cc.costCenter, role.role)}
                            className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                          >
                            <td className="px-6 py-3 font-medium text-slate-700 flex items-center gap-2">
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />}
                              {role.role}
                            </td>
                            <td className="px-6 py-3 text-right text-slate-600 font-semibold">{role.headcount.toFixed(1)}</td>
                            <td className="px-6 py-3 text-right text-slate-600">
                              {role.salary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/30">
                              <td colSpan={3} className="px-6 py-4">
                                <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 text-slate-500 uppercase">
                                      <tr>
                                        <th className="px-4 py-2 font-medium">Nome (Chapa)</th>
                                        <th className="px-4 py-2 font-medium text-right">Salário Base</th>
                                        <th className="px-4 py-2 font-medium text-right">Alocação</th>
                                        <th className="px-4 py-2 font-medium text-right">Valor Alocado</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {role.employees.map(emp => (
                                        <tr key={emp.chapa} className="hover:bg-slate-50">
                                          <td className="px-4 py-2 font-medium text-slate-700">
                                            {emp.nome} <span className="text-slate-400 font-normal">({emp.chapa})</span>
                                          </td>
                                          <td className="px-4 py-2 text-right text-slate-600">
                                            {emp.baseSalary !== null ? emp.baseSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                          </td>
                                          <td className="px-4 py-2 text-right text-slate-600">
                                            {emp.allocation !== null ? `${(emp.allocation * 100).toFixed(0)}%` : '-'}
                                          </td>
                                          <td className="px-4 py-2 text-right text-slate-600 font-medium">
                                            {emp.proportionalSalary !== null ? emp.proportionalSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

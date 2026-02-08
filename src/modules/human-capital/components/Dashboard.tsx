
import React, { useMemo, useState } from 'react';
import { OvertimeRecord, UserProfile, PlanningRecord, BudgetRecord, SalaryRecord } from '../types';
import { Clock, Briefcase, TrendingUp, Wallet, Calculator, Search, Building2, AlertTriangle, Moon, Sun, Scale, Percent, ArrowUpRight, ArrowDownRight, X, User, DollarSign, ListFilter } from 'lucide-react';
import { formatDecimalHours } from '../utils/formatters';
import { getAllPlanningRecords, getBudgets, getSalaries } from '../services/planning';

interface DashboardProps {
  data: OvertimeRecord[];
}

type ViewMode = 'hours' | 'finance';

const HierarchySection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 px-1">
      <div className="h-4 w-1 bg-blue-600 rounded-full"></div>
      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{title}</h4>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {children}
    </div>
  </div>
);

const StatsCard: React.FC<{ 
  title: string; 
  value: string; 
  subValue?: React.ReactNode; 
  icon: React.ReactNode; 
  color: string;
  comparison?: {
    label: string;
    value: string;
    percent?: number;
    isOver?: boolean;
  }
}> = ({ title, value, subValue, icon, color, comparison }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between transition-all hover:shadow-md h-full">
    <div className="flex items-center space-x-4 mb-4">
      <div className={`p-3 rounded-xl ${color} text-white shadow-lg shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{title}</p>
        <h3 className="text-xl font-bold text-gray-800 font-mono truncate">{value}</h3>
      </div>
      {comparison && comparison.percent !== undefined && (
        <div className={`shrink-0 flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg ${comparison.isOver ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {comparison.isOver ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
          {comparison.percent.toFixed(1)}%
        </div>
      )}
    </div>
    
    <div className="pt-3 border-t border-gray-50">
      {subValue ? (
        <div className="text-xs font-medium text-gray-500 w-full space-y-1">{subValue}</div>
      ) : comparison ? (
        <div className="flex flex-col">
          <p className="text-[9px] text-gray-400 font-bold uppercase">{comparison.label}</p>
          <p className="text-sm font-bold text-gray-700 font-mono">{comparison.value}</p>
        </div>
      ) : <div className="h-5" />}
    </div>
  </div>
);

const FunctionDetailModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    functionName: string;
    employees: { name: string; chapa: string; hours: number }[];
}> = ({ isOpen, onClose, functionName, employees }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="bg-blue-600 p-6 flex justify-between items-center text-white shrink-0 relative z-30">
                    <div>
                        <h3 className="text-xl font-bold">{functionName}</h3>
                        <p className="text-blue-100 text-sm opacity-90">Colaboradores vinculados a esta função</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto bg-white flex-1">
                    <table className="w-full text-left text-sm text-gray-600 border-collapse">
                        <thead className="sticky top-0 z-20 shadow-sm">
                            <tr className="bg-gray-100">
                                <th className="px-6 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Colaborador</th>
                                <th className="px-6 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Chapa</th>
                                <th className="px-6 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200 text-right">Horas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employees.map((emp, idx) => (
                                <tr key={emp.chapa + idx} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-gray-900">{emp.name}</td>
                                    <td className="px-6 py-3 font-mono text-gray-400 text-xs">{emp.chapa}</td>
                                    <td className="px-6 py-3 text-right font-bold font-mono text-blue-600">{formatDecimalHours(emp.hours)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{employees.length} COLABORADORES NA LISTA</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Total de Horas:</span>
                        <span className="text-lg font-bold text-gray-900 font-mono">
                            {formatDecimalHours(employees.reduce((acc, curr) => acc + curr.hours, 0))}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CostCenterDetailModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    ccName: string;
    ccCode: string;
    data: { name: string; real: number; planned: number; realCost: number; plannedCost: number }[];
    viewMode: ViewMode;
}> = ({ isOpen, onClose, ccName, ccCode, data, viewMode }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="bg-indigo-600 p-6 flex justify-between items-center text-white shrink-0 relative z-30">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold">{ccName}</h3>
                            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-mono">{ccCode}</span>
                        </div>
                        <p className="text-indigo-100 text-sm opacity-90">Breakdown por Funções</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto bg-white flex-1">
                    <table className="w-full text-left text-sm text-gray-600 border-collapse">
                        <thead className="sticky top-0 z-20 shadow-sm">
                            <tr className="bg-gray-100">
                                <th className="px-6 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Função</th>
                                {viewMode === 'hours' ? (
                                    <>
                                        <th className="px-6 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Plan.</th>
                                        <th className="px-6 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Real</th>
                                        <th className="px-6 py-4 text-center text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Plan. x Real</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Custo Plan.</th>
                                        <th className="px-6 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Custo Real</th>
                                        <th className="px-6 py-4 text-center text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Plan. x Real (R$)</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.map((item, idx) => {
                                const diffHours = item.planned - item.real;
                                const diffCost = item.plannedCost - item.realCost;
                                return (
                                    <tr key={item.name + idx} className="hover:bg-indigo-50/50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-gray-900">{item.name}</td>
                                        {viewMode === 'hours' ? (
                                            <>
                                                <td className="px-6 py-3 text-right font-mono text-gray-400">{formatDecimalHours(item.planned)}</td>
                                                <td className="px-6 py-3 text-right font-mono font-bold text-gray-800">{formatDecimalHours(item.real)}</td>
                                                <td className="px-6 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${diffHours < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {diffHours > 0 ? `+${formatDecimalHours(diffHours)}` : formatDecimalHours(diffHours)}
                                                    </span>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-3 text-right font-mono text-blue-600">R$ {item.plannedCost.toLocaleString('pt-BR')}</td>
                                                <td className="px-6 py-3 text-right font-mono font-bold text-gray-800">R$ {item.realCost.toLocaleString('pt-BR')}</td>
                                                <td className="px-6 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${diffCost < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        R$ {diffCost.toLocaleString('pt-BR')}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <Briefcase size={14} className="text-gray-400" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{data.length} FUNÇÕES NESTE CENTRO DE CUSTO</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const [ccSearch, setCcSearch] = useState('');
  const [funcSearch, setFuncSearch] = useState('');
  const [selectedFuncModal, setSelectedFuncModal] = useState<string | null>(null);
  const [selectedCcModal, setSelectedCcModal] = useState<string | null>(null);
  const [ccViewMode, setCcViewMode] = useState<ViewMode>('hours');
  const [funcViewMode, setFuncViewMode] = useState<ViewMode>('hours');

  const planningRecords = useMemo(() => getAllPlanningRecords(), []);
  const budgets = useMemo(() => getBudgets(), []);
  const salariesMap = useMemo(() => {
    const map: Record<string, number> = {};
    getSalaries().forEach(s => map[s.chapa] = s.salary);
    return map;
  }, []);

  const metrics = useMemo(() => {
    let realHE60Hours = 0;
    let realHE100Hours = 0;
    let realInterHours = 0;
    let realAdicNoturnoHours = 0;
    
    let realValue60 = 0;
    let realValue100 = 0;
    let realValueAdicNoturno = 0;

    data.forEach(r => {
      const hours = Number(r.HORAS) || 0;
      const evt = (r.EVENTO || '').toUpperCase();
      const sal = salariesMap[r.CHAPA] || 0;
      const baseHour = sal / 220;

      if (evt.includes('EXTRA')) {
        if (evt.includes('60')) {
          realHE60Hours += hours;
          realValue60 += baseHour * 1.6 * hours;
        } else if (evt.includes('100')) {
          realHE100Hours += hours;
          realValue100 += baseHour * 2.0 * hours;
        }
      } else if (evt.includes('INTER')) {
        realInterHours += hours;
      } else if (evt.includes('NOTURNO') || evt.includes('20')) {
        realAdicNoturnoHours += hours;
        realValueAdicNoturno += baseHour * 0.2 * hours;
      }
    });

    const totalRealValueHE = realValue60 + realValue100;
    const realValueDSR = totalRealValueHE / 6; 
    const totalRealCost = totalRealValueHE + realValueAdicNoturno + realValueDSR;

    let totalPlannedHours = 0;
    let totalPlannedValue = 0;

    planningRecords.forEach(p => {
      if (p.type === 'DAILY') {
        totalPlannedHours += p.plannedHours;
        const sal = salariesMap[p.chapa];
        if (sal && p.plannedHours > 0) {
          const isSunday = new Date(p.date).getDay() === 0;
          totalPlannedValue += (sal / 220) * (isSunday ? 2.0 : 1.6) * p.plannedHours;
        }
      }
    });

    const totalBudget = budgets.reduce((acc, b) => acc + b.value, 0);

    return {
      realHE60Hours,
      realHE100Hours,
      realTotalHE: realHE60Hours + realHE100Hours,
      realInterHours,
      realAdicNoturnoHours,
      realValueAdicNoturno,
      realValueDSR,
      totalRealCost,
      totalPlannedHours,
      totalPlannedValue,
      totalBudget
    };
  }, [data, planningRecords, budgets, salariesMap]);

  const ccSummary = useMemo(() => {
    const map: Record<string, { real: number; planned: number; name: string; realCost: number; plannedCost: number; budget: number }> = {};
    
    const currentMonth = new Date().toLocaleString('pt-BR', { month: 'long' });
    budgets.forEach(b => {
        if (!map[b.costCenter]) map[b.costCenter] = { real: 0, planned: 0, name: 'Sem Nome', realCost: 0, plannedCost: 0, budget: 0 };
        if (b.month.toLowerCase() === currentMonth.toLowerCase()) {
            map[b.costCenter].budget += b.value;
        }
    });

    data.forEach(r => {
      const cc = r.CODCCUSTO || 'S/ CC';
      if (!map[cc]) map[cc] = { real: 0, planned: 0, name: r.SECAO || 'Sem Nome', realCost: 0, plannedCost: 0, budget: 0 };
      const hours = (Number(r.HORAS) || 0);
      map[cc].real += hours;
      const sal = salariesMap[r.CHAPA] || 0;
      if (sal) {
          const isSunday = new Date(r.DATA).getDay() === 0;
          map[cc].realCost += (sal / 220) * (isSunday ? 2.0 : 1.6) * hours;
      }
    });
    
    planningRecords.forEach(p => {
      const cc = p.costCenter || 'S/ CC';
      if (!map[cc]) map[cc] = { real: 0, planned: 0, name: 'Sem Nome', realCost: 0, plannedCost: 0, budget: 0 };
      map[cc].planned += p.plannedHours;
      const sal = salariesMap[p.chapa];
      if (sal && p.plannedHours > 0) {
          const isSunday = new Date(p.date).getDay() === 0;
          map[cc].plannedCost += (sal / 220) * (isSunday ? 2.0 : 1.6) * p.plannedHours;
      }
    });

    const list = Object.entries(map).map(([cc, s]) => ({ cc, ...s }))
      .sort((a, b) => b.real - a.real);
    return ccSearch ? list.filter(x => x.cc.includes(ccSearch) || x.name.toLowerCase().includes(ccSearch.toLowerCase())) : list;
  }, [data, planningRecords, ccSearch, budgets, salariesMap]);

  const funcSummary = useMemo(() => {
    const map: Record<string, { real: number; planned: number; realCost: number; plannedCost: number }> = {};
    const chapaToFunc: Record<string, string> = {};

    data.forEach(r => {
      const f = r.FUNCAO || 'S/ Função';
      chapaToFunc[r.CHAPA] = f;
      if (!map[f]) map[f] = { real: 0, planned: 0, realCost: 0, plannedCost: 0 };
      const hours = (Number(r.HORAS) || 0);
      map[f].real += hours;
      const sal = salariesMap[r.CHAPA] || 0;
      if (sal) {
          const isSunday = new Date(r.DATA).getDay() === 0;
          map[f].realCost += (sal / 220) * (isSunday ? 2.0 : 1.6) * hours;
      }
    });

    planningRecords.forEach(p => {
      const f = chapaToFunc[p.chapa] || 'Indefinido';
      if (!map[f]) map[f] = { real: 0, planned: 0, realCost: 0, plannedCost: 0 };
      map[f].planned += p.plannedHours;
      const sal = salariesMap[p.chapa];
      if (sal && p.plannedHours > 0) {
          const isSunday = new Date(p.date).getDay() === 0;
          map[f].plannedCost += (sal / 220) * (isSunday ? 2.0 : 1.6) * p.plannedHours;
      }
    });

    const list = Object.entries(map).map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.real - a.real);

    return funcSearch ? list.filter(x => x.name.toLowerCase().includes(funcSearch.toLowerCase())) : list;
  }, [data, planningRecords, funcSearch, salariesMap]);

  const funcDetailData = useMemo(() => {
    if (!selectedFuncModal) return [];
    const empMap: Record<string, { name: string; hours: number }> = {};
    data.filter(r => r.FUNCAO === selectedFuncModal).forEach(r => {
        if (!empMap[r.CHAPA]) empMap[r.CHAPA] = { name: r.NOME, hours: 0 };
        empMap[r.CHAPA].hours += (Number(r.HORAS) || 0);
    });
    return Object.entries(empMap).map(([chapa, info]) => ({ chapa, ...info }))
        .sort((a, b) => b.hours - a.hours);
  }, [data, selectedFuncModal]);

  const ccDetailData = useMemo(() => {
    if (!selectedCcModal) return [];
    const map: Record<string, { real: number; planned: number; realCost: number; plannedCost: number }> = {};
    const chapaToFunc: Record<string, string> = {};

    // Get real functions for this CC
    data.filter(r => r.CODCCUSTO === selectedCcModal).forEach(r => {
        const f = r.FUNCAO || 'S/ Função';
        chapaToFunc[r.CHAPA] = f;
        if (!map[f]) map[f] = { real: 0, planned: 0, realCost: 0, plannedCost: 0 };
        const hours = (Number(r.HORAS) || 0);
        map[f].real += hours;
        const sal = salariesMap[r.CHAPA] || 0;
        if (sal) {
            const isSunday = new Date(r.DATA).getDay() === 0;
            map[f].realCost += (sal / 220) * (isSunday ? 2.0 : 1.6) * hours;
        }
    });

    // Get planned functions for this CC
    planningRecords.filter(p => p.costCenter === selectedCcModal).forEach(p => {
        const f = chapaToFunc[p.chapa] || 'S/ Função';
        if (!map[f]) map[f] = { real: 0, planned: 0, realCost: 0, plannedCost: 0 };
        map[f].planned += p.plannedHours;
        const sal = salariesMap[p.chapa];
        if (sal && p.plannedHours > 0) {
            const isSunday = new Date(p.date).getDay() === 0;
            map[f].plannedCost += (sal / 220) * (isSunday ? 2.0 : 1.6) * p.plannedHours;
        }
    });

    return Object.entries(map).map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.real - a.real);
  }, [data, planningRecords, selectedCcModal, salariesMap]);

  const ToggleButtons = ({ mode, setMode }: { mode: ViewMode, setMode: (m: ViewMode) => void }) => (
    <div className="flex bg-gray-200 p-1 rounded-xl h-9">
        <button 
            onClick={() => setMode('hours')}
            className={`flex items-center gap-2 px-4 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${mode === 'hours' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <Clock size={12} /> Horas
        </button>
        <button 
            onClick={() => setMode('finance')}
            className={`flex items-center gap-2 px-4 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${mode === 'finance' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <DollarSign size={12} /> Financeiro
        </button>
    </div>
  );

  return (
    <div className="space-y-10">
      <FunctionDetailModal 
        isOpen={!!selectedFuncModal} 
        onClose={() => setSelectedFuncModal(null)} 
        functionName={selectedFuncModal || ''}
        employees={funcDetailData}
      />

      <CostCenterDetailModal 
        isOpen={!!selectedCcModal} 
        onClose={() => setSelectedCcModal(null)} 
        ccName={ccSummary.find(c => c.cc === selectedCcModal)?.name || ''}
        ccCode={selectedCcModal || ''}
        data={ccDetailData}
        viewMode={ccViewMode}
      />

      {/* Nível 01: Financeiro */}
      <HierarchySection title="Nível 01: Financeiro">
        <StatsCard 
          title="Budget Total" 
          value={`R$ ${metrics.totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<Wallet size={20} />} 
          color="bg-indigo-600"
          subValue={
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-400 uppercase">Custo Planejado:</span>
                <span className="text-blue-600 font-mono">R$ {metrics.totalPlannedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-400 uppercase">Custo Real (Est.):</span>
                <span className="text-emerald-600 font-mono">R$ {metrics.totalRealCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          }
        />
        <StatsCard 
          title="Custo Planejado" 
          value={`R$ ${metrics.totalPlannedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<TrendingUp size={20} />} 
          color="bg-blue-600"
          comparison={{
            label: "Saldo vs Budget",
            value: `R$ ${(metrics.totalBudget - metrics.totalPlannedValue).toLocaleString('pt-BR')}`,
            percent: metrics.totalBudget > 0 ? (metrics.totalPlannedValue / metrics.totalBudget) * 100 : 0,
            isOver: metrics.totalPlannedValue > metrics.totalBudget
          }}
        />
        <StatsCard 
          title="Custo Real (Est.)" 
          value={`R$ ${metrics.totalRealCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<Calculator size={20} />} 
          color="bg-emerald-600"
          comparison={{
            label: "Saldo Final Budget",
            value: `R$ ${(metrics.totalBudget - metrics.totalRealCost).toLocaleString('pt-BR')}`,
            percent: metrics.totalBudget > 0 ? (metrics.totalRealCost / metrics.totalBudget) * 100 : 0,
            isOver: metrics.totalRealCost > metrics.totalBudget
          }}
        />
      </HierarchySection>

      {/* Nível 02: Horas Extras */}
      <HierarchySection title="Nível 02: Horas Extras">
        <StatsCard 
          title="Soma Total Horas (60+100)" 
          value={formatDecimalHours(metrics.realTotalHE)} 
          icon={<Clock size={20} />} 
          color="bg-slate-700"
          comparison={{
            label: "Comparativo Planejado",
            value: formatDecimalHours(metrics.totalPlannedHours),
            percent: metrics.totalPlannedHours > 0 ? (metrics.realTotalHE / metrics.totalPlannedHours) * 100 : 0,
            isOver: metrics.realTotalHE > metrics.totalPlannedHours
          }}
        />
        <StatsCard 
          title="H.E. 60%" 
          value={formatDecimalHours(metrics.realHE60Hours)} 
          icon={<Percent size={20} />} 
          color="bg-blue-500"
          subValue={`${((metrics.realHE60Hours / (metrics.realTotalHE || 1)) * 100).toFixed(1)}% do real total`}
        />
        <StatsCard 
          title="H.E. 100%" 
          value={formatDecimalHours(metrics.realHE100Hours)} 
          icon={<AlertTriangle size={20} />} 
          color="bg-red-500"
          subValue={`${((metrics.realHE100Hours / (metrics.realTotalHE || 1)) * 100).toFixed(1)}% do real total`}
        />
      </HierarchySection>

      {/* Nível 03: Específicos */}
      <HierarchySection title="Nível 03: Específicos">
        <StatsCard 
          title="Interjornada" 
          value={formatDecimalHours(metrics.realInterHours)} 
          icon={<Scale size={20} />} 
          color="bg-amber-500"
          subValue="Horas de descanso não cumpridas"
        />
        <StatsCard 
          title="Adicional Noturno" 
          value={`R$ ${metrics.realValueAdicNoturno.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<Moon size={20} />} 
          color="bg-purple-600"
          subValue={
            <div className="flex justify-between font-bold text-[10px]">
              <span>HORAS NOTURNAS:</span>
              <span className="font-mono">{formatDecimalHours(metrics.realAdicNoturnoHours)}</span>
            </div>
          }
        />
        <StatsCard 
          title="DSR (Reflexo HE)" 
          value={`R$ ${metrics.realValueDSR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<Sun size={20} />} 
          color="bg-orange-500"
          subValue="Base: 1/6 do valor total de HE"
        />
      </HierarchySection>

      {/* Main Tables */}
      <div className="space-y-8 pt-4">
        {/* Cost Center Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-all">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <Building2 size={16} className="text-blue-500" />
                        RESUMO POR CENTRO DE CUSTO (CC)
                    </h3>
                    <ToggleButtons mode={ccViewMode} setMode={setCcViewMode} />
                </div>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                    <input 
                      type="text" 
                      placeholder="Filtrar CC ou Descrição..." 
                      className="pl-7 pr-2 py-1 text-[10px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={ccSearch}
                      onChange={(e) => setCcSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="w-full">
                <table className="w-full text-left text-xs text-gray-600">
                    <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[9px] sticky top-0 z-10">
                        {ccViewMode === 'hours' ? (
                            <tr>
                                <th className="px-6 py-4">Código CC</th>
                                <th className="px-6 py-4">Nome / Descrição</th>
                                <th className="px-6 py-4 text-right">Horas Plan.</th>
                                <th className="px-6 py-4 text-right">Horas Real</th>
                                <th className="px-6 py-4 text-center">Plan. x Real</th>
                            </tr>
                        ) : (
                            <tr>
                                <th className="px-6 py-4">Código CC</th>
                                <th className="px-6 py-4">Nome / Descrição</th>
                                <th className="px-6 py-4 text-right">Budget</th>
                                <th className="px-6 py-4 text-right">Planejado (R$)</th>
                                <th className="px-6 py-4 text-right">Real (R$)</th>
                                <th className="px-6 py-4 text-center">Plan. x Real (R$)</th>
                            </tr>
                        )}
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {ccSummary.map((item) => {
                            const diffHours = item.planned - item.real;
                            const diffCost = item.plannedCost - item.realCost;
                            
                            return (
                                <tr 
                                    key={item.cc} 
                                    className="hover:bg-blue-50 cursor-pointer transition-colors group"
                                    onClick={() => setSelectedCcModal(item.cc)}
                                >
                                    <td className="px-6 py-3 font-mono font-medium text-gray-900 group-hover:text-blue-600">{item.cc}</td>
                                    <td className="px-6 py-3 font-medium text-gray-500 group-hover:text-blue-600 flex items-center gap-2">
                                        <span>{item.name}</span>
                                        <ListFilter size={12} className="opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity shrink-0" />
                                    </td>
                                    
                                    {ccViewMode === 'hours' ? (
                                        <>
                                            <td className="px-6 py-3 text-right font-mono text-gray-400">{formatDecimalHours(item.planned)}</td>
                                            <td className="px-6 py-3 text-right font-mono font-bold text-gray-800">{formatDecimalHours(item.real)}</td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${diffHours < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {diffHours > 0 ? `+${formatDecimalHours(diffHours)}` : formatDecimalHours(diffHours)}
                                                </span>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-3 text-right font-mono text-gray-400">R$ {item.budget.toLocaleString('pt-BR')}</td>
                                            <td className="px-6 py-3 text-right font-mono text-blue-600">R$ {item.plannedCost.toLocaleString('pt-BR')}</td>
                                            <td className="px-6 py-3 text-right font-mono font-bold text-gray-800">R$ {item.realCost.toLocaleString('pt-BR')}</td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${diffCost < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    R$ {diffCost.toLocaleString('pt-BR')}
                                                </span>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase text-center flex items-center justify-center gap-2">
                    <ListFilter size={14} className="text-blue-400"/>
                    Clique no nome de um CC para ver o detalhamento por função
                </p>
            </div>
        </div>

        {/* Function Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-all">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <Briefcase size={16} className="text-indigo-500" />
                        RESUMO POR FUNÇÃO
                    </h3>
                    <ToggleButtons mode={funcViewMode} setMode={setFuncViewMode} />
                </div>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                    <input 
                      type="text" 
                      placeholder="Filtrar Função..." 
                      className="pl-7 pr-2 py-1 text-[10px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={funcSearch}
                      onChange={(e) => setFuncSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="w-full">
                <table className="w-full text-left text-xs text-gray-600">
                    <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[9px] sticky top-0 z-10">
                        {funcViewMode === 'hours' ? (
                            <tr>
                                <th className="px-6 py-4">Função</th>
                                <th className="px-6 py-4 text-right">Plan.</th>
                                <th className="px-6 py-4 text-right">Real</th>
                                <th className="px-6 py-4 text-center">Plan. x Real</th>
                                <th className="px-6 py-4 text-right">% Impacto</th>
                            </tr>
                        ) : (
                            <tr>
                                <th className="px-6 py-4">Função</th>
                                <th className="px-6 py-4 text-right">Custo Plan.</th>
                                <th className="px-6 py-4 text-right">Custo Real</th>
                                <th className="px-6 py-4 text-center">Plan. x Real (R$)</th>
                                <th className="px-6 py-4 text-right">% Impacto (R$)</th>
                            </tr>
                        )}
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {funcSummary.map((item) => {
                            const diffHours = item.planned - item.real;
                            const diffCost = item.plannedCost - item.realCost;

                            return (
                                <tr 
                                    key={item.name} 
                                    className="hover:bg-indigo-50 cursor-pointer transition-colors group"
                                    onClick={() => setSelectedFuncModal(item.name)}
                                >
                                    <td className="px-6 py-4 font-medium text-gray-900 group-hover:text-indigo-600 flex items-center gap-2">
                                        <span>{item.name}</span>
                                        <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity shrink-0" />
                                    </td>
                                    
                                    {funcViewMode === 'hours' ? (
                                        <>
                                            <td className="px-6 py-4 text-right font-mono text-gray-400">{formatDecimalHours(item.planned)}</td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-gray-800">{formatDecimalHours(item.real)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${diffHours < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {diffHours > 0 ? `+${formatDecimalHours(diffHours)}` : formatDecimalHours(diffHours)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded-full">
                                                    {(item.real / (metrics.realTotalHE || 1) * 100).toFixed(1)}%
                                                </span>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4 text-right font-mono text-blue-600">R$ {item.plannedCost.toLocaleString('pt-BR')}</td>
                                            <td className="px-6 py-4 text-right font-mono font-bold text-gray-800">R$ {item.realCost.toLocaleString('pt-BR')}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${diffCost < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    R$ {diffCost.toLocaleString('pt-BR')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                                                    {(item.realCost / (metrics.totalRealCost || 1) * 100).toFixed(1)}%
                                                </span>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase text-center flex items-center justify-center gap-2">
                    <ArrowUpRight size={14} className="text-indigo-400"/>
                    Clique em uma função para ver o detalhamento por colaborador
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;


import React, { useMemo, useState } from 'react';
import { OvertimeRecord, UserProfile, PlanningRecord, BudgetRecord, SalaryRecord } from '../types';
import { Clock, Briefcase, TrendingUp, Wallet, Calculator, Search, Building2, AlertTriangle, Moon, Scale, Percent, ArrowUpRight, ArrowDownRight, X, User, DollarSign, ListFilter, ShieldAlert, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDecimalHours } from '../utils/formatters';
import { getAllPlanningRecords, getBudgetsSync, getSalariesSync } from '../services/planning';
import { getCCName, getCCRegional, normalizeCC } from '../data/ccMaster';

interface DashboardProps {
  data: OvertimeRecord[];              // dados filtrados (regional, CC, etc.)
  allData?: OvertimeRecord[];          // todos os dados do escopo — para resolver nomes de CC via SECAO
  regional?: string;                   // filtro de regional ativo (é applicado no ccSummary)
  /** Todos os monthKeys (YYYY-MM) cobertos pelo período filtrado */
  budgetMonthKeys: string[];
  /** Callback: clique em colaborador no modal de função → navega para aba Histórico */
  onNavigateToEmployee?: (name: string, chapa: string) => void;
}

interface DashboardMetrics {
  headcount: number;
  he60: number;
  he100: number;
  inter: number;
  noturno: number;
  total: number;
  riskIndex: number;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'GLOBAL' | 'REGIONAL' | 'CC';
  metrics: DashboardMetrics;
  children: TreeNode[];
}

type ViewMode = 'hours' | 'finance';


const FunctionDetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  functionName: string;
  employees: { name: string; cc: string; chapa: string; he60: number; he100: number; interjornada: number; night: number }[];
  onNavigateToEmployee: (name: string, chapa: string) => void;
}> = ({ isOpen, onClose, functionName, employees, onNavigateToEmployee }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[85vh]">
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
                <th className="px-4 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">CC</th>
                <th className="px-4 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Chapa</th>
                <th className="px-4 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Colaborador</th>
                <th className="px-4 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200 text-right">Horas 60%</th>
                <th className="px-4 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200 text-right">Horas 100%</th>
                <th className="px-4 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200 text-right">Adic. Noturno</th>
                <th className="px-4 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200 text-right">Interjornada</th>
                <th className="px-4 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200 text-right bg-gray-200/60">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((emp, idx) => (
                <tr key={emp.chapa + idx} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-400 text-xs">{emp.cc}</td>
                  <td className="px-4 py-3 font-mono text-gray-400 text-xs">{emp.chapa}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { onNavigateToEmployee(emp.name, emp.chapa); onClose(); }}
                      className="font-medium text-blue-700 hover:underline hover:text-blue-900 text-left transition-colors group flex items-center gap-1"
                      title="Ver histórico deste colaborador"
                    >
                      {emp.name}
                      <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-blue-600">{formatDecimalHours(emp.he60)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{formatDecimalHours(emp.he100)}</td>
                  <td className="px-4 py-3 text-right font-mono text-purple-600">{formatDecimalHours(emp.night)}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-600">{formatDecimalHours(emp.interjornada)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-800 bg-gray-50">{formatDecimalHours(emp.he60 + emp.he100 + emp.night + emp.interjornada)}</td>
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
            <span className="text-[10px] font-bold text-gray-400 uppercase">Total Geral:</span>
            <span className="text-lg font-bold text-gray-900 font-mono">
              {formatDecimalHours(employees.reduce((acc, curr) => acc + curr.he60 + curr.he100 + curr.interjornada + curr.night, 0))}
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
  data: { name: string; real: number; planned: number; realCost: number; plannedCost: number; he60: number; he100: number; interjornada: number; night: number }[];
  viewMode: ViewMode;
}> = ({ isOpen, onClose, ccName, ccCode, data, viewMode }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[85vh]">
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
                <th className="px-4 py-4 text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Função</th>
                {viewMode === 'hours' ? (
                  <>
                    <th className="px-4 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Plan.</th>
                    <th className="px-4 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Real (Tot.)</th>
                    <th className="px-4 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">HE 60%</th>
                    <th className="px-4 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">HE 100%</th>
                    <th className="px-4 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Adic. Not.</th>
                    <th className="px-4 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Interjorn.</th>
                    <th className="px-4 py-4 text-center text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Plan. x Real</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Custo Plan.</th>
                    <th className="px-4 py-4 text-right text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Custo Real</th>
                    <th className="px-4 py-4 text-center text-gray-700 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">Plan. x Real (R$)</th>
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
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    {viewMode === 'hours' ? (
                      <>
                        <td className="px-4 py-3 text-right font-mono text-gray-400">{formatDecimalHours(item.planned)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">{formatDecimalHours(item.real)}</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-600">{formatDecimalHours(item.he60)}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-600">{formatDecimalHours(item.he100)}</td>
                        <td className="px-4 py-3 text-right font-mono text-purple-600">{formatDecimalHours(item.night)}</td>
                        <td className="px-4 py-3 text-right font-mono text-amber-600">{formatDecimalHours(item.interjornada)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${diffHours < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {diffHours > 0 ? `+${formatDecimalHours(diffHours)}` : formatDecimalHours(diffHours)}
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right font-mono text-blue-600">R$ {item.plannedCost.toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">R$ {item.realCost.toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-3 text-center">
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

const HierarchicalCard: React.FC<{ node: TreeNode; level: number }> = ({ node, level }) => {
  const [isExpanded, setIsExpanded] = React.useState(level === 0);
  const hasChildren = node.children && node.children.length > 0;

  const isGlobal = level === 0;
  const isRegional = level === 1;
  const isCC = level === 2;

  const getIcon = () => {
    if (isGlobal) return <Building2 size={24} className="text-indigo-400" />;
    if (isRegional) return <Briefcase size={20} className="text-blue-500" />;
    return <Building2 size={16} className="text-slate-400" />;
  };

  // Define larguras específicas para formar a pirâmide sem esticar na tela inteira
  const cardWidth = isGlobal ? 'w-full max-w-lg' : isRegional ? 'w-[340px]' : 'w-[300px]';
  const levelClass = isGlobal
    ? "bg-slate-800 text-white border-slate-700 shadow-xl"
    : isRegional
      ? "bg-white text-slate-800 border-slate-200 shadow-md"
      : "bg-slate-50 text-slate-700 border-slate-200 shadow-sm";

  return (
    <div className="flex flex-col items-center w-full animate-fade-in">
      {/* O CARTÃO (NÓ DA PIRÂMIDE) */}
      <div
        className={`rounded-2xl border transition-all duration-300 relative overflow-hidden ${cardWidth} ${levelClass} p-5 ${hasChildren ? 'cursor-pointer hover:shadow-2xl hover:-translate-y-1' : ''}`}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {isGlobal && <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />}

        <div className="flex justify-between items-start gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isGlobal ? 'bg-slate-700/80 shadow-inner' : isRegional ? 'bg-blue-50' : 'bg-white shadow-sm'}`}>
              {getIcon()}
            </div>
            <div>
              <h4 className={`font-bold ${isGlobal ? 'text-xl' : isRegional ? 'text-base' : 'text-sm'}`}>
                {node.name}
              </h4>
              <p className={`text-[10px] mt-0.5 font-bold uppercase tracking-wider ${isGlobal ? 'text-slate-400' : 'text-slate-500'}`}>
                {node.type === 'GLOBAL' ? 'Visão Corporativa' : node.type === 'REGIONAL' ? 'Agrupamento Regional' : 'Centro de Custo'}
              </p>
            </div>
          </div>

          {hasChildren && (
            <div className={`p-1.5 rounded-full transition-transform ${isExpanded ? 'rotate-180' : ''} ${isGlobal ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
              <ChevronDown size={16} />
            </div>
          )}
        </div>

        {/* KPIs Centralizados */}
        <div className={`grid grid-cols-3 gap-2 mt-5 pt-4 border-t ${isGlobal ? 'border-slate-700/50' : 'border-slate-200/60'}`}>
          <div className="flex flex-col items-center text-center gap-1">
            <span className={`text-[9px] uppercase font-bold tracking-wider ${isGlobal ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-1`}>
              <User size={12} /> Efetivo
            </span>
            <span className={`font-mono font-black ${isGlobal ? 'text-xl' : 'text-lg'}`}>{node.metrics.headcount}</span>
          </div>
          <div className="flex flex-col items-center text-center gap-1">
            <span className={`text-[9px] uppercase font-bold tracking-wider ${isGlobal ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-1`}>
              <Clock size={12} /> Horas
            </span>
            <span className={`font-mono font-black ${isGlobal ? 'text-xl' : 'text-lg'}`}>{formatDecimalHours(node.metrics.total)}</span>
          </div>
          <div className="flex flex-col items-center text-center gap-1">
            <span className={`text-[9px] uppercase font-bold tracking-wider ${isGlobal ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-1`}>
              <AlertTriangle size={12} /> Risco
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-black ${node.metrics.riskIndex > 10 ? 'bg-rose-100 text-rose-700' : node.metrics.riskIndex > 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {node.metrics.riskIndex.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* ÁREA EXPANDIDA (OS DEGRAUS DA PIRÂMIDE) */}
      {isExpanded && hasChildren && (
        <div className="flex flex-col items-center w-full mt-2">
          {/* Linha vertical conectando o pai aos filhos */}
          <div className="w-px h-6 bg-slate-300" />

          {/* Contêiner de Filhos: Regionais lado a lado (Row), CCs empilhados (Col) */}
          <div className={`flex ${isGlobal ? 'flex-row flex-wrap justify-center gap-6' : 'flex-col gap-4'}`}>
            {node.children.map(child => (
              <HierarchicalCard key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ data, allData, regional, budgetMonthKeys, onNavigateToEmployee }) => {
  const [ccSearch, setCcSearch] = useState('');
  const [funcSearch, setFuncSearch] = useState('');
  const [selectedFuncModal, setSelectedFuncModal] = useState<string | null>(null);
  const [selectedCcModal, setSelectedCcModal] = useState<string | null>(null);
  const [ccViewMode, setCcViewMode] = useState<ViewMode>('hours');
  const [funcViewMode, setFuncViewMode] = useState<ViewMode>('hours');

  const planningRecords = useMemo(() => getAllPlanningRecords(), []);
  // Filtra budgets pelos monthKeys cobertos pelo período atual
  const budgets = useMemo(() => {
    const all = getBudgetsSync();
    if (!budgetMonthKeys || budgetMonthKeys.length === 0) return all;
    const keySet = new Set(budgetMonthKeys);
    return all.filter(b => keySet.has(b.monthKey));
  }, [budgetMonthKeys]);
  const salariesMap = useMemo(() => {
    const map: Record<string, number> = {};
    getSalariesSync().forEach(s => map[s.chapa] = s.salary);
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

  // normalizeCC e getCCName/getCCRegional agora vem do ccMaster centralizado

  // Lookup SECAO do TOTVS como complemento ao ccMaster (preenche nomes ainda não mapeados)
  const ccSecaoMap = useMemo(() => {
    const map: Record<string, string> = {};
    (allData ?? data).forEach(r => {
      const cc = normalizeCC(r.CODCCUSTO || '');
      if (cc && r.SECAO && !map[cc]) map[cc] = r.SECAO;
    });
    return map;
  }, [allData, data]);

  /** Nome resolvido: ccMaster > TOTVS SECAO > código bruto */
  const resolveName = (rawCC: string): string => {
    const norm = normalizeCC(rawCC);
    const masterName = getCCName(rawCC);
    if (masterName !== rawCC) return masterName; // ccMaster tem o nome
    return ccSecaoMap[norm] || rawCC;             // fallback: SECAO ou o próprio código
  };


  const ccSummary = useMemo(() => {
    const map: Record<string, { real: number; planned: number; name: string; realCost: number; plannedCost: number; budget: number }> = {};

    // Orçamentos: filtrar por regional se ativo
    budgets.forEach(b => {
      const ccRegional = getCCRegional(b.costCenter);
      if (regional && ccRegional !== regional) return; // filtro regional
      const cc = normalizeCC(b.costCenter);
      if (!map[cc]) map[cc] = { real: 0, planned: 0, name: resolveName(b.costCenter), realCost: 0, plannedCost: 0, budget: 0 };
      map[cc].budget += b.value;
    });

    // Dados TOTVS (já filtrados pelo HumanCapitalDashboard)
    data.forEach(r => {
      const cc = normalizeCC(r.CODCCUSTO || 'S/ CC');
      if (!map[cc]) map[cc] = { real: 0, planned: 0, name: resolveName(r.CODCCUSTO || cc), realCost: 0, plannedCost: 0, budget: 0 };
      if (map[cc].name === cc || map[cc].name === 'S/ CC') map[cc].name = resolveName(r.CODCCUSTO || cc);
      const hours = (Number(r.HORAS) || 0);
      const evt = (r.EVENTO || '').toUpperCase();
      const isOvertime = evt.includes('EXTRA') || evt.includes('INTER') || evt.includes('NOTURNO') || evt.includes('20');
      if (isOvertime) {
        map[cc].real += hours;
        const sal = salariesMap[r.CHAPA] || 0;
        if (sal) {
          const isSunday = new Date(r.DATA).getDay() === 0;
          map[cc].realCost += (sal / 220) * (isSunday ? 2.0 : 1.6) * hours;
        }
      }
    });

    // Planejamento: filtrar por regional se ativo
    planningRecords.forEach(p => {
      const ccRegional = getCCRegional(p.costCenter || '');
      if (regional && ccRegional !== regional) return; // filtro regional
      const cc = normalizeCC(p.costCenter || 'S/ CC');
      if (!map[cc]) map[cc] = { real: 0, planned: 0, name: resolveName(p.costCenter || cc), realCost: 0, plannedCost: 0, budget: 0 };
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
  }, [data, planningRecords, ccSearch, budgets, salariesMap, regional, ccSecaoMap]);

  const funcSummary = useMemo(() => {
    const map: Record<string, { real: number; planned: number; realCost: number; plannedCost: number }> = {};
    const chapaToFunc: Record<string, string> = {};

    data.forEach(r => {
      const f = r.FUNCAO || 'S/ Função';
      chapaToFunc[r.CHAPA] = f;
      if (!map[f]) map[f] = { real: 0, planned: 0, realCost: 0, plannedCost: 0 };
      const hours = (Number(r.HORAS) || 0);
      const evt = (r.EVENTO || '').toUpperCase();

      const isOvertime = evt.includes('EXTRA') || evt.includes('INTER') || evt.includes('NOTURNO') || evt.includes('20');
      if (isOvertime) {
        map[f].real += hours;
        const sal = salariesMap[r.CHAPA] || 0;
        if (sal) {
          const isSunday = new Date(r.DATA).getDay() === 0;
          map[f].realCost += (sal / 220) * (isSunday ? 2.0 : 1.6) * hours;
        }
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
    const empMap: Record<string, { name: string; cc: string; he60: number; he100: number; interjornada: number; night: number }> = {};

    data.filter(r => r.FUNCAO === selectedFuncModal).forEach(r => {
      if (!empMap[r.CHAPA]) empMap[r.CHAPA] = { name: r.NOME, cc: r.CODCCUSTO || '-', he60: 0, he100: 0, interjornada: 0, night: 0 };

      const hours = (Number(r.HORAS) || 0);
      const evt = (r.EVENTO || '').toUpperCase();

      if (evt.includes('EXTRA')) {
        if (evt.includes('60')) {
          empMap[r.CHAPA].he60 += hours;
        } else if (evt.includes('100')) {
          empMap[r.CHAPA].he100 += hours;
        }
      } else if (evt.includes('INTER')) {
        empMap[r.CHAPA].interjornada += hours;
      } else if (evt.includes('NOTURNO') || evt.includes('20')) {
        empMap[r.CHAPA].night += hours;
      }
    });

    return Object.entries(empMap).map(([chapa, info]) => ({ chapa, ...info }))
      .sort((a, b) => (b.he60 + b.he100 + b.interjornada + b.night) - (a.he60 + a.he100 + a.interjornada + a.night));
  }, [data, selectedFuncModal]);

  const ccDetailData = useMemo(() => {
    if (!selectedCcModal) return [];
    const map: Record<string, { real: number; planned: number; realCost: number; plannedCost: number; he60: number; he100: number; interjornada: number; night: number }> = {};
    const chapaToFunc: Record<string, string> = {};

    // Get real functions for this CC
    data.filter(r => r.CODCCUSTO === selectedCcModal).forEach(r => {
      const f = r.FUNCAO || 'S/ Função';
      chapaToFunc[r.CHAPA] = f;
      if (!map[f]) map[f] = { real: 0, planned: 0, realCost: 0, plannedCost: 0, he60: 0, he100: 0, interjornada: 0, night: 0 };
      const hours = (Number(r.HORAS) || 0);

      const evt = (r.EVENTO || '').toUpperCase();
      let isOvertime = false;

      if (evt.includes('EXTRA')) {
        isOvertime = true;
        if (evt.includes('60')) map[f].he60 += hours;
        else if (evt.includes('100')) map[f].he100 += hours;
      } else if (evt.includes('INTER')) {
        isOvertime = true;
        map[f].interjornada += hours;
      } else if (evt.includes('NOTURNO') || evt.includes('20')) {
        isOvertime = true;
        map[f].night += hours;
      }

      if (isOvertime) {
        map[f].real += hours;
        const sal = salariesMap[r.CHAPA] || 0;
        if (sal) {
          const isSunday = new Date(r.DATA).getDay() === 0;
          map[f].realCost += (sal / 220) * (isSunday ? 2.0 : 1.6) * hours;
        }
      }
    });

    // Get planned functions for this CC
    planningRecords.filter(p => p.costCenter === selectedCcModal).forEach(p => {
      const f = chapaToFunc[p.chapa] || 'S/ Função';
      if (!map[f]) map[f] = { real: 0, planned: 0, realCost: 0, plannedCost: 0, he60: 0, he100: 0, interjornada: 0, night: 0 };
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

  const hierarchicalData = useMemo(() => {
    const globalMetrics = { headcount: new Set<string>(), he60: 0, he100: 0, inter: 0, noturno: 0, total: 0 };
    const regionalMap = new Map<string, { metrics: any, ccs: Map<string, any> }>();

    data.forEach(r => {
      const rawCC = r.CODCCUSTO || 'S/ CC';
      const cc = normalizeCC(rawCC);
      const ccName = resolveName(rawCC);
      const reg = getCCRegional(rawCC) || 'Sem Regional';
      const hours = Number(r.HORAS) || 0;
      const evt = (r.EVENTO || '').toUpperCase();
      const isHE60 = evt.includes('EXTRA') && evt.includes('60');
      const isHE100 = evt.includes('EXTRA') && evt.includes('100');
      const isInter = evt.includes('INTER');
      const isNoturno = evt.includes('NOTURNO') || evt.includes('20');

      if (!isHE60 && !isHE100 && !isInter && !isNoturno) return;

      // Inicializa Regional
      if (!regionalMap.has(reg)) {
        regionalMap.set(reg, { metrics: { headcount: new Set(), he60: 0, he100: 0, inter: 0, noturno: 0, total: 0 }, ccs: new Map() });
      }
      const regData = regionalMap.get(reg)!;

      // Inicializa CC
      if (!regData.ccs.has(cc)) {
        regData.ccs.set(cc, { name: ccName, metrics: { headcount: new Set(), he60: 0, he100: 0, inter: 0, noturno: 0, total: 0 } });
      }
      const ccData = regData.ccs.get(cc)!;

      // Acumula
      [globalMetrics, regData.metrics, ccData.metrics].forEach(m => {
        m.headcount.add(r.CHAPA);
        if (isHE60) m.he60 += hours;
        if (isHE100) m.he100 += hours;
        if (isInter) m.inter += hours;
        if (isNoturno) m.noturno += hours;
        m.total += hours;
      });
    });

    const calcRisk = (m: any) => ((m.he100 * 2.5) + (m.he60 * 1.0) + (m.inter * 5.0) + (m.noturno * 0.5)) / (m.headcount.size || 1);

    const root: TreeNode = {
      id: 'global', name: 'DR Construtora (Global)', type: 'GLOBAL',
      metrics: { ...globalMetrics, headcount: globalMetrics.headcount.size, riskIndex: calcRisk(globalMetrics) },
      children: Array.from(regionalMap.entries()).map(([regName, regData]) => ({
        id: regName, name: regName, type: 'REGIONAL' as const,
        metrics: { ...regData.metrics, headcount: regData.metrics.headcount.size, riskIndex: calcRisk(regData.metrics) },
        children: Array.from(regData.ccs.entries()).map(([ccCode, ccData]) => ({
          id: ccCode, name: `${ccCode} - ${ccData.name}`, type: 'CC' as const,
          metrics: { ...ccData.metrics, headcount: ccData.metrics.headcount.size, riskIndex: calcRisk(ccData.metrics) },
          children: []
        })).sort((a, b) => b.metrics.riskIndex - a.metrics.riskIndex)
      })).sort((a, b) => b.metrics.riskIndex - a.metrics.riskIndex)
    };

    return [root];
  }, [data]);

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
    <div className="space-y-5">
      <FunctionDetailModal
        isOpen={!!selectedFuncModal}
        onClose={() => setSelectedFuncModal(null)}
        functionName={selectedFuncModal || ''}
        employees={funcDetailData}
        onNavigateToEmployee={onNavigateToEmployee ?? (() => { })}
      />

      <CostCenterDetailModal
        isOpen={!!selectedCcModal}
        onClose={() => setSelectedCcModal(null)}
        ccName={ccSummary.find(c => c.cc === selectedCcModal)?.name || ''}
        ccCode={selectedCcModal || ''}
        data={ccDetailData}
        viewMode={ccViewMode}
      />

      {/* ── 4 MEGA CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* 1. Orçamento */}
        {(() => {
          const budgetM = metrics.totalBudget / 1_000_000;
          const usedPct = metrics.totalBudget > 0 ? Math.min((metrics.totalRealCost / metrics.totalBudget) * 100, 200) : 0;
          const devioPct = metrics.totalBudget > 0 ? ((metrics.totalRealCost - metrics.totalBudget) / metrics.totalBudget) * 100 : 0;
          const isOver = metrics.totalRealCost > metrics.totalBudget;
          return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow"><Wallet size={14} /></div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Orçamento</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${isOver ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {isOver ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {Math.abs(devioPct).toFixed(1)}%
                </span>
              </div>
              <div>
                <p className="text-[9px] text-gray-400 uppercase font-bold">Budget Total</p>
                <p className="text-xl font-black text-gray-900 font-mono leading-tight">
                  R$ {budgetM >= 1 ? `${budgetM.toFixed(2)}M` : metrics.totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase">
                  <span>Custo Real</span>
                  <span className={isOver ? 'text-red-500' : 'text-emerald-600'}>R$ {metrics.totalRealCost.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-1.5 rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(usedPct, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[9px] text-gray-400">
                  <span>Plan: R$ {metrics.totalPlannedValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                  <span>{usedPct.toFixed(0)}% consumido</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 2. Horas Extras */}
        {(() => {
          const devioPct = metrics.totalPlannedHours > 0 ? ((metrics.realTotalHE - metrics.totalPlannedHours) / metrics.totalPlannedHours) * 100 : 0;
          const isOver = metrics.realTotalHE > metrics.totalPlannedHours;
          const pct60 = metrics.realTotalHE > 0 ? (metrics.realHE60Hours / metrics.realTotalHE) * 100 : 0;
          const pct100 = metrics.realTotalHE > 0 ? (metrics.realHE100Hours / metrics.realTotalHE) * 100 : 0;
          return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-700 text-white shadow"><Clock size={14} /></div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Horas Extras</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${isOver ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {isOver ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {Math.abs(devioPct).toFixed(1)}%
                </span>
              </div>
              <div>
                <p className="text-[9px] text-gray-400 uppercase font-bold">Total HE Real</p>
                <p className="text-xl font-black text-gray-900 font-mono leading-tight">{formatDecimalHours(metrics.realTotalHE)}</p>
              </div>
              <div className="space-y-1">
                <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-100">
                  <div className="bg-blue-500 h-full transition-all" style={{ width: `${pct60}%` }} title={`HE 60%: ${pct60.toFixed(1)}%`} />
                  <div className="bg-red-500 h-full transition-all" style={{ width: `${pct100}%` }} title={`HE 100%: ${pct100.toFixed(1)}%`} />
                </div>
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-blue-600">60%: {formatDecimalHours(metrics.realHE60Hours)}</span>
                  <span className="text-red-600">100%: {formatDecimalHours(metrics.realHE100Hours)}</span>
                </div>
                <p className="text-[9px] text-gray-400">Plan: {formatDecimalHours(metrics.totalPlannedHours)}</p>
              </div>
            </div>
          );
        })()}

        {/* 3. Riscos Trabalhistas */}
        {(() => {
          const totalRisk = metrics.realInterHours + metrics.realAdicNoturnoHours;
          return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500 text-white shadow"><ShieldAlert size={14} /></div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Riscos Trabalhistas</span>
                </div>
                {totalRisk > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">
                    {formatDecimalHours(totalRisk)} h
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <Scale size={12} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Interjornada</span>
                  </div>
                  <span className="text-sm font-black text-gray-800 font-mono">{formatDecimalHours(metrics.realInterHours)}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <Moon size={12} className="text-purple-500" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Noturno</span>
                  </div>
                  <span className="text-sm font-black text-gray-800 font-mono">{formatDecimalHours(metrics.realAdicNoturnoHours)}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-1.5">
                    <Calculator size={12} className="text-orange-500" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase">DSR Estimado</span>
                  </div>
                  <span className="text-sm font-black text-orange-600 font-mono">R$ {metrics.realValueDSR.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 4. Eficiência do Planejamento */}
        {(() => {
          const eficiencia = metrics.totalPlannedHours > 0
            ? Math.min((metrics.realTotalHE / metrics.totalPlannedHours) * 100, 200)
            : 0;
          const efColor = eficiencia > 110 ? 'text-red-600' : eficiencia > 90 ? 'text-emerald-600' : 'text-amber-500';
          const barColor = eficiencia > 110 ? 'bg-red-500' : eficiencia > 90 ? 'bg-emerald-500' : 'bg-amber-400';
          const label = eficiencia > 110 ? 'Acima do Planejado' : eficiencia > 90 ? 'Dentro do Esperado' : 'Abaixo do Planejado';
          const budgetEfic = metrics.totalBudget > 0
            ? Math.min((metrics.totalRealCost / metrics.totalBudget) * 100, 200)
            : 0;
          return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-all">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-600 text-white shadow"><Zap size={14} /></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Eficiência</span>
              </div>
              <div>
                <p className="text-[9px] text-gray-400 uppercase font-bold">Eficiência do Planejamento</p>
                <p className={`text-3xl font-black font-mono leading-tight ${efColor}`}>
                  {eficiencia.toFixed(1)}%
                </p>
                <p className="text-[9px] text-gray-400 mt-0.5">{label}</p>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[9px] font-bold text-gray-400 mb-0.5">
                    <span>Horas Real / Planejado</span>
                    <span>{eficiencia.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(eficiencia, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] font-bold text-gray-400 mb-0.5">
                    <span>Custo Real / Budget</span>
                    <span>{budgetEfic.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full transition-all ${budgetEfic > 100 ? 'bg-red-500' : 'bg-violet-500'}`} style={{ width: `${Math.min(budgetEfic, 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      </div>

      {/* Main Hierarchical View */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
            <Building2 size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Visão Executiva (Hierarquia de Operações)</h3>
            <p className="text-sm text-slate-500">Navegue pelos cartões para explorar o detalhamento de horas.</p>
          </div>
        </div>

        <div className="w-full">
          {hierarchicalData.map(node => <HierarchicalCard key={node.id} node={node} level={0} />)}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

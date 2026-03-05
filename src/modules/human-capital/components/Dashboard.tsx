import React, { useMemo, useState } from 'react';
import { OvertimeRecord, UserProfile, PlanningRecord, BudgetRecord, SalaryRecord, WorkTeam, TeamAllocation } from '../types';
import { Clock, Briefcase, TrendingUp, Wallet, Calculator, Search, Building2, AlertTriangle, Moon, Scale, Percent, ArrowUpRight, ArrowDownRight, X, User, Users, DollarSign, ListFilter, ShieldAlert, Zap, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { formatDecimalHours } from '../utils/formatters';
import { getPlanning, getSalariesSync, getBudgetsSync, saveBudgets, getTeamsSync, getTeamAllocationsSync, getTeamAllocations, getAllPlanningRecords } from '../services/planning';
import { getCCName, getCCRegional, normalizeCC } from '../data/ccMaster';

interface DashboardProps {
  data: OvertimeRecord[];              // dados filtrados (regional, CC, etc.)
  allData?: OvertimeRecord[];          // todos os dados do escopo — para resolver nomes de CC via SECAO
  regional?: string;                   // filtro de regional ativo (é applicado no ccSummary)
  /** Todos os monthKeys (YYYY-MM) cobertos pelo período filtrado */
  budgetMonthKeys: string[];
  /** Callback: clique em colaborador no modal de função → navega para aba Histórico */
  onNavigateToEmployee?: (name: string, chapa: string) => void;
  selectedMonth: string;
}

interface DashboardMetrics {
  headcount: number;
  he60: number;
  he100: number;
  inter: number;
  noturno: number;
  total: number;
  totalCost: number;
  riskIndex: number;
  plannedHours: number;
  budgetCost: number;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'GLOBAL' | 'REGIONAL' | 'CC' | 'TEAM' | 'PERSON';
  metrics: DashboardMetrics;
  children: TreeNode[];
  chapa?: string; // Apenas para nós PERSON
}

type ViewMode = 'hours' | 'finance';

const TreeGridHelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative z-10 animate-scale-in">
      <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Building2 size={20} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Entendendo a Visão Analítica Executiva</h3>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>
      <div className="p-6 space-y-5 text-sm text-slate-600 max-h-[70vh] overflow-y-auto">
        <p>Esta tabela (Tree Grid) permite uma auditoria Top-Down (de cima para baixo) dos seus passivos trabalhistas.</p>

        <div className="space-y-3">
          <div className="flex gap-3"><div className="mt-1"><Zap size={18} className="text-indigo-500" /></div><div><strong className="text-slate-800">Visão Operacional:</strong> Focada em descobrir a CAUSA do problema. Mostra as horas planejadas vs reais e o raio-x exato de onde essas horas vieram (60%, 100%, Interjornada ou Noturno).</div></div>

          <div className="flex gap-3"><div className="mt-1"><Wallet size={18} className="text-emerald-500" /></div><div><strong className="text-slate-800">Visão Financeira:</strong> Focada na dor no bolso. Oculta o volume de horas e foca exclusivamente no Custo Estimado e no Budget (Orçamento) disponível.</div></div>

          <div className="flex gap-3"><div className="mt-1"><AlertTriangle size={18} className="text-amber-500" /></div><div>
            <strong className="text-slate-800">Como o Risco é Calculado?</strong> Não é apenas uma soma. É um algoritmo ponderado pela gravidade da infração dividido pelo tamanho da equipa:<br />
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-500">
              <li><strong className="text-slate-700">HE 60%:</strong> Peso 1.0 (Risco Padrão)</li>
              <li><strong className="text-slate-700">HE 100%:</strong> Peso 2.5 (Risco Alto)</li>
              <li><strong className="text-slate-700">Noturno:</strong> Peso 0.5 (Risco Baixo)</li>
              <li><strong className="text-slate-700">Interjornada:</strong> Peso 5.0 (Risco Crítico CLT)</li>
            </ul>
          </div></div>

          <div className="flex gap-3"><div className="mt-1"><span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100">%</span></div><div><strong className="text-slate-800">Impacto %:</strong> Mostra a representatividade daquela linha em relação ao nível superior. Ex: Quantos % da dor de cabeça da Regional Leste vêm da obra X.</div></div>
        </div>
      </div>
      <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 shadow-sm transition-colors">Entendi</button>
      </div>
    </div>
  </div>
);


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

const HierarchicalRow: React.FC<{ node: TreeNode; level: number; parentTotalHours?: number; viewMode: 'financial' | 'operational' }> = ({ node, level, parentTotalHours, viewMode }) => {
  const [isExpanded, setIsExpanded] = React.useState(level === 0);
  const hasChildren = node.children && node.children.length > 0;

  const isGlobal = level === 0;
  const isRegional = level === 1;
  const isCC = level === 2;
  const isTeam = level === 3;

  const getIcon = () => {
    if (isGlobal) return <Building2 size={16} className="text-indigo-600" />;
    if (isRegional) return <Briefcase size={16} className="text-blue-600" />;
    if (isCC) return <Building2 size={16} className="text-slate-500" />;
    if (node.type === 'TEAM') return <Users size={16} className="text-emerald-500" />;
    return <User size={16} className="text-slate-400" />; // PERSON
  };

  const formatCost = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1000000) return (v / 1000000).toFixed(2) + 'M';
    if (abs >= 10000) return (v / 1000).toFixed(1) + 'k';
    return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  };

  // Nó PERSON: folha, sem expansão
  if (node.type === 'PERSON') {
    return (
      <div
        className="flex items-center justify-between py-2 pr-4 border-b border-slate-50 bg-white hover:bg-blue-50/30 transition-colors"
        style={{ paddingLeft: `${(level * 1.5) + 1}rem` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-[250px] mr-4">
          <div className="w-4 flex justify-center shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
          </div>
          <User size={14} className="text-slate-400 shrink-0" />
          <span className="text-xs text-slate-600 truncate" title={node.name}>{node.name}</span>
        </div>
        <div className="flex items-center gap-4 justify-end shrink-0">
          <div className="w-16" />{/* impacto % */}
          <div className="w-16 text-center">
            <span className="text-xs font-mono text-slate-500">1</span>
          </div>
          {viewMode === 'operational' && (
            <div className="w-[240px] flex items-center justify-between border rounded-md px-3 py-1 text-xs font-mono shadow-sm bg-slate-50 border-slate-200">
              <span className="text-slate-400 w-12 text-right">{formatDecimalHours(node.metrics.plannedHours)}</span>
              <span className="text-slate-200">|</span>
              <span className="font-bold text-slate-800 w-12 text-right">{formatDecimalHours(node.metrics.total)}</span>
              <span className={`w-14 text-right font-black ${(node.metrics.total - node.metrics.plannedHours) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {(node.metrics.total - node.metrics.plannedHours) > 0 ? '+' : ''}{formatDecimalHours(node.metrics.total - node.metrics.plannedHours)}
              </span>
            </div>
          )}
          {viewMode === 'financial' ? (
            <div className="w-[280px] flex items-center justify-between border rounded-md px-3 py-1 text-xs font-mono shadow-sm bg-emerald-50/50 border-emerald-100">
              <span className="text-slate-500 w-16 text-right">R$ {formatCost(node.metrics.budgetCost)}</span>
              <span className="text-emerald-200">|</span>
              <span className="font-bold text-emerald-900 w-16 text-right">R$ {formatCost(node.metrics.totalCost)}</span>
              <span className={`w-16 text-right font-black ${(node.metrics.totalCost - node.metrics.budgetCost) > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                {(node.metrics.totalCost - node.metrics.budgetCost) > 0 ? '+' : ''}{formatCost(node.metrics.totalCost - node.metrics.budgetCost)}
              </span>
            </div>
          ) : (
            <div className="w-[280px] flex items-center justify-between border rounded-md px-2 py-1 text-[10px] font-mono shadow-sm bg-indigo-50/40 border-indigo-100">
              <div className="flex flex-col items-center w-1/4 border-r border-indigo-100/50"><span className="text-indigo-500 font-bold mb-0.5 uppercase text-[8px]">60%</span><span className="font-black text-slate-700">{formatDecimalHours(node.metrics.he60)}</span></div>
              <div className="flex flex-col items-center w-1/4 border-r border-indigo-100/50"><span className="text-rose-400 font-bold mb-0.5 uppercase text-[8px]">100%</span><span className="font-black text-slate-700">{formatDecimalHours(node.metrics.he100)}</span></div>
              <div className="flex flex-col items-center w-1/4 border-r border-indigo-100/50"><span className="text-amber-500 font-bold mb-0.5 uppercase text-[8px]">Inter</span><span className="font-black text-slate-700">{formatDecimalHours(node.metrics.inter)}</span></div>
              <div className="flex flex-col items-center w-1/4"><span className="text-purple-400 font-bold mb-0.5 uppercase text-[8px]">Noturno</span><span className="font-black text-slate-700">{formatDecimalHours(node.metrics.noturno)}</span></div>
            </div>
          )}
          <div className="w-20" />{/* risco vazio para pessoa */}
        </div>
      </div>
    );
  }

  const diffHours = node.metrics.total - node.metrics.plannedHours;
  const diffCost = node.metrics.totalCost - node.metrics.budgetCost;
  const impactPct = parentTotalHours && parentTotalHours > 0 ? ((node.metrics.total / parentTotalHours) * 100).toFixed(1) : '100';

  // Cores dinâmicas por nível para facilitar o entendimento da hierarquia
  const rowBgClass = isGlobal
    ? 'bg-slate-200/80 hover:bg-slate-300/80 border-slate-300'
    : isRegional
      ? 'bg-slate-100/50 hover:bg-slate-200/50 border-slate-200'
      : isCC
        ? 'bg-white hover:bg-slate-50 border-slate-100'
        : 'bg-slate-50/50 hover:bg-slate-100/50 border-slate-50 border-l-2 border-l-emerald-500';

  return (
    <React.Fragment>
      <div
        className={`flex items-center justify-between py-3 pr-4 border-b transition-colors ${rowBgClass} ${hasChildren ? 'cursor-pointer' : ''}`}
        style={{ paddingLeft: `${(level * 1.5) + 1}rem` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-[250px] mr-4">
          <div className="w-4 flex justify-center shrink-0">
            {hasChildren ? (
              <span className={`font-bold text-xs ${level === 0 ? 'text-slate-600' : 'text-slate-400'}`}>{isExpanded ? '▼' : '▶'}</span>
            ) : <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>}
          </div>
          <div className={`shrink-0 p-1 rounded ${level === 0 ? 'bg-white shadow-sm' : ''}`}>{getIcon()}</div>
          <span className={`text-sm truncate ${level === 0 ? 'font-black text-slate-800' : level === 1 ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`} title={node.name}>
            {node.name}
          </span>
        </div>

        <div className="flex items-center gap-4 justify-end shrink-0">
          <div className="w-16 flex justify-center">
            {level > 0 ? (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isRegional ? 'text-indigo-800 bg-indigo-100 border-indigo-200' : isCC ? 'text-indigo-700 bg-indigo-50 border-indigo-100' : 'text-emerald-700 bg-emerald-50 border-emerald-100'}`} title={`Representa ${impactPct}% ${isRegional ? 'da DR' : isCC ? 'da Regional' : 'da Obra'}`}>
                {impactPct}%
              </span>
            ) : <span className="text-[10px] text-slate-400">-</span>}
          </div>

          <div className="w-16 text-center">
            <span className="text-xs font-mono font-bold text-slate-700" title="Efetivo Total">{node.metrics.headcount}</span>
          </div>

          {/* Oculta Volume de Horas no modo Financeiro */}
          {viewMode === 'operational' && (
            <div className={`w-[240px] flex items-center justify-between border rounded-md px-3 py-1.5 text-xs font-mono shadow-sm ${level === 0 ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-slate-400 w-12 text-right" title="Planejado">{formatDecimalHours(node.metrics.plannedHours)}</span>
              <span className="text-slate-200">|</span>
              <span className="font-bold text-slate-800 w-12 text-right" title="Real">{formatDecimalHours(node.metrics.total)}</span>
              <span className={`w-14 text-right font-black ${diffHours > 0 ? 'text-rose-500' : 'text-emerald-500'}`} title="Diferença">
                {diffHours > 0 ? '+' : ''}{formatDecimalHours(diffHours)}
              </span>
            </div>
          )}

          {viewMode === 'financial' ? (
            <div className={`w-[280px] flex items-center justify-between border rounded-md px-3 py-1.5 text-xs font-mono shadow-sm ${level === 0 ? 'bg-emerald-100/50 border-emerald-200' : 'bg-emerald-50/50 border-emerald-100'}`}>
              <span className="text-slate-500 w-16 text-right" title="Budget">R$ {formatCost(node.metrics.budgetCost)}</span>
              <span className="text-emerald-200">|</span>
              <span className="font-bold text-emerald-900 w-16 text-right" title="Custo Real">R$ {formatCost(node.metrics.totalCost)}</span>
              <span className={`w-16 text-right font-black ${diffCost > 0 ? 'text-rose-500' : 'text-emerald-600'}`} title="Estouro/Economia">
                {diffCost > 0 ? '+' : ''}{formatCost(diffCost)}
              </span>
            </div>
          ) : (
            <div className={`w-[280px] flex items-center justify-between border rounded-md px-2 py-1.5 text-[10px] font-mono shadow-sm ${level === 0 ? 'bg-indigo-100/40 border-indigo-200' : 'bg-indigo-50/40 border-indigo-100'}`}>
              <div className="flex flex-col items-center w-1/4 border-r border-indigo-100/50"><span className="text-indigo-500 font-bold mb-0.5 uppercase text-[8px]">60%</span><span className="font-black text-slate-700">{formatDecimalHours(node.metrics.he60)}</span></div>
              <div className="flex flex-col items-center w-1/4 border-r border-indigo-100/50"><span className="text-rose-400 font-bold mb-0.5 uppercase text-[8px]">100%</span><span className="font-black text-slate-700">{formatDecimalHours(node.metrics.he100)}</span></div>
              <div className="flex flex-col items-center w-1/4 border-r border-indigo-100/50"><span className="text-amber-500 font-bold mb-0.5 uppercase text-[8px]">Inter</span><span className="font-black text-slate-700">{formatDecimalHours(node.metrics.inter)}</span></div>
              <div className="flex flex-col items-center w-1/4"><span className="text-purple-400 font-bold mb-0.5 uppercase text-[8px]">Noturno</span><span className="font-black text-slate-700">{formatDecimalHours(node.metrics.noturno)}</span></div>
            </div>
          )}

          <div className="w-20 flex justify-end">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${node.metrics.riskIndex > 10 ? 'bg-rose-100 text-rose-700 border border-rose-200' : node.metrics.riskIndex > 5 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
              Risco: {node.metrics.riskIndex.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div className="flex flex-col w-full">
          {node.children.map(child => <HierarchicalRow key={child.id} node={child} level={level + 1} parentTotalHours={node.metrics.total} viewMode={viewMode} />)}
        </div>
      )}
    </React.Fragment>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ data, allData, regional, budgetMonthKeys, onNavigateToEmployee, selectedMonth }) => {
  const [ccSearch, setCcSearch] = useState('');
  const [funcSearch, setFuncSearch] = useState('');
  const [selectedFuncModal, setSelectedFuncModal] = useState<string | null>(null);
  const [selectedCcModal, setSelectedCcModal] = useState<string | null>(null);
  const [ccViewMode, setCcViewMode] = useState<ViewMode>('hours');
  const [funcViewMode, setFuncViewMode] = useState<ViewMode>('hours');
  const [treeViewMode, setTreeViewMode] = React.useState<'financial' | 'operational'>('financial');
  const [showTreeHelp, setShowTreeHelp] = React.useState(false);

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
    // Carrega as equipes e alocações locais para a resposta imediata
    const allTeams: WorkTeam[] = getTeamsSync();

    // Obter alocações baseadas no mês selecionado da view
    const allAllocations: TeamAllocation[] = getTeamAllocationsSync().filter(a => a.monthKey === selectedMonth);

    // Lookup: cc normalizado → lista de WorkTeams daquele CC
    const ccTeams = new Map<string, WorkTeam[]>();
    allTeams.forEach(t => {
      const cc = normalizeCC(t.costCenter);
      if (!ccTeams.has(cc)) ccTeams.set(cc, []);
      ccTeams.get(cc)!.push(t);
    });

    // Lookup: "cc|chapa" → WorkTeam (qual equipe a chapa pertence dentro de um CC no mês ativo)
    const chapaTeamKey = (cc: string, chapa: string) => `${cc}|${chapa}`;
    const chapaToTeam = new Map<string, WorkTeam>();

    allTeams.forEach(t => {
      const alloc = allAllocations.find(a => a.teamId === t.id);
      if (alloc) {
        const cc = normalizeCC(t.costCenter);
        alloc.chapas.forEach(chapa => {
          chapaToTeam.set(chapaTeamKey(cc, chapa), t);
        });
      }
    });

    // Mapa de nome por chapa (para exibição nos nós PERSON)
    const chapaToName = new Map<string, string>();
    data.forEach(r => { if (r.CHAPA && r.NOME) chapaToName.set(r.CHAPA, r.NOME); });

    // Estrutura de acumulação
    type PersonAcc = { name: string; metrics: any };
    type TeamAcc = { name: string; metrics: any; persons: Map<string, PersonAcc> };
    type CcAcc = { name: string; metrics: any; teams: Map<string, TeamAcc>; persons: Map<string, PersonAcc> };
    type RegAcc = { metrics: any; ccs: Map<string, CcAcc> };

    const newM = () => ({ headcount: new Set<string>(), he60: 0, he100: 0, inter: 0, noturno: 0, total: 0, totalCost: 0, plannedHours: 0, budgetCost: 0 });

    const globalMetrics = newM();
    const regionalMap = new Map<string, RegAcc>();

    const getRegData = (reg: string): RegAcc => {
      if (!regionalMap.has(reg)) regionalMap.set(reg, { metrics: newM(), ccs: new Map() });
      return regionalMap.get(reg)!;
    };

    const getCcData = (regData: RegAcc, cc: string, ccName: string): CcAcc => {
      if (!regData.ccs.has(cc)) regData.ccs.set(cc, { name: ccName, metrics: newM(), teams: new Map(), persons: new Map() });
      return regData.ccs.get(cc)!;
    };

    const getTeamAcc = (ccData: CcAcc, teamId: string, teamName: string): TeamAcc => {
      if (!ccData.teams.has(teamId)) ccData.teams.set(teamId, { name: teamName, metrics: newM(), persons: new Map() });
      return ccData.teams.get(teamId)!;
    };

    const getPersonAcc = (container: { persons: Map<string, PersonAcc> }, chapa: string): PersonAcc => {
      if (!container.persons.has(chapa)) {
        container.persons.set(chapa, { name: chapaToName.get(chapa) || chapa, metrics: newM() });
      }
      return container.persons.get(chapa)!;
    };

    const addHours = (m: any, chapa: string, hours: number, isHE60: boolean, isHE100: boolean, isInter: boolean, isNoturno: boolean, cost: number) => {
      m.headcount.add(chapa);
      if (isHE60) m.he60 += hours;
      if (isHE100) m.he100 += hours;
      if (isInter) m.inter += hours;
      if (isNoturno) m.noturno += hours;
      m.total += hours;
      m.totalCost += cost;
    };

    // 1. DADOS REAIS
    data.forEach(r => {
      const rawCC = r.CODCCUSTO || 'S/ CC';
      const cc = normalizeCC(rawCC);
      const ccName = getCCName(rawCC) || resolveName(rawCC);
      const reg = getCCRegional(rawCC) || 'Sem Regional';
      const hours = Number(r.HORAS) || 0;
      const evt = (r.EVENTO || '').toUpperCase();
      const isHE60 = evt.includes('EXTRA') && evt.includes('60');
      const isHE100 = evt.includes('EXTRA') && evt.includes('100');
      const isInter = evt.includes('INTER');
      const isNoturno = evt.includes('NOTURNO') || evt.includes('20');
      if (!isHE60 && !isHE100 && !isInter && !isNoturno) return;

      if (!chapaToName.has(r.CHAPA)) chapaToName.set(r.CHAPA, r.NOME || r.CHAPA);

      const sal = salariesMap[r.CHAPA] || 0;
      const baseHour = sal / 220;
      let cost = 0;
      if (isHE60) cost = baseHour * 1.6 * hours;
      if (isHE100) cost = baseHour * 2.0 * hours;
      if (isNoturno) cost = baseHour * 0.2 * hours;
      if (isHE60 || isHE100) cost += cost / 6;

      const regData = getRegData(reg);
      const ccData = getCcData(regData, cc, ccName);
      const hasTeams = (ccTeams.get(cc)?.length ?? 0) > 0;

      addHours(globalMetrics, r.CHAPA, hours, isHE60, isHE100, isInter, isNoturno, cost);
      addHours(regData.metrics, r.CHAPA, hours, isHE60, isHE100, isInter, isNoturno, cost);
      addHours(ccData.metrics, r.CHAPA, hours, isHE60, isHE100, isInter, isNoturno, cost);

      if (hasTeams) {
        const wt = chapaToTeam.get(chapaTeamKey(cc, r.CHAPA));
        const teamAcc = getTeamAcc(ccData, wt ? wt.id : `${cc}-sem-equipe`, wt ? wt.name : 'Sem Equipe Designada');
        addHours(teamAcc.metrics, r.CHAPA, hours, isHE60, isHE100, isInter, isNoturno, cost);
        const personAcc = getPersonAcc(teamAcc, r.CHAPA);
        addHours(personAcc.metrics, r.CHAPA, hours, isHE60, isHE100, isInter, isNoturno, cost);
      } else {
        const personAcc = getPersonAcc(ccData, r.CHAPA);
        addHours(personAcc.metrics, r.CHAPA, hours, isHE60, isHE100, isInter, isNoturno, cost);
      }
    });

    // 2. DADOS PLANEJADOS
    planningRecords.forEach(p => {
      const rawCC = p.costCenter || 'S/ CC';
      const cc = normalizeCC(rawCC);
      const ccName = getCCName(rawCC) || resolveName(rawCC);
      const reg = getCCRegional(rawCC) || 'Sem Regional';

      const regData = getRegData(reg);
      const ccData = getCcData(regData, cc, ccName);
      const hasTeams = (ccTeams.get(cc)?.length ?? 0) > 0;

      const addPlan = (m: any) => { m.plannedHours += p.plannedHours; };
      addPlan(globalMetrics); addPlan(regData.metrics); addPlan(ccData.metrics);

      if (hasTeams) {
        const wt = chapaToTeam.get(chapaTeamKey(cc, p.chapa));
        const teamAcc = getTeamAcc(ccData, wt ? wt.id : `${cc}-sem-equipe`, wt ? wt.name : 'Sem Equipe Designada');
        addPlan(teamAcc.metrics);
        const personAcc = getPersonAcc(teamAcc, p.chapa);
        addPlan(personAcc.metrics);
      } else {
        const personAcc = getPersonAcc(ccData, p.chapa);
        addPlan(personAcc.metrics);
      }
    });

    // 3. BUDGET (fica no nível CC e acima)
    budgets.forEach(b => {
      const rawCC = b.costCenter || 'S/ CC';
      const cc = normalizeCC(rawCC);
      const ccName = getCCName(rawCC) || resolveName(rawCC);
      const reg = getCCRegional(rawCC) || 'Sem Regional';
      const regData = getRegData(reg);
      const ccData = getCcData(regData, cc, ccName);
      [globalMetrics, regData.metrics, ccData.metrics].forEach(m => { m.budgetCost += b.value; });
    });

    const calcRisk = (m: any) => ((m.he100 * 2.5) + (m.he60 * 1.0) + (m.inter * 5.0) + (m.noturno * 0.5)) / (m.headcount.size || 1);

    const buildPersonNodes = (persons: Map<string, PersonAcc>, baseId: string): TreeNode[] =>
      Array.from(persons.entries()).map(([chapa, p]) => ({
        id: `${baseId}-${chapa}`, name: p.name, type: 'PERSON' as const, chapa,
        metrics: { ...p.metrics, headcount: 1, riskIndex: calcRisk(p.metrics) },
        children: []
      })).sort((a, b) => b.metrics.total - a.metrics.total);

    const root: TreeNode = {
      id: 'global', name: 'DR Construtora (Global)', type: 'GLOBAL',
      metrics: { ...globalMetrics, headcount: globalMetrics.headcount.size, riskIndex: calcRisk(globalMetrics) },
      children: Array.from(regionalMap.entries()).map(([regName, regData]) => ({
        id: regName, name: regName, type: 'REGIONAL' as const,
        metrics: { ...regData.metrics, headcount: regData.metrics.headcount.size, riskIndex: calcRisk(regData.metrics) },
        children: Array.from(regData.ccs.entries()).map(([ccCode, ccData]) => {
          const hasTeams = ccData.teams.size > 0;
          return {
            id: ccCode, name: `${ccCode} - ${ccData.name}`, type: 'CC' as const,
            metrics: { ...ccData.metrics, headcount: ccData.metrics.headcount.size, riskIndex: calcRisk(ccData.metrics) },
            children: hasTeams
              ? Array.from(ccData.teams.entries()).map(([teamId, teamData]) => ({
                id: teamId, name: teamData.name, type: 'TEAM' as const,
                metrics: { ...teamData.metrics, headcount: teamData.metrics.headcount.size, riskIndex: calcRisk(teamData.metrics) },
                children: buildPersonNodes(teamData.persons, teamId)
              })).sort((a, b) => b.metrics.riskIndex - a.metrics.riskIndex)
              : buildPersonNodes(ccData.persons, ccCode)
          };
        }).sort((a, b) => b.metrics.riskIndex - a.metrics.riskIndex)
      })).sort((a, b) => b.metrics.riskIndex - a.metrics.riskIndex)
    };

    return [root];
  }, [data, planningRecords, budgets, salariesMap, selectedMonth]);

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

      {/* Visão Analítica Hierárquica (Tree Grid) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col mt-8 animate-fade-in relative">
        {showTreeHelp && <TreeGridHelpModal onClose={() => setShowTreeHelp(false)} />}

        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Visão Analítica Executiva (Plan vs Real)</h3>
            <button onClick={() => setShowTreeHelp(true)} className="ml-2 text-slate-400 hover:text-indigo-500 transition-colors p-1" title="Como ler esta tabela?">
              <Info size={16} />
            </button>
          </div>

          <div className="flex bg-slate-200/60 p-1 rounded-lg">
            <button onClick={() => setTreeViewMode('financial')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${treeViewMode === 'financial' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Wallet size={14} /> Financeiro</button>
            <button onClick={() => setTreeViewMode('operational')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${treeViewMode === 'operational' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Zap size={14} /> Operacional</button>
          </div>
        </div>

        <div className="w-full bg-white flex flex-col overflow-x-auto">
          <div className="flex items-center justify-between py-3 pr-4 pl-4 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[900px]">
            <span className="flex-1">Estrutura Organizacional</span>
            <div className="flex items-center gap-4 justify-end shrink-0">
              <span className="w-16 text-center" title="Impacto percentual no pai">Impacto</span>
              <span className="w-16 text-center" title="Número de Pessoas">Efetivo</span>

              {treeViewMode === 'operational' && (
                <span className="w-[240px] text-center text-slate-600 bg-slate-200/50 py-1.5 rounded-md border border-slate-200/50 transition-all">Volume de Horas (Plan | Real | Dif)</span>
              )}

              {treeViewMode === 'financial' ? (
                <span className="w-[280px] text-center text-emerald-700 bg-emerald-100/50 py-1.5 rounded-md border border-emerald-200/50 transition-all">Custo Financeiro (Budget | Real | Dif)</span>
              ) : (
                <span className="w-[280px] text-center text-indigo-700 bg-indigo-100/50 py-1.5 rounded-md border border-indigo-200/50 transition-all">Breakdown de Horas (Origem do Passivo)</span>
              )}

              <span className="w-20 text-right">Risco</span>
            </div>
          </div>

          <div className="min-w-[900px] pb-4">
            {hierarchicalData.map(node => <HierarchicalRow key={node.id} node={node} level={0} viewMode={treeViewMode} />)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

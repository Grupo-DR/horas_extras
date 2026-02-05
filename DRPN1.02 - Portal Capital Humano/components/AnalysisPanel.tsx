
import React, { useMemo, useState } from 'react';
import { OvertimeRecord } from '../types';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getBudgets, getSalaries, getAllPlanningRecords } from '../services/planning';
import { Wallet, TrendingUp, DollarSign, TrendingDown, ArrowUpRight, ArrowDownRight, Clock, Calculator, Percent, Gavel, AlertTriangle, ShieldAlert, CheckCircle2, Moon, Sun, Scale } from 'lucide-react';
import { formatDecimalHours } from '../utils/formatters';

interface AnalysisPanelProps {
  data: OvertimeRecord[];
  selectedYear: string;
}

type ViewMode = 'finance' | 'hours';

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const MONTH_ABBRS = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
];

// Componente de Tooltip Personalizado para detalhamento
const CustomTooltip = ({ active, payload, label, viewMode }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    
    return (
      <div className="bg-white p-4 rounded-2xl shadow-2xl border border-gray-100 min-w-[240px] animate-in fade-in zoom-in duration-200">
        <div className="border-b border-gray-100 pb-2 mb-3">
          <p className="text-sm font-bold text-gray-800">{data.fullLabel || label}</p>
        </div>
        
        <div className="space-y-3">
          {/* Sessão de Horas Reais / Custo Real */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Realizado Total</span>
              <span className="text-sm font-bold text-gray-900 font-mono">
                {viewMode === 'finance' 
                  ? `R$ ${data.real.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                  : formatDecimalHours(data.realHours)}
              </span>
            </div>
            
            <div className="bg-emerald-50/50 rounded-lg p-2 space-y-1.5 border border-emerald-100/50">
              <div className="flex justify-between items-center text-[10px]">
                <span className="flex items-center gap-1.5 text-gray-500"><Percent size={10} className="text-blue-500"/> HE 60%</span>
                <span className="font-mono font-bold text-gray-700">
                  {viewMode === 'finance' ? `R$ ${data.he60Cost.toLocaleString('pt-BR')}` : formatDecimalHours(data.he60Hours)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="flex items-center gap-1.5 text-gray-500"><AlertTriangle size={10} className="text-red-500"/> HE 100%</span>
                <span className="font-mono font-bold text-gray-700">
                  {viewMode === 'finance' ? `R$ ${data.he100Cost.toLocaleString('pt-BR')}` : formatDecimalHours(data.he100Hours)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="flex items-center gap-1.5 text-gray-500"><Moon size={10} className="text-purple-500"/> Adic. Noturno</span>
                <span className="font-mono font-bold text-gray-700">
                  {viewMode === 'finance' ? `R$ ${data.noturnoCost.toLocaleString('pt-BR')}` : formatDecimalHours(data.noturnoHours)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="flex items-center gap-1.5 text-gray-500"><Scale size={10} className="text-orange-500"/> Interjornada</span>
                <span className="font-mono font-bold text-gray-700">{formatDecimalHours(data.interHours)}</span>
              </div>
              {viewMode === 'finance' && (
                <div className="flex justify-between items-center text-[10px] border-t border-emerald-100 pt-1 mt-1">
                  <span className="flex items-center gap-1.5 text-gray-500"><Sun size={10} className="text-orange-400"/> Reflexo DSR</span>
                  <span className="font-mono font-bold text-gray-700">R$ {data.dsrCost.toLocaleString('pt-BR')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sessão de Planejamento */}
          <div className="border-t border-gray-50 pt-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Planejado</span>
              <span className="text-xs font-bold text-gray-600 font-mono">
                {viewMode === 'finance' 
                  ? `R$ ${data.planned.toLocaleString('pt-BR')}` 
                  : formatDecimalHours(data.plannedHours)}
              </span>
            </div>
          </div>

          {/* Sessão de Budget */}
          {viewMode === 'finance' && (
            <div className="border-t border-gray-50 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Budget (Meta)</span>
                <span className="text-xs font-bold text-gray-600 font-mono">R$ {data.budget.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ data, selectedYear }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('finance');
  const budgets = useMemo(() => getBudgets(), []);
  const planningRecords = useMemo(() => getAllPlanningRecords(), []);
  const salariesMap = useMemo(() => {
    const map: Record<string, number> = {};
    getSalaries().forEach(s => map[s.chapa] = s.salary);
    return map;
  }, []);

  const chartData = useMemo(() => {
    const isMultiYear = !selectedYear;
    const monthlyMap: Record<string, { 
      key: string,
      month: string, 
      displayLabel: string,
      fullLabel: string,
      budget: number, 
      planned: number, 
      real: number, 
      plannedHours: number, 
      realHours: number,
      he60Hours: number,
      he100Hours: number,
      noturnoHours: number,
      interHours: number,
      he60Cost: number,
      he100Cost: number,
      noturnoCost: number,
      dsrCost: number
    }> = {};

    // Helper para gerar a estrutura inicial do bucket
    const createBucket = (mName: string, mIndex: number, year: number) => {
      const yearShort = year.toString().slice(-2);
      const label = isMultiYear ? `${MONTH_ABBRS[mIndex]} (${yearShort})` : mName;
      const key = isMultiYear ? `${year}-${(mIndex + 1).toString().padStart(2, '0')}` : mName;
      
      return {
        key,
        month: mName,
        displayLabel: label,
        fullLabel: isMultiYear ? `${mName} de ${year}` : mName,
        budget: 0, planned: 0, real: 0, plannedHours: 0, realHours: 0,
        he60Hours: 0, he100Hours: 0, noturnoHours: 0, interHours: 0,
        he60Cost: 0, he100Cost: 0, noturnoCost: 0, dsrCost: 0
      };
    };

    // 1. Processar BUDGETS
    budgets.forEach(b => {
      const mIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === b.month.toLowerCase());
      if (mIdx === -1) return;
      
      const year = parseInt(selectedYear) || new Date().getFullYear();
      const bucketKey = isMultiYear ? `${year}-${(mIdx + 1).toString().padStart(2, '0')}` : MONTH_NAMES[mIdx];
      
      if (!monthlyMap[bucketKey]) monthlyMap[bucketKey] = createBucket(MONTH_NAMES[mIdx], mIdx, year);
      monthlyMap[bucketKey].budget += b.value;
    });

    // 2. Processar PLANEJAMENTO
    planningRecords.forEach(p => {
      const date = new Date(p.date);
      const mIdx = date.getMonth();
      const year = date.getFullYear();
      const bucketKey = isMultiYear ? `${year}-${(mIdx + 1).toString().padStart(2, '0')}` : MONTH_NAMES[mIdx];
      const sal = salariesMap[p.chapa] || 0;
      
      if (!monthlyMap[bucketKey]) monthlyMap[bucketKey] = createBucket(MONTH_NAMES[mIdx], mIdx, year);
      
      monthlyMap[bucketKey].plannedHours += p.plannedHours;
      if (sal > 0) {
        const baseHour = sal / 220;
        const isSunday = date.getDay() === 0;
        const multiplier = isSunday ? 2.0 : 1.6;
        monthlyMap[bucketKey].planned += baseHour * multiplier * p.plannedHours;
      }
    });

    // 3. Processar REALIZADO
    data.forEach(r => {
      const date = new Date(r.DATA);
      const mIdx = date.getMonth();
      const year = date.getFullYear();
      const bucketKey = isMultiYear ? `${year}-${(mIdx + 1).toString().padStart(2, '0')}` : MONTH_NAMES[mIdx];
      const sal = salariesMap[r.CHAPA] || 0;
      const hours = Number(r.HORAS) || 0;
      const evt = (r.EVENTO || '').toUpperCase();
      
      if (!monthlyMap[bucketKey]) monthlyMap[bucketKey] = createBucket(MONTH_NAMES[mIdx], mIdx, year);
      
      const baseHour = sal / 220;
      let itemCost = 0;
      let isExtraEvent = false;

      if (evt.includes('EXTRA')) {
        isExtraEvent = true;
        if (evt.includes('60')) {
          monthlyMap[bucketKey].he60Hours += hours;
          if (sal > 0) {
            itemCost = baseHour * 1.6 * hours;
            monthlyMap[bucketKey].he60Cost += itemCost;
          }
        } else if (evt.includes('100')) {
          monthlyMap[bucketKey].he100Hours += hours;
          if (sal > 0) {
            itemCost = baseHour * 2.0 * hours;
            monthlyMap[bucketKey].he100Cost += itemCost;
          }
        }
      } else if (evt.includes('NOTURNO')) {
        isExtraEvent = true;
        monthlyMap[bucketKey].noturnoHours += hours;
        if (sal > 0) {
          itemCost = baseHour * 0.2 * hours;
          monthlyMap[bucketKey].noturnoCost += itemCost;
        }
      } else if (evt.includes('INTER')) {
        isExtraEvent = true;
        monthlyMap[bucketKey].interHours += hours;
      }

      if (isExtraEvent) {
        monthlyMap[bucketKey].realHours += hours;
        const dsrReflex = itemCost / 6;
        monthlyMap[bucketKey].dsrCost += dsrReflex;
        monthlyMap[bucketKey].real += itemCost + dsrReflex;
      }
    });

    // Ordenação e Retorno
    const result = Object.values(monthlyMap)
      .filter(d => d.budget > 0 || d.planned > 0 || d.real > 0 || d.plannedHours > 0 || d.realHours > 0)
      .sort((a, b) => {
        if (isMultiYear) return a.key.localeCompare(b.key);
        return MONTH_NAMES.indexOf(a.month) - MONTH_NAMES.indexOf(b.month);
      });

    return result;
  }, [data, budgets, planningRecords, salariesMap, selectedYear]);

  const complianceMetrics = useMemo(() => {
    const ccViolations: Record<string, { 
      cc: string, 
      name: string, 
      interjornada: number, 
      extra100: number, 
      totalIrregular: number,
      riskLevel: 'high' | 'medium' | 'low'
    }> = {};

    data.forEach(r => {
      const evt = (r.EVENTO || '').toUpperCase();
      const isInter = evt.includes('INTER');
      const is100 = evt.includes('100');
      
      if (isInter || is100) {
        if (!ccViolations[r.CODCCUSTO]) {
          ccViolations[r.CODCCUSTO] = { 
            cc: r.CODCCUSTO, 
            name: r.SECAO || 'Sem Nome', 
            interjornada: 0, 
            extra100: 0, 
            totalIrregular: 0,
            riskLevel: 'low'
          };
        }
        
        const hours = Number(r.HORAS) || 0;
        if (isInter) ccViolations[r.CODCCUSTO].interjornada += hours;
        if (is100) ccViolations[r.CODCCUSTO].extra100 += hours;
        ccViolations[r.CODCCUSTO].totalIrregular += hours;
      }
    });

    return Object.values(ccViolations).map(v => ({
      ...v,
      riskLevel: v.interjornada > 0 ? 'high' : v.extra100 > 20 ? 'medium' : 'low'
    })).sort((a, b) => b.totalIrregular - a.totalIrregular);
  }, [data]);

  const totals = useMemo(() => {
    return chartData.reduce((acc, curr) => ({
      budget: acc.budget + curr.budget,
      planned: acc.planned + curr.planned,
      real: acc.real + curr.real,
      plannedHours: acc.plannedHours + curr.plannedHours,
      realHours: acc.realHours + curr.realHours
    }), { budget: 0, planned: 0, real: 0, plannedHours: 0, realHours: 0 });
  }, [chartData]);

  const isOverTarget = viewMode === 'finance' 
    ? totals.real > totals.budget 
    : totals.realHours > totals.plannedHours;

  const diffPercent = viewMode === 'finance'
    ? (totals.budget > 0 ? Math.abs(100 - (totals.real / totals.budget * 100)) : 0)
    : (totals.plannedHours > 0 ? Math.abs(100 - (totals.realHours / totals.plannedHours * 100)) : 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Context Switcher Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Calculator size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Modo de Análise</h2>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Alterne entre evolução financeira e operacional</p>
          </div>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200">
          <button 
            onClick={() => setViewMode('finance')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold uppercase transition-all ${viewMode === 'finance' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <DollarSign size={14} /> Financeiro
          </button>
          <button 
            onClick={() => setViewMode('hours')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold uppercase transition-all ${viewMode === 'hours' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Clock size={14} /> Horas
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
            {viewMode === 'finance' ? <Wallet size={24} /> : <Calculator size={24} />}
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              {viewMode === 'finance' ? 'Budget Acumulado' : 'Meta Planejada (h)'}
            </p>
            <h3 className="text-2xl font-bold text-gray-800 font-mono">
              {viewMode === 'finance' 
                ? `R$ ${totals.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : formatDecimalHours(totals.plannedHours)
              }
            </h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-100">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                {viewMode === 'finance' ? 'Planejado Acumulado' : 'Executado Total (h)'}
            </p>
            <h3 className="text-2xl font-bold text-gray-800 font-mono">
              {viewMode === 'finance' 
                ? `R$ ${totals.planned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : formatDecimalHours(totals.realHours)
              }
            </h3>
          </div>
        </div>

        <div className={`p-6 rounded-2xl shadow-sm border flex items-center gap-5 transition-transform hover:scale-[1.02] ${isOverTarget ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className={`p-4 rounded-2xl text-white shadow-lg ${isOverTarget ? 'bg-red-600' : 'bg-emerald-600'}`}>
            {viewMode === 'finance' ? <DollarSign size={24} /> : <Percent size={24} />}
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                {viewMode === 'finance' ? 'Realizado Acumulado' : 'Eficiência do Período'}
            </p>
            <h3 className={`text-2xl font-bold font-mono ${isOverTarget ? 'text-red-700' : 'text-emerald-700'}`}>
              {viewMode === 'finance' 
                ? `R$ ${totals.real.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : `${isOverTarget ? 'Excedente' : 'Dentro da Meta'}`
              }
            </h3>
          </div>
          <div className={`text-right ${isOverTarget ? 'text-red-600' : 'text-emerald-700'}`}>
              <div className="flex items-center justify-end text-sm font-bold">
                  {isOverTarget ? <ArrowUpRight size={16}/> : <ArrowDownRight size={16}/>}
                  {diffPercent.toFixed(1)}%
              </div>
              <div className="text-[10px] font-medium uppercase opacity-70">
                  {isOverTarget ? 'Acima' : 'Abaixo'}
              </div>
          </div>
        </div>
      </div>

      {/* Main Chart Card */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <TrendingUp className={viewMode === 'finance' ? "text-blue-600" : "text-emerald-600"} size={22} />
              {viewMode === 'finance' ? 'Evolução Financeira' : 'Evolução de Horas'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {viewMode === 'finance' 
                ? 'Comparativo entre Budget (Meta), Planejado (Operacional) e Real (Executado)'
                : 'Comparativo entre Horas Planejadas (Operacional) e Horas Reais (Executadas)'
              }
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4 text-xs font-bold text-gray-500">
            {viewMode === 'finance' && (
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-slate-400 rounded-sm"></div> Budget
                </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div> {viewMode === 'finance' ? 'Planejado (R$)' : 'Horas Planejadas'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-emerald-500"></div> {viewMode === 'finance' ? 'Real (R$)' : 'Horas Reais'}
            </div>
          </div>
        </div>

        <div className="h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="displayLabel" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                tickFormatter={(val) => viewMode === 'finance' 
                    ? `R$ ${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`
                    : `${val}h`
                }
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                content={<CustomTooltip viewMode={viewMode} />}
              />
              <Legend 
                verticalAlign="top" 
                align="right" 
                height={36} 
                iconType="circle" 
                wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#64748b', paddingBottom: '20px' }}
              />
              {viewMode === 'finance' && (
                <Bar 
                    dataKey="budget" 
                    name="Budget" 
                    fill="#94a3b8" 
                    radius={[6, 6, 0, 0]} 
                    barSize={40} 
                />
              )}
              <Bar 
                dataKey={viewMode === 'finance' ? 'planned' : 'plannedHours'} 
                name={viewMode === 'finance' ? 'Planejado' : 'Horas Planejadas'} 
                fill="#3b82f6" 
                radius={[6, 6, 0, 0]} 
                barSize={40} 
              />
              <Line 
                type="monotone" 
                dataKey={viewMode === 'finance' ? 'real' : 'realHours'} 
                name={viewMode === 'finance' ? 'Realizado' : 'Horas Reais'} 
                stroke="#10b981" 
                strokeWidth={4} 
                dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 8 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Compliance Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                    <Gavel size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Compliance e Riscos Legais</h3>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mt-0.5">Centros de Custo com jornadas irregulares ou excessivas</p>
                </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-gray-200 shadow-sm">
                <AlertTriangle size={14} className="text-orange-500" />
                <span className="text-[10px] font-bold text-gray-500 uppercase">{complianceMetrics.length} CCs COM ALERTA</span>
            </div>
        </div>
        
        <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-white text-gray-400 font-bold uppercase text-[10px] border-b border-gray-100">
                    <tr>
                        <th className="px-8 py-4">Centro de Custo</th>
                        <th className="px-8 py-4 text-center">Interjornada (h)</th>
                        <th className="px-8 py-4 text-center">H.E. 100% (Excesso)</th>
                        <th className="px-8 py-4 text-center">Impacto Total Irregular</th>
                        <th className="px-8 py-4 text-right">Nível de Risco</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {complianceMetrics.length > 0 ? (
                        complianceMetrics.map((v) => (
                            <tr key={v.cc} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-8 py-5">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-gray-900 font-bold">{v.cc}</span>
                                        <span className="text-xs text-gray-400 font-medium truncate max-w-[200px]">{v.name}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    <span className={`font-mono font-bold ${v.interjornada > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                                        {formatDecimalHours(v.interjornada)}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    <span className={`font-mono font-bold ${v.extra100 > 0 ? 'text-orange-600' : 'text-gray-300'}`}>
                                        {formatDecimalHours(v.extra100)}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    <div className="flex flex-col items-center">
                                        <span className="font-mono text-gray-800 font-bold">{formatDecimalHours(v.totalIrregular)}</span>
                                        <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${v.riskLevel === 'high' ? 'bg-red-500' : v.riskLevel === 'medium' ? 'bg-orange-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(100, (v.totalIrregular / 20) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${
                                        v.riskLevel === 'high' ? 'bg-red-100 text-red-700' : 
                                        v.riskLevel === 'medium' ? 'bg-orange-100 text-orange-700' : 
                                        'bg-emerald-100 text-emerald-700'
                                    }`}>
                                        {v.riskLevel === 'high' ? 'Alto Risco (Jurídico)' : 
                                         v.riskLevel === 'medium' ? 'Risco Moderado' : 
                                         'Monitoramento'}
                                    </span>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={5} className="px-8 py-12 text-center">
                                <div className="flex flex-col items-center gap-2 opacity-30">
                                    <CheckCircle2 size={48} className="text-emerald-500" />
                                    <p className="font-bold text-gray-500 uppercase tracking-widest text-xs">Nenhuma irregularidade detectada no período</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        <div className="p-4 bg-red-50 text-red-800 text-[10px] font-bold uppercase tracking-widest text-center flex items-center justify-center gap-2">
            <ShieldAlert size={14} />
            Nota: Interjornadas representam descumprimento do descanso mínimo de 11h previsto na CLT Art. 66.
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;

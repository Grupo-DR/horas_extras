import React, { useMemo } from 'react';
import { Project, ContractData } from '../types';
import { 
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ReferenceLine 
} from 'recharts';
import { Info, TrendingDown, DollarSign } from 'lucide-react';

interface ContractAnalysisTabProps {
  project: Project | null;
  contractData: ContractData | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });


export const ContractAnalysisTab: React.FC<ContractAnalysisTabProps> = ({ project, contractData }) => {
  
  const { chartData, totalContractValue, totalMeasured, currentBalance } = useMemo(() => {
    if (!contractData) {
      return { chartData: [], totalContractValue: 0, totalMeasured: 0, currentBalance: 0 };
    }

    const totalAddedValue = contractData.addenda.reduce((s, a) => s + (a.addedValue ?? 0), 0);
    const totalValue = contractData.contractValue + totalAddedValue;
    const entries = contractData.monthlyEntries;
    
    let lastMeasuredIndex = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
      if ((entries[i].measured || 0) > 0) {
        lastMeasuredIndex = i;
        break;
      }
    }
    
    let measuredAcc = 0;
    for (let i = 0; i <= lastMeasuredIndex; i++) {
      measuredAcc += (entries[i].measured || 0);
    }
    
    const currentBalanceCalc = totalValue - measuredAcc;
    const remainingMonths = entries.length - (lastMeasuredIndex + 1);
    const projectedMonthly = remainingMonths > 0 ? currentBalanceCalc / remainingMonths : 0;
    
    let runningBalance = totalValue;
    let runningRealAcc = 0;
    let runningProjAcc = measuredAcc;
    let runningBudgetAcc = 0;
    let runningForecastAcc = 0;
    let runningOrcamentoAcc = 0;
    const orcamentoPorMes = entries.length > 0 ? totalValue / entries.length : 0;
    
    const data = entries.map((entry, index) => {
      const measured = entry.measured || 0;
      const budget = entry.budget || 0;
      const forecast = entry.forecast || 0;
      
      runningBudgetAcc += budget;
      runningForecastAcc += forecast;
      runningOrcamentoAcc += orcamentoPorMes;
      
      let realAcc: number | null = null;
      let projAcc: number | null = null;
      let medReal: number | null = null;
      let medProj: number | null = null;
      let barSaldo = 0;
      
      if (index <= lastMeasuredIndex) {
        runningRealAcc += measured;
        runningBalance -= measured;
        realAcc = runningRealAcc;
        barSaldo = runningBalance;
        medReal = measured;
        if (index === lastMeasuredIndex) {
           projAcc = runningRealAcc; 
        }
      } else {
        runningProjAcc += projectedMonthly;
        runningBalance -= projectedMonthly;
        projAcc = runningProjAcc;
        barSaldo = runningBalance;
        medProj = projectedMonthly;
      }
      
      return {
        month: entry.name,
        medReal,
        medProj,
        saldo: barSaldo,
        realAcc,
        projAcc,
        budgetAcc: runningBudgetAcc,
        forecastAcc: runningForecastAcc,
        orcamentoAcc: runningOrcamentoAcc
      };
    });
    
    return {
      chartData: data,
      totalContractValue: totalValue,
      totalMeasured: measuredAcc,
      currentBalance: currentBalanceCalc
    };
  }, [contractData]);

  if (!project || !contractData || contractData.monthlyEntries.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-3xl border border-white/5 text-center bg-white/[0.02] border-dashed animate-fade-in">
        <Info className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-30" />
        <p className="text-slate-500 font-medium">Não há dados suficientes para a análise.</p>
        <p className="text-slate-600 text-sm mt-2">Certifique-se de preencher as datas e medições mensais na aba "Dados do Contrato".</p>
      </div>
    );
  }

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-white/10 rounded-xl p-4 shadow-xl">
          <p className="text-slate-300 text-sm font-bold mb-2 capitalize">{label}</p>
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
              <span className="text-slate-400 text-xs">{p.name}:</span>
              <span className="text-white text-xs font-mono font-semibold">
                {fmtBRL(p.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <DollarSign className="w-16 h-16 text-blue-500" />
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Valor Total do Contrato</p>
          <h4 className="text-2xl font-bold text-white font-mono mt-1 z-10">{fmtBRL(totalContractValue)}</h4>
          <p className="text-xs text-slate-500 z-10">Valor original + aditivos</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <TrendingDown className="w-16 h-16 text-emerald-500" />
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Total Medido</p>
          <h4 className="text-2xl font-bold text-emerald-400 font-mono mt-1 z-10">{fmtBRL(totalMeasured)}</h4>
          <p className="text-xs text-slate-500 z-10">Acumulado das medições</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-2 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Info className="w-16 h-16 text-amber-500" />
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Saldo Atual do Contrato</p>
          <h4 className={`text-2xl font-bold font-mono mt-1 z-10 ${currentBalance < 0 ? 'text-red-400' : 'text-amber-400'}`}>
            {fmtBRL(currentBalance)}
          </h4>
          <p className="text-xs text-slate-500 z-10">Valor a medir</p>
        </div>
      </div>

      <div className="glass-panel rounded-3xl border border-white/5 p-6 shadow-2xl shadow-blue-900/10">
        <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
          Evolução: Medições vs Saldo Remanescente
        </h3>
        <div className="w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis 
                dataKey="month" 
                stroke="#64748b" 
                tick={{ fill: '#94a3b8', fontSize: 12 }} 
                tickLine={false} 
                axisLine={{ stroke: '#ffffff10' }} 
              />
              <YAxis 
                yAxisId="left"
                stroke="#64748b" 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                tickLine={false}
                axisLine={{ stroke: '#ffffff10' }}
                domain={[0, 'auto']}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#64748b" 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                tickLine={false}
                axisLine={{ stroke: '#ffffff10' }}
                domain={[0, 'auto']}
              />
              <RechartsTooltip content={customTooltip} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              
              {/* Linha de referência do valor total do contrato */}
              <ReferenceLine 
                yAxisId="left"
                y={totalContractValue} 
                stroke="#3b82f6" 
                strokeDasharray="3 3" 
                label={{ position: 'top', value: 'Valor Total', fill: '#3b82f6', fontSize: 12 }} 
              />

              <Bar 
                yAxisId="left"
                dataKey="saldo" 
                name="Saldo Remanescente" 
                fill="#fbbf24" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />

              <Bar 
                yAxisId="left"
                dataKey="medReal" 
                name="Medição Realizada" 
                fill="#10b981" 
                stackId="med"
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />

              <Bar 
                yAxisId="left"
                dataKey="medProj" 
                name="Medição Necessária" 
                fill="#ef4444" 
                opacity={0.4}
                stackId="med"
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />
              
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="realAcc" 
                name="Acumulado Real" 
                stroke="#3b82f6" 
                strokeWidth={1.5}
                dot={{ r: 3, fill: '#0f172a', stroke: '#3b82f6', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 1.5 }}
              />

              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="projAcc" 
                name="Acumulado Projetado" 
                stroke="#ef4444" 
                strokeWidth={1.5}
                strokeDasharray="6 6"
                dot={{ r: 3, fill: '#0f172a', stroke: '#ef4444', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#ef4444', stroke: '#fff', strokeWidth: 1.5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-panel rounded-3xl border border-white/5 p-6 shadow-2xl shadow-blue-900/10">
        <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
          Curva S do Contrato
        </h3>
        <div className="w-full h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis 
                dataKey="month" 
                stroke="#64748b" 
                tick={{ fill: '#94a3b8', fontSize: 12 }} 
                tickLine={false} 
                axisLine={{ stroke: '#ffffff10' }} 
              />
              <YAxis 
                yAxisId="left"
                stroke="#64748b" 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                tickLine={false}
                axisLine={{ stroke: '#ffffff10' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#64748b" 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                tickLine={false}
                axisLine={{ stroke: '#ffffff10' }}
              />
              <RechartsTooltip content={customTooltip} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />

              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="orcamentoAcc" 
                name="Orçamento (Linear)" 
                stroke="#ffffff" 
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />

              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="budgetAcc" 
                name="Budget (Planejado)" 
                stroke="#a855f7" 
                strokeWidth={1.5}
                dot={{ r: 3, fill: '#0f172a', stroke: '#a855f7', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#a855f7', stroke: '#fff', strokeWidth: 1.5 }}
              />

              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="forecastAcc" 
                name="Forecast" 
                stroke="#f97316" 
                strokeWidth={1.5}
                dot={{ r: 3, fill: '#0f172a', stroke: '#f97316', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#f97316', stroke: '#fff', strokeWidth: 1.5 }}
              />

              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="realAcc" 
                name="Realizado" 
                stroke="#3b82f6" 
                strokeWidth={1.5}
                dot={{ r: 3, fill: '#0f172a', stroke: '#3b82f6', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 1.5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

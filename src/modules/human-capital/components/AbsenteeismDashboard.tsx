import React, { useMemo } from 'react';
import { OvertimeRecord, UserProfile, HeadcountRecord } from '../types';
import { formatDecimalHours } from '../utils/formatters';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell, LabelList } from 'recharts';
import { 
  buildAbsenteeismFacts, 
  calculateAbsenteeismSummary, 
  calculateAbsenteeismByRegional,
  calculateAbsenteeismMonthlyEvolution,
  calculateAbsenteeismByCostCenter,
  calculateAbsenteeismByFunction,
  calculateAbsenteeismByEmployee,
  generateExecutiveDiagnosis,
  analyzeAbsenteeismOvertimeCorrelation
} from '../domain/absenteeism';
import { DEFAULT_ABSENTEEISM_TARGETS, AbsenteeismGroupSummary, AbsenteeismOvertimeCorrelation } from '../domain/absenteeismTypes';
import { getCCRegional } from '../data/ccMaster';

interface AbsenteeismDashboardProps {
  data: OvertimeRecord[];
  regional?: string;
  costCenter?: string;
  functionName?: string;
  budgetMonthKeys: string[];
  dateMode: 'PAYROLL' | 'ANNUAL' | 'CUSTOM';
  selectedMonth: string;
  user: UserProfile | null;
  periodStart: Date;
  periodEnd: Date;
  headcountRecords: HeadcountRecord[];
}

const formatPercent = (value: number) => {
  return (value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
};

const formatPercentAbs = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const AbsenteeismDashboard: React.FC<AbsenteeismDashboardProps> = ({ data, regional, costCenter, functionName, headcountRecords, periodStart, periodEnd }) => {
  
  const filteredHeadcountRecords = useMemo(() => {
      const startStr = periodStart.toISOString().slice(0, 10);
      const endStr = periodEnd.toISOString().slice(0, 10);
      return headcountRecords.filter(h => {
          if (h.dataInicio > endStr || h.dataFim < startStr) return false;
          if (regional && getCCRegional(h.centroCusto) !== regional) return false;
          if (costCenter && h.centroCusto !== costCenter) return false;
          if (functionName && h.funcao !== functionName) return false;
          return true;
      });
  }, [headcountRecords, periodStart, periodEnd, regional, costCenter, functionName]);

  const facts = useMemo(() => buildAbsenteeismFacts(data, filteredHeadcountRecords), [data, filteredHeadcountRecords]);
  const summary = useMemo(() => calculateAbsenteeismSummary(facts, filteredHeadcountRecords), [facts, filteredHeadcountRecords]);
  const regionalGroups = useMemo(() => calculateAbsenteeismByRegional(facts, filteredHeadcountRecords), [facts, filteredHeadcountRecords]);
  const evolutionGroups = useMemo(() => calculateAbsenteeismMonthlyEvolution(facts, filteredHeadcountRecords), [facts, filteredHeadcountRecords]);
  const costCenterGroups = useMemo(() => calculateAbsenteeismByCostCenter(facts, filteredHeadcountRecords), [facts, filteredHeadcountRecords]);
  const functionGroups = useMemo(() => calculateAbsenteeismByFunction(facts, filteredHeadcountRecords), [facts, filteredHeadcountRecords]);
  const employeeGroups = useMemo(() => calculateAbsenteeismByEmployee(facts, filteredHeadcountRecords), [facts, filteredHeadcountRecords]);
  const diagnosisText = useMemo(() => generateExecutiveDiagnosis(summary, regionalGroups, costCenterGroups), [summary, regionalGroups, costCenterGroups]);
  const correlations = useMemo(() => analyzeAbsenteeismOvertimeCorrelation(facts, data), [facts, data]);


  const renderBadge = (status: 'OK' | 'ATTENTION' | 'CRITICAL', deviation: number) => {
    let color = 'bg-gray-100 text-gray-700 border border-gray-200';
    let label = 'N/A';
    if (status === 'OK') {
        color = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
        label = 'No alvo';
    } else if (status === 'ATTENTION') {
        color = 'bg-amber-50 text-amber-700 border border-amber-200';
        label = 'Atenção';
    } else if (status === 'CRITICAL') {
        color = 'bg-red-50 text-red-700 border border-red-200';
        label = 'Crítico';
    }

    return (
      <div className="flex flex-col items-center">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${color} shadow-sm`}>
            {label}
        </span>
        {deviation > 0 && <span className="text-[9px] text-gray-500 mt-0.5">+{formatPercent(deviation)}</span>}
      </div>
    );
  };

  const renderRiskBadge = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => {
      let color = 'bg-gray-100 text-gray-700';
      if (risk === 'HIGH') color = 'bg-red-100 text-red-700 font-bold';
      if (risk === 'MEDIUM') color = 'bg-orange-100 text-orange-700 font-medium';
      if (risk === 'LOW') color = 'bg-green-100 text-green-700';

      const labels: Record<string, string> = {
          'LOW': 'Baixo',
          'MEDIUM': 'Médio',
          'HIGH': 'Alto'
      };

      return (
          <span className={`px-2 py-1 rounded text-[10px] uppercase ${color}`}>
              {labels[risk]}
          </span>
      );
  }

  const getStatusByRate = (rate: number, target: number): 'OK' | 'ATTENTION' | 'CRITICAL' => {
      if (rate <= target) return 'OK';
      if (rate <= target * 1.25) return 'ATTENTION';
      return 'CRITICAL';
  };

  const pctTotal = (part: number, total: number) => total > 0 ? (part / total) * 100 : 0;
  
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  const chartData = evolutionGroups.map(item => {
      let displayLabel = item.id;
      if (displayLabel !== 'Unknown') {
        const clean = displayLabel.replace(/-Payroll$/i, '');
        const parts = clean.split('-');
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10);
          if (m >= 1 && m <= 12) {
            displayLabel = `${monthNames[m - 1]}/${parts[0].slice(-2)}`;
          }
        }
      }
      return {
          displayLabel,
          atrasos: item.delayHours,
          faltas: item.absenceHours,
          total: item.totalHours,
          taxaAbsenteismo: item.absenteeismRate * 100
      };
  });

  const sortedRegionals = [...regionalGroups].sort((a, b) => a.id.localeCompare(b.id));

  // Função helper para renderizar tabelas de ranking
  const renderRankingTable = (title: string, data: AbsenteeismGroupSummary[], target: number) => (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-gray-50 bg-gray-50/30">
              <h4 className="text-sm font-bold text-gray-900">{title}</h4>
              <p className="text-[10px] text-gray-500">Todos os registros (Critério: Status e Taxa)</p>
          </div>
          <div className="p-0 flex-grow overflow-x-auto overflow-y-auto max-h-[350px]">
              <table className="w-full text-xs text-left relative">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-semibold sticky top-0 z-10 shadow-sm">
                      <tr>
                          <th className="px-4 py-2 bg-gray-50">Identificação</th>
                          <th className="px-4 py-2 bg-gray-50 text-right">Horas</th>
                          <th className="px-4 py-2 bg-gray-50 text-right">Taxa</th>
                          <th className="px-4 py-2 bg-gray-50 text-center">Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                      {data.filter(d => d.totalHours > 0).map((row, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-4 py-2 font-medium text-gray-700 truncate max-w-[150px]" title={row.label}>{row.label}</td>
                              <td className="px-4 py-2 text-right text-gray-600">{formatDecimalHours(row.totalHours)}h</td>
                              <td className="px-4 py-2 text-right text-gray-900 font-bold">{formatPercent(row.absenteeismRate)}</td>
                              <td className="px-4 py-2 text-center">{renderBadge(row.status, row.deviationFromTarget)}</td>
                          </tr>
                      ))}
                      {data.filter(d => d.totalHours > 0).length === 0 && (
                          <tr>
                              <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Nenhum ofensor encontrado no período.</td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
  );

  return (
    <div className="space-y-6">
      
      {/* Header Actions Removidos */}


      {/* Alertas de Inteligência Gerencial */}
      {correlations.filter(c => c.correlationRisk === 'HIGH' || c.correlationRisk === 'MEDIUM').length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2 uppercase mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  Alertas de Inteligência: Reposição Custosa de Mão de Obra
              </h3>
              <div className="space-y-3">
                  {correlations.filter(c => c.correlationRisk === 'HIGH' || c.correlationRisk === 'MEDIUM').slice(0, 3).map((c, i) => (
                      <div key={i} className="bg-white rounded-lg p-4 border border-orange-100 shadow-sm flex items-start gap-4">
                          <div className="shrink-0 mt-1">{renderRiskBadge(c.correlationRisk)}</div>
                          <div>
                              <div className="font-bold text-gray-800 text-sm">{c.costCenter} - {c.costCenterName}</div>
                              <p className="text-xs text-gray-600 mt-1">{c.alertMessage}</p>
                              <div className="flex gap-4 mt-2 text-xs">
                                  <div className="text-gray-500">Horas Faltas: <span className="font-bold text-[#1e3a8a]">{formatDecimalHours(c.absenteeismHours)}h</span></div>
                                  <div className="text-gray-500">Horas Extras: <span className="font-bold text-orange-600">{formatDecimalHours(c.overtimeHours)}h</span></div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Cards Superiores */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Card: Taxa Absenteísmo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-base font-bold text-[#1e3a8a] flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                TAXA DE ABSENTEÍSMO
              </h3>
              {renderBadge(getStatusByRate(summary.absenteeismRate, DEFAULT_ABSENTEEISM_TARGETS.totalRate), summary.absenteeismRate - DEFAULT_ABSENTEEISM_TARGETS.totalRate)}
            </div>
            <p className="text-[11px] text-gray-500 mb-6">Calculada via disponibilidade real (Headcount: {summary.headcount})</p>
            
            <div className="flex justify-between items-end mb-4">
              <div>
                <div className="text-5xl font-black text-gray-900 tracking-tight leading-none mb-1">
                  {formatPercent(summary.absenteeismRate)}
                </div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Taxa Geral</div>
              </div>
              
              <div className="flex gap-6 text-right">
                <div className="pl-4">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Faltas</div>
                  <div className="text-2xl font-bold text-gray-900">{formatPercent(summary.absenceRate)}</div>
                  <div className="text-[10px] text-gray-400 font-medium bg-gray-50 rounded px-1 mt-1 inline-block">{formatPercentAbs(pctTotal(summary.absenceHours, summary.totalHours))}% do abs.</div>
                </div>
                <div className="border-l border-gray-100 pl-4">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Atrasos</div>
                  <div className="text-2xl font-bold text-gray-900">{formatPercent(summary.delayRate)}</div>
                  <div className="text-[10px] text-gray-400 font-medium bg-gray-50 rounded px-1 mt-1 inline-block">{formatPercentAbs(pctTotal(summary.delayHours, summary.totalHours))}% do abs.</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 shadow-inner">
            <div style={{ width: `${pctTotal(summary.absenceHours, summary.totalHours)}%` }} className="bg-gradient-to-r from-blue-900 to-blue-700 transition-all duration-1000" title="Faltas"></div>
            <div style={{ width: `${pctTotal(summary.delayHours, summary.totalHours)}%` }} className="bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-1000" title="Atrasos"></div>
          </div>
        </div>

        {/* Card: Horas de Absenteísmo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-base font-bold text-[#1e3a8a] flex items-center gap-2 uppercase">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Horas e Custos
              </h3>
              <div className="text-right">
                <div className="text-3xl font-black text-gray-900 tracking-tight leading-none">{formatDecimalHours(summary.totalHours)} h</div>
                <div className="text-[10px] text-gray-500 uppercase font-bold mt-1 tracking-wider">Total Perdido</div>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mb-6">Impacto financeiro e operacional consolidado</p>
            
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Faltas</div>
                <div className="text-xl font-bold text-[#1e3a8a]">{formatDecimalHours(summary.absenceHours)} <span className="text-xs font-medium">h</span></div>
              </div>
              <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100/50">
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Atrasos</div>
                <div className="text-xl font-bold text-orange-600">{formatDecimalHours(summary.delayHours)} <span className="text-xs font-medium">h</span></div>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Dias Eq.</div>
                <div className="text-xl font-bold text-gray-900">{summary.equivalentDays.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</div>
              </div>
              <div className="bg-red-50/50 p-3 rounded-xl border border-red-100/50 relative overflow-hidden">
                <div className="text-[10px] text-red-500/80 font-bold uppercase mb-1">Custo Estimado</div>
                <div className="text-lg font-black text-red-600 truncate" title={summary.estimatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })}>
                  {summary.estimatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 shadow-inner mt-auto">
            <div style={{ width: `${pctTotal(summary.absenceHours, summary.totalHours)}%` }} className="bg-gradient-to-r from-blue-900 to-blue-700 transition-all duration-1000" title="Faltas"></div>
            <div style={{ width: `${pctTotal(summary.delayHours, summary.totalHours)}%` }} className="bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-1000" title="Atrasos"></div>
          </div>
        </div>

      </div>

      {/* Rankings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderRankingTable("Por Centro de Custo", costCenterGroups, DEFAULT_ABSENTEEISM_TARGETS.totalRate)}
          {renderRankingTable("Por Função", functionGroups, DEFAULT_ABSENTEEISM_TARGETS.totalRate)}
          {renderRankingTable("Por Colaborador", employeeGroups, DEFAULT_ABSENTEEISM_TARGETS.totalRate)}
      </div>

      {/* Tabela de Absenteísmo por Regional */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
                <h3 className="text-base font-bold text-[#1e3a8a] flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Distribuição Regional
                </h3>
                <p className="text-[11px] text-gray-500 mt-1">Comparativo direto com as metas de diretoria</p>
            </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th className="px-6 py-4 bg-gray-50/50 text-gray-700 font-bold border-b border-gray-200 uppercase text-xs tracking-wider">KPIs</th>
                {sortedRegionals.map(reg => (
                  <th key={reg.id} colSpan={3} className="px-4 py-4 bg-gray-50/50 text-gray-700 font-bold border-b border-gray-200 text-center border-l border-gray-200 uppercase text-xs tracking-wider">
                    {reg.label}
                  </th>
                ))}
                <th colSpan={3} className="px-4 py-4 bg-blue-50/30 text-[#1e3a8a] font-black border-b border-gray-200 text-center border-l border-gray-200 uppercase text-xs tracking-wider">
                  Consolidado
                </th>
              </tr>
              <tr>
                <th className="px-6 py-2 bg-gray-50/30 border-b border-gray-100"></th>
                {sortedRegionals.map(reg => (
                  <React.Fragment key={`sub-${reg.id}`}>
                    <th className="px-2 py-2 bg-gray-50/30 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 text-center border-l border-gray-100">Meta</th>
                    <th className="px-2 py-2 bg-gray-50/30 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 text-center">Real</th>
                    <th className="px-2 py-2 bg-gray-50/30 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 text-center">Sts</th>
                  </React.Fragment>
                ))}
                <th className="px-2 py-2 bg-blue-50/20 text-[10px] font-bold text-gray-500 uppercase border-b border-gray-100 text-center border-l border-gray-100">Meta</th>
                <th className="px-2 py-2 bg-blue-50/20 text-[10px] font-bold text-[#1e3a8a] uppercase border-b border-gray-100 text-center">Real</th>
                <th className="px-2 py-2 bg-blue-50/20 text-[10px] font-bold text-gray-500 uppercase border-b border-gray-100 text-center">Sts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {/* Row 1: Taxa de Absenteísmo */}
              <tr className="hover:bg-blue-50/10 transition-colors">
                <td className="px-6 py-3 font-semibold text-gray-800">Taxa Geral</td>
                {sortedRegionals.map(reg => (
                  <React.Fragment key={`taxa-geral-${reg.id}`}>
                    <td className="px-2 py-3 text-center text-gray-400 border-l border-gray-50 text-xs">{formatPercent(DEFAULT_ABSENTEEISM_TARGETS.totalRate)}</td>
                    <td className="px-2 py-3 text-center font-bold text-gray-900">{formatPercent(reg.absenteeismRate)}</td>
                    <td className="px-2 py-3 text-center">{renderBadge(reg.status, reg.deviationFromTarget)}</td>
                  </React.Fragment>
                ))}
                <td className="px-2 py-3 text-center text-gray-400 border-l border-gray-50 bg-blue-50/10 text-xs">{formatPercent(DEFAULT_ABSENTEEISM_TARGETS.totalRate)}</td>
                <td className="px-2 py-3 text-center font-black text-[#1e3a8a] bg-blue-50/10 text-lg">{formatPercent(summary.absenteeismRate)}</td>
                <td className="px-2 py-3 text-center bg-blue-50/10">{renderBadge(getStatusByRate(summary.absenteeismRate, DEFAULT_ABSENTEEISM_TARGETS.totalRate), summary.absenteeismRate - DEFAULT_ABSENTEEISM_TARGETS.totalRate)}</td>
              </tr>
              
              {/* Row 2: Taxa de Atrasos */}
              <tr className="hover:bg-blue-50/10 transition-colors">
                <td className="px-6 py-3 font-medium text-gray-500 pl-10 text-xs border-l-2 border-transparent">↳ Taxa de Atrasos</td>
                {sortedRegionals.map(reg => (
                  <React.Fragment key={`taxa-atrasos-${reg.id}`}>
                    <td className="px-2 py-3 text-center text-gray-300 border-l border-gray-50 text-xs">{formatPercent(DEFAULT_ABSENTEEISM_TARGETS.delayRate)}</td>
                    <td className="px-2 py-3 text-center text-gray-600 font-medium">{formatPercent(reg.delayRate)}</td>
                    <td className="px-2 py-3 text-center">{renderBadge(getStatusByRate(reg.delayRate, DEFAULT_ABSENTEEISM_TARGETS.delayRate), reg.delayRate - DEFAULT_ABSENTEEISM_TARGETS.delayRate)}</td>
                  </React.Fragment>
                ))}
                <td className="px-2 py-3 text-center text-gray-400 border-l border-gray-50 bg-blue-50/10 text-xs">{formatPercent(DEFAULT_ABSENTEEISM_TARGETS.delayRate)}</td>
                <td className="px-2 py-3 text-center font-bold text-gray-700 bg-blue-50/10">{formatPercent(summary.delayRate)}</td>
                <td className="px-2 py-3 text-center bg-blue-50/10">{renderBadge(getStatusByRate(summary.delayRate, DEFAULT_ABSENTEEISM_TARGETS.delayRate), summary.delayRate - DEFAULT_ABSENTEEISM_TARGETS.delayRate)}</td>
              </tr>

              {/* Row 3: Taxa de Faltas */}
              <tr className="hover:bg-blue-50/10 transition-colors border-b-2 border-gray-100">
                <td className="px-6 py-3 font-medium text-gray-500 pl-10 text-xs border-l-2 border-transparent">↳ Taxa de Faltas</td>
                {sortedRegionals.map(reg => (
                  <React.Fragment key={`taxa-faltas-${reg.id}`}>
                    <td className="px-2 py-3 text-center text-gray-300 border-l border-gray-50 text-xs">{formatPercent(DEFAULT_ABSENTEEISM_TARGETS.absenceRate)}</td>
                    <td className="px-2 py-3 text-center text-gray-600 font-medium">{formatPercent(reg.absenceRate)}</td>
                    <td className="px-2 py-3 text-center">{renderBadge(getStatusByRate(reg.absenceRate, DEFAULT_ABSENTEEISM_TARGETS.absenceRate), reg.absenceRate - DEFAULT_ABSENTEEISM_TARGETS.absenceRate)}</td>
                  </React.Fragment>
                ))}
                <td className="px-2 py-3 text-center text-gray-400 border-l border-gray-50 bg-blue-50/10 text-xs">{formatPercent(DEFAULT_ABSENTEEISM_TARGETS.absenceRate)}</td>
                <td className="px-2 py-3 text-center font-bold text-gray-700 bg-blue-50/10">{formatPercent(summary.absenceRate)}</td>
                <td className="px-2 py-3 text-center bg-blue-50/10">{renderBadge(getStatusByRate(summary.absenceRate, DEFAULT_ABSENTEEISM_TARGETS.absenceRate), summary.absenceRate - DEFAULT_ABSENTEEISM_TARGETS.absenceRate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Gráfico */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-base font-bold text-[#1e3a8a] mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            Evolução Mensal do Absenteísmo
        </h3>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="displayLabel" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip 
                 cursor={{ fill: '#f8fafc' }}
                 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                 formatter={(value: any, name: any) => {
                    if (name === 'Taxa Absenteísmo') return [`${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%`, name];
                    return [value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }), name];
                 }}
              />
              <Legend verticalAlign="top" align="left" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 500 }} />
              
              <Bar yAxisId="left" dataKey="atrasos" stackId="a" name="Horas Atrasos" fill="#f97316" barSize={40} radius={[0, 0, 4, 4]} />
              <Bar yAxisId="left" dataKey="faltas" stackId="a" name="Horas Faltas" fill="#1e3a8a" barSize={40} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="total" position="top" formatter={(v: any) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} style={{ fontSize: '10px', fill: '#64748b', fontWeight: 'bold' }} />
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="taxaAbsenteismo" name="Taxa Absenteísmo" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AbsenteeismDashboard;

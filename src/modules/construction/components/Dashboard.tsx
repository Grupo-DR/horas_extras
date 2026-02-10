
import React, { useMemo, useState } from 'react';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, ComposedChart, Legend, Cell, LabelList
} from 'recharts';
import { ConstructionRecord, ServicePrice, PlanningAssignment } from '../types';
import {
  Truck, BarChart3, AlertTriangle,
  MapPin, X, ChevronRight, Target, Zap, Activity, Filter,
  TrendingUp, ArrowDownRight, ClipboardCheck, Calendar
} from 'lucide-react';
import {
  calculateRecordFinancials, formatCurrency, formatCurrencyWithZero,
  getTrechoInfo, getEquipmentCategory, calculateAssignmentTotal,
  getPeriodInfo, getProductivityStatus, getUnifiedServiceInfo, getCycleKey
} from '../utils/calculations';

interface DashboardProps {
  data: ConstructionRecord[];
  servicePrices: ServicePrice[];
  assignments: PlanningAssignment[];
}

const Dashboard: React.FC<DashboardProps> = ({ data, servicePrices, assignments }) => {
  // Extrair todos os ciclos disponíveis nos dados
  const availableCycles = useMemo(() => {
    const cycles = Array.from(new Set(data.map(r => getCycleKey(r.data)))).sort().reverse();
    return cycles;
  }, [data]);

  const [selectedCycle, setSelectedCycle] = useState<string>(availableCycles[0] || '');
  const [selectedTrechoDetail, setSelectedTrechoDetail] = useState<any>(null);

  const stats = useMemo(() => {
    if (!selectedCycle && availableCycles.length > 0) return null;

    // Filtrar dados pelo ciclo selecionado
    const filteredRecords = data.filter(r => getCycleKey(r.data) === selectedCycle);

    // Obter datas do ciclo (Ex: se ciclo é 05-2024, periodo é 21/04 a 20/05)
    const [month, year] = (selectedCycle || '').split('-').map(Number);
    const refDate = new Date(year, month - 1, 15); // Meio do mês para garantir detecção do período
    const period = getPeriodInfo(refDate, filteredRecords);

    let realTotal = 0, realProdutivo = 0, realImprodutivo = 0;
    const byCategoryReal: Record<string, number> = {};
    const byDateReal: Record<string, number> = {};
    const byTrechoImprod: Record<string, number> = {};
    const byTrechoCityImprod: Record<string, Record<string, number>> = {};

    filteredRecords.forEach((curr) => {
      const financials = calculateRecordFinancials(curr, servicePrices);
      const geo = getTrechoInfo(curr.trechoFinal);
      const category = getEquipmentCategory(curr.frota);

      realTotal += financials.total;
      if (financials.status === 'IMPRODUTIVA') {
        realImprodutivo += financials.total;
        if (geo.trecho) {
          byTrechoImprod[geo.trecho] = (byTrechoImprod[geo.trecho] || 0) + financials.total;
          if (!byTrechoCityImprod[geo.trecho]) byTrechoCityImprod[geo.trecho] = {};
          const cityKey = geo.cidade || 'Não Identificada';
          byTrechoCityImprod[geo.trecho][cityKey] = (byTrechoCityImprod[geo.trecho][cityKey] || 0) + financials.total;
        }
      } else if (financials.status === 'PRODUTIVA') {
        realProdutivo += financials.total;
      }
      byCategoryReal[category] = (byCategoryReal[category] || 0) + financials.total;
      byDateReal[curr.data] = (byDateReal[curr.data] || 0) + financials.total;
    });

    // Filtrar planejamentos do ciclo
    const filteredAssignments = assignments.filter(a => {
      const parts = a.date.split('-');
      const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
      return getCycleKey(formatted) === selectedCycle;
    });

    let planejadoTotal = 0;
    const byDatePlan: Record<string, number> = {};
    filteredAssignments.forEach(a => {
      const parts = a.date.split('-');
      const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
      const totalA = calculateAssignmentTotal(a, servicePrices);
      planejadoTotal += totalA;
      byDatePlan[formatted] = (byDatePlan[formatted] || 0) + totalA;
    });

    const chartData = Array.from(new Set([...Object.keys(byDateReal), ...Object.keys(byDatePlan)]))
      .map(d => ({
        name: d,
        real: byDateReal[d] || 0,
        plan: byDatePlan[d] || 0,
        ts: new Date(d.split('/')[2] + '-' + d.split('/')[1] + '-' + d.split('/')[0]).getTime()
      })).sort((a, b) => a.ts - b.ts);

    const paretoCategory = Object.entries(byCategoryReal)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    const idleTrechoTable = Object.keys(byTrechoImprod).map(key => ({
      name: key, value: byTrechoImprod[key],
      cities: Object.entries(byTrechoCityImprod[key]).map(([name, value]) => ({ name, value }))
    })).sort((a, b) => b.value - a.value);

    return { realTotal, realProdutivo, realImprodutivo, planejadoTotal, period, chartData, paretoCategory, idleTrechoTable };
  }, [data, selectedCycle, servicePrices, assignments]);

  if (!stats) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <Calendar className="w-12 h-12 mb-4 opacity-20" />
      <p className="font-bold uppercase tracking-widest text-xs">Selecione um período para visualizar os dados</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header com Filtro de Ciclo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-500" /> Ciclo de Medição
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Dados de {stats.period.start.toLocaleDateString()} até {stats.period.end.toLocaleDateString()}</p>
        </div>
        <select
          value={selectedCycle}
          onChange={(e) => setSelectedCycle(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20"
        >
          {availableCycles.map(c => (
            <option key={c} value={c}>Ciclo {c.split('-')[0]}/{c.split('-')[1]}</option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Realizado no Ciclo</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{formatCurrencyWithZero(stats.realTotal)}</p>
          <div className="mt-4 flex gap-4">
            <div><p className="text-[8px] font-bold text-emerald-500 uppercase">Produtivo</p><p className="text-[10px] font-black">{formatCurrencyWithZero(stats.realProdutivo)}</p></div>
            <div><p className="text-[8px] font-bold text-red-400 uppercase">Improdutivo</p><p className="text-[10px] font-black">{formatCurrencyWithZero(stats.realImprodutivo)}</p></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Planejado</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{formatCurrencyWithZero(stats.planejadoTotal)}</p>
          <div className="mt-4">
            <p className="text-[8px] font-bold text-slate-400 uppercase">Aderência</p>
            <p className="text-[10px] font-black text-amber-600">{stats.planejadoTotal > 0 ? ((stats.realTotal / stats.planejadoTotal) * 100).toFixed(1) : '0'}%</p>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-800">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tendência Fechamento</p>
          <p className="text-2xl font-black text-amber-500 mt-1">
            {formatCurrencyWithZero(stats.realTotal + (stats.realTotal / (stats.period.daysWithMeasurement || 1)) * stats.period.remainingDays)}
          </p>
        </div>
      </div>

      {/* Gráfico de Evolução */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" /> Evolução Diária do Ciclo
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stats.chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickFormatter={val => `R$ ${val / 1000}k`} />
              <Tooltip formatter={(v: any) => formatCurrencyWithZero(v)} />
              <Legend />
              <Bar dataKey="plan" name="Planejado" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Line dataKey="real" name="Realizado" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

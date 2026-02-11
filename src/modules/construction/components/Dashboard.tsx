
import React, { useMemo, useState } from 'react';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, ComposedChart, Legend, Cell, LabelList, ReferenceLine
} from 'recharts';
import { ConstructionRecord, ServicePrice, PlanningAssignment } from '../types';
import {
  Truck, BarChart3, AlertTriangle,
  MapPin, X, ChevronRight, Target, Zap, Activity, Filter,
  TrendingUp, ArrowDownRight, ClipboardCheck, Calendar, DollarSign
} from 'lucide-react';
import {
  calculateRecordFinancials, formatCurrency, formatCurrencyWithZero,
  getTrechoInfo, getEquipmentCategory, calculateAssignmentTotal,
  getPeriodInfo, getProductivityStatus, getUnifiedServiceInfo, getCycleKey, getPeriodFromCycle
} from '../utils/calculations';
import { CategoryDetailModal, DayDetailModal } from './DashboardComponents';
import budgetData from '../data/budgets.json';

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
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<any>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedDayDetail, setSelectedDayDetail] = useState<any>(null);
  const [selectedEquipmentType, setSelectedEquipmentType] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');


  const stats = useMemo(() => {
    if (!selectedCycle && availableCycles.length > 0) return null;

    // Filtrar dados pelo ciclo selecionado
    let filteredRecords = data.filter(r => getCycleKey(r.data) === selectedCycle);

    // Aplicar filtro de tipo de equipamento
    if (selectedEquipmentType) {
      filteredRecords = filteredRecords.filter(r => getEquipmentCategory(r.frota) === selectedEquipmentType);
    }

    // Aplicar filtro de equipamento específico
    if (selectedEquipment) {
      filteredRecords = filteredRecords.filter(r => r.frota === selectedEquipment);
    }

    // Obter datas do ciclo (Ex: se ciclo é 05-2024, periodo é 21/04 a 20/05)
    // Usando a função canônica para garantir regra 21-20
    const { start, end } = getPeriodFromCycle(selectedCycle);

    // getPeriodInfo agora usa getPeriodFromCycle internamente, então podemos passar qualquer data dentro do range
    // Mas para manter compatibilidade com o retorno esperado de getPeriodInfo (que inclui dias úteis/medidos), chamamos ele.
    // Ele precisa apenas de uma data de referência. Usamos o meio do período.
    const refDate = new Date((start.getTime() + end.getTime()) / 2);
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

    // Preparar dados detalhados por data incluindo registros completos
    const byDateEquipments: Record<string, { frota: string; value: number; planned: number }[]> = {};
    const byDateRecords: Record<string, any[]> = {}; // Armazena registros completos por data

    filteredRecords.forEach((curr) => {
      const financials = calculateRecordFinancials(curr, servicePrices);
      const geo = getTrechoInfo(curr.trechoFinal);

      // Armazenar registro completo com informações financeiras e geográficas
      if (!byDateRecords[curr.data]) byDateRecords[curr.data] = [];
      byDateRecords[curr.data].push({
        ...curr,
        financials,
        geo
      });

      // Agregação por equipamento (para compatibilidade)
      if (!byDateEquipments[curr.data]) byDateEquipments[curr.data] = [];
      const existing = byDateEquipments[curr.data].find(e => e.frota === curr.frota);
      if (existing) {
        existing.value += financials.total;
      } else {
        byDateEquipments[curr.data].push({ frota: curr.frota, value: financials.total, planned: 0 });
      }
    });

    filteredAssignments.forEach(a => {
      const parts = a.date.split('-');
      const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
      if (!byDateEquipments[formatted]) byDateEquipments[formatted] = [];
      const existing = byDateEquipments[formatted].find(e => e.frota === a.frota);
      if (existing) {
        existing.planned += calculateAssignmentTotal(a, servicePrices);
      } else {
        byDateEquipments[formatted].push({ frota: a.frota, value: 0, planned: calculateAssignmentTotal(a, servicePrices) });
      }
    });

    const chartData = Array.from(new Set([...Object.keys(byDateReal), ...Object.keys(byDatePlan)]))
      .map(d => ({
        name: d,
        real: byDateReal[d] || 0,
        plan: byDatePlan[d] || 0,
        equipments: byDateEquipments[d] || [],
        records: byDateRecords[d] || [], // Adiciona registros completos
        ts: new Date(d.split('/')[2] + '-' + d.split('/')[1] + '-' + d.split('/')[0]).getTime()
      })).sort((a, b) => a.ts - b.ts);

    // Calculate budget for current cycle
    const cycleEndDate = end;
    const budgetMonth = cycleEndDate.getMonth() + 2; // +1 for next month, +1 because getMonth() is 0-indexed
    const budgetYear = budgetMonth > 12 ? cycleEndDate.getFullYear() + 1 : cycleEndDate.getFullYear();
    const normalizedBudgetMonth = budgetMonth > 12 ? 1 : budgetMonth;

    const monthBudgets = budgetData.budgets.filter(
      b => b.month === normalizedBudgetMonth && b.year === budgetYear
    );

    const totalBudget = monthBudgets.reduce((sum, b) => sum + b.value, 0);

    // Calculate daily budget (budget divided by number of days in period)
    const periodDays = chartData.length;
    const dailyBudget = periodDays > 0 ? totalBudget / periodDays : 0;

    const paretoCategory = Object.entries(byCategoryReal)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    const idleTrechoTable = Object.keys(byTrechoImprod).map(key => ({
      name: key, value: byTrechoImprod[key],
      cities: Object.entries(byTrechoCityImprod[key]).map(([name, value]) => ({ name, value }))
    })).sort((a, b) => b.value - a.value);


    // Pareto de Faturamento por Tipo de Equipamento (ABC)
    const paretoRevenue = Object.entries(byCategoryReal)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index, arr) => {
        const total = arr.reduce((sum, [, v]) => sum + v, 0);
        const accumulated = arr.slice(0, index + 1).reduce((sum, [, v]) => sum + v, 0);
        const accumulatedPercentage = (accumulated / total) * 100;
        let abcClass = 'C';
        if (accumulatedPercentage <= 80) abcClass = 'A';
        else if (accumulatedPercentage <= 95) abcClass = 'B';
        return { name, value, abcClass };
      });

    // Pareto de Horas Improdutivas por Tipo de Equipamento (ABC)
    const byCategoryIdle: Record<string, number> = {};
    filteredRecords.forEach((curr) => {
      const financials = calculateRecordFinancials(curr, servicePrices);
      const category = getEquipmentCategory(curr.frota);
      if (financials.status === 'IMPRODUTIVA') {
        byCategoryIdle[category] = (byCategoryIdle[category] || 0) + financials.total;
      }
    });

    const paretoIdle = Object.entries(byCategoryIdle)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index, arr) => {
        const total = arr.reduce((sum, [, v]) => sum + v, 0);
        const accumulated = arr.slice(0, index + 1).reduce((sum, [, v]) => sum + v, 0);
        const accumulatedPercentage = (accumulated / total) * 100;
        let abcClass = 'C';
        if (accumulatedPercentage <= 80) abcClass = 'A';
        else if (accumulatedPercentage <= 95) abcClass = 'B';
        return { name, value, abcClass };
      });

    // Tabela de Equipamentos: Planejado vs Real
    const equipmentTable: Record<string, {
      planned: number;
      actual: number;
      equipments: string[];
      equipmentDetails: { frota: string; planned: number; actual: number; difference: number }[]
    }> = {};

    filteredRecords.forEach((curr) => {
      const financials = calculateRecordFinancials(curr, servicePrices);
      const category = getEquipmentCategory(curr.frota);
      if (!equipmentTable[category]) {
        equipmentTable[category] = { planned: 0, actual: 0, equipments: [], equipmentDetails: [] };
      }
      equipmentTable[category].actual += financials.total;
      if (!equipmentTable[category].equipments.includes(curr.frota)) {
        equipmentTable[category].equipments.push(curr.frota);
      }

      // Track individual equipment
      let detail = equipmentTable[category].equipmentDetails.find(d => d.frota === curr.frota);
      if (!detail) {
        detail = { frota: curr.frota, planned: 0, actual: 0, difference: 0 };
        equipmentTable[category].equipmentDetails.push(detail);
      }
      detail.actual += financials.total;
    });

    filteredAssignments.forEach(a => {
      const category = getEquipmentCategory(a.frota);
      const totalA = calculateAssignmentTotal(a, servicePrices);
      if (!equipmentTable[category]) {
        equipmentTable[category] = { planned: 0, actual: 0, equipments: [], equipmentDetails: [] };
      }
      equipmentTable[category].planned += totalA;
      if (!equipmentTable[category].equipments.includes(a.frota)) {
        equipmentTable[category].equipments.push(a.frota);
      }

      // Track individual equipment
      let detail = equipmentTable[category].equipmentDetails.find(d => d.frota === a.frota);
      if (!detail) {
        detail = { frota: a.frota, planned: 0, actual: 0, difference: 0 };
        equipmentTable[category].equipmentDetails.push(detail);
      }
      detail.planned += totalA;
    });

    // Calculate differences
    Object.values(equipmentTable).forEach(cat => {
      cat.equipmentDetails.forEach(detail => {
        detail.difference = detail.actual - detail.planned;
      });
      cat.equipmentDetails.sort((a, b) => b.actual - a.actual);
    });

    const equipmentComparison = Object.entries(equipmentTable)
      .map(([category, data]) => ({
        category,
        planned: data.planned,
        actual: data.actual,
        difference: data.actual - data.planned,
        equipments: data.equipments.sort(),
        equipmentDetails: data.equipmentDetails
      }))
      .sort((a, b) => b.actual - a.actual);

    // Tabela de Equipamentos Improdutivos (apenas valores improdutivos)
    const idleEquipmentTable: Record<string, {
      idle: number;
      equipmentDetails: { frota: string; idle: number }[]
    }> = {};

    filteredRecords.forEach((curr) => {
      const financials = calculateRecordFinancials(curr, servicePrices);
      if (financials.status === 'IMPRODUTIVA') {
        const category = getEquipmentCategory(curr.frota);
        if (!idleEquipmentTable[category]) {
          idleEquipmentTable[category] = { idle: 0, equipmentDetails: [] };
        }
        idleEquipmentTable[category].idle += financials.total;

        let detail = idleEquipmentTable[category].equipmentDetails.find(d => d.frota === curr.frota);
        if (!detail) {
          detail = { frota: curr.frota, idle: 0 };
          idleEquipmentTable[category].equipmentDetails.push(detail);
        }
        detail.idle += financials.total;
      }
    });

    // Sort equipment details by idle value
    Object.values(idleEquipmentTable).forEach(cat => {
      cat.equipmentDetails.sort((a, b) => b.idle - a.idle);
    });

    const idleComparison = Object.entries(idleEquipmentTable)
      .map(([category, data]) => ({
        category,
        idle: data.idle,
        equipmentDetails: data.equipmentDetails
      }))
      .sort((a, b) => b.idle - a.idle);

    return {
      realTotal, realProdutivo, realImprodutivo, planejadoTotal, period, chartData,
      paretoCategory, idleTrechoTable, paretoRevenue, paretoIdle, equipmentComparison, idleComparison,
      totalBudget, dailyBudget
    };
  }, [data, selectedCycle, servicePrices, assignments, selectedEquipmentType, selectedEquipment]);

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

        {/* Equipment Type Filter */}
        <select
          value={selectedEquipmentType}
          onChange={(e) => {
            setSelectedEquipmentType(e.target.value);
            setSelectedEquipment(''); // Reset specific equipment when type changes
          }}
          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20"
        >
          <option value="">Todos os Tipos</option>
          {Array.from(new Set(data.filter(r => getCycleKey(r.data) === selectedCycle).map(r => getEquipmentCategory(r.frota)))).sort().map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        {/* Specific Equipment Filter */}
        <select
          value={selectedEquipment}
          onChange={(e) => setSelectedEquipment(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20"
          disabled={!selectedEquipmentType && data.filter(r => getCycleKey(r.data) === selectedCycle).length > 50}
        >
          <option value="">Todos os Equipamentos</option>
          {Array.from(new Set(
            data
              .filter(r => getCycleKey(r.data) === selectedCycle)
              .filter(r => !selectedEquipmentType || getEquipmentCategory(r.frota) === selectedEquipmentType)
              .map(r => r.frota)
          )).sort().map(frota => (
            <option key={frota} value={frota}>{frota}</option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Budget Card - FIRST */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl shadow-lg border border-blue-400 text-white">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-90">Budget do Ciclo</p>
          <p className="text-2xl font-black mt-1">{formatCurrencyWithZero(stats.totalBudget)}</p>
          <div className="mt-4">
            <p className="text-[8px] font-bold uppercase opacity-75">Diário Médio</p>
            <p className="text-[10px] font-black opacity-90">{formatCurrencyWithZero(stats.dailyBudget)}</p>
          </div>
        </div>

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
              <Legend />
              <Bar dataKey="plan" name="Planejado" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Line
                dataKey="real"
                name="Realizado"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ r: 4, fill: '#6366f1' }}
                activeDot={{
                  r: 6,
                  fill: '#6366f1',
                  cursor: 'pointer',
                  onClick: (e: any, payload: any) => setSelectedDayDetail(payload.payload)
                }}
              />
              <ReferenceLine y={stats.dailyBudget} stroke="#3b82f6" strokeDasharray="5 5" strokeWidth={2} label={{ value: 'Budget Diário', position: 'insideTopRight', fill: '#3b82f6', fontSize: 10, fontWeight: 'bold' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pareto de Faturamento por Tipo de Equipamento */}
      {stats.paretoRevenue.length > 0 && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Pareto de Faturamento por Tipo de Equipamento
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.paretoRevenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickFormatter={val => `R$ ${val / 1000}k`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} width={120} />
                <Tooltip formatter={(v: any) => formatCurrencyWithZero(v)} />
                <Bar
                  dataKey="value"
                  name="Faturamento"
                  radius={[0, 4, 4, 0]}
                  onClick={(data) => {
                    const category = stats.equipmentComparison.find(c => c.category === data.name);
                    if (category) {
                      setSelectedCategoryDetail({ ...category, type: 'revenue' });
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {stats.paretoRevenue.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.abcClass === 'A' ? '#10b981' : entry.abcClass === 'B' ? '#f59e0b' : '#ef4444'}
                    />
                  ))}
                  <LabelList dataKey="abcClass" position="right" style={{ fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Pareto de Horas Improdutivas por Tipo de Equipamento */}
      {stats.paretoIdle.length > 0 && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Pareto de R$ Horas Improdutivas por Tipo de Equipamento
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.paretoIdle} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickFormatter={val => `R$ ${val / 1000}k`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} width={120} />
                <Tooltip formatter={(v: any) => formatCurrencyWithZero(v)} />
                <Bar
                  dataKey="value"
                  name="Improdutivo"
                  radius={[0, 4, 4, 0]}
                  onClick={(data) => {
                    const category = stats.idleComparison.find(c => c.category === data.name);
                    if (category) {
                      setSelectedCategoryDetail({ ...category, type: 'idle' });
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {stats.paretoIdle.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.abcClass === 'A' ? '#ef4444' : entry.abcClass === 'B' ? '#f59e0b' : '#94a3b8'}
                    />
                  ))}
                  <LabelList dataKey="abcClass" position="right" style={{ fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabela de Equipamentos: Planejado vs Real */}
      {stats.equipmentComparison.length > 0 && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-500" /> Comparativo: Planejado vs Realizado por Tipo de Equipamento
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Tipo de Equipamento</th>
                  <th className="text-right py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Faturamento Planejado</th>
                  <th className="text-right py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Faturamento Real</th>
                  <th className="text-right py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.equipmentComparison.map((row, i) => {
                  const isExpanded = expandedCategories.has(row.category);

                  return (
                    <React.Fragment key={i}>
                      {/* Category Row */}
                      <tr
                        className="hover:bg-slate-50 transition-colors bg-slate-50/50 cursor-pointer"
                        onClick={() => {
                          const newExpanded = new Set(expandedCategories);
                          if (isExpanded) {
                            newExpanded.delete(row.category);
                          } else {
                            newExpanded.add(row.category);
                          }
                          setExpandedCategories(newExpanded);
                        }}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <ChevronRight
                              className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            />
                            <span className="text-sm font-bold text-slate-900">{row.category}</span>
                            <span className="text-xs text-slate-400">({row.equipments.length} equipamentos)</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-bold text-slate-600">{formatCurrencyWithZero(row.planned)}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-bold text-indigo-600">{formatCurrencyWithZero(row.actual)}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`text-sm font-bold ${row.difference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {row.difference >= 0 ? '+' : ''}{formatCurrencyWithZero(row.difference)}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Equipment Details */}
                      {isExpanded && row.equipmentDetails.map((eq, j) => (
                        <tr key={`${i}-${j}`} className="bg-slate-50/30">
                          <td className="py-2 px-4 pl-12">
                            <span className="text-xs text-slate-600">{eq.frota}</span>
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className="text-xs text-slate-500">{formatCurrencyWithZero(eq.planned)}</span>
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className="text-xs text-indigo-500">{formatCurrencyWithZero(eq.actual)}</span>
                          </td>
                          <td className="py-2 px-4 text-right">
                            <span className={`text-xs font-semibold ${eq.difference >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {eq.difference >= 0 ? '+' : ''}{formatCurrencyWithZero(eq.difference)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Detail Modal */}
      {selectedCategoryDetail && (
        <CategoryDetailModal
          category={selectedCategoryDetail}
          onClose={() => setSelectedCategoryDetail(null)}
          type={selectedCategoryDetail.type}
        />
      )}

      {/* Day Detail Modal */}
      {selectedDayDetail && (
        <DayDetailModal
          day={selectedDayDetail}
          onClose={() => setSelectedDayDetail(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;

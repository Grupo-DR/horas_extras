
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
  calculateRecordFinancials, formatCurrencyWithZero,
  getTrechoInfo, getEquipmentCategory, calculateAssignmentTotal,
  getProductivityStatus, getUnifiedServiceInfo, getCycleKey, getPeriodFromCycle
} from '../utils/calculations';
import { CategoryDetailModal, DayDetailModal } from './DashboardComponents';
import budgetData from '../data/budgets.json';

interface DashboardProps {
  data: ConstructionRecord[];
  servicePrices: ServicePrice[];
  assignments: PlanningAssignment[];
  availableCycles?: string[];
  selectedCycle?: string;
  onCycleChange?: (cycle: string) => void;
}

interface ComparisonMetric {
  delta: number;
  percent: number | null;
}

const DAY_MS = 1000 * 60 * 60 * 24;

const toIsoDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDashboardDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  let d = 0;
  let m = 0;
  let y = 0;

  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    d = Number(parts[0]);
    m = Number(parts[1]);
    y = Number(parts[2]);
  } else if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    y = Number(parts[0]);
    m = Number(parts[1]);
    d = Number(parts[2]);
  } else {
    return null;
  }

  const parsed = new Date(y, m - 1, d);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const countBusinessDays = (start: Date, end: Date): number => {
  if (start > end) return 0;

  let total = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (cursor <= endDate) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
};

const countCalendarDaysInclusive = (start: Date, end: Date): number => {
  if (start > end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
};

const buildComparison = (value: number, baseline: number): ComparisonMetric => ({
  delta: value - baseline,
  percent: baseline > 0 ? (value / baseline) * 100 : null
});

const formatComparisonPercent = (value: number | null): string => (
  value === null ? 'n/d' : `${value.toFixed(1)}%`
);

const normalizeRealFrota = (frota: string): string => {
  const normalized = String(frota || '').trim();
  return normalized.toUpperCase() === 'CM-005' ? 'CM-005/SR-005' : normalized;
};

const Dashboard: React.FC<DashboardProps> = ({
  data,
  servicePrices,
  assignments,
  availableCycles: externalCycles,
  selectedCycle: externalSelectedCycle,
  onCycleChange
}) => {
  // Extrair todos os ciclos disponíveis nos dados (fallback se não vier de fora)
  const availableCycles = useMemo(() => {
    if (externalCycles && externalCycles.length > 0) {
      return externalCycles;
    }
    const cycles = Array.from(new Set(data.map(r => getCycleKey(r.data)))).sort().reverse();
    return cycles;
  }, [data, externalCycles]);

  const [selectedCycle, setSelectedCycle] = useState<string>(
    externalSelectedCycle || availableCycles[0] || ''
  );

  // Sync internal state with external prop if it changes
  React.useEffect(() => {
    if (externalSelectedCycle && externalSelectedCycle !== selectedCycle) {
      setSelectedCycle(externalSelectedCycle);
    }
  }, [externalSelectedCycle]);

  const handleCycleChange = (cycle: string) => {
    setSelectedCycle(cycle);
    if (onCycleChange) {
      onCycleChange(cycle);
    }
  };

  const [selectedTrechoDetail, setSelectedTrechoDetail] = useState<any>(null);
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<any>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedDayDetail, setSelectedDayDetail] = useState<any>(null);
  const [selectedEquipmentType, setSelectedEquipmentType] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [rangeStartDate, setRangeStartDate] = useState<string>('');
  const [rangeEndDate, setRangeEndDate] = useState<string>('');

  const cycleDateBounds = useMemo(() => {
    if (!selectedCycle) return null;
    return getPeriodFromCycle(selectedCycle);
  }, [selectedCycle]);

  React.useEffect(() => {
    if (!cycleDateBounds) return;
    setRangeStartDate(toIsoDateString(cycleDateBounds.start));
    setRangeEndDate(toIsoDateString(cycleDateBounds.end));
  }, [cycleDateBounds]);


  const stats = useMemo(() => {
    if (!selectedCycle && availableCycles.length > 0) return null;
    if (!selectedCycle) return null;

    const { start: cycleStartRaw, end: cycleEndRaw } = getPeriodFromCycle(selectedCycle);
    const cycleStart = new Date(cycleStartRaw);
    cycleStart.setHours(0, 0, 0, 0);
    const cycleEnd = new Date(cycleEndRaw);
    cycleEnd.setHours(0, 0, 0, 0);

    const parsedRangeStart = parseDashboardDate(rangeStartDate);
    const parsedRangeEnd = parseDashboardDate(rangeEndDate);

    const rangeStart = new Date(parsedRangeStart ? parsedRangeStart.getTime() : cycleStart.getTime());
    const rangeEnd = new Date(parsedRangeEnd ? parsedRangeEnd.getTime() : cycleEnd.getTime());

    if (rangeStart < cycleStart) rangeStart.setTime(cycleStart.getTime());
    if (rangeEnd > cycleEnd) rangeEnd.setTime(cycleEnd.getTime());
    if (rangeEnd < rangeStart) rangeEnd.setTime(rangeStart.getTime());

    const toBrDateKey = (date: Date): string => {
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      return `${d}/${m}/${date.getFullYear()}`;
    };

    const isWithinRange = (rawDate: string): boolean => {
      const parsed = parseDashboardDate(rawDate);
      if (!parsed) return false;
      return parsed >= rangeStart && parsed <= rangeEnd;
    };

    let filteredRecords = data.filter(r => getCycleKey(r.data) === selectedCycle && isWithinRange(r.data));

    if (selectedEquipmentType) {
      filteredRecords = filteredRecords.filter(r => getEquipmentCategory(normalizeRealFrota(r.frota)) === selectedEquipmentType);
    }

    if (selectedEquipment) {
      filteredRecords = filteredRecords.filter(r => normalizeRealFrota(r.frota) === selectedEquipment);
    }

    let filteredAssignments = assignments.filter(a => {
      if (getCycleKey(a.date) !== selectedCycle) return false;
      return isWithinRange(a.date);
    });

    if (selectedEquipmentType) {
      filteredAssignments = filteredAssignments.filter(a => getEquipmentCategory(a.frota) === selectedEquipmentType);
    }

    if (selectedEquipment) {
      filteredAssignments = filteredAssignments.filter(a => a.frota === selectedEquipment);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let realTotal = 0;
    let realProdutivo = 0;
    let realImprodutivo = 0;
    let realToDate = 0;
    const measuredDates = new Set<string>();
    const byCategoryReal: Record<string, number> = {};
    const byDateReal: Record<string, number> = {};
    const byTrechoImprod: Record<string, number> = {};
    const byTrechoCityImprod: Record<string, Record<string, number>> = {};

    filteredRecords.forEach((curr) => {
      const financials = calculateRecordFinancials(curr, servicePrices);
      const geo = getTrechoInfo(curr.trechoFinal);
      const realFrota = normalizeRealFrota(curr.frota);
      const category = getEquipmentCategory(realFrota);
      const recordDate = parseDashboardDate(curr.data);
      if (!recordDate) return;

      const dateKey = toBrDateKey(recordDate);
      measuredDates.add(toIsoDateString(recordDate));
      realTotal += financials.total;
      if (recordDate <= today) {
        realToDate += financials.total;
      }
      if (financials.status === 'IMPRODUTIVA') {
        realImprodutivo += financials.total;
        if (geo.trecho) {
          byTrechoImprod[geo.trecho] = (byTrechoImprod[geo.trecho] || 0) + financials.total;
          if (!byTrechoCityImprod[geo.trecho]) byTrechoCityImprod[geo.trecho] = {};
          const cityKey = geo.cidade || 'Nao Identificada';
          byTrechoCityImprod[geo.trecho][cityKey] = (byTrechoCityImprod[geo.trecho][cityKey] || 0) + financials.total;
        }
      } else if (financials.status === 'PRODUTIVA') {
        realProdutivo += financials.total;
      }
      byCategoryReal[category] = (byCategoryReal[category] || 0) + financials.total;
      byDateReal[dateKey] = (byDateReal[dateKey] || 0) + financials.total;
    });

    let planejadoTotal = 0;
    let projectedFuturePlan = 0;
    const byDatePlan: Record<string, number> = {};
    filteredAssignments.forEach(a => {
      const assignmentDate = parseDashboardDate(a.date);
      if (!assignmentDate) return;
      const formatted = toBrDateKey(assignmentDate);
      const totalA = calculateAssignmentTotal(a, servicePrices);
      planejadoTotal += totalA;
      byDatePlan[formatted] = (byDatePlan[formatted] || 0) + totalA;
      if (assignmentDate > today) {
        projectedFuturePlan += totalA;
      }
    });

    const byDateEquipments: Record<string, { frota: string; value: number; planned: number }[]> = {};
    const byDatePlannedServices: Record<string, { frota: string; item: string; planned: number }[]> = {};
    const byDateRecords: Record<string, any[]> = {};

    filteredRecords.forEach((curr) => {
      const financials = calculateRecordFinancials(curr, servicePrices);
      const geo = getTrechoInfo(curr.trechoFinal);
      const realFrota = normalizeRealFrota(curr.frota);
      const recordDate = parseDashboardDate(curr.data);
      if (!recordDate) return;
      const dateKey = toBrDateKey(recordDate);

      if (!byDateRecords[dateKey]) byDateRecords[dateKey] = [];
      byDateRecords[dateKey].push({
        ...curr,
        frota: realFrota,
        financials,
        geo
      });

      if (!byDateEquipments[dateKey]) byDateEquipments[dateKey] = [];
      const existing = byDateEquipments[dateKey].find(e => e.frota === realFrota);
      if (existing) {
        existing.value += financials.total;
      } else {
        byDateEquipments[dateKey].push({ frota: realFrota, value: financials.total, planned: 0 });
      }
    });

    filteredAssignments.forEach(a => {
      const assignmentDate = parseDashboardDate(a.date);
      if (!assignmentDate) return;
      const formatted = toBrDateKey(assignmentDate);

      if (!byDatePlannedServices[formatted]) byDatePlannedServices[formatted] = [];
      a.services.forEach(service => {
        const info = getUnifiedServiceInfo(service.item, servicePrices);
        const plannedValue = (service.producao || 0) * info.precoTotal;
        const existingService = byDatePlannedServices[formatted].find(
          s => s.frota === a.frota && s.item === service.item
        );

        if (existingService) {
          existingService.planned += plannedValue;
        } else {
          byDatePlannedServices[formatted].push({
            frota: a.frota,
            item: service.item,
            planned: plannedValue
          });
        }
      });

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
        plannedServices: byDatePlannedServices[d] || [],
        records: byDateRecords[d] || [],
        ts: new Date(d.split('/')[2] + '-' + d.split('/')[1] + '-' + d.split('/')[0]).getTime()
      }))
      .sort((a, b) => a.ts - b.ts);

    const period = {
      start: rangeStart,
      end: rangeEnd,
      totalDaysInPeriod: countCalendarDaysInclusive(rangeStart, rangeEnd),
      daysWithMeasurement: measuredDates.size,
      remainingDays: (() => {
        const projectionStart = new Date(Math.max(today.getTime(), rangeStart.getTime()));
        return projectionStart > rangeEnd ? 0 : countBusinessDays(projectionStart, rangeEnd);
      })()
    };

    const budgetMonth = cycleEnd.getMonth() + 2;
    const budgetYear = budgetMonth > 12 ? cycleEnd.getFullYear() + 1 : cycleEnd.getFullYear();
    const normalizedBudgetMonth = budgetMonth > 12 ? 1 : budgetMonth;

    const monthBudgets = budgetData.budgets.filter(
      b => b.month === normalizedBudgetMonth && b.year === budgetYear
    );

    const cycleBudget = monthBudgets.reduce((sum, b) => sum + b.value, 0);
    const cycleBusinessDays = countBusinessDays(cycleStart, cycleEnd);
    const selectedRangeBusinessDays = countBusinessDays(rangeStart, rangeEnd);
    const totalBudget = cycleBusinessDays > 0 ? (cycleBudget * selectedRangeBusinessDays) / cycleBusinessDays : 0;
    const dailyBudget = selectedRangeBusinessDays > 0 ? totalBudget / selectedRangeBusinessDays : 0;
    const elapsedBusinessDays = (() => {
      const elapsedEnd = new Date(Math.min(today.getTime(), rangeEnd.getTime()));
      return elapsedEnd < rangeStart ? 0 : countBusinessDays(rangeStart, elapsedEnd);
    })();

    const budgetConsumedPct = totalBudget > 0 ? (realTotal / totalBudget) * 100 : null;
    const budgetRemaining = totalBudget - realTotal;
    const realDailyAvg = elapsedBusinessDays > 0 ? realToDate / elapsedBusinessDays : 0;
    const burnRatePct = dailyBudget > 0 ? (realDailyAvg / dailyBudget) * 100 : null;

    const paretoCategory = Object.entries(byCategoryReal)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    const idleTrechoTable = Object.keys(byTrechoImprod).map(key => ({
      name: key,
      value: byTrechoImprod[key],
      cities: Object.entries(byTrechoCityImprod[key]).map(([name, value]) => ({ name, value }))
    })).sort((a, b) => b.value - a.value);

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

    const byCategoryIdle: Record<string, number> = {};
    filteredRecords.forEach((curr) => {
      const financials = calculateRecordFinancials(curr, servicePrices);
      const category = getEquipmentCategory(normalizeRealFrota(curr.frota));
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

    const equipmentTable: Record<string, {
      planned: number;
      actual: number;
      equipments: string[];
      equipmentDetails: { frota: string; planned: number; actual: number; difference: number }[];
    }> = {};

    filteredRecords.forEach((curr) => {
      const financials = calculateRecordFinancials(curr, servicePrices);
      const realFrota = normalizeRealFrota(curr.frota);
      const category = getEquipmentCategory(realFrota);
      if (!equipmentTable[category]) {
        equipmentTable[category] = { planned: 0, actual: 0, equipments: [], equipmentDetails: [] };
      }
      equipmentTable[category].actual += financials.total;
      if (!equipmentTable[category].equipments.includes(realFrota)) {
        equipmentTable[category].equipments.push(realFrota);
      }

      let detail = equipmentTable[category].equipmentDetails.find(d => d.frota === realFrota);
      if (!detail) {
        detail = { frota: realFrota, planned: 0, actual: 0, difference: 0 };
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

      let detail = equipmentTable[category].equipmentDetails.find(d => d.frota === a.frota);
      if (!detail) {
        detail = { frota: a.frota, planned: 0, actual: 0, difference: 0 };
        equipmentTable[category].equipmentDetails.push(detail);
      }
      detail.planned += totalA;
    });

    Object.values(equipmentTable).forEach(cat => {
      cat.equipmentDetails.forEach(detail => {
        detail.difference = detail.actual - detail.planned;
      });
      cat.equipmentDetails.sort((a, b) => b.actual - a.actual);
    });

    const equipmentComparison = Object.entries(equipmentTable)
      .map(([category, categoryData]) => ({
        category,
        planned: categoryData.planned,
        actual: categoryData.actual,
        difference: categoryData.actual - categoryData.planned,
        equipments: categoryData.equipments.sort(),
        equipmentDetails: categoryData.equipmentDetails
      }))
      .sort((a, b) => b.actual - a.actual);

    const idleEquipmentTable: Record<string, {
      idle: number;
      equipmentDetails: { frota: string; idle: number }[];
    }> = {};

    filteredRecords.forEach((curr) => {
      const financials = calculateRecordFinancials(curr, servicePrices);
      if (financials.status === 'IMPRODUTIVA') {
        const realFrota = normalizeRealFrota(curr.frota);
        const category = getEquipmentCategory(realFrota);
        if (!idleEquipmentTable[category]) {
          idleEquipmentTable[category] = { idle: 0, equipmentDetails: [] };
        }
        idleEquipmentTable[category].idle += financials.total;

        let detail = idleEquipmentTable[category].equipmentDetails.find(d => d.frota === realFrota);
        if (!detail) {
          detail = { frota: realFrota, idle: 0 };
          idleEquipmentTable[category].equipmentDetails.push(detail);
        }
        detail.idle += financials.total;
      }
    });

    Object.values(idleEquipmentTable).forEach(cat => {
      cat.equipmentDetails.sort((a, b) => b.idle - a.idle);
    });

    const idleComparison = Object.entries(idleEquipmentTable)
      .map(([category, categoryData]) => ({
        category,
        idle: categoryData.idle,
        equipmentDetails: categoryData.equipmentDetails
      }))
      .sort((a, b) => b.idle - a.idle);

    const sapItemMap: Record<string, {
      item: string;
      description: string;
      planned: number;
      actual: number;
    }> = {};

    servicePrices.forEach(sp => {
      const info = getUnifiedServiceInfo(sp.item, servicePrices);
      if (!sapItemMap[sp.item]) {
        sapItemMap[sp.item] = {
          item: sp.item,
          description: info.descricao,
          planned: 0,
          actual: 0
        };
      }
    });

    filteredRecords.forEach(r => {
      const financials = calculateRecordFinancials(r, servicePrices);
      if (sapItemMap[r.item]) {
        sapItemMap[r.item].actual += financials.total;
      }
    });

    filteredAssignments.forEach(a => {
      a.services.forEach(s => {
        const info = getUnifiedServiceInfo(s.item, servicePrices);
        if (sapItemMap[s.item]) {
          sapItemMap[s.item].planned += (s.producao * info.precoTotal);
        }
      });
    });

    const sapComparison = Object.values(sapItemMap)
      .map(item => ({
        ...item,
        difference: item.actual - item.planned
      }))
      .filter(item => item.planned > 0 || item.actual > 0)
      .sort((a, b) => b.actual - a.actual);

    const ritmoFechamento = period.daysWithMeasurement > 0
      ? realTotal + (realTotal / period.daysWithMeasurement) * period.remainingDays
      : realTotal;
    const tendenciaFechamento = realToDate + projectedFuturePlan;

    const ritmoVsPlanejado = buildComparison(ritmoFechamento, planejadoTotal);
    const ritmoVsBudget = buildComparison(ritmoFechamento, totalBudget);
    const tendenciaVsPlanejado = buildComparison(tendenciaFechamento, planejadoTotal);
    const tendenciaVsBudget = buildComparison(tendenciaFechamento, totalBudget);
    const realVsPlanejado = buildComparison(realTotal, planejadoTotal);
    const realVsBudget = buildComparison(realTotal, totalBudget);
    const productiveSharePct = realTotal > 0 ? (realProdutivo / realTotal) * 100 : null;
    const improdutiveSharePct = realTotal > 0 ? (realImprodutivo / realTotal) * 100 : null;
    const plannedDailyAvg = selectedRangeBusinessDays > 0 ? planejadoTotal / selectedRangeBusinessDays : 0;
    const plannedToDate = planejadoTotal - projectedFuturePlan;
    const plannedRemaining = planejadoTotal - realTotal;
    const plannedExecutionPct = planejadoTotal > 0 ? (realTotal / planejadoTotal) * 100 : null;
    const adherenceToDatePct = plannedToDate > 0 ? (realToDate / plannedToDate) * 100 : null;
    const realToDateVsPlannedToDate = realToDate - plannedToDate;

    return {
      realTotal,
      realProdutivo,
      realImprodutivo,
      planejadoTotal,
      period,
      chartData,
      paretoCategory,
      idleTrechoTable,
      paretoRevenue,
      paretoIdle,
      equipmentComparison,
      idleComparison,
      totalBudget,
      dailyBudget,
      sapComparison,
      ritmoFechamento,
      tendenciaFechamento,
      realToDate,
      projectedFuturePlan,
      ritmoVsPlanejado,
      ritmoVsBudget,
      tendenciaVsPlanejado,
      tendenciaVsBudget,
      selectedRangeBusinessDays,
      elapsedBusinessDays,
      budgetConsumedPct,
      budgetRemaining,
      realDailyAvg,
      burnRatePct,
      realVsPlanejado,
      realVsBudget,
      productiveSharePct,
      improdutiveSharePct,
      plannedDailyAvg,
      plannedToDate,
      plannedRemaining,
      plannedExecutionPct,
      adherenceToDatePct,
      realToDateVsPlannedToDate
    };
  }, [
    data,
    selectedCycle,
    servicePrices,
    assignments,
    selectedEquipmentType,
    selectedEquipment,
    rangeStartDate,
    rangeEndDate,
    availableCycles.length
  ]);

  const cycleStartIso = cycleDateBounds ? toIsoDateString(cycleDateBounds.start) : '';
  const cycleEndIso = cycleDateBounds ? toIsoDateString(cycleDateBounds.end) : '';

  if (!stats) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <Calendar className="w-12 h-12 mb-4 opacity-20" />
      <p className="font-bold uppercase tracking-widest text-xs">Selecione um período para visualizar os dados</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header com Filtro de Ciclo */}
      <div className="flex flex-col gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Filter className="w-4 h-4 text-amber-500" /> Ciclo de Medicao
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
              Intervalo selecionado: {stats.period.start.toLocaleDateString()} ate {stats.period.end.toLocaleDateString()}
            </p>
          </div>

          <select
            value={selectedCycle}
            onChange={(e) => handleCycleChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            {availableCycles.map(c => (
              <option key={c} value={c}>Ciclo {c.split('-')[0]}/{c.split('-')[1]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Data inicial</label>
            <input
              type="date"
              value={rangeStartDate}
              min={cycleStartIso}
              max={rangeEndDate || cycleEndIso}
              onChange={(e) => {
                const nextStart = e.target.value;
                setRangeStartDate(nextStart);
                if (rangeEndDate && nextStart > rangeEndDate) {
                  setRangeEndDate(nextStart);
                }
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Data final</label>
            <input
              type="date"
              value={rangeEndDate}
              min={rangeStartDate || cycleStartIso}
              max={cycleEndIso}
              onChange={(e) => {
                const nextEnd = e.target.value;
                setRangeEndDate(nextEnd);
                if (rangeStartDate && nextEnd < rangeStartDate) {
                  setRangeStartDate(nextEnd);
                }
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tipo de equipamento</label>
            <select
              value={selectedEquipmentType}
              onChange={(e) => {
                setSelectedEquipmentType(e.target.value);
                setSelectedEquipment('');
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="">Todos os Tipos</option>
              {Array.from(new Set(data.filter(r => getCycleKey(r.data) === selectedCycle).map(r => getEquipmentCategory(normalizeRealFrota(r.frota))))).sort().map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Equipamento</label>
            <select
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20"
              disabled={!selectedEquipmentType && data.filter(r => getCycleKey(r.data) === selectedCycle).length > 50}
            >
              <option value="">Todos os Equipamentos</option>
              {Array.from(new Set(
                data
                  .filter(r => getCycleKey(r.data) === selectedCycle)
                  .filter(r => !selectedEquipmentType || getEquipmentCategory(normalizeRealFrota(r.frota)) === selectedEquipmentType)
                  .map(r => normalizeRealFrota(r.frota))
              )).sort().map(frota => (
                <option key={frota} value={frota}>{frota}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl shadow-lg border border-blue-400 text-white">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-90">Budget no Intervalo</p>
          <p className="text-2xl font-black mt-1">{formatCurrencyWithZero(stats.totalBudget)}</p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wider opacity-90">
              <span>Taxa de Aderencia</span>
              <span>{formatComparisonPercent(stats.budgetConsumedPct)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-white/20">
              <div
                className={`${(stats.budgetConsumedPct ?? 0) > 100 ? 'bg-amber-200' : 'bg-emerald-200'} h-full`}
                style={{ width: `${Math.max(0, Math.min(100, stats.budgetConsumedPct ?? 0))}%` }}
              />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-300/40">
            <div>
              <p className="text-[8px] font-bold uppercase opacity-75">Diario Medio</p>
              <p className="text-[10px] font-black opacity-90">{formatCurrencyWithZero(stats.dailyBudget)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Planejado</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{formatCurrencyWithZero(stats.planejadoTotal)}</p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[8px] font-black text-slate-500 uppercase tracking-wider">
              <span>Taxa de Aderencia</span>
              <span>{formatComparisonPercent(stats.plannedExecutionPct)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-slate-200">
              <div
                className={`${(stats.plannedExecutionPct ?? 0) <= 100 ? 'bg-amber-500' : 'bg-emerald-500'} h-full`}
                style={{ width: `${Math.max(0, Math.min(100, stats.plannedExecutionPct ?? 0))}%` }}
              />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200">
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Planejado por dia util</p>
              <p className="text-[10px] font-black">{formatCurrencyWithZero(stats.plannedDailyAvg)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Realizado no Intervalo</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{formatCurrencyWithZero(stats.realTotal)}</p>
          <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[8px] font-bold text-emerald-500 uppercase">Produtivo</p>
              <p className="text-[10px] font-black">{formatCurrencyWithZero(stats.realProdutivo)}</p>
              <p className="text-[9px] font-bold text-emerald-600">{formatComparisonPercent(stats.productiveSharePct)}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-red-400 uppercase">Improdutivo</p>
              <p className="text-[10px] font-black">{formatCurrencyWithZero(stats.realImprodutivo)}</p>
              <p className="text-[9px] font-bold text-red-500">{formatComparisonPercent(stats.improdutiveSharePct)}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">vs Budget</p>
              <p className={`text-[10px] font-black ${stats.realVsBudget.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats.realVsBudget.delta >= 0 ? '+' : ''}{formatCurrencyWithZero(stats.realVsBudget.delta)}
              </p>
              <p className="text-[9px] font-bold text-slate-600">{formatComparisonPercent(stats.realVsBudget.percent)}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">vs Planejado</p>
              <p className={`text-[10px] font-black ${stats.realVsPlanejado.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats.realVsPlanejado.delta >= 0 ? '+' : ''}{formatCurrencyWithZero(stats.realVsPlanejado.delta)}
              </p>
              <p className="text-[9px] font-bold text-slate-600">{formatComparisonPercent(stats.realVsPlanejado.percent)}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Media diaria real</p>
              <p className="text-[10px] font-black">{formatCurrencyWithZero(stats.realDailyAvg)}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Dias uteis medidos</p>
              <p className="text-[10px] font-black">{stats.elapsedBusinessDays}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ritmo de Fechamento</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {formatCurrencyWithZero(stats.ritmoFechamento)}
          </p>
          <div className="mt-3">
            <p className="text-[8px] font-bold text-slate-400 uppercase">Base de Medicao</p>
            <p className="text-[10px] font-black text-slate-700">{stats.period.daysWithMeasurement} dia(s)</p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">vs Budget</p>
              <p className={`text-[10px] font-black ${stats.ritmoVsBudget.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats.ritmoVsBudget.delta >= 0 ? '+' : ''}{formatCurrencyWithZero(stats.ritmoVsBudget.delta)}
              </p>
              <p className="text-[9px] font-bold text-slate-700">{formatComparisonPercent(stats.ritmoVsBudget.percent)}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">vs Planejado</p>
              <p className={`text-[10px] font-black ${stats.ritmoVsPlanejado.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats.ritmoVsPlanejado.delta >= 0 ? '+' : ''}{formatCurrencyWithZero(stats.ritmoVsPlanejado.delta)}
              </p>
              <p className="text-[9px] font-bold text-slate-700">{formatComparisonPercent(stats.ritmoVsPlanejado.percent)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tendencia de Fechamento</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {formatCurrencyWithZero(stats.tendenciaFechamento)}
          </p>
          <div className="mt-4 flex gap-4">
            <div>
              <p className="text-[8px] font-bold text-emerald-500 uppercase">Real ate hoje</p>
              <p className="text-[10px] font-black text-emerald-700">{formatCurrencyWithZero(stats.realToDate)}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-emerald-500 uppercase">Projetado futuro</p>
              <p className="text-[10px] font-black text-emerald-700">{formatCurrencyWithZero(stats.projectedFuturePlan)}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">vs Budget</p>
              <p className={`text-[10px] font-black ${stats.tendenciaVsBudget.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats.tendenciaVsBudget.delta >= 0 ? '+' : ''}{formatCurrencyWithZero(stats.tendenciaVsBudget.delta)}
              </p>
              <p className="text-[9px] font-bold text-slate-700">{formatComparisonPercent(stats.tendenciaVsBudget.percent)}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">vs Planejado</p>
              <p className={`text-[10px] font-black ${stats.tendenciaVsPlanejado.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats.tendenciaVsPlanejado.delta >= 0 ? '+' : ''}{formatCurrencyWithZero(stats.tendenciaVsPlanejado.delta)}
              </p>
              <p className="text-[9px] font-bold text-slate-700">{formatComparisonPercent(stats.tendenciaVsPlanejado.percent)}</p>
            </div>
          </div>
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
              <ReferenceLine y={stats.dailyBudget} stroke="#3b82f6" strokeDasharray="5 5" strokeWidth={2} label={{ value: 'Budget Diario (Uteis)', position: 'insideTopRight', fill: '#3b82f6', fontSize: 10, fontWeight: 'bold' }} />
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

      {/* Tabela Detalhada do Catálogo SAP */}
      {stats.sapComparison.length > 0 && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-amber-500" /> Indicadores por Item do Catálogo SAP
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Item</th>
                  <th className="text-left py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Descrição do Serviço</th>
                  <th className="text-right py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Planejado</th>
                  <th className="text-right py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Realizado</th>
                  <th className="text-right py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.sapComparison.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg uppercase">{row.item}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-slate-700">{row.description}</span>
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
                ))}
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


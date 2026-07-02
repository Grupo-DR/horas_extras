import {
  HistogramCategory,
  HistogramStatus,
  HistogramItem,
  HistogramAnalysisRow,
  HistogramAnalysisSummary,
  HistogramSourceGroup,
  RDOData,
  Project
} from '../types';

/**
 * Generates a simple UUID
 */
export const generateUUID = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * Normalizes a month string to YYYY-MM format.
 * Supports: 2026-01, 01/2026, Jan/2026, Janeiro/2026, etc.
 */
export const normalizeMonthKey = (value: string): string => {
  if (!value) throw new Error("Valor do mês está vazio.");

  const cleanValue = value.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Format: 2026-01
  const yyyyMm = cleanValue.match(/^(\d{4})-(\d{2})$/);
  if (yyyyMm) return `${yyyyMm[1]}-${yyyyMm[2].padStart(2, '0')}`;

  // Format: 01/2026
  const mmYyyy = cleanValue.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmYyyy) return `${mmYyyy[2]}-${mmYyyy[1].padStart(2, '0')}`;

  // Format: Name/YYYY or Name YYYY
  const monthMap: Record<string, string> = {
    jan: "01", janeiro: "01",
    fev: "02", fevereiro: "02",
    mar: "03", marco: "03",
    abr: "04", abril: "04",
    mai: "05", maio: "05",
    jun: "06", junho: "06",
    jul: "07", julho: "07",
    ago: "08", agosto: "08",
    set: "09", setembro: "09",
    out: "10", outubro: "10",
    nov: "11", novembro: "11",
    dez: "12", dezembro: "12"
  };

  const parts = cleanValue.split(/[\/\s-]/);
  let month = "";
  let year = "";

  parts.forEach(p => {
    if (monthMap[p]) month = monthMap[p];
    else if (p.match(/^\d{4}$/)) year = p;
    else if (p.match(/^\d{1,2}$/) && !month) {
      const m = parseInt(p);
      if (m >= 1 && m <= 12) month = p.padStart(2, '0');
    }
  });

  if (month && year) return `${year}-${month}`;

  throw new Error(`Formato de mês inválido: ${value}`);
};

/**
 * Formats YYYY-MM to Jan/YYYY
 */
export const formatMonthLabel = (monthKey: string): string => {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-");
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex]}/${year}`;
};

/**
 * Extracts YYYY-MM from a date string (DD/MM/YYYY)
 */
export const getRdoMonthKey = (dateStr: string): string => {
  if (!dateStr) return "";
  const [day, month, year] = dateStr.split("/");
  return `${year}-${month.padStart(2, '0')}`;
};

/**
 * Generates a list of month keys between start and end
 */
export const generateMonthRange = (startKey: string, endKey: string): string[] => {
  const [startYear, startMonth] = startKey.split('-').map(Number);
  const [endYear, endMonth] = endKey.split('-').map(Number);

  const months: string[] = [];
  let currentYear = startYear;
  let currentMonth = startMonth;

  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
    months.push(`${currentYear}-${currentMonth.toString().padStart(2, '0')}`);
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }
  return months;
};

/**
 * Normalizes item names for matching
 */
export const normalizeItemName = (value: string): string => {
  if (!value) return "";
  return value
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");
};

/**
 * Normalizes category names to standard keys
 */
export const normalizeHistogramCategory = (value: string): HistogramCategory => {
  if (!value) throw new Error("Categoria não informada.");

  const v = value.toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, "");

  if (v.includes("DIRETA")) return "MAO_OBRA_DIRETA";
  if (v.includes("INDIRETA")) return "MAO_OBRA_INDIRETA";
  if (v.includes("EQUIPAMENTO") || v.includes("VEICULO")) return "EQUIPAMENTOS";

  return "MAO_OBRA_DIRETA";
};

/**
 * Generates initial histogram base from RDO records
 */
export const generateHistogramFromRdos = (
  projectId: string,
  rdos: RDOData[],
  monthKeys: string[]
): HistogramItem[] => {
  const workforceItems = new Map<string, string>(); // normalized -> original
  const equipmentItems = new Map<string, string>(); // normalized -> original

  rdos.forEach(rdo => {
    rdo.workforce.forEach(w => {
      const norm = normalizeItemName(w.role);
      if (!workforceItems.has(norm)) workforceItems.set(norm, w.role);
    });
    rdo.equipment.forEach(e => {
      const norm = normalizeItemName(e.name);
      if (!equipmentItems.has(norm)) equipmentItems.set(norm, e.name);
    });
  });

  const items: HistogramItem[] = [];

  // Generate Workforce Items
  workforceItems.forEach((originalName, normName) => {
    items.push({
      id: generateUUID(),
      projectId,
      category: 'MAO_OBRA_DIRETA', // Default
      sourceGroup: 'WORKFORCE',
      name: originalName,
      normalizedName: normName,
      peakQty: 0,
      monthlyPlan: monthKeys.map(key => ({
        monthKey: key,
        monthLabel: formatMonthLabel(key),
        quantity: 0
      })),
      source: 'RDO_GENERATED'
    });
  });

  // Generate Equipment Items
  equipmentItems.forEach((originalName, normName) => {
    items.push({
      id: generateUUID(),
      projectId,
      category: 'EQUIPAMENTOS',
      sourceGroup: 'EQUIPMENT',
      name: originalName,
      normalizedName: normName,
      peakQty: 0,
      monthlyPlan: monthKeys.map(key => ({
        monthKey: key,
        monthLabel: formatMonthLabel(key),
        quantity: 0
      })),
      source: 'RDO_GENERATED'
    });
  });

  return items;
};

/**
 * Merges new items from RDO into existing histogram
 */
export const mergeHistogramItems = (
  existing: HistogramItem[],
  fromRdos: HistogramItem[]
): HistogramItem[] => {
  const result = [...existing];

  fromRdos.forEach(newItem => {
    const exists = result.find(e =>
      e.normalizedName === newItem.normalizedName &&
      e.sourceGroup === newItem.sourceGroup
    );

    if (!exists) {
      result.push(newItem);
    } else {
      // If it exists, we might want to ensure it has the correct months if month range changed
      newItem.monthlyPlan.forEach(p => {
        const monthExists = exists.monthlyPlan.find(ep => ep.monthKey === p.monthKey);
        if (!monthExists) {
          exists.monthlyPlan.push(p);
        }
      });
      // Sort months
      exists.monthlyPlan.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    }
  });

  return result;
};

/**
 * Calculates daily average from RDOS using sourceGroup
 */
export const calculateDailyAverageFromRdos = (
  rdos: RDOData[],
  monthKey: string,
  sourceGroup: HistogramSourceGroup
): Record<string, number> => {
  const monthRdos = rdos.filter(r => getRdoMonthKey(r.date) === monthKey);

  // Group by unique date
  const rdosByDate: Record<string, RDOData[]> = {};
  monthRdos.forEach(r => {
    if (!rdosByDate[r.date]) rdosByDate[r.date] = [];
    rdosByDate[r.date].push(r);
  });

  const uniqueDates = Object.keys(rdosByDate);
  const totalDays = uniqueDates.length;

  if (totalDays === 0) return {};

  const dailySums: Record<string, number> = {};

  uniqueDates.forEach(date => {
    const dayRdos = rdosByDate[date];

    dayRdos.forEach(rdo => {
      if (sourceGroup === 'EQUIPMENT') {
        rdo.equipment.forEach(e => {
          const normName = normalizeItemName(e.name);
          dailySums[normName] = (dailySums[normName] || 0) + e.count;
        });
      } else if (sourceGroup === 'WORKFORCE') {
        rdo.workforce.forEach(w => {
          const normName = normalizeItemName(w.role);
          dailySums[normName] = (dailySums[normName] || 0) + w.count;
        });
      }
    });
  });

  const averages: Record<string, number> = {};
  Object.keys(dailySums).forEach(name => {
    // Average = (Sum of all counts in the month) / (Number of days with reports)
    averages[name] = dailySums[name] / totalDays;
  });

  return averages;
};

/**
 * Main analysis calculation logic
 */
export const calculateHistogramAnalysis = (
  histogramItems: HistogramItem[],
  rdos: RDOData[],
  selectedMonthKey: string,
  tolerancePercent: number = 10
): { rows: HistogramAnalysisRow[], summary: HistogramAnalysisSummary } => {

  const rows: HistogramAnalysisRow[] = [];
  const processedRdoItemKeys = new Set<string>();

  // 1. Process items from Histogram (The Source of Truth)
  histogramItems.forEach(item => {
    const plannedMonth = item.monthlyPlan.find(p => p.monthKey === selectedMonthKey);
    const plannedQty = plannedMonth ? plannedMonth.quantity : 0;

    // Get actual average using sourceGroup
    const averages = calculateDailyAverageFromRdos(rdos, selectedMonthKey, item.sourceGroup);
    const actualQty = averages[item.normalizedName] || 0;

    processedRdoItemKeys.add(`${item.sourceGroup}-${item.normalizedName}`);

    const deviationQty = actualQty - plannedQty;
    const deviationPercent = plannedQty > 0
      ? (deviationQty / plannedQty) * 100
      : (actualQty > 0 ? 100 : 0);

    let status: HistogramStatus = 'OK';
    if (plannedQty === 0 && actualQty > 0) status = 'NAO_PLANEJADO';
    else if (plannedQty > 0 && actualQty === 0) status = 'SEM_APONTAMENTO';
    else if (deviationPercent < -tolerancePercent) status = 'ABAIXO';
    else if (deviationPercent > tolerancePercent) status = 'ACIMA';

    rows.push({
      itemName: item.name,
      normalizedName: item.normalizedName,
      category: item.category,
      peakQty: item.peakQty,
      plannedQty,
      actualQty,
      deviationQty,
      deviationPercent,
      status
    });
  });

  // 2. Add items that are in RDOS but NOT in Histogram (Truly unplanned)
  const groups: HistogramSourceGroup[] = ['WORKFORCE', 'EQUIPMENT'];
  groups.forEach(group => {
    const averages = calculateDailyAverageFromRdos(rdos, selectedMonthKey, group);
    Object.entries(averages).forEach(([normName, actualQty]) => {
      if (!processedRdoItemKeys.has(`${group}-${normName}`)) {
        rows.push({
          itemName: normName,
          normalizedName: normName,
          category: group === 'WORKFORCE' ? 'MAO_OBRA_DIRETA' : 'EQUIPAMENTOS',
          peakQty: 0,
          plannedQty: 0,
          actualQty,
          deviationQty: actualQty,
          deviationPercent: 100,
          status: 'NAO_PLANEJADO'
        });
      }
    });
  });

  // 3. Sort rows
  const statusPriority: Record<HistogramStatus, number> = {
    'SEM_APONTAMENTO': 0,
    'ABAIXO': 1,
    'NAO_PLANEJADO': 2,
    'ACIMA': 3,
    'OK': 4
  };
  rows.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);

  // 4. Summary
  const summary: HistogramAnalysisSummary = {
    totalItems: rows.length,
    okItems: rows.filter(r => r.status === 'OK').length,
    belowItems: rows.filter(r => r.status === 'ABAIXO').length,
    aboveItems: rows.filter(r => r.status === 'ACIMA').length,
    notPlannedItems: rows.filter(r => r.status === 'NAO_PLANEJADO').length,
    missingItems: rows.filter(r => r.status === 'SEM_APONTAMENTO').length,
    adherencePercent: 0,
    directLaborAdherencePercent: 0,
    indirectLaborAdherencePercent: 0,
    equipmentAdherencePercent: 0
  };

  if (summary.totalItems > 0) {
    summary.adherencePercent = (summary.okItems / summary.totalItems) * 100;
  }

  const calcCatAdherence = (cat: HistogramCategory) => {
    const catRows = rows.filter(r => r.category === cat);
    if (catRows.length === 0) return 100;
    return (catRows.filter(r => r.status === 'OK').length / catRows.length) * 100;
  };

  summary.directLaborAdherencePercent = calcCatAdherence('MAO_OBRA_DIRETA');
  summary.indirectLaborAdherencePercent = calcCatAdherence('MAO_OBRA_INDIRETA');
  summary.equipmentAdherencePercent = calcCatAdherence('EQUIPAMENTOS');

  return { rows, summary };
};

/**
 * Generates automated alerts based on analysis results
 */
export const generateHistogramAlerts = (
  rows: HistogramAnalysisRow[],
  summary: HistogramAnalysisSummary,
  selectedMonthKey: string
): string[] => {
  const alerts: string[] = [];
  const monthLabel = formatMonthLabel(selectedMonthKey);

  rows.forEach(row => {
    if (row.status === 'SEM_APONTAMENTO') {
      alerts.push(`O item ${row.itemName} está planejado (${row.plannedQty}), mas não possui apontamento nas RDOs de ${monthLabel}.`);
    } else if (row.status === 'ABAIXO') {
      alerts.push(`O item ${row.itemName} está ${Math.abs(row.deviationPercent).toFixed(1)}% ABAIXO do planejado em ${monthLabel}.`);
    } else if (row.status === 'NAO_PLANEJADO') {
      alerts.push(`O item ${row.itemName} aparece nas RDOs, mas NÃO está planejado no histograma de ${monthLabel}.`);
    } else if (row.status === 'ACIMA') {
      alerts.push(`O item ${row.itemName} está ${row.deviationPercent.toFixed(1)}% ACIMA do planejado em ${monthLabel}.`);
    }
  });

  if (summary.adherencePercent < 50) {
    alerts.push(`ALERTA CRÍTICO: A aderência geral ao histograma em ${monthLabel} é de apenas ${summary.adherencePercent.toFixed(1)}%.`);
  }

  return alerts;
};

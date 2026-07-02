import * as XLSX from 'xlsx';
import { RDOData, HistogramItem, HistogramCategory } from '../types';
import { normalizeItemName } from './histogramUtils';

interface ExportColumn {
  key: string; // Normalized name
  displayName: string;
  category: HistogramCategory;
  source: 'WORKFORCE' | 'EQUIPMENT';
}

/**
 * Classifies a workforce role as direct or indirect labor.
 * 1. Checks if configured in the project's histogram.
 * 2. Fallbacks to keyword matching.
 */
export const classifyWorkforceRole = (
  roleName: string, 
  histograms: HistogramItem[] = []
): HistogramCategory => {
  const normalized = normalizeItemName(roleName);
  
  // 1. Try to find in loaded histograms configuration
  const found = histograms.find(h => h.normalizedName === normalized);
  if (found && (found.category === 'MAO_OBRA_DIRETA' || found.category === 'MAO_OBRA_INDIRETA')) {
    return found.category;
  }
  
  // 2. Fallback to keywords commonly used for indirect labor in Brazil
  const indirectKeywords = [
    "ENCARREGADO", "ENGENHEIRO", "MESTRE", "TECNICO", "ADMINISTRATIVO", 
    "APONTADOR", "SEGURANCA", "SUPERVISOR", "GERENTE", "COORDENADOR", 
    "COMPRADOR", "ALMOXARIFE", "VIGIA", "APOIO", "AUXILIAR", "ESTAGIARIO"
  ];
  
  const isIndirect = indirectKeywords.some(keyword => normalized.includes(keyword));
  return isIndirect ? 'MAO_OBRA_INDIRETA' : 'MAO_OBRA_DIRETA';
};

/**
 * Parses a date string formatted as DD/MM/YYYY into a Date object.
 */
const parseDateString = (dateStr: string): Date => {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Consolidates daily workforce and equipment counts from RDOs and exports to Excel.
 */
export const exportRDOsToExcel = (
  rdos: RDOData[], 
  projectName: string,
  histograms: HistogramItem[] = [],
  fileName: string = 'diario_rdo_consolidado.xlsx'
) => {
  if (rdos.length === 0) {
    alert("Nenhum RDO encontrado para exportar.");
    return;
  }

  // 1. Collect all unique items and classify them
  const uniqueWorkforce = new Map<string, { displayName: string; category: HistogramCategory }>();
  const uniqueEquipment = new Map<string, { displayName: string }>();

  rdos.forEach(rdo => {
    rdo.workforce.forEach(w => {
      const norm = normalizeItemName(w.role);
      if (!norm) return;
      if (!uniqueWorkforce.has(norm)) {
        const cat = classifyWorkforceRole(w.role, histograms);
        uniqueWorkforce.set(norm, { displayName: w.role, category: cat });
      }
    });
    
    rdo.equipment.forEach(e => {
      const norm = normalizeItemName(e.name);
      if (!norm) return;
      if (!uniqueEquipment.has(norm)) {
        uniqueEquipment.set(norm, { displayName: e.name });
      }
    });
  });

  // 2. Separate and sort columns alphabetically by display name
  const directLaborCols: ExportColumn[] = [];
  const indirectLaborCols: ExportColumn[] = [];
  const equipmentCols: ExportColumn[] = [];

  uniqueWorkforce.forEach((val, key) => {
    const col: ExportColumn = {
      key,
      displayName: val.displayName,
      category: val.category,
      source: 'WORKFORCE'
    };
    if (val.category === 'MAO_OBRA_DIRETA') {
      directLaborCols.push(col);
    } else {
      indirectLaborCols.push(col);
    }
  });

  uniqueEquipment.forEach((val, key) => {
    equipmentCols.push({
      key,
      displayName: val.displayName,
      category: 'EQUIPAMENTOS',
      source: 'EQUIPMENT'
    });
  });

  directLaborCols.sort((a, b) => a.displayName.localeCompare(b.displayName));
  indirectLaborCols.sort((a, b) => a.displayName.localeCompare(b.displayName));
  equipmentCols.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const allColumns = [
    ...directLaborCols,
    ...indirectLaborCols,
    ...equipmentCols
  ];

  // 3. Group and aggregate RDO data by date
  // Map from "DD/MM/YYYY" to a Map of normalized item -> count sum
  const dataByDate = new Map<string, Map<string, number>>();

  rdos.forEach(rdo => {
    const dateStr = rdo.date;
    if (!dataByDate.has(dateStr)) {
      dataByDate.set(dateStr, new Map<string, number>());
    }
    const itemMap = dataByDate.get(dateStr)!;
    
    rdo.workforce.forEach(w => {
      const norm = normalizeItemName(w.role);
      if (!norm) return;
      itemMap.set(norm, (itemMap.get(norm) || 0) + w.count);
    });
    
    rdo.equipment.forEach(e => {
      const norm = normalizeItemName(e.name);
      if (!norm) return;
      itemMap.set(norm, (itemMap.get(norm) || 0) + e.count);
    });
  });

  // Get chronological unique dates
  const uniqueDates = Array.from(dataByDate.keys()).sort((a, b) => {
    return parseDateString(a).getTime() - parseDateString(b).getTime();
  });

  // 4. Build Excel Sheet Structure
  // Row 1: Category Headers (Merged later)
  const row1 = ["Data"];
  for (let i = 0; i < directLaborCols.length; i++) row1.push("Mão de Obra Direta");
  for (let i = 0; i < indirectLaborCols.length; i++) row1.push("Mão de Obra Indireta");
  for (let i = 0; i < equipmentCols.length; i++) row1.push("Equipamentos");

  // Row 2: Item Display Names
  const row2 = ["Data", ...allColumns.map(c => c.displayName)];

  // Data rows
  const dataRows = uniqueDates.map(dateStr => {
    const itemMap = dataByDate.get(dateStr)!;
    const row: (string | number)[] = [dateStr];
    allColumns.forEach(col => {
      const val = itemMap.get(col.key);
      row.push(val !== undefined ? val : 0);
    });
    return row;
  });

  const allData = [row1, row2, ...dataRows];

  // 5. Generate Worksheet and set formatting
  const ws = XLSX.utils.aoa_to_sheet(allData);

  // Setup merges
  const merges = [
    // A1 and A2 (Data header vertically merged)
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }
  ];

  // Merge Direct Labor categories
  if (directLaborCols.length > 1) {
    merges.push({ s: { r: 0, c: 1 }, e: { r: 0, c: directLaborCols.length } });
  }

  // Merge Indirect Labor categories
  if (indirectLaborCols.length > 1) {
    const start = 1 + directLaborCols.length;
    const end = directLaborCols.length + indirectLaborCols.length;
    merges.push({ s: { r: 0, c: start }, e: { r: 0, c: end } });
  }

  // Merge Equipment categories
  if (equipmentCols.length > 1) {
    const start = 1 + directLaborCols.length + indirectLaborCols.length;
    const end = start + equipmentCols.length - 1;
    merges.push({ s: { r: 0, c: start }, e: { r: 0, c: end } });
  }

  ws['!merges'] = merges;

  // Auto-fit column widths (with padding)
  const colsWidths = allData[1].map((_, colIdx) => {
    let maxLen = 10; // Default minimum width
    for (let rowIdx = 0; rowIdx < allData.length; rowIdx++) {
      // Ignore Row 0's category headers to avoid skewing column widths due to merged cell contents
      if (rowIdx === 0 && colIdx > 0) continue;
      
      const val = allData[rowIdx][colIdx];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxLen) {
          maxLen = len;
        }
      }
    }
    return { wch: maxLen + 4 };
  });
  ws['!cols'] = colsWidths;

  // 6. Create Workbook and Export
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Diário Consolidado");

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

import { read, utils } from 'xlsx';
import { 
  HistogramItem, 
  HistogramMonthlyPlan, 
  HistogramCategory 
} from '../types';
import { 
  normalizeMonthKey, 
  normalizeHistogramCategory, 
  formatMonthLabel,
  normalizeItemName,
  generateUUID 
} from '../utils/histogramUtils';

export interface HistogramImportResult {
  items: HistogramItem[];
  months: {
    monthKey: string;
    monthLabel: string;
  }[];
  errors: string[];
  warnings: string[];
}

/**
 * Parses the Histogram Excel file (Unified format)
 */
export const parseHistogramExcel = async (
  file: File, 
  projectId: string
): Promise<HistogramImportResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to rows
        const jsonData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          resolve({ items: [], months: [], errors: ["O arquivo está vazio ou não possui cabeçalhos."], warnings: [] });
          return;
        }

        const headers = jsonData[0].map(h => String(h || "").trim());
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate mandatory columns
        const catIdx = headers.findIndex(h => h.toLowerCase() === 'categoria');
        const itemIdx = headers.findIndex(h => h.toLowerCase() === 'item');
        const peakIdx = headers.findIndex(h => h.toLowerCase().includes('pico'));

        if (catIdx === -1) errors.push("Coluna 'Categoria' não encontrada.");
        if (itemIdx === -1) errors.push("Coluna 'Item' não encontrada.");
        if (peakIdx === -1) errors.push("Coluna 'Qtd Pico' não encontrada.");

        if (errors.length > 0) {
          resolve({ items: [], months: [], errors, warnings });
          return;
        }

        // Identify month columns (everything after the 3rd column or not cat/item/peak)
        const monthColumns: { index: number, key: string, label: string }[] = [];
        headers.forEach((h, idx) => {
          if (idx === catIdx || idx === itemIdx || idx === peakIdx) return;
          if (!h) return;
          try {
            const key = normalizeMonthKey(h);
            const label = formatMonthLabel(key);
            monthColumns.push({ index: idx, key, label });
          } catch (err) {
            // Log warning for unrecognized columns that might be intended as months
            if (h.length > 3) {
              warnings.push(`Coluna '${h}' ignorada por não ser reconhecida como um mês válido.`);
            }
          }
        });

        if (monthColumns.length === 0) {
          errors.push("Nenhuma coluna mensal válida encontrada (ex: 2026-01, Jan/2026).");
          resolve({ items: [], months: [], errors, warnings });
          return;
        }

        const items: HistogramItem[] = [];
        const uniqueCheck = new Set<string>();

        // Process rows
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const rawCat = String(row[catIdx] || "").trim();
          const rawItem = String(row[itemIdx] || "").trim();
          const peakQty = parseFloat(String(row[peakIdx] || "0")) || 0;

          if (!rawCat && !rawItem) continue; // Skip empty rows

          // 1. Normalize Category
          let category: HistogramCategory;
          try {
            category = normalizeHistogramCategory(rawCat);
          } catch (err) {
            errors.push(`Linha ${i + 1}: ${(err as Error).message}`);
            continue;
          }

          // 2. Normalize Item Name
          if (!rawItem) {
            errors.push(`Linha ${i + 1}: O nome do item não foi informado.`);
            continue;
          }
          const name = rawItem;
          const normalizedName = normalizeItemName(name);
          
          // 3. Duplicate check (Category + Normalized Name)
          const comboKey = `${category}-${normalizedName}`;
          if (uniqueCheck.has(comboKey)) {
            errors.push(`Item duplicado na mesma categoria: '${name}' em '${category}'.`);
            continue;
          }
          uniqueCheck.add(comboKey);

          // 4. Process monthly quantities
          const monthlyPlan: HistogramMonthlyPlan[] = [];
          let maxMonthly = 0;
          let allZero = true;

          monthColumns.forEach(col => {
            const val = parseFloat(String(row[col.index] || "0")) || 0;
            if (val > 0) allZero = false;
            if (val > maxMonthly) maxMonthly = val;

            monthlyPlan.push({
              monthKey: col.key,
              monthLabel: col.label,
              quantity: val
            });
          });

          // 5. Warnings
          if (allZero) {
            warnings.push(`O item '${name}' (${category}) possui todas as quantidades mensais zeradas.`);
          }
          if (peakQty !== maxMonthly && peakQty > 0) {
            warnings.push(`O item '${name}' tem Qtd Pico ${peakQty}, mas o maior valor mensal é ${maxMonthly}.`);
          }

          items.push({
            id: generateUUID(),
            projectId,
            category,
            name,
            normalizedName,
            peakQty,
            monthlyPlan
          });
        }

        // Return result
        if (items.length === 0 && errors.length === 0) {
          errors.push("Nenhum item válido encontrado no arquivo.");
        }

        const months = monthColumns.map(c => ({ monthKey: c.key, monthLabel: c.label }));

        resolve({ items, months, errors, warnings });
      } catch (err) {
        resolve({ 
          items: [], 
          months: [], 
          errors: [`Erro fatal ao processar Excel: ${err instanceof Error ? err.message : String(err)}`], 
          warnings: [] 
        });
      }
    };
    reader.onerror = () => resolve({ items: [], months: [], errors: ["Erro ao ler o arquivo."], warnings: [] });
    reader.readAsBinaryString(file);
  });
};

/**
 * dimensionsParser.ts
 * Parser de dimensões compatível com o novo padrão de abas:
 * 1. "dados da obra"
 * 2. "feriados"
 * 3. "equivalência"
 */

import { read, utils } from 'xlsx';
import {
  DimensionItem,
  DimensionGroup,
  DimensionImportResult,
  DimensionImportMetadata,
  DimensionPlanMonth,
} from '../types/analyticsTypes';
import { normalizeItemName, safeNumber, parseBrazilianDate } from '../core/normalizer';

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

export function normalizeSheetName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

function normalizeHeader(h: unknown): string {
  if (!h) return '';
  return String(h)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_\-]/g, '');
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function monthKeyToLabel(monthKey: string): string {
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [y, m] = monthKey.split('-');
  const idx = parseInt(m, 10) - 1;
  return `${labels[idx] ?? m}/${y}`;
}

function addMonths(monthKey: string, n: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const total = (y * 12 + m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

function parseDateToIso(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  const d = parseBrazilianDate(str);
  if (d) return toIsoDate(d);
  const num = parseFloat(str);
  if (!isNaN(num) && num > 1000) {
    const excelEpoch = new Date(1899, 11, 30);
    const d2 = new Date(excelEpoch.getTime() + num * 86400000);
    if (!isNaN(d2.getTime())) return toIsoDate(d2);
  }
  return null;
}

function normalizeGroup(raw: unknown): DimensionGroup {
  if (!raw) return 'OTHER';
  const v = normalizeHeader(raw);
  if (v.includes('MOD') || v.includes('DIRETA')) return 'MOD';
  if (v.includes('MOI') || v.includes('INDIRETA')) return 'MOI';
  if (v.includes('EQUIP') || v.includes('VEICULO') || v.includes('MAQUINA')) return 'EQUIP';
  if (v.includes('MATERIAL') || v.includes('INSUMO')) return 'MATERIAL';
  return 'OTHER';
}

function excelCellToIsoDate(cell: unknown): string | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (cell instanceof Date) return toIsoDate(cell);
  return parseDateToIso(cell);
}

// ---------------------------------------------------------------------------
// Processamento de "dados da obra"
// ---------------------------------------------------------------------------

function processDadosDaObra(worksheet: any): DimensionImportMetadata {
  const jsonData = utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '', blankrows: false });
  const meta: DimensionImportMetadata = {};
  
  if (jsonData.length < 2) return meta;

  const headers = (jsonData[0] as unknown[]).map(normalizeHeader);
  const values = jsonData[1] as unknown[];

  const getCol = (colName: string) => {
    const idx = headers.findIndex(h => h.includes(normalizeHeader(colName)));
    return idx !== -1 ? values[idx] : undefined;
  };

  const iCc = getCol('I_CC');
  if (iCc) meta.centroCusto = String(iCc).trim();

  const iStart = getCol('I_START');
  if (iStart) meta.iStart = excelCellToIsoDate(iStart) || undefined;

  const iEnd = getCol('I_END');
  if (iEnd) meta.iEnd = excelCellToIsoDate(iEnd) || undefined;

  const iValor = getCol('I_VALOR');
  if (iValor) meta.valorContratual = safeNumber(iValor);

  const iName = getCol('I_NAME');
  if (iName) meta.nomeObra = String(iName).trim();

  const iContrato = getCol('I_CONTRATO');
  if (iContrato) meta.contrato = String(iContrato).trim();

  const iCliente = getCol('I_CLIENTE');
  if (iCliente) meta.cliente = String(iCliente).trim();

  return meta;
}

// ---------------------------------------------------------------------------
// Processamento de "feriados"
// ---------------------------------------------------------------------------

function parseMonthPtBr(monthStr: string): number | null {
  const m = normalizeHeader(monthStr);
  if (m.startsWith('JAN')) return 1;
  if (m.startsWith('FEV')) return 2;
  if (m.startsWith('MAR')) return 3;
  if (m.startsWith('ABR')) return 4;
  if (m.startsWith('MAI')) return 5;
  if (m.startsWith('JUN')) return 6;
  if (m.startsWith('JUL')) return 7;
  if (m.startsWith('AGO')) return 8;
  if (m.startsWith('SET')) return 9;
  if (m.startsWith('OUT')) return 10;
  if (m.startsWith('NOV')) return 11;
  if (m.startsWith('DEZ')) return 12;
  const num = parseInt(monthStr, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return num;
  return null;
}

function processFeriados(worksheet: any): string[] {
  const jsonData = utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '', blankrows: false });
  const holidays: string[] = [];
  
  if (jsonData.length < 2) return holidays;

  const headers = (jsonData[0] as unknown[]).map(normalizeHeader);
  const anoIdx = headers.findIndex(h => h.includes('ANO'));
  const mesIdx = headers.findIndex(h => h.includes('MES'));
  const diaIdx = headers.findIndex(h => h.includes('DIA'));

  if (anoIdx === -1 || mesIdx === -1 || diaIdx === -1) return holidays;

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i] as unknown[];
    const ano = safeNumber(row[anoIdx]);
    const mes = parseMonthPtBr(String(row[mesIdx]));
    const dia = safeNumber(row[diaIdx]);

    if (ano > 0 && mes !== null && dia > 0) {
      const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      if (!holidays.includes(iso)) holidays.push(iso);
    }
  }

  return holidays.sort();
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

export async function parseDimensionsExcel(
  file: File,
  _projectId: string
): Promise<DimensionImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = read(data, { type: 'binary', cellDates: true });

        let sheetDados: any = null;
        let sheetFeriados: any = null;
        let sheetEquivalencia: any = null;

        for (const sheetName of workbook.SheetNames) {
          const norm = normalizeSheetName(sheetName);
          if (norm === 'dadosdaobra') sheetDados = workbook.Sheets[sheetName];
          else if (norm === 'feriados') sheetFeriados = workbook.Sheets[sheetName];
          else if (norm === 'equivalencia') sheetEquivalencia = workbook.Sheets[sheetName];
        }

        if (!sheetDados) {
          return resolve(emptyResult('Aba "dados da obra" não foi encontrada na planilha.'));
        }
        if (!sheetEquivalencia) {
          return resolve(emptyResult('Aba "equivalência" não foi encontrada na planilha.'));
        }

        // 1. Metadados
        const metadata = processDadosDaObra(sheetDados);
        if (!metadata.iStart) {
          return resolve(emptyResult('A data "i_start" na aba "dados da obra" é obrigatória e não foi identificada.'));
        }

        // 2. Feriados
        const holidays = sheetFeriados ? processFeriados(sheetFeriados) : [];

        // 3. Equivalência
        const eqData = utils.sheet_to_json<unknown[]>(sheetEquivalencia, { header: 1, defval: '', blankrows: false });
        if (eqData.length < 2) {
          return resolve(emptyResult('Aba "equivalência" está vazia.'));
        }

        const eqHeaders = (eqData[0] as unknown[]).map(normalizeHeader);
        const grupoIdx = eqHeaders.findIndex(h => h.includes('GRUPO'));
        const itemIdx = eqHeaders.findIndex(h => h.includes('ITEMPADRAO') || h === 'ITEM_PADRAO' || h.includes('ITEM'));
        const rdoIdx = eqHeaders.findIndex(h => h.includes('ITEMRDO') || h === 'ITEM_RDO');
        const custoIdx = eqHeaders.findIndex(h => h.includes('CUSTOMENSALUNITARIO') || h.includes('CUSTO'));
        
        if (itemIdx === -1) {
          return resolve(emptyResult('Coluna "Item_Padrao" não encontrada na aba "equivalência".'));
        }

        const qtdPlanPattern = /QTDPLAN|QTDMES|QTD_PLAN_MES_/;
        const qtdCols: number[] = [];
        eqHeaders.forEach((h, idx) => {
          if (qtdPlanPattern.test(h)) qtdCols.push(idx);
        });
        qtdCols.sort((a, b) => a - b);

        const items: DimensionItem[] = [];
        const seenNames = new Set<string>();
        const warnings: string[] = [];
        let errorCount = 0;
        let totalRows = 0;

        const anchorD = parseBrazilianDate(metadata.iStart) ?? new Date(metadata.iStart);
        const anchorMonthKey = `${anchorD.getFullYear()}-${String(anchorD.getMonth() + 1).padStart(2, '0')}`;

        for (let i = 1; i < eqData.length; i++) {
          const row = eqData[i] as unknown[];
          if (!row || row.length === 0) continue;

          const rawName = String(row[itemIdx] ?? '').trim();
          if (!rawName) continue;

          totalRows++;
          const normalizedName = normalizeItemName(rawName);

          if (seenNames.has(normalizedName)) {
            warnings.push(`Equivalência linha ${i + 1}: item duplicado '${rawName}'.`);
            errorCount++;
            continue;
          }
          seenNames.add(normalizedName);

          const rawGroup = grupoIdx !== -1 ? row[grupoIdx] : undefined;
          const group = normalizeGroup(rawGroup);
          const hasMissingGroup = !rawGroup || String(rawGroup).trim() === '';

          const rawCusto = custoIdx !== -1 ? row[custoIdx] : undefined;
          const monthlyUnitCost = safeNumber(rawCusto);
          const hasMissingCost = rawCusto === undefined || rawCusto === '' || rawCusto === null;

          let rdoEquivalent: string | undefined;
          let rdoEquivalentNormalized: string | undefined;
          if (rdoIdx !== -1) {
            const raw = String(row[rdoIdx] ?? '').trim();
            if (raw) {
              rdoEquivalent = raw;
              rdoEquivalentNormalized = normalizeItemName(raw);
            }
          }

          const monthlyPlan: DimensionPlanMonth[] = [];
          qtdCols.forEach((colIdx, monthIndex) => {
            const qty = safeNumber(row[colIdx]);
            const monthKey = addMonths(anchorMonthKey, monthIndex);
            const monthLabel = monthKeyToLabel(monthKey);
            monthlyPlan.push({ monthKey, monthLabel, quantity: qty });
          });

          if (hasMissingCost) warnings.push(`'${rawName}' sem custo mensal unitário.`);
          if (!rdoEquivalent) warnings.push(`'${rawName}' sem Item_RDO equivalente.`);
          if (hasMissingGroup || group === 'OTHER') warnings.push(`'${rawName}' sem grupo válido — classificado como 'OTHER'.`);
          if (monthlyPlan.length > 0 && monthlyPlan.every(p => p.quantity === 0)) {
            warnings.push(`'${rawName}' com planejamento zerado em todos os meses.`);
          }

          items.push({
            name: rawName,
            normalizedName,
            rdoEquivalent,
            rdoEquivalentNormalized,
            group,
            monthlyUnitCost,
            hasMissingCost,
            hasMissingGroup,
            monthlyPlan,
            iStart: metadata.iStart,
            iEnd: metadata.iEnd,
          });
        }

        const monthSet = new Map<string, string>();
        items.forEach(item =>
          item.monthlyPlan.forEach(mp => {
            if (!monthSet.has(mp.monthKey)) monthSet.set(mp.monthKey, mp.monthLabel);
          })
        );
        const months = Array.from(monthSet.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([monthKey, monthLabel]) => ({ monthKey, monthLabel }));

        resolve({
          items,
          holidays,
          metadata,
          months,
          totalRows,
          successCount: items.length,
          errorCount,
          errors: [],
          warnings,
          importedAt: new Date().toISOString(),
        });
      } catch (err) {
        resolve(emptyResult(
          `Erro fatal ao processar XLSX: ${err instanceof Error ? err.message : String(err)}`
        ));
      }
    };

    reader.onerror = () => resolve(emptyResult('Erro ao ler o arquivo.'));
    reader.readAsBinaryString(file);
  });
}

function emptyResult(error: string): DimensionImportResult {
  return {
    items: [],
    holidays: [],
    metadata: {},
    months: [],
    totalRows: 0,
    successCount: 0,
    errorCount: 1,
    errors: [error],
    warnings: [],
    importedAt: new Date().toISOString(),
  };
}

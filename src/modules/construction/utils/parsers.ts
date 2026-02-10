import { ConstructionRecord } from '../types';
import * as XLSX from 'xlsx';

/**
 * Trata valores numéricos robustamente.
 * Troca vírgula por ponto (1.000,00 -> 1000.00).
 * Retorna 0 para null, undefined ou string vazia.
 */
export const parseNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (str === '') return 0;
  // Remove pontos de milhar e troca vírgula decimal por ponto
  const clean = str.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

/**
 * Formata data para DD/MM/YYYY.
 */
export const formatDateBR = (val: any): string => {
  if (!val) return '';

  let date: Date;

  if (val instanceof Date) {
    date = val;
  } else if (typeof val === 'number') {
    // Excel serial date
    date = new Date((val - 25569) * 86400 * 1000);
    date.setSeconds(date.getSeconds() + 1); // Rounding
  } else {
    const str = String(val).trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const p = str.split('-');
      date = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    }
    // DD/MM/YYYY
    else if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
      return str;
    } else {
      // Fallback
      date = new Date(str);
    }
  }

  if (isNaN(date.getTime())) return String(val); // Return raw if failed

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

/**
 * Helper para buscar valor ignorando case.
 */
const getValue = (row: any, targetKey: string): any => {
  const keys = Object.keys(row);
  // Tenta match exato primeiro
  if (row[targetKey] !== undefined) return row[targetKey];
  // Tenta match case-insensitive
  const foundKey = keys.find(k => k.trim().toUpperCase() === targetKey.toUpperCase());
  return foundKey ? row[foundKey] : undefined;
};

export interface ParseResult {
  records: ConstructionRecord[];
  errors: string[];
  warningCount: number;
}

const REQUIRED_HEADERS = ['DATA', 'FROTA']; // Minimal required to identify a record

const validateHeaders = (headers: string[]): string[] => {
  const missing = REQUIRED_HEADERS.filter(req => !headers.some(h => h.toUpperCase().includes(req)));
  return missing;
};

export const excelToRecords = (buffer: ArrayBuffer): ParseResult => {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const result: ParseResult = { records: [], errors: [], warningCount: 0 };

  let targetSheetName = '';

  // Procura aba com 'RENTAL' no nome
  for (const name of workbook.SheetNames) {
    if (name.toUpperCase().includes('RENTAL')) {
      targetSheetName = name;
      break;
    }
  }

  // Fallback: Busca por headers
  if (!targetSheetName) {
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 });
      if (json.length > 0) {
        const headers = (json[0] as any[]).map(h => String(h).trim().toUpperCase());
        if (headers.some(h => h.includes('RDO') || h.includes('FROTA'))) {
          targetSheetName = name;
          break;
        }
      }
    }
  }

  if (!targetSheetName) targetSheetName = workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheetName];
  const data: any[] = XLSX.utils.sheet_to_json(worksheet);

  if (data.length === 0) {
    result.errors.push("Planilha vazia ou sem dados reconhecíveis.");
    return result;
  }

  // Validate Headers based on first row keys
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    const missingHeaders = validateHeaders(headers);
    if (missingHeaders.length > 0) {
      result.errors.push(`Colunas obrigatórias não encontradas na aba '${targetSheetName}': ${missingHeaders.join(', ')}`);
      // Critical failure if keys are missing
      return result;
    }
  }

  data.forEach((row: any, index: number) => {
    const rowNum = index + 2; // +2 considering header and 0-index

    // Defensive Reads
    const rawDate = getValue(row, 'Data');
    const rawFrota = getValue(row, 'Frota');

    if (!rawDate || !rawFrota) {
      // Silent skip empty rows often found in Excel
      return;
    }

    const fmtDate = formatDateBR(rawDate);
    const fmtFrota = String(rawFrota || '').trim();

    if (!fmtDate || !fmtFrota) {
      result.warningCount++;
      return;
    }

    // Safe Parser
    result.records.push({
      data: fmtDate,
      frota: fmtFrota,
      trechoFinal: String(getValue(row, 'Trecho Final') || ''),
      item: String(getValue(row, 'Item') || ''),
      producao: parseNumber(getValue(row, 'Produção') || getValue(row, 'Qntd. Produção')),
      codSapRental: String(getValue(row, 'Cód. SAP RENTAL') || ''),
      codSapMobra: String(getValue(row, 'Cód. SAP MOBRA') || ''),
      operador: String(getValue(row, 'Operador') || ''),
      horaInicio: String(getValue(row, 'Hr Inicial') || ''),
      horaTermino: String(getValue(row, 'Hr Final') || '')
    });
  });

  return result;
};

export const csvToRecords = (csvText: string): ParseResult => {
  const result: ParseResult = { records: [], errors: [], warningCount: 0 };
  const lines = csvText.split('\n');
  if (lines.length < 2) {
    result.errors.push("Arquivo CSV vazio ou inválido.");
    return result;
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toUpperCase());
  const missingHeaders = validateHeaders(headers);

  if (missingHeaders.length > 0) {
    result.errors.push(`Colunas obrigatórias ausentes no CSV: ${missingHeaders.join(', ')}`);
    return result;
  }

  const originalHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Robust simple CSV split (limitations apply to commas inside quotes without extensive regex)
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));

    const rowObj: any = {};
    originalHeaders.forEach((h, idx) => { rowObj[h] = values[idx]; });

    const getVal = (key: string) => getValue(rowObj, key);
    const rawDate = getVal('Data');
    const rawFrota = getVal('Frota');

    if (!rawDate || !rawFrota) {
      result.warningCount++;
      continue;
    }

    result.records.push({
      data: formatDateBR(rawDate),
      frota: String(rawFrota || ''),
      trechoFinal: String(getVal('Trecho Final') || ''),
      item: String(getVal('Item') || ''),
      producao: parseNumber(getVal('Produção') || getVal('Qntd. Produção')),
      codSapRental: String(getVal('Cód. SAP RENTAL') || ''),
      codSapMobra: String(getVal('Cód. SAP MOBRA') || ''),
      operador: String(getVal('Operador') || ''),
      horaInicio: String(getVal('Hr Inicial') || ''),
      horaTermino: String(getVal('Hr Final') || '')
    });
  }
  return result;
};

// --- Teste Unitário Manual ---
// Copie e cole isso no console do navegador se quiser testar ou execute via node (precisa de mocks).
export const runParserTest = () => {
  console.log("=== INICIANDO TESTE DO PARSER ===");

  // Simulação de linha CSV/Excel convertida para JSON
  const mockRow = {
    "Data": "2025-12-22",
    "Frota": "REL-007",
    "Trecho Final": "300",
    "Item": "120",
    "Produção": "7",
    "Cód. SAP RENTAL": "S.VP-01437",
    "Cód. SAP MOBRA": "S.VP-01395",
    "Hr Inicial": "485",
    "Hr Final": "492"
  };

  const result = {
    data: formatDateBR(mockRow['Data']),
    frota: String(mockRow['Frota']),
    trechoFinal: String(mockRow['Trecho Final']),
    item: String(mockRow['Item']),
    producao: parseNumber(mockRow['Produção']),
    codSapRental: String(mockRow['Cód. SAP RENTAL']),
    codSapMobra: String(mockRow['Cód. SAP MOBRA']),
    operador: '',
    horaInicio: String(mockRow['Hr Inicial']),
    horaTermino: String(mockRow['Hr Final'])
  };

  console.log("Input:", mockRow);
  console.log("Parsed Output:", result);

  const expectedDate = "22/12/2025";
  if (result.data === expectedDate) {
    console.log("✅ TESTE DATA PASSOU: " + result.data);
  } else {
    console.error("❌ TESTE DATA FALHOU: Esperado " + expectedDate + ", Recebido " + result.data);
  }

  if (result.producao === 7) {
    console.log("✅ TESTE NUMERO PASSOU: " + result.producao);
  } else {
    console.error("❌ TESTE NUMERO FALHOU");
  }
  console.log("=== FIM DO TESTE ===");
};

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

export const excelToRecords = (buffer: ArrayBuffer): ConstructionRecord[] => {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  let targetSheetName = '';

  // Procura aba com 'RENTAL' no nome (ex: "MEDIÇÃO RENTAL")
  for (const name of workbook.SheetNames) {
    if (name.toUpperCase().includes('RENTAL')) {
      targetSheetName = name;
      break;
    }
  }

  // Se não achar pelo nome, tenta pelos headers na primeira aba
  if (!targetSheetName) {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, range: 0 });
    if (data.length > 0) {
      const headers = data[0].map(h => String(h).trim().toUpperCase());
      if (headers.includes('RDO MOBRA') || headers.includes('ROD RENTAL')) {
        targetSheetName = workbook.SheetNames[0];
      }
    }
  }

  // Fallback final
  if (!targetSheetName) targetSheetName = workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheetName];
  // Header na linha 1 (índice 0)
  const data: any[] = XLSX.utils.sheet_to_json(worksheet);

  if (data.length === 0) return [];

  return data.map((row: any) => ({
    data: formatDateBR(getValue(row, 'Data')),
    frota: String(getValue(row, 'Frota') || ''),
    trechoFinal: String(getValue(row, 'Trecho Final') || ''),
    item: String(getValue(row, 'Item') || ''),
    producao: parseNumber(getValue(row, 'Produção') || getValue(row, 'Qntd. Produção')),
    codSapRental: String(getValue(row, 'Cód. SAP RENTAL') || ''),
    codSapMobra: String(getValue(row, 'Cód. SAP MOBRA') || ''),
    operador: String(getValue(row, 'Operador') || ''),
    horaInicio: String(getValue(row, 'Hr Inicial') || ''),
    horaTermino: String(getValue(row, 'Hr Final') || '')
  }));
};

export const csvToRecords = (csvText: string): ConstructionRecord[] => {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const records: ConstructionRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));

    const rowObj: any = {};
    headers.forEach((h, idx) => { rowObj[h] = values[idx]; });
    const getVal = (key: string) => getValue(rowObj, key);

    records.push({
      data: formatDateBR(getVal('Data')),
      frota: String(getVal('Frota') || ''),
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
  return records;
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

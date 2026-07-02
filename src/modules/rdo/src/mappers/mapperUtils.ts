import { generateUUID } from '../../utils';

/**
 * Normaliza qualquer formato de data para o padrão de domínio "YYYY-MM-DD".
 * Suporta: strings ISO, "DD/MM/YYYY", "YYYY-MM-DD", objetos Date e números ordinais do Excel.
 */
export function normalizeDate(value: any): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  // Se já for uma instância de Date
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  // Se for um número (Ex: número serial do Excel para data)
  if (typeof value === 'number') {
    if (value <= 0) return '';
    // Corrigindo offset do bug do Excel de 1900
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    // Verificar se a data resultante é válida
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return '';
  }

  const str = String(value).trim();
  if (!str) return '';

  // Formato "DD/MM/YYYY" ou "D/M/YYYY"
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Formato "YYYY-MM-DD"
  const ymdMatch = str.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }

  // Formato ISO Completo ou data legível pelo construtor Date
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }

  return '';
}

/**
 * Normaliza valores monetários e numéricos.
 * Converte strings formatadas (ex: "R$ 1.500,30", "1.500", "R$ -200,00") ou floats em números válidos.
 */
export function normalizeCurrency(value: any): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  const str = String(value).trim();
  if (!str) return 0;

  // Se contiver R$, pontos de milhar e vírgula decimal (padrão brasileiro)
  // Remove R$, espaços, pontos de milhar, e troca vírgula decimal por ponto.
  let cleaned = str
    .replace(/R\$/g, '')
    .replace(/\s/g, '');

  // Conta se tem mais de um ponto ou vírgula. Se tiver vírgula no final tipo '1.000,50'
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Caso clássico de milhar ponto e decimal vírgula: remove o ponto e troca vírgula por ponto
    cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
  } else if (cleaned.includes(',')) {
    // Se tiver apenas vírgula (ex: "1500,30" ou "1,5"), assume que é o separador decimal
    // Mas se for algo como "1,500" sem decimais e for milhar? Na DR assume-se vírgula como decimal.
    cleaned = cleaned.replace(/,/g, '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Normaliza percentuais (ex: "45%", "0.45" -> 45, "45" -> 45).
 * Se o valor for menor que 1.0 (ex: 0.45), converte para o formato inteiro de representação 45%.
 */
export function normalizePercentage(value: any): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    // Se for um decimal menor que 1, converte para escala de 100
    if (value > 0 && value < 1) {
      return value * 100;
    }
    return value;
  }

  const str = String(value).trim().replace(/%/g, '');
  const num = parseFloat(str);
  if (isNaN(num)) return 0;

  // Se era "0.45" original convertido em número
  if (num > 0 && num < 1) {
    return num * 100;
  }

  return num;
}

/**
 * Sanitiza identificadores removendo espaços desnecessários,
 * forçando string e gerando UUID se nulo ou vazio.
 */
export function normalizeIdentifier(value: any): string {
  if (value === null || value === undefined) {
    return generateUUID();
  }
  const clean = String(value).trim();
  return clean === '' ? generateUUID() : clean;
}

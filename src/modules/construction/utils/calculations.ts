
import { ConstructionRecord, ServicePrice, LocationInfo, PlannedService, PlanningAssignment } from '../types';
import { TRECHO_MAPPINGS, SUPERVISAO_MAPPINGS, EQUIPMENT_CATEGORIES } from './constants';

/**
 * Retorna uma chave única para o ciclo baseado em uma data (21 de um mês a 20 do próximo).
 * O ciclo é nomeado pelo mês final. Ex: 21/04 a 20/05 pertence ao ciclo "05-2024".
 */
export const getCycleKey = (dateStr: string): string => {
  if (!dateStr) return 'unknown';

  // Handle ISO format YYYY-MM-DD
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      // Convert to DD/MM/YYYY format parts for the logic below
      // ISO: YYYY-MM-DD -> parts[0]=Year, parts[1]=Month, parts[2]=Day
      // Logic expects: parts[0]=Day, parts[1]=Month, parts[2]=Year
      const isoYear = parts[0];
      const isoMonth = parts[1];
      const isoDay = parts[2];
      dateStr = `${isoDay}/${isoMonth}/${isoYear}`;
    }
  }

  const parts = dateStr.split('/');
  if (parts.length < 3) return 'unknown';

  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const year = parseInt(parts[2]);

  const dateObj = new Date(year, month - 1, day);

  // Se for dia 21 em diante, pertence ao ciclo do próximo mês
  if (day >= 21) {
    const nextMonth = new Date(year, month, 1);
    const m = String(nextMonth.getMonth() + 1).padStart(2, '0');
    return `${m}-${nextMonth.getFullYear()}`;
  } else {
    // Se for antes de 21, pertence ao ciclo deste mês
    const m = String(month).padStart(2, '0');
    return `${m}-${year}`;
  }
};

/**
 * Converte strings de KM em números tratáveis.
 */
export const parseKm = (val: string): number => {
  if (!val) return 0;
  const clean = val.toString().toUpperCase().replace('KM', '').replace(/\s/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};

/**
 * Identifica a categoria do equipamento baseado no código da frota.
 */
export const getEquipmentCategory = (frota: string): string => {
  if (!frota) return "Outros";
  const match = frota.match(/^([A-Z]+)/);
  const prefix = match ? match[1] : "";
  return EQUIPMENT_CATEGORIES[prefix] || "Outros";
};

/**
 * Lógica de Período Customizado (Dia 21 ao dia 20 do mês seguinte)
 */
export const getPeriodInfo = (referenceDate: Date = new Date(), records: ConstructionRecord[] = []) => {
  let start: Date;
  let end: Date;

  if (referenceDate.getDate() >= 21) {
    start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 21);
    end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 20);
  } else {
    start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 21);
    end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 20);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const totalDaysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  const measuredDates = new Set<string>();
  records.forEach(r => {
    const [d, m, y] = r.data.split('/').map(Number);
    const date = new Date(y, m - 1, d);
    if (date >= start && date <= end) {
      measuredDates.add(r.data);
    }
  });

  const daysWithMeasurement = measuredDates.size || 0;
  const remainingDays = Math.max(0, totalDaysInPeriod - daysWithMeasurement);

  return {
    start,
    end,
    totalDaysInPeriod,
    daysWithMeasurement,
    remainingDays
  };
};

/**
 * Busca informações de Trecho, Cidade e Supervisão baseado no KM informado.
 */
export const getTrechoInfo = (kmStr: string): LocationInfo => {
  const km = parseKm(kmStr);
  const mapping = TRECHO_MAPPINGS.find(m => km >= m.km_inicial && km <= m.km_final);
  if (!mapping) return { cidade: '', trecho: '', supervisao: '' };
  const supervisaoMapping = SUPERVISAO_MAPPINGS.find(s => s.trecho === mapping.trecho);
  return {
    cidade: mapping.cidade || '',
    trecho: mapping.trecho || '',
    supervisao: supervisaoMapping?.supervisao || ''
  };
};

/**
 * Busca e unifica os preços de Rental e Mobra para um mesmo código de item.
 */
export const getUnifiedServiceInfo = (itemNumber: string, prices: ServicePrice[]) => {
  const rental = prices.find(p => p.item === itemNumber && p.category === 'RENTAL');
  const mobra = prices.find(p => p.item === itemNumber && p.category === 'MOBRA');

  return {
    item: itemNumber,
    descricao: rental?.descricao || mobra?.descricao || 'Serviço não identificado',
    unidade: rental?.unidade || mobra?.unidade || 'UN',
    precoRental: rental?.preco_unitario || 0,
    precoMobra: mobra?.preco_unitario || 0,
    precoTotal: (rental?.preco_unitario || 0) + (mobra?.preco_unitario || 0)
  };
};

/**
 * Identifica se um serviço é produtivo.
 */
export const getProductivityStatus = (sapCode: string, prices: ServicePrice[]): 'PRODUTIVA' | 'IMPRODUTIVA' | 'OUTROS' => {
  if (!sapCode) return 'OUTROS';
  const service = prices.find(s => s.codigo_sap?.trim().toUpperCase() === sapCode.trim().toUpperCase());
  if (!service) return 'OUTROS';
  const desc = service.descricao.toUpperCase();
  if (desc.includes('IMPRODUTIVA') || desc.includes('IMPROD')) return 'IMPRODUTIVA';
  if (desc.includes('PRODUTIVA') || desc.includes('PROD') || desc.includes('KM RODADO')) return 'PRODUTIVA';
  return 'OUTROS';
};

/**
 * Calcula os valores financeiros (Rental e Mobra) para um registro específico.
 */
export const calculateRecordFinancials = (record: ConstructionRecord, prices: ServicePrice[]) => {
  const normalizedRental = (record.codSapRental || '').trim().toUpperCase();
  const normalizedMobra = (record.codSapMobra || '').trim().toUpperCase();

  const priceRental = prices.find(s => s.codigo_sap?.trim().toUpperCase() === normalizedRental)?.preco_unitario || 0;
  const priceMobra = prices.find(s => s.codigo_sap?.trim().toUpperCase() === normalizedMobra)?.preco_unitario || 0;

  const valorRental = record.producao * priceRental;
  const valorMobra = record.producao * priceMobra;
  const status = getProductivityStatus(record.codSapRental || record.codSapMobra, prices);
  return { valorRental, valorMobra, total: valorRental + valorMobra, status };
};

export const formatCurrency = (val: number | null): string => {
  if (val === null || val === 0) return 'R$ 0';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
};

export const formatCurrencyWithZero = (val: number | null): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val || 0);
};

export const calculateAssignmentTotal = (assignment: PlanningAssignment, prices: ServicePrice[]) => {
  return assignment.services.reduce((acc, s) => {
    const info = getUnifiedServiceInfo(s.item, prices);
    return acc + (s.producao * info.precoTotal);
  }, 0);
};

export const isServiceRelevantForEquipment = (frota: string, serviceDescription: string): boolean => {
  const category = getEquipmentCategory(frota).toUpperCase();
  const desc = serviceDescription.toUpperCase();

  const keywords: Record<string, string[]> = {
    "ESCAVADEIRA HIDRÁULICA": ["ESCAVADEIRA"],
    "CAMINHÃO BASCULANTE": ["BASCULANTE"],
    "MOTONIVELADORA": ["MOTONIVELADORA"],
    "PÁ CARREGADEIRA": ["PA CARREGADEIRA", "PÁ CARREGADEIRA"],
    "RETROESCAVADEIRA": ["RETROESCAVADEIRA"],
    "MINIESCAVADEIRA": ["MINIESCAVADEIRA"],
    "VEÍCULO LEVE": ["VEICULO", "VEÍCULO"],
    "CAVALO MECÂNICO": ["CARRETA", "PRANCHA", "CAVALO"]
  };

  const currentKeywords = keywords[category] || [];
  if (desc.includes("MOBILIZACAO INICIAL")) return true;
  return currentKeywords.some(kw => desc.includes(kw));
};

/**
 * measurementEngine.ts
 * Motor de Medição Contratual
 *
 * Transforma atividades de RDOs em fatos de medição, cruzando-as com as
 * composições importadas e a tabela de preços do projeto (fallback).
 */

import {
  RDOData,
  Project,
  Activity,
  ServiceItem
} from '../../../types';
import {
  CompositionImportResult,
  ServiceComposition,
  MeasurementFact,
  MeasurementStatus
} from '../types/analyticsTypes';
import { normalizeText, safeNumber } from '../core/normalizer';
import { isDateInRange } from '../../../utils';

// ---------------------------------------------------------------------------
// 1. matchActivityToComposition
// ---------------------------------------------------------------------------

/**
 * Tenta encontrar a composição correspondente para uma atividade do RDO.
 *
 * Estratégia de fallback:
 * 1. Busca exata pelo código (activity.code).
 * 2. Busca por equivalência de nome normalizado.
 *
 * @returns { composition, isNameEquivalence }
 */
export function matchActivityToComposition(
  activity: Activity,
  compositions: CompositionImportResult | null,
  projectServices?: ServiceItem[],
  rdoDate?: string
): { composition: ServiceComposition | null; isNameEquivalence: boolean } {
  if (!compositions || !compositions.compositionsByService) {
    return { composition: null, isNameEquivalence: false };
  }

  const { compositionsByService } = compositions;

  // 1. Busca por código
  if (activity.code && compositionsByService[activity.code]) {
    return { composition: compositionsByService[activity.code], isNameEquivalence: false };
  }

  // Prepara nome limpo usando a Tabela de Preços (projectServices) como ponte, se disponível
  let cleanActivityName = activity.description;
  if (activity.code && projectServices && rdoDate) {
    const serviceInTable = projectServices.find(s => s.code === activity.code && isDateInRange(rdoDate, s.startDate, s.endDate));
    if (serviceInTable) {
      cleanActivityName = serviceInTable.scope;
    }
  }

  // 2. Busca por nome normalizado (tolerante a comentários extras após o nome do serviço)
  const normalizedActivityName = normalizeText(cleanActivityName);
  
  let bestMatch: ServiceComposition | null = null;
  let bestMatchLength = 0;

  for (const comp of Object.values(compositionsByService)) {
    const normCompDesc = normalizeText(comp.description);
    
    // Correspondência exata ou a atividade do RDO começa com o nome da composição seguido de espaço.
    if (normalizedActivityName === normCompDesc || normalizedActivityName.startsWith(normCompDesc + ' ')) {
      // Se houver múltiplos matches (ex: "ESCAVAÇÃO" vs "ESCAVAÇÃO EM ROCHA"), prioriza o mais longo
      if (normCompDesc.length > bestMatchLength) {
        bestMatch = comp;
        bestMatchLength = normCompDesc.length;
      }
    }
  }

  if (bestMatch) {
    return { composition: bestMatch, isNameEquivalence: true };
  }

  // 3. Fallback para o nome original sujo (caso a ponte não tenha dado resultado)
  if (cleanActivityName !== activity.description) {
    const dirtyNormalized = normalizeText(activity.description);
    for (const comp of Object.values(compositionsByService)) {
      const normCompDesc = normalizeText(comp.description);
      if (dirtyNormalized === normCompDesc || dirtyNormalized.startsWith(normCompDesc + ' ')) {
        if (normCompDesc.length > bestMatchLength) {
          bestMatch = comp;
          bestMatchLength = normCompDesc.length;
        }
      }
    }
    if (bestMatch) {
      return { composition: bestMatch, isNameEquivalence: true };
    }
  }

  return { composition: null, isNameEquivalence: false };
}

// ---------------------------------------------------------------------------
// 2. buildMeasurementFacts
// ---------------------------------------------------------------------------

export interface BuildMeasurementFactsParams {
  projectId: string;
  rdos: RDOData[];
  compositions: CompositionImportResult | null;
  projectServices: ServiceItem[];
}

export interface MeasurementFactsResult {
  facts: MeasurementFact[];
  warnings: string[];
}

/**
 * Gera fatos de medição a partir das atividades dos RDOs.
 */
export function buildMeasurementFacts(
  params: BuildMeasurementFactsParams
): MeasurementFactsResult {
  const { projectId, rdos, compositions, projectServices } = params;
  const facts: MeasurementFact[] = [];
  const warnings: string[] = [];

  for (const rdo of rdos) {
    // Ignora RDOs de outros projetos, se acidentalmente passados
    if (rdo.projectId && rdo.projectId !== projectId) continue;

    for (const activity of rdo.activities) {
      // Regra 10: quantidade zero deve ser mantida, mas precisa existir a propriedade "quantity"
      if (activity.quantity === undefined || activity.quantity === null) {
        continue; // Ignora se não houver campo quantidade
      }

      const quantity = safeNumber(activity.quantity);
      let unitPrice = 0;
      let unitCost = 0;
      let unit = 'UN';
      let status: MeasurementStatus = 'SEM_COMPOSICAO';
      let activityName = '';

      const { composition, isNameEquivalence } = matchActivityToComposition(activity, compositions, projectServices, rdo.date);

      if (composition) {
        unitPrice = composition.unitPrice;
        unitCost = composition.unitCost;
        unit = composition.unit || unit;
        status = isNameEquivalence ? 'EQUIVALENCIA_NOME' : 'ENCONTRADA_COMPOSICAO';
        activityName = composition.description;
        
        // Verifica divergência de unidade (heurística simples por nome normalizado da unidade)
        // Se RDO não tem unidade, assumimos a da composição. 
        // Como Activity não tem unit no type padrão, usamos a unidade da composição.
        // Mas se quisermos tratar divergência no futuro, precisaria de unit na Activity.
      } else {
        // Fallback: buscar em projectServices considerando a data do RDO
        const fallbackService = projectServices.find(s => 
          (s.code === activity.code || normalizeText(s.scope) === normalizeText(activity.description)) &&
          isDateInRange(rdo.date, s.startDate, s.endDate)
        );

        if (fallbackService) {
          unitPrice = fallbackService.value; // Usamos o value do ServiceItem como unitPrice
          unitCost = 0; // Fallback não tem custo detalhado
          unit = fallbackService.unit;
          status = 'PRECO_SERVICES_FALLBACK';
          activityName = fallbackService.scope;
        } else {
          status = 'SEM_COMPOSICAO';
          warnings.push(`RDO ${rdo.date}: Atividade '${activity.description}' sem composição e sem fallback.`);
        }
      }

      const measuredValue = quantity * unitPrice;
      const theoreticalCost = quantity * unitCost;
      const margin = measuredValue - theoreticalCost;
      const marginPercent = measuredValue !== 0 ? margin / measuredValue : 0;

      facts.push({
        projectId,
        date: rdo.date,
        rdoId: rdo.id,
        teamId: rdo.teamId,
        activityCode: activity.code || '',
        activityName,
        activityDescription: activity.description,
        unit,
        quantity,
        unitPrice,
        unitCost,
        measuredValue,
        theoreticalCost,
        margin,
        marginPercent,
        status,
      });
    }
  }

  // Ordenar por data
  facts.sort((a, b) => a.date.localeCompare(b.date));

  return { facts, warnings };
}

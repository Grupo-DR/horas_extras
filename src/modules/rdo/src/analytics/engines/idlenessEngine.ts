/**
 * idlenessEngine.ts
 * Motor de Improdutividade Preliminar
 *
 * Calcula o custo potencial de improdutividade para ocorrências classificadas
 * como POTENCIAL_PLEITO, de forma conservadora (baseada nos recursos totais do RDO).
 */

import { RDOData } from '../../../types';
import { OccurrenceFact, IdlenessFact, CompositionImportResult } from '../types/analyticsTypes';

export interface BuildIdlenessFactsParams {
  occurrenceFacts: OccurrenceFact[];
  rdos: RDOData[];
  compositions: CompositionImportResult | null;
}

/**
 * Busca a composição de inatividade baseada no código.
 */
function findIdlenessComposition(compositions: CompositionImportResult | null, code: string): number {
  if (!compositions || !compositions.compositionsByService) return 0;
  const comp = compositions.compositionsByService[code];
  return comp ? comp.unitPrice : 0;
}

/**
 * Gera fatos de improdutividade a partir de ocorrências qualificadas.
 */
export function buildIdlenessFacts(params: BuildIdlenessFactsParams): { facts: IdlenessFact[]; warnings: string[] } {
  const { occurrenceFacts, rdos, compositions } = params;
  const facts: IdlenessFact[] = [];
  const warnings: string[] = [];

  // Valores mockados para a composição se não acharmos (fallback opcional).
  // Na regra, buscamos "MOD_IMPRODUTIVA" e "EQP_IMPRODUTIVO".
  const modUnitPrice = findIdlenessComposition(compositions, 'MOD_IMPRODUTIVA') || 25.00; // fallback simulado
  const eqpUnitPrice = findIdlenessComposition(compositions, 'EQP_IMPRODUTIVO') || 150.00; // fallback simulado

  for (const occ of occurrenceFacts) {
    if (occ.eligibility !== 'POTENCIAL_PLEITO' || occ.impactHours <= 0) {
      continue; // Ignora se não é pleito ou não tem duração
    }

    // Busca o RDO correspondente pela data para pegar os recursos do dia
    // (Em um sistema real mais complexo, cruzaríamos pelo ID do RDO/Equipe)
    const rdo = rdos.find(r => r.date === occ.date && (!r.projectId || r.projectId === occ.projectId));
    
    if (!rdo) {
      warnings.push(`RDO não encontrado para a ocorrência na data ${occ.date}`);
      continue;
    }

    // Modo Conservador: Total de pessoas e equipamentos no RDO
    const workforceCount = rdo.workforce.reduce((sum, w) => sum + (w.count || 0), 0);
    const equipmentCount = rdo.equipment.reduce((sum, e) => sum + (e.count > 0 ? e.count : 0), 0);

    const workforceValue = occ.impactHours * workforceCount * modUnitPrice;
    const equipmentValue = occ.impactHours * equipmentCount * eqpUnitPrice;
    const totalValue = workforceValue + equipmentValue;

    facts.push({
      projectId: occ.projectId,
      rdoId: occ.rdoId,
      date: occ.date,
      teamId: occ.teamId,
      occurrenceDescription: occ.description,
      impactHours: occ.impactHours,
      workforceCount,
      equipmentCount,
      workforceValue,
      equipmentValue,
      totalValue,
      calculationMethod: 'CONSERVADOR_BASE_RDO'
    });
  }

  // Mais recentes primeiro
  facts.sort((a, b) => b.date.localeCompare(a.date));

  return { facts, warnings };
}

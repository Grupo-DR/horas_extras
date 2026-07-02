/**
 * productivityEngine.ts
 * Motor de Produtividade
 *
 * Analisa a aderência produtiva das atividades dos RDOs em relação à
 * produção esperada definida nas composições (teamProduction).
 */

import { RDOData } from '../../../types';
import {
  CompositionImportResult,
  ProductivityFact,
  ProductivityStatus
} from '../types/analyticsTypes';
import { getRdoWorkingHours } from '../core/contractRules';
import { matchActivityToComposition } from './measurementEngine';
import { safeNumber } from '../core/normalizer';

export interface BuildProductivityFactsParams {
  projectId: string;
  rdos: RDOData[];
  compositions: CompositionImportResult | null;
  projectServices?: import('../../../types').ServiceItem[];
}

export interface ProductivityFactsResult {
  facts: ProductivityFact[];
  warnings: string[];
}

/**
 * Gera fatos de produtividade a partir das atividades dos RDOs.
 */
export function buildProductivityFacts(
  params: BuildProductivityFactsParams
): ProductivityFactsResult {
  const { projectId, rdos, compositions } = params;
  const facts: ProductivityFact[] = [];
  const warnings: string[] = [];

  for (const rdo of rdos) {
    if (rdo.projectId && rdo.projectId !== projectId) continue;

    const rdoWorkingHours = getRdoWorkingHours(rdo);

    for (const activity of rdo.activities) {
      if (activity.quantity === undefined || activity.quantity === null) {
        continue; // Ignora se não houver campo quantidade
      }

      const actualProduction = safeNumber(activity.quantity);
      let status: ProductivityStatus = 'SEM_BASE';
      let expectedProduction = 0;
      let adherence = 0;
      let productionDeviation = 0;
      let actualProductivityPerHour = 0;
      let unit = 'UN';

      const { composition } = matchActivityToComposition(activity, compositions, params.projectServices);

      if (composition) {
        unit = composition.unit || unit;
      }

      const hasBase = composition && composition.teamProduction && composition.teamProduction > 0;

      // 1. Calculando horas reais
      // Usamos as horas totais trabalhadas no RDO como horas gastas na atividade.
      const workedHours = rdoWorkingHours;

      // 2. Cálculo real vs esperado se tiver base
      if (hasBase) {
        const teamProduction = composition.teamProduction!;
        expectedProduction = workedHours * teamProduction;
        productionDeviation = actualProduction - expectedProduction;

        if (expectedProduction > 0) {
          adherence = actualProduction / expectedProduction;
        }

        if (workedHours > 0) {
          actualProductivityPerHour = actualProduction / workedHours;
        }

        // Classificação
        if (actualProduction === 0) {
          status = 'SEM_PRODUCAO';
        } else if (adherence > 1.05) {
          status = 'ACIMA_COMPOSICAO';
        } else if (adherence >= 0.95 && adherence <= 1.05) {
          status = 'CONFORME_COMPOSICAO';
        } else {
          status = 'ABAIXO_COMPOSICAO';
        }
      } else {
        // Sem base
        if (workedHours > 0) {
          actualProductivityPerHour = actualProduction / workedHours;
        }
        status = 'SEM_BASE';
        if (actualProduction === 0) {
          status = 'SEM_PRODUCAO';
        }
      }

      facts.push({
        projectId,
        date: rdo.date,
        teamId: rdo.teamId,
        activityCode: activity.code || '',
        activityDescription: activity.description,
        workedHours,
        expectedProduction,
        actualProduction,
        unit,
        productionDeviation,
        adherence,
        actualProductivityPerHour,
        status,
      });
    }
  }

  facts.sort((a, b) => a.date.localeCompare(b.date));

  return { facts, warnings };
}

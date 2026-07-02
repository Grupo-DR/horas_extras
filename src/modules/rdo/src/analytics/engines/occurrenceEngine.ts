/**
 * occurrenceEngine.ts
 * Motor de Ocorrências
 *
 * Analisa descrições de ocorrências via regras determinísticas de regex e
 * as classifica em categorias, responsabilidades e elegibilidade para pleito.
 */

import { RDOData } from '../../../types';
import {
  OccurrenceFact,
  OccurrenceCategory,
  OccurrenceResponsibility,
  OccurrenceEligibility,
  OccurrenceStatus
} from '../types/analyticsTypes';

export interface BuildOccurrenceFactsParams {
  projectId: string;
  rdos: RDOData[];
}

export interface OccurrenceClassification {
  category: OccurrenceCategory;
  responsibility: OccurrenceResponsibility;
  eligibility: OccurrenceEligibility;
}

/**
 * Classifica a ocorrência com base em palavras-chave determinísticas.
 */
export function classifyOccurrence(description: string): OccurrenceClassification {
  const text = description.toLowerCase();

  const rules: { regex: RegExp; result: OccurrenceClassification }[] = [
    {
      regex: /(trem|trens|circulação|circulacao|faixa|malha|intervalo operacional)/,
      result: { category: 'CIRCULACAO_TRENS', responsibility: 'CONTRATANTE_OPERACAO', eligibility: 'POTENCIAL_PLEITO' }
    },
    {
      regex: /(falta de mão de obra|falta de mao de obra|falta de efetivo|equipe desfalcada)/,
      result: { category: 'FALTA_MAO_OBRA', responsibility: 'CONTRATADA', eligibility: 'RISCO_CONTRATADA' }
    },
    {
      regex: /(falta de equipamento|falta de ferramenta|avaria|manutenção própria|manutencao propria)/,
      result: { category: 'EQUIPAMENTO_FERRAMENTA', responsibility: 'CONTRATADA', eligibility: 'RISCO_CONTRATADA' }
    },
    {
      regex: /(chuva forte|clima impeditivo)/,
      result: { category: 'CLIMA', responsibility: 'INDETERMINADA', eligibility: 'REQUER_ANALISE' }
    },
    {
      regex: /(feriado|sábado|sabado|domingo)/,
      result: { category: 'CALENDARIO', responsibility: 'CALENDARIO', eligibility: 'NAO_ELEGIVEL' }
    }
  ];

  for (const rule of rules) {
    if (rule.regex.test(text)) {
      return rule.result;
    }
  }

  // Fallback
  return {
    category: 'OUTRA',
    responsibility: 'INDETERMINADA',
    eligibility: 'REQUER_ANALISE'
  };
}

/**
 * Converte as ocorrências do RDO em fatos classificados.
 */
export function buildOccurrenceFacts(params: BuildOccurrenceFactsParams): { facts: OccurrenceFact[]; warnings: string[] } {
  const { projectId, rdos } = params;
  const facts: OccurrenceFact[] = [];
  const warnings: string[] = [];

  for (const rdo of rdos) {
    if (rdo.projectId && rdo.projectId !== projectId) continue;

    const occurrences = rdo.occurrences || [];
    for (let i = 0; i < occurrences.length; i++) {
      const occ = occurrences[i];
      const minutes = occ.impactTimeMinutes || 0;
      const hours = minutes / 60;
      const classification = classifyOccurrence(occ.description);
      const status: OccurrenceStatus = hours > 0 ? 'DURACAO_CALCULADA' : 'SEM_DURACAO_EXPLICITA';

      facts.push({
        projectId,
        rdoId: rdo.id,
        occurrenceIndex: i,
        date: rdo.date,
        teamId: rdo.teamId,
        description: occ.description,
        category: occ.category || '',
        responsibility: classification.responsibility,
        eligibility: classification.eligibility,
        impactMinutes: minutes,
        impactHours: hours,
        status
      });
    }
  }

  // Ordenar mais recentes primeiro
  facts.sort((a, b) => b.date.localeCompare(a.date));

  return { facts, warnings };
}

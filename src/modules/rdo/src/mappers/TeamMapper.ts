import { Team } from '../../types';
import { TeamDTO } from '../dtos/TeamDTO';
import {
  normalizeIdentifier,
  normalizeCurrency,
  normalizePercentage
} from './mapperUtils';

export class TeamMapper {
  /**
   * Converte um TeamDTO para o modelo de domínio Team.
   */
  static toDomain(dto: TeamDTO): Team {
    const id = normalizeIdentifier(dto.id || dto.ID_EQUIPE);
    const projectId = normalizeIdentifier(dto.projectId || dto.CC);
    const name = dto.name || dto.NOME_TURMA || dto.NOME_EQUIPE || `Turma ${id}`;
    const leader = dto.leader || dto.LIDER || '';
    const membersCount = typeof dto.INTEGRANTES === 'number' 
      ? dto.INTEGRANTES 
      : parseInt(String(dto.INTEGRANTES || dto.membersCount || 0).trim(), 10) || 0;

    const budgetValue = normalizeCurrency(dto.budgetValue || dto.VALOR_ORCADO);
    const forecastValue = normalizeCurrency(dto.forecastValue || dto.VALOR_PROJETADO);
    
    // As porcentagens podem vir como "45%", "0.45" ou "45"
    const budgetPct = normalizePercentage(dto.budgetPct ?? dto.PERCENTUAL_ORCADO);
    const forecastPct = normalizePercentage(dto.forecastPct ?? dto.PERCENTUAL_PROJETADO);

    const createdAt = dto.createdAt || new Date().toISOString();

    return {
      id,
      projectId,
      name,
      leader: leader || undefined,
      membersCount: membersCount || undefined,
      budgetValue: budgetValue || undefined,
      forecastValue: forecastValue || undefined,
      budgetPct: budgetPct || undefined,
      forecastPct: forecastPct || undefined,
      createdAt
    };
  }

  /**
   * Converte um modelo de domínio Team para TeamDTO pronto para exportações ou integrações externas.
   */
  static toDTO(domain: Team): TeamDTO {
    return {
      id: domain.id,
      ID_EQUIPE: domain.id,
      projectId: domain.projectId,
      CC: domain.projectId,
      name: domain.name,
      NOME_TURMA: domain.name,
      NOME_EQUIPE: domain.name,
      leader: domain.leader,
      LIDER: domain.leader,
      membersCount: domain.membersCount,
      INTEGRANTES: domain.membersCount,
      budgetValue: domain.budgetValue,
      VALOR_ORCADO: domain.budgetValue,
      forecastValue: domain.forecastValue,
      VALOR_PROJETADO: domain.forecastValue,
      budgetPct: domain.budgetPct,
      PERCENTUAL_ORCADO: domain.budgetPct,
      forecastPct: domain.forecastPct,
      PERCENTUAL_PROJETADO: domain.forecastPct,
      createdAt: domain.createdAt
    };
  }
}

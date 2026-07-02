import { Project, ServiceItem } from '../../types';
import { ProjectDTO, ServiceItemDTO } from '../dtos/ProjectDTO';
import {
  normalizeIdentifier,
  normalizeDate,
  normalizeCurrency
} from './mapperUtils';

export class ProjectMapper {
  /**
   * Converte um ProjectDTO vindo de planilhas ou APIs para o modelo de domínio Project.
   */
  static toDomain(dto: ProjectDTO): Project {
    const id = normalizeIdentifier(dto.id || dto.CC);
    const name = dto.name || dto.NOME || dto.NOME_OBRA || `Obra CC ${id}`;
    const regional = dto.regional || dto.REGIONAL || '';
    const client = dto.client || dto.CLIENTE || '';
    const location = dto.location || dto.LOCALIZACAO || '';
    const address = dto.address || dto.ENDERECO || '';
    const status = (dto.status || dto.STATUS || 'ACTIVE') as 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';

    const startDate = normalizeDate(dto.startDate || dto.DATA_INICIO);
    const endDate = normalizeDate(dto.endDate || dto.DATA_FIM);
    const contractValue = normalizeCurrency(dto.contractValue || dto.VALOR_CONTRATO);
    const createdAt = dto.createdAt || new Date().toISOString();

    const rawServices = dto.services || dto.SERVICOS || [];
    const services: ServiceItem[] = rawServices.map((s: ServiceItemDTO) => ({
      code: String(s.code || s.codigo || '').trim(),
      scope: String(s.scope || s.escopo || '').trim(),
      unit: String(s.unit || s.unidade || '').trim(),
      value: normalizeCurrency(s.value ?? s.valor),
      startDate: normalizeDate(s.startDate || s.DATA_INICIO) || undefined,
      endDate: normalizeDate(s.endDate || s.DATA_FIM) || undefined
    })).filter(s => s.code !== '');

    return {
      id,
      name,
      regional,
      client,
      location,
      address,
      status,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      contractValue: contractValue || undefined,
      createdAt,
      services
    };
  }

  /**
   * Converte um modelo de domínio Project para ProjectDTO pronto para exportações ou integrações externas.
   */
  static toDTO(domain: Project): ProjectDTO {
    const services: ServiceItemDTO[] = domain.services.map(s => ({
      code: s.code,
      scope: s.scope,
      unit: s.unit,
      value: s.value,
      startDate: s.startDate,
      DATA_INICIO: s.startDate,
      endDate: s.endDate,
      DATA_FIM: s.endDate
    }));

    return {
      id: domain.id,
      CC: domain.id,
      name: domain.name,
      NOME: domain.name,
      NOME_OBRA: domain.name,
      regional: domain.regional,
      REGIONAL: domain.regional,
      client: domain.client,
      CLIENTE: domain.client,
      location: domain.location,
      LOCALIZACAO: domain.location,
      address: domain.address,
      ENDERECO: domain.address,
      status: domain.status,
      STATUS: domain.status,
      startDate: domain.startDate,
      DATA_INICIO: domain.startDate,
      endDate: domain.endDate,
      DATA_FIM: domain.endDate,
      contractValue: domain.contractValue,
      VALOR_CONTRATO: domain.contractValue,
      createdAt: domain.createdAt,
      services
    };
  }
}

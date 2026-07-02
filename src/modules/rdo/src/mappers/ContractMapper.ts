import { ContractData, ContractAddendum, MonthlyBudgetEntry } from '../../types';
import { ContractDTO, ContractAddendumDTO, MonthlyBudgetEntryDTO } from '../dtos/ContractDTO';
import {
  normalizeIdentifier,
  normalizeDate,
  normalizeCurrency,
  normalizePercentage
} from './mapperUtils';

export class ContractMapper {
  /**
   * Converte um ContractDTO para o modelo de domínio ContractData.
   */
  static toDomain(dto: ContractDTO): ContractData {
    const projectId = normalizeIdentifier(dto.projectId || dto.CC);
    const contractValue = normalizeCurrency(dto.contractValue || dto.valor_original);
    const contractStartDate = normalizeDate(dto.contractStartDate || dto.data_inicio_contrato);
    const contractEndDate = normalizeDate(dto.contractEndDate || dto.data_fim_contrato);
    const updatedAt = dto.updatedAt || new Date().toISOString();

    // Medições / MonthlyBudgetEntry
    const rawEntries = dto.monthlyEntries || dto.medicoes || [];
    const monthlyEntries: MonthlyBudgetEntry[] = rawEntries.map((e: MonthlyBudgetEntryDTO) => {
      const id = normalizeIdentifier(e.id);
      const name = String(e.name || e.nome_periodo || `Período ${id}`).trim();
      const startDate = normalizeDate(e.startDate || e.data_inicio);
      const endDate = normalizeDate(e.endDate || e.data_fim);
      const monthKey = e.monthKey || '';
      
      const budget = normalizeCurrency(e.budget ?? e.orcamento);
      const forecast = normalizeCurrency(e.forecast ?? e.provisao);
      const measured = normalizeCurrency(e.measured ?? e.medido);

      const rawAllocations = e.teamAllocations || e.alocacoes_equipe || [];
      const teamAllocations = rawAllocations.map(a => ({
        teamId: normalizeIdentifier(a.teamId),
        budgetPct: normalizePercentage(a.budgetPct),
        forecastPct: normalizePercentage(a.forecastPct),
        budgetValue: (a as any).budgetValue,
        forecastValue: (a as any).forecastValue
      })).filter(a => a.teamId !== '');

      return {
        id,
        name,
        startDate,
        endDate,
        monthKey: monthKey || undefined,
        budget,
        forecast,
        measured,
        teamAllocations: teamAllocations.length ? teamAllocations : undefined
      };
    });

    // Aditivos / ContractAddendum
    const rawAddenda = dto.addenda || dto.aditivos || [];
    const addenda: ContractAddendum[] = rawAddenda.map((a: ContractAddendumDTO) => {
      const id = normalizeIdentifier(a.id);
      const type = (a.type || a.tipo || 'VALUE') as 'TIME' | 'VALUE' | 'TIME_AND_VALUE';
      const description = String(a.description || a.descricao || '').trim();
      
      const addedDays = typeof a.addedDays === 'number'
        ? a.addedDays
        : parseInt(String(a.addedDays ?? a.dias_adicionados ?? 0).trim(), 10) || 0;
      
      const addedValue = normalizeCurrency(a.addedValue || a.valor_adicionado);
      const approvedAt = normalizeDate(a.approvedAt || a.data_aprovacao);
      const createdAt = a.createdAt || new Date().toISOString();

      return {
        id,
        type,
        description,
        addedDays: type !== 'VALUE' ? addedDays : undefined,
        addedValue: type !== 'TIME' ? addedValue : undefined,
        approvedAt: approvedAt || new Date().toISOString().split('T')[0],
        createdAt
      };
    });

    return {
      projectId,
      contractValue,
      contractStartDate,
      contractEndDate,
      monthlyEntries,
      addenda,
      updatedAt
    };
  }

  /**
   * Converte o modelo de domínio ContractData em ContractDTO.
   */
  static toDTO(domain: ContractData): ContractDTO {
    const medicoes: MonthlyBudgetEntryDTO[] = domain.monthlyEntries.map(e => ({
      id: e.id,
      name: e.name,
      nome_periodo: e.name,
      startDate: e.startDate,
      data_inicio: e.startDate,
      endDate: e.endDate,
      data_fim: e.endDate,
      monthKey: e.monthKey,
      budget: e.budget,
      orcamento: e.budget,
      forecast: e.forecast,
      provisao: e.forecast,
      measured: e.measured,
      medido: e.measured,
      teamAllocations: e.teamAllocations?.map(a => ({
        teamId: a.teamId,
        budgetPct: a.budgetPct,
        forecastPct: a.forecastPct,
        budgetValue: a.budgetValue,
        forecastValue: a.forecastValue
      }))
    }));

    const aditivos: ContractAddendumDTO[] = domain.addenda.map(a => ({
      id: a.id,
      type: a.type,
      tipo: a.type,
      description: a.description,
      descricao: a.description,
      addedDays: a.addedDays,
      dias_adicionados: a.addedDays,
      addedValue: a.addedValue,
      valor_adicionado: a.addedValue,
      approvedAt: a.approvedAt,
      data_aprovacao: a.approvedAt,
      createdAt: a.createdAt
    }));

    return {
      projectId: domain.projectId,
      CC: domain.projectId,
      contractValue: domain.contractValue,
      valor_original: domain.contractValue,
      contractStartDate: domain.contractStartDate,
      data_inicio_contrato: domain.contractStartDate,
      contractEndDate: domain.contractEndDate,
      data_fim_contrato: domain.contractEndDate,
      monthlyEntries: medicoes,
      medicoes,
      addenda: aditivos,
      aditivos,
      updatedAt: domain.updatedAt
    };
  }
}

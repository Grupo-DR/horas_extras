import { RDOData, Workforce, Equipment, Activity, Occurrence } from '../../types';
import { RDODTO, WorkforceDTO, EquipmentDTO, ActivityDTO, OccurrenceDTO } from '../dtos/RDODTO';
import {
  normalizeIdentifier,
  normalizeDate,
  normalizeCurrency,
  normalizePercentage
} from './mapperUtils';

export class RDOMapper {
  /**
   * Converte um RDODTO para o modelo de domínio RDOData.
   */
  static toDomain(dto: RDODTO): RDOData {
    const id = normalizeIdentifier(dto.id);
    const projectId = normalizeIdentifier(dto.projectId || dto.CC);
    const teamId = normalizeIdentifier(dto.teamId || dto.id_equipe);
    const date = normalizeDate(dto.date || dto.data);
    const reportNumber = dto.reportNumber || dto.numero_relatorio || '';
    const shift = (dto.shift || dto.turno || 'DAY') as 'DAY' | 'NIGHT';
    const weather = dto.weather || dto.clima || '';
    const weatherMorning = dto.weatherMorning || dto.clima_manha || '';
    const weatherAfternoon = dto.weatherAfternoon || dto.clima_tarde || '';
    const rainIndexMm = normalizeCurrency(dto.rainIndexMm ?? dto.indice_chuva_mm);
    const notes = dto.notes || dto.observacoes || '';
    const comments = dto.comments || dto.comentarios || '';
    const contractNumber = dto.contractNumber || dto.numero_contrato || '';
    const processedAt = dto.processedAt || new Date().toISOString();
    const synced = dto.synced ?? false;

    // Mão de obra
    const rawWorkforce = dto.workforce || dto.mao_de_obra || [];
    const workforce: Workforce[] = rawWorkforce.map((w: WorkforceDTO) => {
      const role = String(w.role || w.funcao || '').trim();
      const count = typeof w.count === 'number' 
        ? w.count 
        : parseInt(String(w.count ?? w.quantidade ?? 0).trim(), 10) || 0;
      const totalHours = typeof w.totalHours === 'number'
        ? w.totalHours
        : parseFloat(String(w.totalHours ?? w.horas_trabalhadas ?? 0).trim()) || 0;

      return {
        role,
        count,
        totalHours: totalHours || undefined
      };
    }).filter(w => w.role !== '');

    // Equipamentos
    const rawEquipment = dto.equipment || dto.equipamentos || [];
    const equipment: Equipment[] = rawEquipment.map((e: EquipmentDTO) => {
      const name = String(e.name || e.nome || '').trim();
      const count = typeof e.count === 'number'
        ? e.count
        : parseInt(String(e.count ?? e.quantidade ?? 0).trim(), 10) || 0;
      const hoursOperated = typeof e.hoursOperated === 'number'
        ? e.hoursOperated
        : parseFloat(String(e.hoursOperated ?? e.horas_operadas ?? 0).trim()) || 0;

      return {
        name,
        count,
        hoursOperated: hoursOperated || undefined
      };
    }).filter(e => e.name !== '');

    // Atividades
    const rawActivities = dto.activities || dto.atividades || [];
    const activities: Activity[] = rawActivities.map((a: ActivityDTO) => {
      const description = String(a.description || a.descricao || '').trim();
      const status = String(a.status || 'PENDING').trim();
      const code = String(a.code || a.codigo || '').trim();
      const quantity = typeof a.quantity === 'number'
        ? a.quantity
        : parseFloat(String(a.quantity ?? a.quantidade ?? 0).trim()) || 0;
      const progress = normalizePercentage(a.progress ?? a.progresso);

      return {
        description,
        status,
        code: code || undefined,
        quantity: quantity || undefined,
        progress: progress || undefined
      };
    }).filter(a => a.description !== '');

    // Ocorrências
    const rawOccurrences = dto.occurrences || dto.ocorrencias || [];
    const occurrences: Occurrence[] = rawOccurrences.map((o: OccurrenceDTO) => {
      const description = String(o.description || o.descricao || '').trim();
      const type = String(o.type || o.tipo || '').trim();
      const impact = (o.impact || o.impacto || 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH';
      const impactTimeMinutes = typeof o.impactTimeMinutes === 'number'
        ? o.impactTimeMinutes
        : parseInt(String(o.impactTimeMinutes ?? o.tempo_impacto_minutos ?? 0).trim(), 10) || 0;

      return {
        description,
        type: type || undefined,
        impact: impact || undefined,
        impactTimeMinutes: impactTimeMinutes || undefined
      };
    }).filter(o => o.description !== '');

    return {
      id,
      projectId: projectId || undefined,
      teamId,
      date,
      reportNumber: reportNumber || undefined,
      shift: shift || undefined,
      weather: weather || undefined,
      weatherMorning: weatherMorning || undefined,
      weatherAfternoon: weatherAfternoon || undefined,
      rainIndexMm: rainIndexMm || undefined,
      workforce,
      equipment,
      activities,
      occurrences,
      notes: notes || undefined,
      comments: comments || undefined,
      contractNumber: contractNumber || undefined,
      processedAt: processedAt || undefined,
      synced
    };
  }

  /**
   * Converte um RDOData de domínio para RDODTO.
   */
  static toDTO(domain: RDOData): RDODTO {
    const workforce: WorkforceDTO[] = domain.workforce.map(w => ({
      role: w.role,
      funcao: w.role,
      count: w.count,
      quantidade: w.count,
      totalHours: w.totalHours,
      horas_trabalhadas: w.totalHours
    }));

    const equipment: EquipmentDTO[] = domain.equipment.map(e => ({
      name: e.name,
      nome: e.name,
      count: e.count,
      quantidade: e.count,
      hoursOperated: e.hoursOperated,
      horas_operadas: e.hoursOperated
    }));

    const activities: ActivityDTO[] = domain.activities.map(a => ({
      description: a.description,
      descricao: a.description,
      status: a.status,
      code: a.code,
      codigo: a.code,
      quantity: a.quantity,
      quantidade: a.quantity,
      progress: a.progress,
      progresso: a.progress
    }));

    const occurrences: OccurrenceDTO[] = domain.occurrences.map(o => ({
      description: o.description,
      descricao: o.description,
      type: o.type,
      tipo: o.type,
      impact: o.impact,
      impacto: o.impact,
      impactTimeMinutes: o.impactTimeMinutes,
      tempo_impacto_minutos: o.impactTimeMinutes
    }));

    return {
      id: domain.id,
      projectId: domain.projectId,
      CC: domain.projectId,
      teamId: domain.teamId,
      id_equipe: domain.teamId,
      date: domain.date,
      data: domain.date,
      reportNumber: domain.reportNumber,
      numero_relatorio: domain.reportNumber,
      shift: domain.shift,
      turno: domain.shift,
      weather: domain.weather,
      clima: domain.weather,
      weatherMorning: domain.weatherMorning,
      clima_manha: domain.weatherMorning,
      weatherAfternoon: domain.weatherAfternoon,
      clima_tarde: domain.weatherAfternoon,
      rainIndexMm: domain.rainIndexMm,
      indice_chuva_mm: domain.rainIndexMm,
      workforce,
      mao_de_obra: workforce,
      equipment,
      equipamentos: equipment,
      activities,
      atividades: activities,
      occurrences,
      ocorrencias: occurrences,
      notes: domain.notes,
      observacoes: domain.notes,
      comments: domain.comments,
      comentarios: domain.comments,
      contractNumber: domain.contractNumber,
      numero_contrato: domain.contractNumber,
      processedAt: domain.processedAt,
      synced: domain.synced
    };
  }
}

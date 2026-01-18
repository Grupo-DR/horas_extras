import { differenceInDays, parseISO, subDays, isAfter } from 'date-fns';
import { Client, Interaction, Opportunity } from '../../types';
import { CRM_SILENCE } from '../../constants';

export type HealthStatus = 'ACTIVE' | 'ATTENTION' | 'RISK';

interface ClientHealth {
    status: HealthStatus;
    daysSilence: number;
    lastInteractionDate: string | null;
    score: number; // 0 a 100
}

/**
 * Calcula dias corridos desde uma data
 */
export const getDaysSince = (dateString?: string | null): number => {
    if (!dateString) return 999;
    return differenceInDays(new Date(), parseISO(dateString));
};

/**
 * Calcula a saúde do cliente baseada nas regras do constants.ts
 */
export const getClientHealth = (
    client: Client,
    interactions: Interaction[],
    bids: Opportunity[]
): ClientHealth => {
    // Filtra interações deste cliente e ordena por data (mais recente primeiro)
    const clientInteractions = interactions
        .filter((i) => i.clientId === client.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const lastInteraction = clientInteractions[0];
    // Fallback: se nunca interagiu, usa a data de criação do cliente
    const lastDate = lastInteraction ? lastInteraction.date : client.createdAt;

    const daysSilence = getDaysSince(lastDate);

    let status: HealthStatus = 'ACTIVE';

    // Regras de Silêncio
    if (daysSilence > CRM_SILENCE.CLIENT_INTERACTION_DAYS) status = 'RISK'; // > 60 dias
    else if (daysSilence > CRM_SILENCE.CLIENT_INTERACTION_DAYS / 2) status = 'ATTENTION'; // > 30 dias

    // Score simples (MVP): 100 pontos menos 1 ponto por dia de silêncio
    const score = Math.max(0, 100 - daysSilence);

    return {
        status,
        daysSilence,
        lastInteractionDate: lastInteraction ? lastInteraction.date : null,
        score
    };
};

/**
 * Helper para KPIs: Verifica se interação ocorreu na janela de dias (ex: 7 dias)
 */
export const isInteractionRecent = (interaction: Interaction, days = 7) => {
    const date = parseISO(interaction.date);
    const boundary = subDays(new Date(), days);
    return isAfter(date, boundary);
};

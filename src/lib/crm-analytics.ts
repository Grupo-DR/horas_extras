import { differenceInDays, parseISO, isValid } from 'date-fns';
import { Client, Interaction, Bid } from '../../types';

export type HealthStatus = 'RISCO' | 'ATENÇÃO' | 'ATIVO';

export interface ClientHealth {
    status: HealthStatus;
    daysSilence: number;
    lastInteractionDate: Date | null;
}

/**
 * Calculates days since a given date
 */
export const getDaysSince = (dateInput: string | Date | undefined | null): number => {
    if (!dateInput) return 999; // Infinite silence if no date

    let date: Date;
    if (typeof dateInput === 'string') {
        date = parseISO(dateInput);
    } else {
        date = dateInput;
    }

    if (!isValid(date)) return 999;

    return differenceInDays(new Date(), date);
};

/**
 * Determines the health of a client based on interactions and bids
 * Rules:
 * > 60 days: RISCO (Red)
 * > 30 days: ATENÇÃO (Yellow)
 * <= 30 days: ATIVO (Green)
 */
export const getClientHealth = (
    client: Client,
    interactions: Interaction[],
    bids: Bid[] = [] // Optional for now
): ClientHealth => {
    // Filter interactions for this client
    const clientInteractions = interactions
        .filter(i => i.clientId === client.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const lastInteraction = clientInteractions.length > 0 ? clientInteractions[0] : null;
    const lastDate = lastInteraction ? lastInteraction.date : null;

    // Logic could also include Bids (e.g. if there is a recent bid, maybe they are active)
    // For now, adhering strictly to the requested Silence Logic based on Last Interaction.

    const daysSilence = getDaysSince(lastDate);

    let status: HealthStatus = 'ATIVO';

    if (daysSilence > 60) {
        status = 'RISCO';
    } else if (daysSilence > 30) {
        status = 'ATENÇÃO';
    }

    return {
        status,
        daysSilence,
        lastInteractionDate: lastDate
    };
};

import { Interaction, Bid, ClientContact, ClientHealthMetrics, ContactProfile } from '../types';
import { CRM_SILENCE } from '../constants';

// --- HELPERS ---

const getDaysDiff = (date: Date): number => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 3600 * 24));
};

// Filter interactions that happened in the past (date <= now)
// Future interactions are "Agenda" and should not score.
const getEffectiveInteractions = (interactions: Interaction[]): Interaction[] => {
    const now = new Date();
    return interactions.filter(i => i.date <= now);
};

// --- CONTACT ANALYTICS ---

export const calculateContactProfile = (
    contact: ClientContact,
    interactions: Interaction[],
    bidsCreatedByContact: Bid[] // Se tivermos essa info no futuro, por enquanto assumimos 0 ou passamos vazio
): ContactProfile => {
    const effective = getEffectiveInteractions(interactions);
    const now = new Date();

    // 1. Check History
    const hasHistory = effective.length > 0;
    if (!hasHistory) return 'OCASIONAL'; // Sem histórico = Ocasional (ou Novo)

    // 2. Check Silence
    // Get most recent interaction
    const sorted = [...effective].sort((a, b) => b.date.getTime() - a.date.getTime());
    const lastInteraction = sorted[0];
    const daysSince = getDaysDiff(lastInteraction.date);

    if (daysSince > CRM_SILENCE.CONTACT_DAYS) {
        return 'SILENCIOSA';
    }

    // 3. Check "CHAVE" Criteria
    // Score >= 70 (Simplified here to rules: >= 6 interactions in 90d OR >= 2 bids in 12m)

    const cutoff90d = new Date();
    cutoff90d.setDate(cutoff90d.getDate() - 90);
    const interactions90d = effective.filter(i => i.date >= cutoff90d).length;

    // TODO: Bids logic if/when we link Bids to specific Contacts
    // const bids12m = bidsCreatedByContact.length; 

    if (interactions90d >= 6) {
        return 'CHAVE';
    }

    return 'OCASIONAL';
};

export const calculateContactAnalytics = (contact: ClientContact, interactions: Interaction[], bids: Bid[] = []) => {
    const effective = getEffectiveInteractions(interactions);
    const sorted = [...effective].sort((a, b) => b.date.getTime() - a.date.getTime());
    const last = sorted[0] || null;

    const cutoff90d = new Date();
    cutoff90d.setDate(cutoff90d.getDate() - 90);
    const count90d = effective.filter(i => i.date >= cutoff90d).length;

    // --- SCORING ALGORITHM ---
    let score = 0;

    // 1. Interactions (30 pts)
    if (last) {
        const days = getDaysDiff(last.date);
        if (days <= 30) score += 15;
        else if (days <= 60) score += 5;
    }
    if (count90d >= 5) score += 15;
    else if (count90d >= 2) score += 5;

    // 2. Opportunities (30 pts)
    // Filter bids created/owned by this contact (using contactId)
    const contactBids = bids.filter(b => b.contactId === contact.id);
    const opportunityCount = contactBids.length;

    if (opportunityCount >= 5) score += 30;
    else if (opportunityCount >= 2) score += 20;
    else if (opportunityCount > 0) score += 10;

    // 3. Conversion Rate (40 pts)
    const successBids = contactBids.filter(b =>
        b.status === 'VENCIDA' ||
        b.status === 'GANHA' ||
        b.result === 'SUCCESS'
    );
    const successCount = successBids.length;

    // Calculate Rate: Success / Total (Consider only closed/decided ones? Or all?)
    // Requirement says: "quantidade de propostas de sucesso" over "propostas recebidas" (total)
    const conversionRate = opportunityCount > 0 ? (successCount / opportunityCount) : 0;

    // Calculate Values
    const totalValue = contactBids.reduce((sum, b) => sum + (b.estimatedValue || 0), 0);
    const successValue = successBids.reduce((sum, b) => sum + (b.estimatedValue || 0), 0);

    // Normalized Score (Max 40)
    score += Math.min(Math.round(conversionRate * 40), 40);

    // --- 3-AXIS INDICES ---

    // 1. Relationship Index (Last Opportunity Recency)
    // Using last BID date (not interaction) as per request "oportunidade recebida"
    // Find last bid date for this contact
    const lastBidDate = contactBids.length > 0
        ? contactBids.sort((a, b) => b.date.getTime() - a.date.getTime())[0].date
        : null;

    let relationshipIndex: 'MUITO_PROXIMO' | 'PROXIMO' | 'DISTANTE' = 'DISTANTE';
    if (lastBidDate) {
        const daysSinceBid = getDaysDiff(lastBidDate);
        if (daysSinceBid < 30) relationshipIndex = 'MUITO_PROXIMO';
        else if (daysSinceBid < 90) relationshipIndex = 'PROXIMO';
    }

    // 2. Commercial Index (Volume)
    let commercialIndex: 'ALTO_VOLUME' | 'MEDIO_VOLUME' | 'BAIXO_VOLUME' = 'BAIXO_VOLUME';
    if (opportunityCount > 5) commercialIndex = 'ALTO_VOLUME';
    else if (opportunityCount >= 2) commercialIndex = 'MEDIO_VOLUME';

    // 3. Quality Index (Conversion)
    let qualityIndex: 'CAMPEAO' | 'PROMISSOR' | 'NEUTRO' = 'NEUTRO';
    const convRatePercent = conversionRate * 100;
    if (convRatePercent > 40) qualityIndex = 'CAMPEAO';
    else if (convRatePercent > 10) qualityIndex = 'PROMISSOR';


    return {
        profile: calculateContactProfile(contact, interactions, []),
        lastInteraction: last ? last.date : null,
        daysSinceLastInteraction: last ? getDaysDiff(last.date) : -1,
        totalInteractions90d: count90d,
        // Metrics
        score,
        conversionRate: convRatePercent, // Display as %
        opportunityCount,
        successCount,
        totalValue,
        successValue,
        // Indexes
        relationshipIndex,
        commercialIndex,
        qualityIndex
    };
};

// --- CLIENT ANALYTICS ---

export const calculateCompanyScore = (
    lastInteractionDate: Date | undefined | null,
    lastBidDate: Date | undefined | null,
    activeContactsCount: number, // within window
    bidTrend: 'CRESCENTE' | 'ESTAVEL' | 'CAINDO' | 'ZEROU'
): number => {
    let score = 0;
    const now = new Date();

    // 1. Recência Interação (0-40)
    if (lastInteractionDate) {
        const days = getDaysDiff(lastInteractionDate);
        if (days <= 15) score += 40;
        else if (days <= 30) score += 30;
        else if (days <= 60) score += 15;
        else if (days <= 90) score += 5;
    }

    // 2. Recência Convite/Bid (0-30)
    if (lastBidDate) {
        const days = getDaysDiff(lastBidDate);
        if (days <= 30) score += 30;
        else if (days <= 60) score += 20;
        else if (days <= 120) score += 10;
    }

    // 3. Diversidade Contatos (0-20)
    if (activeContactsCount >= 3) score += 20;
    else if (activeContactsCount === 2) score += 12;
    else if (activeContactsCount === 1) score += 5;

    // 4. Tendência (0-10)
    const trendMap = { CRESCENTE: 10, ESTAVEL: 6, CAINDO: 2, ZEROU: 0 };
    score += trendMap[bidTrend];

    return Math.min(score, 100);
};

export const getCompanyStatus = (score: number) => {
    if (score >= 70) return 'ATIVA';
    if (score >= 45) return 'ATENCAO';
    if (score >= 20) return 'EM_RISCO';
    return 'PERDIDA';
};

export const calculateClientHealth = (
    interactions: Interaction[],
    bids: Bid[],
    contacts: ClientContact[]
): ClientHealthMetrics => {
    const effectiveInteractions = getEffectiveInteractions(interactions);

    // Sort Date Desc
    const sortedInteractions = [...effectiveInteractions].sort((a, b) => b.date.getTime() - a.date.getTime());
    const sortedBids = [...bids].sort((a, b) => b.date.getTime() - a.date.getTime());

    const lastInteraction = sortedInteractions[0]?.date || null;
    const lastBid = sortedBids[0]?.date || null;

    // Active Contacts (Interaction in last 90d window)
    const cutoffActive = new Date();
    cutoffActive.setDate(cutoffActive.getDate() - CRM_SILENCE.WINDOW_CONTACT_ACTIVE_DAYS);

    // Set of contactIs interacting recently
    const activeContactIds = new Set<string>();
    effectiveInteractions.forEach(i => {
        if (i.contactId && i.date >= cutoffActive) {
            activeContactIds.add(i.contactId);
        }
    });

    // Bid Trend Calculation (Simplified)
    // Compare last 6 months volume vs previous 6 months? 
    // For now, let's use a simple heuristic:
    // If last bid is recent (< 30d) -> CRESCENTE/ESTAVEL
    // If last bid is old (> 90d) -> CAINDO
    let bidTrend: 'CRESCENTE' | 'ESTAVEL' | 'CAINDO' | 'ZEROU' = 'ESTAVEL';

    if (!lastBid) {
        bidTrend = 'ZEROU';
    } else {
        const daysSinceBid = getDaysDiff(lastBid);
        if (daysSinceBid < 30) bidTrend = 'CRESCENTE';
        else if (daysSinceBid < 90) bidTrend = 'ESTAVEL';
        else bidTrend = 'CAINDO';
    }

    const score = calculateCompanyScore(
        lastInteraction,
        lastBid,
        activeContactIds.size,
        bidTrend
    );

    return {
        score,
        status: getCompanyStatus(score),
        lastInteraction,
        lastBid,
        silenceDays: lastInteraction ? getDaysDiff(lastInteraction) : 999,
        activeContacts90d: activeContactIds.size,
        bidTrend
    };
};

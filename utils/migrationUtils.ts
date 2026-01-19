import { db } from '../services/firebaseConfig';
import { collection, getDocs, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { Opportunity, Bid, BidStatus, PipelineStage } from '../types';

const mapLegacyStatus = (legacyStatus: string): BidStatus => {
    const s = legacyStatus?.toUpperCase();
    if (s === 'GANHOU' || s === 'SUCESSO') return BidStatus.GANHA;
    if (s === 'PERDEU' || s === 'FRACASSO') return BidStatus.PERDIDA;
    if (s === 'CANCELADA' || s === 'ARQUIVADA') return BidStatus.ARQUIVADA;
    return BidStatus.ABERTA; // Default for 'ATIVA', 'EM ANDAMENTO' etc
};

export const migrateOpportunitiesToBidsOnce = async () => {
    console.log("Starting Migration: Opportunities -> Bids...");
    const opportunitiesRef = collection(db, 'opportunities');
    const bidsRef = collection(db, 'bids');

    try {
        const snapshot = await getDocs(opportunitiesRef);
        console.log(`Found ${snapshot.size} opportunities to migrate.`);

        let migratedCount = 0;
        let skippedCount = 0;
        let errorsCount = 0;

        await Promise.all(snapshot.docs.map(async (docSnap) => {
            const opData = docSnap.data();
            const opId = docSnap.id;
            const targetRef = doc(bidsRef, opId);

            // 1. Check Idempotency
            try {
                const targetDoc = await getDoc(targetRef);
                if (targetDoc.exists()) {
                    console.log(`[SKIP] Bid ${opId} already exists.`);
                    skippedCount++;
                    return;
                }
            } catch (err) {
                console.warn(`Error checking existence for ${opId}`, err);
            }

            // 2. Map Data
            const safeDate = (v: any) => {
                if (!v) return null;
                if (v.toDate) return v.toDate(); // Firestore Timestamp
                if (v instanceof Date) return v;
                if (typeof v === 'string') return new Date(v);
                return null;
            };

            const title = opData.title || 'Migrated Opportunity';
            // Simple heuristic for client ID if missing
            const clientId = opData.clientId || (opData.clientName ? `legacy_${opData.clientName.replace(/\s+/g, '_').toLowerCase()}` : 'UNKNOWN_CLIENT');

            const newBid: Bid = {
                id: opId,
                clientId: clientId,
                clientName: opData.clientName || 'Unknown Client',
                title: title,

                pipelineStage: opData.pipelineStage || PipelineStage.LEAD_RECEBIDO,
                status: mapLegacyStatus(opData.status),
                probability: opData.probability || 0,
                priority: opData.priority || 'MÉDIA',

                estimatedValue: Number(opData.estimatedValue) || 0,
                deadline: safeDate(opData.deadline) || new Date(),
                openedAt: safeDate(opData.openedAt),
                closedAt: safeDate(opData.closedAt),
                submissionDate: safeDate(opData.submissionDate),
                date: safeDate(opData.date) || safeDate(opData.createdAt) || new Date(), // Important for 'Entrada'

                contactId: opData.contactId || '',
                contactName: opData.contactName || '',
                ownerId: opData.ownerId || '',
                ownerName: opData.ownerName,

                description: opData.description || opData.notes, // Map notes if description empty
                scopeSummary: opData.scopeSummary,

                // Legacy fields mapping
                // decision/result mapping if any
                location: opData.location || '',

                createdAt: safeDate(opData.createdAt) || new Date(),
                updatedAt: safeDate(opData.updatedAt) || new Date(),

                // Track Legacy ID just in case
                legacyOpportunityId: opId
            };

            // 3. Write to Bids
            try {
                // Remove undefined fields
                const payload = JSON.parse(JSON.stringify({
                    ...newBid,
                    deadline: newBid.deadline ? Timestamp.fromDate(newBid.deadline) : null,
                    openedAt: newBid.openedAt ? Timestamp.fromDate(newBid.openedAt) : null,
                    closedAt: newBid.closedAt ? Timestamp.fromDate(newBid.closedAt) : null,
                    submissionDate: newBid.submissionDate ? Timestamp.fromDate(newBid.submissionDate) : null,
                    date: newBid.date ? Timestamp.fromDate(newBid.date) : Timestamp.now(),
                    createdAt: newBid.createdAt ? Timestamp.fromDate(newBid.createdAt) : Timestamp.now(),
                    updatedAt: newBid.updatedAt ? Timestamp.fromDate(newBid.updatedAt) : Timestamp.now(),
                }));

                await setDoc(targetRef, payload);
                console.log(`[MIGRATED] ${opId} -> ${newBid.title}`);
                migratedCount++;
            } catch (err) {
                console.error(`[ERROR] Failed to migrate ${opId}`, err);
                errorsCount++;
            }
        }));

        console.log(`Migration Complete.`);
        console.log(`Migrated: ${migratedCount}`);
        console.log(`Skipped: ${skippedCount}`);
        console.log(`Errors: ${errorsCount}`);

        return { migratedCount, skippedCount, errorsCount };

    } catch (error) {
        console.error("Migration Failed Critical:", error);
        throw error;
    }
};

import { db } from '../services/firebaseConfig';
import { collection, getDocs, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { Opportunity, Bid, BidStatus, PipelineStage } from '../types';

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

        const results = await Promise.all(snapshot.docs.map(async (docSnap) => {
            const opData = docSnap.data();
            const opId = docSnap.id;
            const targetRef = doc(bidsRef, opId);

            // 1. Check Idempotency
            const targetDoc = await getDoc(targetRef);
            if (targetDoc.exists()) {
                console.log(`[SKIP] Bid ${opId} already exists.`);
                skippedCount++;
                return;
            }

            // 2. Map Data
            // Heuristic Mapping
            const safeDate = (v: any) => v && v.toDate ? v.toDate() : (v instanceof Date ? v : null);

            const newBid: Bid = {
                id: opId,
                clientId: opData.clientName || opData.clientId || 'UNKNOWN_CLIENT', // Best effort
                clientName: opData.clientName || 'Unknown Client',
                title: opData.title || 'Migrated Opportunity',

                pipelineStage: opData.pipelineStage || PipelineStage.LEAD_RECEBIDO,
                status: opData.status || BidStatus.ABERTA,
                probability: opData.probability || 0,

                estimatedValue: Number(opData.estimatedValue) || 0,
                deadline: safeDate(opData.deadline) || new Date(),
                openedAt: safeDate(opData.openedAt),
                closedAt: safeDate(opData.closedAt),
                submissionDate: safeDate(opData.submissionDate),

                contactId: opData.contactId || '',
                ownerId: opData.ownerId || '',
                ownerName: opData.ownerName,

                description: opData.description,
                scopeSummary: opData.scopeSummary,
                decision: opData.decision,
                result: opData.result,

                createdAt: safeDate(opData.createdAt) || new Date(),
                updatedAt: safeDate(opData.updatedAt) || new Date(),

                // Track Legacy ID just in case
                opportunityId: opId
            };

            // 3. Write to Bids
            try {
                // Ensure Timestamps for Firestore
                const payload = {
                    ...newBid,
                    deadline: newBid.deadline ? Timestamp.fromDate(newBid.deadline) : null,
                    openedAt: newBid.openedAt ? Timestamp.fromDate(newBid.openedAt) : null,
                    closedAt: newBid.closedAt ? Timestamp.fromDate(newBid.closedAt) : null,
                    submissionDate: newBid.submissionDate ? Timestamp.fromDate(newBid.submissionDate) : null,
                    createdAt: newBid.createdAt ? Timestamp.fromDate(newBid.createdAt) : Timestamp.now(),
                    updatedAt: newBid.updatedAt ? Timestamp.fromDate(newBid.updatedAt) : Timestamp.now(),
                };

                await setDoc(targetRef, payload);
                console.log(`[MIGRATED] ${opId}`);
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

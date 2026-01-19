import { db } from './firebaseConfig';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    where,
    orderBy,
    Timestamp,
    getDocs,
    getDoc,
    runTransaction
} from 'firebase/firestore';
import { Bid, BidStatus, PipelineStage, Task, TaskStatus } from '../types';
import { toFirestoreTimestamp, safeDateParse } from '../utils/dateUtils';
import { getExecutionPercent, getNextStage, getStageLabel } from '../domain/pipeline'; // Reuse pipeline domain logic if applicable

const COLLECTION = 'bids';
const TASKS_COLLECTION = 'tasks';

// Helper to sanitize incoming Firestore data to Bid type
const mapDocToBid = (docSnap: any): Bid => {
    const d = docSnap.data();
    return {
        id: docSnap.id,
        ...d,
        date: safeDateParse(d.date) || safeDateParse(d.createdAt) || new Date(), // Fallback
        deadline: safeDateParse(d.deadline),
        createdAt: safeDateParse(d.createdAt),
        updatedAt: safeDateParse(d.updatedAt),
        openedAt: safeDateParse(d.openedAt),
        closedAt: safeDateParse(d.closedAt),
        submissionDate: safeDateParse(d.submissionDate),
        // Ensure compatibility fields if missing
        status: d.status || BidStatus.PROCESSANDO,
        pipelineStage: d.pipelineStage || PipelineStage.LEAD_RECEBIDO,
        probability: d.probability ?? 0,
        estimatedValue: d.estimatedValue ?? d.value ?? 0
    } as Bid;
};

export const BidService = {
    // CREATE
    create: async (data: Omit<Bid, 'id' | 'createdAt' | 'updatedAt' | 'pipelineStage'> & { pipelineStage?: PipelineStage }) => { // relax pipelineStage requirement on input
        const stage = data.pipelineStage || PipelineStage.LEAD_RECEBIDO;
        const probability = data.probability ?? getExecutionPercent(stage);

        const payload = {
            ...data,
            pipelineStage: stage,
            probability: probability,

            date: toFirestoreTimestamp(data.date),
            deadline: toFirestoreTimestamp(data.deadline),
            openedAt: toFirestoreTimestamp(data.openedAt),
            closedAt: toFirestoreTimestamp(data.closedAt),
            submissionDate: toFirestoreTimestamp(data.submissionDate),

            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),

            // Defensives
            status: data.status || BidStatus.ABERTA,
            estimatedValue: data.estimatedValue || 0
        };

        // Remove undefined keys
        Object.keys(payload).forEach(key => payload[key as keyof typeof payload] === undefined && delete payload[key as keyof typeof payload]);

        return await addDoc(collection(db, COLLECTION), payload);
    },

    // READ
    getById: async (id: string): Promise<Bid | null> => {
        const docRef = doc(db, COLLECTION, id);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) return null;
        return mapDocToBid(snapshot);
    },

    getAll: async (): Promise<Bid[]> => {
        const q = query(collection(db, COLLECTION), orderBy('updatedAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(mapDocToBid);
    },

    // UPDATE
    update: async (id: string, updates: Partial<Bid>) => {
        const payload: any = {
            ...updates,
            updatedAt: Timestamp.now()
        };

        // Convert known dates in updates
        if (updates.date) payload.date = toFirestoreTimestamp(updates.date);
        if (updates.deadline) payload.deadline = toFirestoreTimestamp(updates.deadline);
        if (updates.openedAt) payload.openedAt = toFirestoreTimestamp(updates.openedAt);
        if (updates.closedAt) payload.closedAt = toFirestoreTimestamp(updates.closedAt);
        if (updates.submissionDate) payload.submissionDate = toFirestoreTimestamp(updates.submissionDate);

        // Remove undefined
        Object.keys(payload).forEach(key => payload[key as keyof typeof payload] === undefined && delete payload[key as keyof typeof payload]);

        await updateDoc(doc(db, COLLECTION, id), payload);
    },

    // DELETE
    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION, id));
    },

    // SUBSCRIBE BY CLIENT
    subscribeByClient: (clientId: string, callback: (bids: Bid[]) => void) => {
        const q = query(
            collection(db, COLLECTION),
            where('clientId', '==', clientId),
            orderBy('updatedAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(mapDocToBid);
            callback(items);
        });
    },

    // GLOBAL RECENT (For Dashboard)
    subscribeRecentGlobal: (months: number, callback: (data: Bid[]) => void) => {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);

        const q = query(
            collection(db, COLLECTION),
            where('updatedAt', '>=', Timestamp.fromDate(cutoff)),
            orderBy('updatedAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(mapDocToBid);
            callback(items);
        });
    },

    // SUBSCRIBE ALL (Optional)
    subscribeAll: (callback: (data: Bid[]) => void) => {
        const q = query(collection(db, COLLECTION), orderBy('updatedAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(mapDocToBid);
            callback(items);
        });
    },

    // MOVEMENT (Transaction)
    moveBid: async (bidId: string, targetStage: PipelineStage): Promise<{ updatedBid: Bid, createdTask: Task }> => {
        return await runTransaction(db, async (transaction) => {
            // 1. Get Current
            const bidRef = doc(db, COLLECTION, bidId);
            const bidSnap = await transaction.get(bidRef);

            if (!bidSnap.exists()) {
                throw new Error("Bid (Oportunidade) não encontrada.");
            }

            const currentBid = mapDocToBid(bidSnap);
            const currentStage = currentBid.pipelineStage;

            // 2. Validate Move (Logic mainly in UI, here we trust mostly but warn)
            if (targetStage !== currentStage) {
                // Allows jumps
            }

            // 3. Prepare Updates
            const newProbability = getExecutionPercent(targetStage);
            const updatedData = {
                pipelineStage: targetStage,
                probability: newProbability,
                updatedAt: Timestamp.now()
            };

            transaction.update(bidRef, updatedData);

            // 4. Create Linked Task
            const newTaskRef = doc(collection(db, TASKS_COLLECTION));
            const newTaskData: any = {
                title: `[${getStageLabel(targetStage)}] - ${currentBid.title}`,
                description: ` Tarefa gerada automaticamente para a etapa ${getStageLabel(targetStage)}.`,
                opportunityId: bidId, // Legacy link
                bidId: bidId, // New Canonical link
                stageAtCreation: targetStage,
                assigneeId: currentBid.ownerId || 'SYSTEM',
                status: TaskStatus.PENDING,
                priority: 'MEDIO',
                startDate: Timestamp.now(),
                endDate: Timestamp.now(),
                needsDetails: true,
                progress: 0,
                observations: '',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                moduleCategory: 'COMERCIAL'
            };

            transaction.set(newTaskRef, newTaskData);

            return {
                updatedBid: { ...currentBid, ...updatedData, updatedAt: new Date(), probability: newProbability },
                createdTask: { id: newTaskRef.id, ...newTaskData, startDate: new Date(), endDate: new Date() } as Task
            };
        });
    }
};

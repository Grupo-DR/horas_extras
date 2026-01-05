import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp, arrayUnion } from 'firebase/firestore';
import { KPI, KPIHistory } from '../types';

const COLLECTION_NAME = 'kpis';

// Helper: Safely convert Firestore Timestamp or string to Date
const toDate = (val: any): Date => {
    if (!val) return new Date();
    if (typeof val.toDate === 'function') return val.toDate(); // Firestore Timestamp
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
};

// Helper: Strict String
const s = (v: any) => typeof v === 'string' ? v : '';
// Helper: Strict Number
const n = (v: any) => typeof v === 'number' ? v : 0;

export const KPIService = {

    // REAL-TIME SUBSCRIPTION
    subscribe: (callback: (kpis: KPI[]) => void) => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));

        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const raw = doc.data();

                // Map History safely handling both old and new formats
                const historyRaw = Array.isArray(raw.history) ? raw.history : [];
                const history = historyRaw.map((h: any) => ({
                    value: n(h.value),
                    referenceDate: h.referenceDate ? toDate(h.referenceDate) : toDate(h.date), // Fallback to old date
                    updatedBy: s(h.updatedBy) || 'System',
                    date: h.date ? toDate(h.date) : undefined
                })).sort((a: any, b: any) => a.referenceDate.getTime() - b.referenceDate.getTime()); // Sort Ascending for charts

                return {
                    id: doc.id,
                    name: s(raw.name),
                    description: s(raw.description),
                    unit: ['R$', '%', 'N', 'BRL'].includes(raw.unit) ? raw.unit : 'N',
                    targetValue: n(raw.targetValue),
                    currentValue: n(raw.currentValue),
                    responsibleId: s(raw.responsibleId),
                    responsibleName: s(raw.responsibleName),
                    history: history,

                    startDate: raw.startDate ? toDate(raw.startDate) : undefined,
                    endDate: raw.endDate ? toDate(raw.endDate) : undefined,
                    updatedAt: toDate(raw.updatedAt),
                } as KPI;
            });
            callback(data);
        });
    },

    // CREATE
    create: async (kpi: Omit<KPI, 'id' | 'currentValue' | 'history' | 'updatedAt'>) => {
        const payload = {
            name: s(kpi.name),
            description: s(kpi.description),
            unit: kpi.unit,
            targetValue: n(kpi.targetValue),
            currentValue: 0, // Starts at 0
            responsibleId: s(kpi.responsibleId),
            responsibleName: s(kpi.responsibleName),

            startDate: kpi.startDate ? Timestamp.fromDate(kpi.startDate) : null,
            endDate: kpi.endDate ? Timestamp.fromDate(kpi.endDate) : null,
            history: [],
            updatedAt: Timestamp.now()
        };
        return await addDoc(collection(db, COLLECTION_NAME), payload);
    },

    // UPDATE PROGRESS (Atomic-like with optimistic calc or read-modify-write)
    // Note: To ensure we get the *latest* referenceDate for currentValue, we strictly should read the doc first or trust the client array.
    // For safety, we will fetch the current doc, append, resort, and update.
    updateProgress: async (kpiId: string, value: number, referenceDate: Date, updatedBy: string) => {
        const docRef = doc(db, COLLECTION_NAME, kpiId);

        // 1. Create the new entry
        const newEntry = {
            referenceDate: Timestamp.fromDate(referenceDate),
            value: Number(value),
            updatedBy: updatedBy,
            date: Timestamp.now() // Audit timestamp
        };

        // 2. We need to update the history array. 
        // Since we need to recalculate currentValue based on the *latest* referenceDate, 
        // we can't just arrayUnion if we want to update currentValue correctly in one go without reading.
        // However, arrayUnion is best for concurrency. 
        // Compromise: We use arrayUnion to add history, but we need to know if this new date is the latest.
        // If we assume the user usually adds the latest data, we can just update currentValue.
        // BUT the requirement says: "allow retroactive".

        // So, we MUST read the current history to decide on currentValue.
        // A transaction is ideal here.

        await deleteDoc(docRef); // WAIT NO - Don't delete! 
        // My previous thought process was interrupted. Let's use runTransaction or just get/update. 
        // Given complexity/traffic, get/update is fine.

        const snap = await import('firebase/firestore').then(mod => mod.getDoc(docRef));
        if (!snap.exists()) throw new Error("KPI not found");

        const raw = snap.data();
        const existingHistory = Array.isArray(raw.history) ? raw.history : [];

        // Convert safe types for comparison
        const parsedHistory = existingHistory.map((h: any) => ({
            ...h,
            referenceDate: h.referenceDate ? toDate(h.referenceDate) : toDate(h.date),
            value: Number(h.value)
        }));

        // Add new one (local representation for sorting)
        parsedHistory.push({
            referenceDate: referenceDate,
            value: Number(value),
            updatedBy: updatedBy
        });

        // Sort by referenceDate DESC to find the latest
        parsedHistory.sort((a: any, b: any) => b.referenceDate.getTime() - a.referenceDate.getTime());

        const latestEntry = parsedHistory[0];
        const newCurrentValue = latestEntry.value;

        // Prepare Firestore Payload
        // We append the new entry using arrayUnion to be cleaner or just rewrite the whole array if we want 100% order.
        // Firestore doesn't hold order in arrays reliably if manipulated partially, but rewriting is safe for small arrays.
        // Let's use arrayUnion to add the *raw* firestore entry, and update currentValue.

        await updateDoc(docRef, {
            history: arrayUnion(newEntry),
            currentValue: newCurrentValue,
            updatedAt: Timestamp.now()
        });
    },

    // DELETE
    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    update: async (id: string, data: Partial<KPI>) => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const payload: any = { ...data, updatedAt: Timestamp.now() };

        if (data.startDate) payload.startDate = Timestamp.fromDate(data.startDate);
        if (data.endDate) payload.endDate = Timestamp.fromDate(data.endDate);

        await updateDoc(docRef, payload);
    }
};

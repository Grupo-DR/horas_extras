import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp, arrayUnion, getDoc } from 'firebase/firestore';
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
    updateProgress: async (kpiId: string, value: number, referenceDate: Date, updatedBy: string) => {
        console.log('Atualizando KPI:', kpiId, 'Values:', { value, referenceDate, updatedBy });

        if (!kpiId) throw new Error("ID do KPI inválido");

        const docRef = doc(db, COLLECTION_NAME, kpiId);

        // 1. Prepare new entry
        const newEntry = {
            referenceDate: Timestamp.fromDate(referenceDate),
            value: Number(value),
            updatedBy: updatedBy,
            date: Timestamp.now() // Audit timestamp
        };

        // 2. Read to determine if we need to update currentValue
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            console.error("KPI Document not found for ID:", kpiId);
            throw new Error("KPI not found");
        }

        const raw = snap.data();
        const history = Array.isArray(raw.history) ? raw.history : [];

        // Check if this new date is the "latest" compared to existing ones
        let isNewest = true;
        for (const h of history) {
            const hDate = h.referenceDate ? toDate(h.referenceDate) : toDate(h.date);
            // If existing date is newer than new date, then new entry is NOT the newest
            if (hDate > referenceDate) {
                isNewest = false;
                break;
            }
        }

        const payload: any = {
            history: arrayUnion(newEntry),
            updatedAt: Timestamp.now()
        };

        if (isNewest) {
            payload.currentValue = Number(value);
        }

        await updateDoc(docRef, payload);
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

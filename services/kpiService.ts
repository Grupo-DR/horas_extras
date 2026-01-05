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
                return {
                    id: doc.id,
                    name: s(raw.name),
                    description: s(raw.description),
                    unit: ['R$', '%', 'N', 'BRL'].includes(raw.unit) ? raw.unit : 'N',
                    targetValue: n(raw.targetValue),
                    currentValue: n(raw.currentValue),
                    responsibleId: s(raw.responsibleId),
                    responsibleName: s(raw.responsibleName),
                    history: Array.isArray(raw.history) ? raw.history.map((h: any) => ({
                        date: toDate(h.date),
                        value: n(h.value)
                    })) : [],
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
            history: [],
            updatedAt: Timestamp.now()
        };
        return await addDoc(collection(db, COLLECTION_NAME), payload);
    },

    // UPDATE PROGRESS (Atomic)
    updateProgress: async (kpiId: string, newValue: number) => {
        const docRef = doc(db, COLLECTION_NAME, kpiId);

        const newEntry: KPIHistory = {
            date: new Date(), // Local time -> Service converts to Timestamp in payload or auto-handled?
            // Firestore arrayUnion handles Date objects nicely usually? 
            // Better explicit Timestamp for safety inside Service.
            value: newValue
        };

        // Convert newEntry.date to Timestamp for Firestore consistency
        const firestoreEntry = {
            date: Timestamp.now(),
            value: Number(newValue)
        };

        await updateDoc(docRef, {
            currentValue: Number(newValue),
            history: arrayUnion(firestoreEntry),
            updatedAt: Timestamp.now()
        });
    },

    // DELETE
    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    update: async (id: string, data: Partial<KPI>) => {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() });
    }
};

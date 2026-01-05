import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { DataSolution } from '../types';

const COLLECTION_NAME = 'solutions';

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

// Helper: Strict Status
const strictStatus = (v: any) => {
    if (['ACTIVE', 'COMPLETED', 'ON_HOLD'].includes(v)) return v;
    return 'ACTIVE';
}

export const SolutionService = {

    // REAL-TIME SUBSCRIPTION
    subscribe: (callback: (solutions: DataSolution[]) => void) => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('deadline', 'asc'));

        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const raw = doc.data();
                return {
                    id: doc.id,
                    name: s(raw.name),
                    stakeholders: Array.isArray(raw.stakeholders) ? raw.stakeholders.map(s) : [],
                    deadline: toDate(raw.deadline),
                    responsibleId: s(raw.responsibleId),
                    responsibleName: s(raw.responsibleName),
                    status: strictStatus(raw.status),
                    description: s(raw.description),
                    createdAt: toDate(raw.createdAt),
                    updatedAt: toDate(raw.updatedAt),
                } as DataSolution;
            });
            callback(data);
        });
    },

    // GET ALL (One-time fetch)
    getAll: async (): Promise<DataSolution[]> => {
        return new Promise((resolve) => {
            SolutionService.subscribe((data) => resolve(data));
        });
    },

    // CREATE
    create: async (solution: Omit<DataSolution, 'id'>) => {
        const payload = {
            name: s(solution.name),
            stakeholders: Array.isArray(solution.stakeholders) ? solution.stakeholders : [],
            deadline: Timestamp.fromDate(solution.deadline),
            responsibleId: s(solution.responsibleId),
            responsibleName: s(solution.responsibleName),
            status: solution.status || 'ACTIVE',
            description: s(solution.description),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        return await addDoc(collection(db, COLLECTION_NAME), payload);
    },

    // UPDATE
    update: async (id: string, updates: Partial<DataSolution>) => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const payload: any = { ...updates, updatedAt: Timestamp.now() };

        // Convert Dates to Timestamps if present
        if (updates.deadline) payload.deadline = Timestamp.fromDate(updates.deadline);

        await updateDoc(docRef, payload);
    },

    // DELETE
    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    }
};

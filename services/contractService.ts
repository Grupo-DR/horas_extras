import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp, arrayUnion, getDoc } from 'firebase/firestore';
import { Contract, ContractMeasurement, ContractStatus } from '../types';
import { BMParser, ParsedBM } from './BMParser';

// COLLECTION REF
const COLLECTION_NAME = 'contracts';

// HELPER: Sanitization Shield
const n = (v: any) => (typeof v === 'number' && !isNaN(v) ? v : 0);
const s = (v: any) => (typeof v === 'string' ? v : '');
const d = (v: any) => {
    if (!v) return null;
    if (v instanceof Timestamp) return v.toDate();
    if (v && typeof v.toDate === 'function') return v.toDate();
    if (v instanceof Date) return v;
    if (typeof v === 'string') {
        const parsed = new Date(v);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};

// --- ROBUST PARSER (REPLACES ALL LEGACY) ---
export const parseBM = async (grid: any[][]): Promise<ParsedBM> => {
    return await BMParser.parse(grid);
};

export const ContractService = {
    // GET ALL REAL-TIME
    getAll: async (): Promise<Contract[]> => {
        return [];
    },

    // SUBSCRIBE (Standard Pattern for this App)
    subscribe: (callback: (contracts: Contract[]) => void) => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('startDate', 'desc'));

        return onSnapshot(q, (snapshot) => {
            const contracts = snapshot.docs.map(doc => {
                const data = doc.data();

                return {
                    id: doc.id,
                    name: s(data.name),
                    siteName: s(data.siteName),
                    clientName: s(data.clientName),
                    totalValue: n(data.totalValue),
                    startDate: d(data.startDate),
                    endDate: d(data.endDate),
                    status: data.status || ContractStatus.ACTIVE,

                    measurements: Array.isArray(data.measurements)
                        ? data.measurements.map((m: any) => ({
                            id: s(m.id),
                            date: d(m.date),
                            value: n(m.value),
                            description: s(m.description),
                            entity: m.entity || undefined
                        }))
                        : [],

                    scopeItems: Array.isArray(data.scopeItems) ? data.scopeItems : [],

                    createdAt: d(data.createdAt),
                    updatedAt: d(data.updatedAt)
                } as Contract;
            });

            callback(contracts);
        });
    },

    // CREATE
    create: async (contract: Omit<Contract, 'id'>) => {
        const cleanData = {
            ...contract,
            startDate: Timestamp.fromDate(contract.startDate),
            endDate: Timestamp.fromDate(contract.endDate),
            measurements: [],
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        const validData = JSON.parse(JSON.stringify(cleanData));

        return await addDoc(collection(db, COLLECTION_NAME), validData);
    },

    // UPDATE
    update: async (id: string, updates: Partial<Contract>) => {
        const cleanUpdates: any = { ...updates, updatedAt: Timestamp.now() };

        if (updates.startDate) cleanUpdates.startDate = Timestamp.fromDate(updates.startDate);
        if (updates.endDate) cleanUpdates.endDate = Timestamp.fromDate(updates.endDate);

        if (updates.measurements) {
            cleanUpdates.measurements = updates.measurements.map(m => ({
                ...m,
                date: m.date instanceof Date ? Timestamp.fromDate(m.date) : m.date
            }));
        }

        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, cleanUpdates);
    },

    // DELETE
    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    // ADD MEASUREMENT (ATOMIC)
    addMeasurement: async (contractId: string, measurement: Omit<ContractMeasurement, 'id'>) => {
        const docRef = doc(db, COLLECTION_NAME, contractId);

        const newId = Math.random().toString(36).substr(2, 9);

        const newMeasurement = {
            id: newId,
            date: Timestamp.fromDate(measurement.date),
            value: Number(measurement.value),
            description: String(measurement.description)
        };

        await updateDoc(docRef, {
            measurements: arrayUnion(newMeasurement),
            updatedAt: Timestamp.now()
        });
    },

    // REMOVE MEASUREMENT
    removeMeasurement: async (contractId: string, measurementId: string) => {
        const docRef = doc(db, COLLECTION_NAME, contractId);

        const snap = await getDoc(docRef);
        if (!snap.exists()) throw new Error("Contrato não encontrado");

        const data = snap.data();
        const measurements = Array.isArray(data.measurements) ? data.measurements : [];

        const updatedMeasurements = measurements.filter((m: any) => m.id !== measurementId);

        await updateDoc(docRef, {
            measurements: updatedMeasurements,
            updatedAt: Timestamp.now()
        });
    }
};

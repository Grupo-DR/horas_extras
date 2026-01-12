import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, Timestamp, arrayUnion } from 'firebase/firestore';
import { Contract, ContractMeasurement, ContractStatus } from '../types';

// COLLECTION REF
const COLLECTION_NAME = 'contracts';

// HELPER: Sanitization Shield
const n = (v: any) => (typeof v === 'number' && !isNaN(v) ? v : 0);
const s = (v: any) => (typeof v === 'string' ? v : '');
const d = (v: any) => {
    if (!v) return null; // FIX: Don't default to today
    if (v instanceof Timestamp) return v.toDate();
    if (v && typeof v.toDate === 'function') return v.toDate();
    if (v instanceof Date) return v;
    if (typeof v === 'string') {
        const parsed = new Date(v);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};

// PARSER: Golden Template
export const parseGoldenTemplate = (data: any[][]) => {
    // 1. Metadata (Header Row 17 -> index 16)
    // Entity: Col 7 -> index 6
    const entityCell = data[16]?.[6] || '';
    let entity: 'RENTAL' | 'CONSTRUTORA' | null = null;

    const upperEntity = String(entityCell).toUpperCase();
    if (upperEntity.includes('RENTAL') || upperEntity.includes('DR RENTAL')) entity = 'RENTAL';
    else if (upperEntity.includes('CONSTRUTORA') || upperEntity.includes('DR CONSTRUTORA')) entity = 'CONSTRUTORA';
    else {
        throw new Error("Entidade inválida ou não encontrada na célula G17.");
    }

    // Period: Col 19 -> index 18 (e.g. "jan/25")
    const periodCell = data[16]?.[18];

    // 2. Map Items (Start Row 20 -> index 19)
    const items: any[] = [];

    for (let i = 19; i < data.length; i++) {
        const row = data[i];

        // Validation: Ignore if Code (Col 5 -> index 4) is empty
        if (!row || !row[4]) continue;

        // Extract Values
        const code = String(row[4]);
        const description = String(row[6] || ''); // Col 7 -> index 6? No, strictly mapping:
        // Wait, user didn't specify description col, assuming standard or keeping previous.
        // Previous was Col 6 (index 5) for Description? 
        // User REQ: "Ignore linhas onde o campo 'Item' (col 5) esteja vazio." -> Col 5 is Code/Item?
        // Let's assume Description is still around Col 6/7. 
        // In previous code I used `s(row[6])`. I'll stick to it unless it breaks.
        // USER SAID: "Valor Medido: Capture obrigatoriamente da coluna 18" -> index 17.
        // "Saldo: Capture da coluna 21" -> index 20.

        const monthValue = typeof row[17] === 'number' ? row[17] : 0;
        const balance = typeof row[20] === 'number' ? row[20] : 0;

        items.push({
            code,
            description: row[6], // Maintaining previous assumption for Description
            monthValue,
            balance,
            period: periodCell
        });
    }

    return { entity, items, period: periodCell };
};

export const ContractService = {
    // GET ALL REAL-TIME
    getAll: async (): Promise<Contract[]> => {
        // This is a placeholder for direct fetch if needed, but we usually use onSnapshot in the component
        // Integrating the same logic here for reference or future use
        return [];
    },

    // SUBSCRIBE (Standard Pattern for this App)
    subscribe: (callback: (contracts: Contract[]) => void) => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('startDate', 'desc'));

        return onSnapshot(q, (snapshot) => {
            const contracts = snapshot.docs.map(doc => {
                const data = doc.data();

                // CHECKLIST: Robust Sanitization & Timestamp Conversion
                return {
                    id: doc.id,
                    name: s(data.name),
                    siteName: s(data.siteName),
                    clientName: s(data.clientName),
                    totalValue: n(data.totalValue),
                    startDate: d(data.startDate),
                    endDate: d(data.endDate),
                    status: data.status || ContractStatus.ACTIVE,

                    // CHECKLIST: Handle Empty Arrays & Measurement Sanitization
                    measurements: Array.isArray(data.measurements)
                        ? data.measurements.map((m: any) => ({
                            id: s(m.id),
                            date: d(m.date),
                            value: n(m.value),
                            description: s(m.description),
                            entity: m.entity || undefined
                        }))
                        : [],

                    scopeItems: Array.isArray(data.scopeItems) ? data.scopeItems : [], // Map Scope Items

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
            // Ensure specific fields are primitives/Timestamps for Firestore
            startDate: Timestamp.fromDate(contract.startDate),
            endDate: Timestamp.fromDate(contract.endDate),
            measurements: [], // Start empty
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        // Remove undefined
        const validData = JSON.parse(JSON.stringify(cleanData));

        return await addDoc(collection(db, COLLECTION_NAME), validData);
    },

    // UPDATE
    update: async (id: string, updates: Partial<Contract>) => {
        const cleanUpdates: any = { ...updates, updatedAt: Timestamp.now() };

        if (updates.startDate) cleanUpdates.startDate = Timestamp.fromDate(updates.startDate);
        if (updates.endDate) cleanUpdates.endDate = Timestamp.fromDate(updates.endDate);

        // If updating measurements, ensure they are clean too (though usually handled by specific methods)
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

        // Generate simple ID
        const newId = Math.random().toString(36).substr(2, 9);

        const newMeasurement = {
            id: newId,
            date: Timestamp.fromDate(measurement.date), // Store as Timestamp
            value: Number(measurement.value),
            description: String(measurement.description)
        };

        // ATOMIC UPDATE using arrayUnion
        await updateDoc(docRef, {
            measurements: arrayUnion(newMeasurement),
            updatedAt: Timestamp.now()
        });
    },

    // REMOVE MEASUREMENT
    removeMeasurement: async (contractId: string, measurementId: string) => {
        const docRef = doc(db, COLLECTION_NAME, contractId);

        // 1. Get current doc
        const snap = await import('firebase/firestore').then(mod => mod.getDoc(docRef));
        if (!snap.exists()) throw new Error("Contrato não encontrado");

        const data = snap.data();
        const measurements = Array.isArray(data.measurements) ? data.measurements : [];

        // 2. Filter out the specific measurement
        const updatedMeasurements = measurements.filter((m: any) => m.id !== measurementId);

        // 3. Update doc
        await updateDoc(docRef, {
            measurements: updatedMeasurements,
            updatedAt: Timestamp.now()
        });
    }
};

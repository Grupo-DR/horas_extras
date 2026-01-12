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
    // 1. Dynamic Entity Identification (Search G15-G20 -> Indices 14-19, Col 6)
    let entity: 'RENTAL' | 'CONSTRUTORA' | null = null;
    let foundEntityRowIndex = -1;

    // Search range for Entity
    const searchStart = 14;
    const searchEnd = Math.min(data.length, 25);

    for (let r = searchStart; r < searchEnd; r++) {
        const cellVal = String(data[r]?.[6] || '').toUpperCase().trim();
        if (cellVal.includes('RENTAL')) {
            entity = 'RENTAL';
            foundEntityRowIndex = r;
            break;
        }
        if (cellVal.includes('CONSTRUTORA')) {
            entity = 'CONSTRUTORA';
            foundEntityRowIndex = r;
            break;
        }
    }

    if (!entity) {
        throw new Error("Entidade não encontrada entre as linhas 15 e 25 (Coluna G). Verifique o cabeçalho.");
    }

    // 2. Metadata (Strictly Row 18 -> Index 17 as per request)
    // Contrato: E18 (Index 17, Col 4)
    // Period: S18 (Index 17, Col 18)
    // Note: User said "Valor da entidade esta na Linha 18", so metadata line is likely 18 (index 17).
    const headerRowIndex = 17;
    const periodCell = data[headerRowIndex]?.[18]; // S18 -> Col 19 -> Index 18

    let periodDate: Date | null = null;
    if (periodCell && typeof periodCell === 'string') {
        const parts = periodCell.split(' a ');
        if (parts.length > 1) {
            // Parse "20/01/2025" -> Date
            const dateStr = parts[1].trim();
            const [day, month, year] = dateStr.split('/');
            if (day && month && year) {
                periodDate = new Date(`${year}-${month}-${day}`);
                if (isNaN(periodDate.getTime())) periodDate = null;
            }
        }
    }

    // 3. Map Items (Start Row 21 -> Index 20)
    const items: any[] = [];

    for (let i = 20; i < data.length; i++) {
        const row = data[i];

        // Validation: Ignore if Code (Col E -> Index 4) is empty
        if (!row || !row[4]) continue;

        // Extract Values with strict mapping V3
        const code = String(row[4]).trim();          // Col E -> Index 4
        const description = String(row[6] || '').trim(); // Col G -> Index 6

        // Values
        const monthValue = typeof row[17] === 'number' ? row[17] : 0; // Col R -> Index 17
        const balance = typeof row[20] === 'number' ? row[20] : 0;    // Col U -> Index 20
        const executionPercentage = typeof row[21] === 'number' ? row[21] : 0; // Col V -> Index 21

        items.push({
            code,
            description,
            monthValue,
            balance,
            executionPercentage,
            period: periodCell
        });
    }

    return { entity, items, periodDate };
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

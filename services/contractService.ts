import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp, arrayUnion, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { Contract, ContractMeasurement, ContractStatus } from '../types';
import { BMParser, ParsedBM } from './BMParser';
import { format } from 'date-fns';

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
                            measurementValue: n(m.value || m.measurementValue), // Support legacy 'value'
                            description: s(m.description),
                            entity: m.entity || undefined,
                            period: m.period || format(d(m.date) || new Date(), 'yyyy-MM'),
                            // Defaults for optional fields
                            accumulatedValue: n(m.accumulatedValue),
                            contractBalance: n(m.contractBalance),
                            scopeMatrix: []
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



    // --- HISTORY MANAGEMENT ---

    // ADD MEASUREMENT (HISTORY MODE)
    // Saves to subcollection: contracts/{id}/measurements/{period}
    // Also updates the main contract document's consolidated list for quick access
    addMeasurementHistory: async (contractId: string, measurement: Omit<ContractMeasurement, 'id'>) => {
        const contractRef = doc(db, COLLECTION_NAME, contractId);

        // 1. Prepare Full Object
        const newId = measurement.period || Math.random().toString(36).substr(2, 9);
        const measurementDate = measurement.date instanceof Date ? measurement.date : new Date(measurement.date);

        const fullMeasurement = {
            ...measurement,
            id: newId,
            date: Timestamp.fromDate(measurementDate),
            importedAt: Timestamp.now(),

            // Ensure numerics
            measurementValue: n(measurement.measurementValue),
            accumulatedValue: n(measurement.accumulatedValue),
            contractBalance: n(measurement.contractBalance),

            // Clean Scope Matrix (Sanitize for Firestore)
            scopeMatrix: (measurement.scopeMatrix || []).map(item => ({
                item: s(item.item),
                codigoVLI: s(item.codigoVLI),
                descricao: s(item.descricao),
                acumuladoAnterior: n(item.acumuladoAnterior),
                doMes: n(item.doMes),
                totalAcumulado: n(item.totalAcumulado),
                previstoContrato: n(item.previstoContrato),
                saldo: n(item.saldo)
            }))
        };

        // 2. Save to Subcollection: contracts/{id}/measurements/{period}
        // Using setDoc to enforce "One Measurement per Period" rule (id = period)
        const subColRef = collection(contractRef, 'measurements');
        const docRef = doc(subColRef, newId); // ID is Period "YYYY-MM"

        // We use setDoc with merge: true to allow updating same period, 
        // OR without merge to strictly overwrite (which fits "Versioned Audit" requirement)
        await setDoc(docRef, fullMeasurement);

        // 3. Update Main Contract Array (Consolidated View)
        // We persist a lighter version in the main doc for charts/cards
        const lightMeasurement = {
            id: newId,
            date: Timestamp.fromDate(measurementDate),
            value: n(measurement.measurementValue),
            description: s(measurement.description),
            entity: measurement.entity,
            period: measurement.period
        };

        // We need to check if it exists in array to replace or add
        // Since arrayUnion doesn't replace, we fetch-filter-save
        const snap = await getDoc(contractRef);
        if (snap.exists()) {
            const data = snap.data();
            let currentList = Array.isArray(data.measurements) ? data.measurements : [];

            // Remove existing for same period
            currentList = currentList.filter((m: any) => m.period !== measurement.period);

            // Add new
            currentList.push(lightMeasurement);

            await updateDoc(contractRef, {
                measurements: currentList,
                updatedAt: Timestamp.now()
            });
        }
    },

    // GET HISTORY (Full Audit Data)
    getMeasurementHistory: async (contractId: string): Promise<ContractMeasurement[]> => {
        const subColRef = collection(db, COLLECTION_NAME, contractId, 'measurements');
        const q = query(subColRef, orderBy('date', 'desc'));

        const snap = await getDocs(q);

        return snap.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: d(data.date),
                importedAt: d(data.importedAt),
                // Rehydrate dates if needed
            } as ContractMeasurement;
        });
    },

    // REMOVE MEASUREMENT (Both History and Consolidated)
    removeMeasurement: async (contractId: string, measurementId: string) => {
        const contractRef = doc(db, COLLECTION_NAME, contractId);

        // 1. Delete from Subcollection
        await deleteDoc(doc(contractRef, 'measurements', measurementId));

        // 2. Remove from Main Array
        const snap = await getDoc(contractRef);
        if (snap.exists()) {
            const data = snap.data();
            const measurements = Array.isArray(data.measurements) ? data.measurements : [];
            const updated = measurements.filter((m: any) => m.id !== measurementId && m.period !== measurementId);

            await updateDoc(contractRef, {
                measurements: updated,
                updatedAt: Timestamp.now()
            });
        }
    }
};

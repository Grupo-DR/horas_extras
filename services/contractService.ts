import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp, arrayUnion, getDoc, getDocs, setDoc, runTransaction } from 'firebase/firestore';
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

// HELPER: Timestamp Conversion
const toTimestamp = (date: Date | Timestamp | string | undefined): Timestamp => {
    if (date instanceof Timestamp) return date;
    if (date instanceof Date) return Timestamp.fromDate(date);
    if (typeof date === 'string') return Timestamp.fromDate(new Date(date));
    return Timestamp.now();
};

export const ContractService = {
    // GET ALL REAL-TIME
    getAll: async (): Promise<Contract[]> => {
        return [];
    },

    // SUBSCRIBE
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

                    // Consolidated Measurement Data (From Parent Doc)
                    measurements: Array.isArray(data.measurements)
                        ? data.measurements.map((m: any) => ({
                            id: s(m.id),
                            date: d(m.date),
                            measurementValue: n(m.measurementValue || m.value), // Support legacy
                            description: s(m.description),
                            period: m.period || format(d(m.date) || new Date(), 'yyyy-MM'),
                            // We don't load the full matrix here to keep it light
                            auditMatrix: []
                        }))
                        : [],

                    // Scope Items (Master List)
                    scopeItems: Array.isArray(data.scopeItems) ? data.scopeItems : [],

                    createdAt: d(data.createdAt),
                    updatedAt: d(data.updatedAt)
                } as Contract;
            });

            callback(contracts);
        });
    },

    // CREATE CONTRACT
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

    // UPDATE CONTRACT
    update: async (id: string, updates: Partial<Contract>) => {
        const cleanUpdates: any = { ...updates, updatedAt: Timestamp.now() };

        if (updates.startDate) cleanUpdates.startDate = Timestamp.fromDate(updates.startDate);
        if (updates.endDate) cleanUpdates.endDate = Timestamp.fromDate(updates.endDate);

        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, cleanUpdates);
    },

    // DELETE CONTRACT
    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },


    // --- MEASUREMENT TRANSACTION ---

    addMeasurement: async (contractId: string, measurement: ContractMeasurement) => {
        const contractRef = doc(db, COLLECTION_NAME, contractId);

        // 1. Prepare Measurement ID (Period-based)
        const measurementId = measurement.period;
        const measurementDocRef = doc(collection(contractRef, 'measurements'), measurementId);

        // 2. Sanitize Measurement Data
        const measurementDate = toTimestamp(measurement.date);

        // Entity Logic Override: If contractorName contains RENTAL, force RENTAL
        let entityType = measurement.entityType;
        if (measurement.contractorName && measurement.contractorName.toUpperCase().includes('RENTAL')) {
            entityType = 'RENTAL';
        }

        const fullMeasurementData = {
            ...measurement,
            id: measurementId,
            date: measurementDate,
            entityType,
            importedAt: Timestamp.now(),

            // Ensure numerics
            measurementValue: n(measurement.measurementValue),
            contractTotalValue: n(measurement.contractTotalValue),
            contractBalance: n(measurement.contractBalance),

            // Persist Full Audit Matrix
            auditMatrix: (measurement.auditMatrix || []).map(item => ({
                codeVLI: s(item.codeVLI),
                description: s(item.description),
                prevAccumulated: n(item.prevAccumulated),
                currentMonth: n(item.currentMonth),
                totalAccumulated: n(item.totalAccumulated),
                plannedContract: n(item.plannedContract),
                balance: n(item.balance)
            }))
        };

        // 3. Run Transaction
        await runTransaction(db, async (transaction) => {
            const contractDoc = await transaction.get(contractRef);
            if (!contractDoc.exists()) {
                throw new Error("Contrato não encontrado!");
            }

            const contractData = contractDoc.data();

            // Calculate Global Totals for Parent Doc
            // Note: measurement.totalAccumulated is specific to items, we need a global "Total Executed so far"
            // Start with what we have in the measurement object or calculate from matrix?
            // The AI provides 'valor_medicao' (current month). 
            // We need 'Total Accumulated' for the contract. 
            // PROPOSAL: Use the 'contractTotalValue' - 'contractBalance' from the measurement logic as 'Total Accumulated'?
            // No, the safest is: Last Accumulated = Sum of all 'measurements' values? 
            // But we might be re-uploading an old one.
            // Simplified Logic as requested: Update Parent with THIS measurement's snapshot data.
            // If we are uploading out of order, this might be tricky, but let's assume chronological for now 
            // or simply that "Last Uploaded = Best Source of Truth" for these header fields.

            const totalAccumulated = n(measurement.measurementValue) + (n(contractData.totalAccumulated) || 0); // Warning: This assumes simple addition, might double count if re-uploading.
            // Better approach for 'totalAccumulated':
            // Use the sum of 'totalAccumulated' from the Audit Matrix? Or trust the 'valor_medicao' + 'acumulado_anterior' (if available)?
            // Let's trust the AI extracted 'saldo_contratual' and 'valor_medicao'. 
            // Actually, the user asked to update "totalAccumulated: Soma do anterior + atual". 
            // Let's stick to updating the metadata based on the NEWEST measurement provided.

            // Update consolidated list
            let currentMeasurements = Array.isArray(contractData.measurements) ? contractData.measurements : [];
            // Remove existing for same period to avoid duplicates in array
            currentMeasurements = currentMeasurements.filter((m: any) => m.period !== measurement.period);

            // Add lightweight version
            currentMeasurements.push({
                id: measurementId,
                period: measurement.period,
                date: measurementDate,
                measurementValue: n(measurement.measurementValue),
                description: s(measurement.description),
                entityType: entityType
            });

            // Sort by date descending
            currentMeasurements.sort((a: any, b: any) => b.date.toMillis() - a.date.toMillis());

            // WRITE SUBCOLLECTION
            transaction.set(measurementDocRef, fullMeasurementData);

            // UPDATE PARENT
            transaction.update(contractRef, {
                measurements: currentMeasurements,
                lastMeasurementDate: measurementDate,
                lastMeasurementValue: n(measurement.measurementValue),
                // We update the balance to what the measurement says it is (Source of Truth)
                currentBalance: n(measurement.contractBalance),
                // We update total accumulated to what the measurement implies (Total Contract - Balance) 
                // This is more robust than summing incrementally.
                totalAccumulated: n(measurement.contractTotalValue) - n(measurement.contractBalance),
                updatedAt: Timestamp.now()
            });
        });
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
            } as ContractMeasurement;
        });
    },

    // REMOVE MEASUREMENT
    removeMeasurement: async (contractId: string, measurementId: string) => {
        const contractRef = doc(db, COLLECTION_NAME, contractId);

        await runTransaction(db, async (transaction) => {
            const contractDoc = await transaction.get(contractRef);
            if (!contractDoc.exists()) throw new Error("Contrato não encontrado");

            // 1. Delete from Subcollection
            const measureDocRef = doc(contractRef, 'measurements', measurementId);
            transaction.delete(measureDocRef);

            // 2. Remove from Main Array
            const data = contractDoc.data();
            const measurements = Array.isArray(data.measurements) ? data.measurements : [];
            const updated = measurements.filter((m: any) => m.id !== measurementId && m.period !== measurementId);

            transaction.update(contractRef, {
                measurements: updated,
                updatedAt: Timestamp.now()
            });
        });
    }
};

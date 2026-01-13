import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp, getDocs, runTransaction } from 'firebase/firestore';
import { Contract, ContractMeasurement, ContractStatus } from '../types';
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
                            period: m.period || format(d(m.date) || new Date(), 'yyyy-MM'),
                            value: n(m.value || m.measurementValue), // Support legacy

                            // Mandatory fields with defaults/fallbacks for Type Compatibility
                            contractor: s(m.contractor || m.contractorName || 'N/A'),
                            entityType: (m.entityType === 'RENTAL' || (m.contractorName && m.contractorName.toUpperCase().includes('RENTAL'))) ? 'RENTAL' : 'CONSTRUTORA',
                            contractTotalValue: n(m.contractTotalValue),
                            contractBalance: n(m.contractBalance),
                            status: m.status || 'PROCESSADO',
                            importedAt: d(m.importedAt) || new Date(),

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
        // CRITICAL FIX: Replace slashes with dashes to prevent nested subcollections
        const measurementId = measurement.period.replace(/\//g, '-').replace(/\s+/g, '');
        const measurementDocRef = doc(collection(contractRef, 'measurements'), measurementId);

        // 2. Sanitize Measurement Data
        const measurementDate = toTimestamp(measurement.date);

        // Entity Logic Override is now handled by BMParser, trusting the measurement object.
        const entityType = measurement.entityType;

        const fullMeasurementData = {
            ...measurement,
            id: measurementId,
            date: measurementDate,
            entityType,
            importedAt: Timestamp.now(),

            // Ensure numerics
            value: n(measurement.value),
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
        console.log("Saving Measurement to Subcollection:", measurementDocRef.path);
        console.log("Full Data Payload (Audit Matrix Size):", fullMeasurementData.auditMatrix?.length);

        await runTransaction(db, async (transaction) => {
            const contractDoc = await transaction.get(contractRef);
            if (!contractDoc.exists()) {
                throw new Error("Contrato não encontrado!");
            }

            const contractData = contractDoc.data();

            // Calculate Global Totals for Parent Doc
            // We update "totalAccumulated" based on the measurement data for consistency
            const totalAccumulated = n(measurement.value) + (n(contractData.totalAccumulated) || 0);

            // Update consolidated list
            let currentMeasurements = Array.isArray(contractData.measurements) ? contractData.measurements : [];
            // Remove existing for same period to avoid duplicates in array
            currentMeasurements = currentMeasurements.filter((m: any) => m.period !== measurement.period);

            // Add lightweight version
            currentMeasurements.push({
                id: measurementId,
                period: measurement.period,
                date: measurementDate,
                value: n(measurement.value),
                entityType: entityType,
                // Add mandatory fields for the lightweight array too, to match ContractMeasurement
                contractor: s(measurement.contractor),
                contractTotalValue: n(measurement.contractTotalValue),
                contractBalance: n(measurement.contractBalance),
                status: measurement.status || 'PROCESSADO',
                importedAt: Timestamp.now(),
                auditMatrix: [] // Empty for lightweight
            });

            // Sort by date descending
            currentMeasurements.sort((a: any, b: any) => b.date.toMillis() - a.date.toMillis());

            // WRITE SUBCOLLECTION
            transaction.set(measurementDocRef, fullMeasurementData);

            // UPDATE PARENT
            transaction.update(contractRef, {
                measurements: currentMeasurements,
                lastMeasurementDate: measurementDate,
                lastMeasurementValue: n(measurement.value),
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
        console.log(`Fetched ${snap.size} measurements from subcollection: ${subColRef.path}`);

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
            // Ensure we look for the sanitized ID
            const safeId = measurementId.includes('/') ? measurementId.replace(/\//g, '-').replace(/\s+/g, '') : measurementId;
            const measureDocRef = doc(contractRef, 'measurements', safeId);
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

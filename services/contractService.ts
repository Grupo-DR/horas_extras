import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp, getDocs, runTransaction } from 'firebase/firestore';
import { Contract, ContractMeasurement, ContractStatus } from '../types';
import { format } from 'date-fns';
import { safeDateParse, toFirestoreTimestamp } from '../utils/dateUtils';

// COLLECTION REF
const COLLECTION_NAME = 'contracts';

// HELPER: Sanitization Shield
const n = (v: any) => (typeof v === 'number' && !isNaN(v) ? v : 0);
const s = (v: any) => (typeof v === 'string' ? v : '');
// d() helper is replaced by safeDateParse usage below

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
                    startDate: safeDateParse(data.startDate) || new Date(), // Fallback to now if critical
                    endDate: safeDateParse(data.endDate) || new Date(),
                    status: data.status || ContractStatus.ACTIVE,

                    // Consolidated Measurement Data (From Parent Doc)
                    measurements: Array.isArray(data.measurements)
                        ? data.measurements.map((m: any) => ({
                            id: s(m.id),
                            date: safeDateParse(m.date) || new Date(),
                            period: m.period || format(safeDateParse(m.date) || new Date(), 'yyyy-MM'),
                            value: n(m.value || m.measurementValue), // Support legacy

                            // Mandatory fields with defaults/fallbacks for Type Compatibility
                            contractor: s(m.contractor || m.contractorName || 'N/A'),
                            entityType: (m.entityType === 'RENTAL' || (m.contractorName && m.contractorName.toUpperCase().includes('RENTAL'))) ? 'RENTAL' : 'CONSTRUTORA',
                            contractTotalValue: n(m.contractTotalValue),
                            contractBalance: n(m.contractBalance),
                            status: m.status || 'PROCESSADO',
                            importedAt: safeDateParse(m.importedAt) || new Date(),

                            // We don't load the full matrix here to keep it light
                            auditMatrix: []
                        }))
                        : [],

                    // Scope Items (Master List)
                    scopeItems: Array.isArray(data.scopeItems) ? data.scopeItems : [],

                    // Evolution Events
                    events: Array.isArray(data.events) ? data.events.map((e: any) => ({
                        ...e,
                        date: safeDateParse(e.date) || new Date(),
                        createdAt: safeDateParse(e.createdAt) || new Date()
                    })) : [],

                    initialValue: n(data.initialValue) || n(data.totalValue), // Fallback
                    initialEndDate: safeDateParse(data.initialEndDate) || safeDateParse(data.endDate),

                    createdAt: safeDateParse(data.createdAt),
                    updatedAt: safeDateParse(data.updatedAt)
                } as Contract;
            });

            callback(contracts);
        });
    },

    // CREATE CONTRACT
    create: async (contract: Omit<Contract, 'id'>) => {
        const cleanData = {
            ...contract,
            startDate: toFirestoreTimestamp(contract.startDate) || Timestamp.now(),
            endDate: toFirestoreTimestamp(contract.endDate) || Timestamp.now(),
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

        if (updates.startDate) cleanUpdates.startDate = toFirestoreTimestamp(updates.startDate);
        if (updates.endDate) cleanUpdates.endDate = toFirestoreTimestamp(updates.endDate);

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
        const measurementDate = toFirestoreTimestamp(measurement.date) || Timestamp.now();

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
                date: safeDateParse(data.date) || new Date(),
                importedAt: safeDateParse(data.importedAt) || new Date(),
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
    },

    // ADD EVENT (Additive/Readjustment)
    addEvent: async (contractId: string, event: any) => {
        const contractRef = doc(db, COLLECTION_NAME, contractId);

        await runTransaction(db, async (transaction) => {
            const contractDoc = await transaction.get(contractRef);
            if (!contractDoc.exists()) throw new Error("Contrato não encontrado");

            const contractData = contractDoc.data();

            // 1. Prepare Event Object
            const newEvent = {
                id: crypto.randomUUID(),
                ...event,
                date: toFirestoreTimestamp(event.date),
                createdAt: Timestamp.now(),
                createdBy: 'SYSTEM' // TODO: Replace with actual user ID
            };

            // 2. Calculate New Contract State
            // If initialValue is missing, assume current totalValue was the initial
            const currentTotal = n(contractData.totalValue);
            const initialValue = n(contractData.initialValue) || currentTotal;
            const currentEndDate = contractData.endDate ? toFirestoreTimestamp(contractData.endDate).toDate() : new Date();
            const initialEndDate = contractData.initialEndDate ? toFirestoreTimestamp(contractData.initialEndDate).toDate() : currentEndDate;

            // Apply Deltas
            const newTotalValue = currentTotal + n(event.valueDelta);

            const newEndDate = new Date(currentEndDate);
            if (event.termDeltaDays) {
                newEndDate.setDate(newEndDate.getDate() + n(event.termDeltaDays));
            }

            // 3. Update Contract
            // We append to the events array
            const currentEvents = Array.isArray(contractData.events) ? contractData.events : [];
            currentEvents.push(newEvent);

            // Sort events by date just in case
            // currentEvents.sort(...) - usually better to sort on read or just append

            transaction.update(contractRef, {
                events: currentEvents,
                totalValue: newTotalValue, // Active Value
                endDate: Timestamp.fromDate(newEndDate), // Active End Date

                // Ensure Initial fields are populated if they weren't
                initialValue: initialValue,
                initialEndDate: Timestamp.fromDate(initialEndDate),

                updatedAt: Timestamp.now()
            });
        });
    },

    // REMOVE EVENT
    removeEvent: async (contractId: string, eventId: string) => {
        const contractRef = doc(db, COLLECTION_NAME, contractId);

        await runTransaction(db, async (transaction) => {
            const contractDoc = await transaction.get(contractRef);
            if (!contractDoc.exists()) throw new Error("Contrato não encontrado");

            const contractData = contractDoc.data();
            const events = Array.isArray(contractData.events) ? contractData.events : [];

            // Find event to remove
            const eventToRemove = events.find((e: any) => e.id === eventId);
            if (!eventToRemove) return; // Already gone

            // Remove it
            const updatedEvents = events.filter((e: any) => e.id !== eventId);

            // Recalculate Totals from scratch (Safer than reversing delta)
            // Start from initial
            const initialValue = n(contractData.initialValue) || n(contractData.totalValue); // Robust fallback? 
            // Ideally we rely on initialValue. If it's missing, we are in trouble if we try to rebuild.
            // If we are removing an event, we assume `initialValue` + `remaining events` = `current`.

            // If `initialValue` is NOT reliably stored before events, we might have issues. 
            // However, `addEvent` logic ensured `initialValue` was set.
            // Let's assume `initialValue` is good.

            let newTotal = initialValue;
            let newEndDate = contractData.initialEndDate ? toFirestoreTimestamp(contractData.initialEndDate).toDate() : (contractData.startDate ? toFirestoreTimestamp(contractData.startDate).toDate() : new Date());

            // Replay events
            updatedEvents.forEach((ev: any) => {
                newTotal += n(ev.valueDelta);
                if (ev.termDeltaDays) {
                    newEndDate.setDate(newEndDate.getDate() + n(ev.termDeltaDays));
                }
            });

            transaction.update(contractRef, {
                events: updatedEvents,
                totalValue: newTotal,
                endDate: Timestamp.fromDate(newEndDate),
                updatedAt: Timestamp.now()
            });
        });
    }
};

import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    query,
    where,
    orderBy,
    addDoc,
    writeBatch,
    Timestamp,
    deleteDoc
} from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { ConstructionRecord, PlanningAssignment } from '../types';

const COLLECTIONS = {
    CYCLES: 'construction_cycles',
    RECORDS: 'construction_records',
    PLANNING: 'construction_planning',
    UPLOADS: 'construction_uploads'
};



export const constructionService = {

    async getCycles(): Promise<string[]> {
        try {
            const q = query(collection(db, COLLECTIONS.CYCLES), orderBy('id', 'desc')); // Assuming 'id' is sortable like YYYY-MM
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                // Fallback or seed initial cycle if needed
                return [];
            }

            return snapshot.docs.map(doc => doc.id);
        } catch (error) {
            console.error("Error fetching cycles:", error);
            throw error;
        }
    },

    async createCycle(cycleKey: string): Promise<void> {
        const docRef = doc(db, COLLECTIONS.CYCLES, cycleKey);
        await setDoc(docRef, {
            id: cycleKey,
            createdAt: Timestamp.now()
        });
    },

    async getRecords(cycleKey: string, workId: string = 'OBRA-01'): Promise<ConstructionRecord[]> {
        try {
            const q = query(
                collection(db, COLLECTIONS.RECORDS),
                where('cycleKey', '==', cycleKey),
                where('workId', '==', workId)
            );
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as any as ConstructionRecord[];
        } catch (error) {
            console.error("Error fetching records:", error);
            throw error;
        }
    },

    async saveRecords(cycleKey: string, records: any[], workId: string = 'OBRA-01', fileName: string = 'upload.xlsx'): Promise<void> {
        try {
            // Ensure cycle exists
            await this.createCycle(cycleKey);

            // 1. Audit: Save the full upload payload to history
            // We store the raw records array to preserve exactly what was uploaded
            await addDoc(collection(db, COLLECTIONS.UPLOADS), {
                workId,
                cycleKey,
                fileName,
                recordCount: records.length,
                uploadedAt: Timestamp.now(),
                records // Audit copy
            });

            // 2. Delete existing records for this cycle/work to ensure "Unique Active RDO"
            // We now filter by workId as well
            const q = query(
                collection(db, COLLECTIONS.RECORDS),
                where('cycleKey', '==', cycleKey),
                where('workId', '==', workId)
            );
            const snapshot = await getDocs(q);

            const MAX_BATCH_SIZE = 400; // Leave buffer
            const batches = [];
            let currentBatch = writeBatch(db);
            let operationCount = 0;

            // Delete operations
            snapshot.docs.forEach((doc) => {
                currentBatch.delete(doc.ref);
                operationCount++;
                if (operationCount >= MAX_BATCH_SIZE) {
                    batches.push(currentBatch);
                    currentBatch = writeBatch(db);
                    operationCount = 0;
                }
            });

            // 3. Insert new records
            records.forEach((record) => {
                const docRef = doc(collection(db, COLLECTIONS.RECORDS));
                currentBatch.set(docRef, {
                    ...record,
                    cycleKey,
                    workId, // Persist context
                    createdAt: Timestamp.now()
                });
                operationCount++;
                if (operationCount >= MAX_BATCH_SIZE) {
                    batches.push(currentBatch);
                    currentBatch = writeBatch(db);
                    operationCount = 0;
                }
            });

            // Push final batch
            if (operationCount > 0) {
                batches.push(currentBatch);
            }

            // Commit all batches
            await Promise.all(batches.map(b => b.commit()));

        } catch (error) {
            console.error("Error saving records:", error);
            throw error;
        }
    },

    async getPlanning(cycleKey: string, workId: string = 'OBRA-01'): Promise<PlanningAssignment[]> {
        try {
            // Construct a composite ID or query?
            // Since planning is a single document per cycle currently, we need to adapt it.
            // If we want (workId, periodId) uniqueness, the doc ID should probably be `${workId}_${cycleKey}`.
            // OR we use a query.
            // Current implementation uses `doc(db, COLLECTIONS.PLANNING, cycleKey)`.
            // This is NOT unique per workId. It assumes one global planning per cycle.
            // We MUST change this to support multi-work.
            // Strategy: Use `${workId}_${cycleKey}` as Doc ID.

            const docId = `${workId}_${cycleKey}`;
            const docRef = doc(db, COLLECTIONS.PLANNING, docId);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                return snapshot.data().assignments as PlanningAssignment[];
            }
            return [];
        } catch (error) {
            console.error("Error fetching planning:", error);
            return [];
        }
    },

    async updatePlanning(cycleKey: string, assignments: PlanningAssignment[], workId: string = 'OBRA-01'): Promise<void> {
        try {
            const docId = `${workId}_${cycleKey}`;
            const docRef = doc(db, COLLECTIONS.PLANNING, docId);
            await setDoc(docRef, {
                cycleKey,
                workId,
                assignments, // Storing strict JSON array
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error("Error updating planning:", error);
            throw error;
        }
    },

    async getUploads(workId: string = 'OBRA-01'): Promise<any[]> {
        try {
            const q = query(
                collection(db, COLLECTIONS.UPLOADS),
                where('workId', '==', workId),
                orderBy('uploadedAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                workId: doc.data().workId,
                cycleKey: doc.data().cycleKey,
                fileName: doc.data().fileName,
                recordCount: doc.data().recordCount,
                uploadedAt: doc.data().uploadedAt
            }));
        } catch (error) {
            console.error("Error fetching uploads:", error);
            return [];
        }
    },

    async getUpload(uploadId: string): Promise<any | null> {
        try {
            const docRef = doc(db, COLLECTIONS.UPLOADS, uploadId);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                return {
                    id: snapshot.id,
                    ...snapshot.data()
                };
            }
            return null;
        } catch (error) {
            console.error("Error fetching upload:", error);
            return null;
        }
    },
    async deleteCycleData(cycleKey: string, workId: string = 'OBRA-01'): Promise<void> {
        try {
            const MAX_BATCH_SIZE = 400;

            // Helper to commit batches
            const deleteInBatches = async (querySnapshot: any) => {
                let batch = writeBatch(db);
                let count = 0;
                const batches = [];

                querySnapshot.docs.forEach((doc: any) => {
                    batch.delete(doc.ref);
                    count++;
                    if (count >= MAX_BATCH_SIZE) {
                        batches.push(batch);
                        batch = writeBatch(db);
                        count = 0;
                    }
                });

                if (count > 0) batches.push(batch);
                await Promise.all(batches.map(b => b.commit()));
            };

            // 1. Get Records to delete
            const recordsQ = query(
                collection(db, COLLECTIONS.RECORDS),
                where('cycleKey', '==', cycleKey),
                where('workId', '==', workId)
            );
            const recordsSnap = await getDocs(recordsQ);
            await deleteInBatches(recordsSnap);

            // 2. Get Uploads to delete
            const uploadsQ = query(
                collection(db, COLLECTIONS.UPLOADS),
                where('cycleKey', '==', cycleKey),
                where('workId', '==', workId)
            );
            const uploadsSnap = await getDocs(uploadsQ);
            await deleteInBatches(uploadsSnap);

            // 3. Delete Planning (Single Doc)
            const planningId = `${workId}_${cycleKey}`;
            const planningRef = doc(db, COLLECTIONS.PLANNING, planningId);
            await deleteDoc(doc(db, COLLECTIONS.PLANNING, planningId)); // Direct delete, no batch needed if single

        } catch (error) {
            console.error("Error deleting cycle data:", error);
            throw error;
        }
    },

    // EQUIPMENT MANAGEMENT
    async getEquipments(): Promise<any[]> {
        try {
            const q = query(collection(db, 'construction_equipments'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching equipments:", error);
            return [];
        }
    },

    async addEquipment(equipment: Omit<any, 'id'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(db, 'construction_equipments'), equipment);
            return docRef.id;
        } catch (error) {
            console.error("Error adding equipment:", error);
            throw error;
        }
    },

    async updateEquipment(id: string, equipment: Partial<any>): Promise<void> {
        try {
            const docRef = doc(db, 'construction_equipments', id);
            await setDoc(docRef, equipment, { merge: true });
        } catch (error) {
            console.error("Error updating equipment:", error);
            throw error;
        }
    },

    async deleteEquipment(id: string): Promise<void> {
        try {
            await deleteDoc(doc(db, 'construction_equipments', id));
        } catch (error) {
            console.error("Error deleting equipment:", error);
            throw error;
        }
    }
};

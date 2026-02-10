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
    Timestamp
} from 'firebase/firestore';
import { db } from '@/services/firebaseConfig';
import { ConstructionRecord, PlanningTarget } from '../types';

const COLLECTIONS = {
    CYCLES: 'construction_cycles',
    RECORDS: 'construction_records',
    PLANNING: 'construction_planning'
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

    async getRecords(cycleKey: string): Promise<ConstructionRecord[]> {
        try {
            const q = query(
                collection(db, COLLECTIONS.RECORDS),
                where('cycleKey', '==', cycleKey)
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

    async saveRecords(cycleKey: string, records: any[]): Promise<void> {
        try {
            // Ensure cycle exists
            await this.createCycle(cycleKey);

            // 1. Delete existing records for this cycle to avoid duplicates (Overwrite strategy)
            const q = query(collection(db, COLLECTIONS.RECORDS), where('cycleKey', '==', cycleKey));
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

            // Add operations
            records.forEach((record) => {
                const docRef = doc(collection(db, COLLECTIONS.RECORDS));
                currentBatch.set(docRef, {
                    ...record,
                    cycleKey,
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

    async getPlanning(cycleKey: string): Promise<PlanningTarget[]> {
        try {
            const docRef = doc(db, COLLECTIONS.PLANNING, cycleKey);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                return snapshot.data().targets as PlanningTarget[];
            }
            return [];
        } catch (error) {
            console.error("Error fetching planning:", error);
            return [];
        }
    },

    async updatePlanning(cycleKey: string, targets: PlanningTarget[]): Promise<void> {
        try {
            const docRef = doc(db, COLLECTIONS.PLANNING, cycleKey);
            await setDoc(docRef, {
                cycleKey,
                targets,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error("Error updating planning:", error);
            throw error;
        }
    }
};

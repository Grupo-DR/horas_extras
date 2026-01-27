import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    getDocs
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Prospect, ProspectStage } from '../types';

const COLLECTION = 'prospects';

// Helper to convert Firestore Timestamp to Date
const convertDates = (data: any): Prospect => {
    return {
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        stageStartedAt: data.stageStartedAt instanceof Timestamp ? data.stageStartedAt.toDate() : new Date(data.stageStartedAt || Date.now()),
        lastContactDate: data.lastContactDate instanceof Timestamp ? data.lastContactDate.toDate() : new Date(data.lastContactDate || Date.now()),
        nextActionDate: data.nextActionDate instanceof Timestamp ? data.nextActionDate.toDate() : new Date(data.nextActionDate || Date.now()),
    } as Prospect;
};

export const ProspectService = {
    // Subscribe to all prospects (Real-time)
    subscribeAll: (callback: (prospects: Prospect[]) => void) => {
        const q = query(
            collection(db, COLLECTION),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(data.map(convertDates));
        });
    },

    // Add new prospect
    add: async (prospect: Omit<Prospect, 'id' | 'createdAt' | 'stageStartedAt'>) => {
        const now = new Date();
        await addDoc(collection(db, COLLECTION), {
            ...prospect,
            createdAt: serverTimestamp(),
            stageStartedAt: now // Initial stage start
        });
    },

    // Update prospect fields
    update: async (id: string, data: Partial<Prospect>) => {
        const docRef = doc(db, COLLECTION, id);
        await updateDoc(docRef, data);
    },

    // Specific method to move stage which resets stage timer
    moveStage: async (id: string, newStage: ProspectStage) => {
        const docRef = doc(db, COLLECTION, id);
        const now = new Date();
        await updateDoc(docRef, {
            stage: newStage,
            stageStartedAt: now
        });
    },

    // Delete prospect
    delete: async (id: string) => {
        const docRef = doc(db, COLLECTION, id);
        await deleteDoc(docRef);
    },

    // Initialize with seed data if empty (Optional utility)
    seedIfEmpty: async (seedData: Omit<Prospect, 'id'>[]) => {
        const snap = await getDocs(collection(db, COLLECTION));
        if (snap.empty) {
            console.log('Seeding prospects...');
            for (const p of seedData) {
                await addDoc(collection(db, COLLECTION), p);
            }
        }
    }
};

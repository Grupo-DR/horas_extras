import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Interaction } from '../types';
import { toFirestoreTimestamp, safeDateParse } from '../utils/dateUtils';

const COLLECTION = 'interactions';

export const InteractionService = {
    // CREATE
    create: async (data: Omit<Interaction, 'id' | 'createdAt'>) => {
        // Validation: createdBy must be present
        if (!data.createdBy || !data.createdBy.id) {
            console.warn("InteractionService: createdBy field is missing or invalid", data);
            // We could throw, but for safety lets allow if system
        }

        const payload = {
            ...data,
            date: toFirestoreTimestamp(data.date),
            createdAt: Timestamp.now()
        };
        // Remove undefined
        Object.keys(payload).forEach(key => payload[key as keyof typeof payload] === undefined && delete payload[key as keyof typeof payload]);

        return await addDoc(collection(db, COLLECTION), payload);
    },

    // UPDATE
    update: async (id: string, updates: Partial<Interaction>) => {
        const payload: any = { ...updates };
        if (updates.date) {
            payload.date = toFirestoreTimestamp(updates.date);
        }

        // Remove undefined
        Object.keys(payload).forEach(key => payload[key as keyof typeof payload] === undefined && delete payload[key as keyof typeof payload]);

        await updateDoc(doc(db, COLLECTION, id), payload);
    },

    // DELETE
    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION, id));
    },

    // SUBSCRIBE BY CLIENT
    subscribeByClient: (clientId: string, callback: (data: Interaction[]) => void) => {
        // IMPORTANT: Ensure composite index exists: clientId ASC, date DESC
        const q = query(
            collection(db, COLLECTION),
            where('clientId', '==', clientId),
            orderBy('date', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    date: safeDateParse(d.date),
                    createdAt: safeDateParse(d.createdAt)
                } as Interaction;
            });
            callback(items);
        });
    },

    // SUBSCRIBE BY CONTACT
    subscribeByContact: (contactId: string, callback: (data: Interaction[]) => void) => {
        const q = query(
            collection(db, COLLECTION),
            where('contactId', '==', contactId),
            orderBy('date', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    date: safeDateParse(d.date),
                    createdAt: safeDateParse(d.createdAt)
                } as Interaction;
            });
            callback(items);
        });
    },

    // SUBSCRIBE BY BID
    subscribeByBid: (bidId: string, callback: (data: Interaction[]) => void) => {
        const q = query(
            collection(db, COLLECTION),
            where('bidId', '==', bidId),
            orderBy('date', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    date: safeDateParse(d.date),
                    createdAt: safeDateParse(d.createdAt)
                } as Interaction;
            });
            callback(items);
        });
    },

    // GLOBAL RECENT (For Dashboard)
    subscribeRecentGlobal: (months: number, callback: (data: Interaction[]) => void) => {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);

        const q = query(
            collection(db, COLLECTION),
            // where('date', '>=', Timestamp.fromDate(cutoff)), // Might require index
            orderBy('date', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    date: safeDateParse(d.date),
                    createdAt: safeDateParse(d.createdAt)
                } as Interaction;
            });
            // Client-side filtering if index issues arise, but ideally query filters.
            // For now, let's trust the query or filter client-side if needed.
            const p = items.filter(i => i.date >= cutoff);
            callback(p);
        });
    }
};

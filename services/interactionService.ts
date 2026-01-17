import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Interaction } from '../types';
import { toFirestoreTimestamp, safeDateParse } from '../utils/dateUtils';

const COLLECTION = 'interactions';

export const InteractionService = {
    // CREATE
    create: async (data: Omit<Interaction, 'id' | 'createdAt'>) => {
        // Garantir que date é Timestamp
        const payload = {
            ...data,
            date: toFirestoreTimestamp(data.date),
            createdAt: Timestamp.now()
        };
        return await addDoc(collection(db, COLLECTION), payload);
    },

    // UPDATE
    update: async (id: string, updates: Partial<Interaction>) => {
        const payload: any = { ...updates };
        if (updates.date) {
            payload.date = toFirestoreTimestamp(updates.date);
        }

        await updateDoc(doc(db, COLLECTION, id), payload);
    },

    // DELETE
    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION, id));
    },

    // SUBSCRIBE BY CLIENT
    subscribeByClient: (clientId: string, callback: (data: Interaction[]) => void) => {
        // Index necessário: clientId ASC, date DESC
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
            where('date', '>=', Timestamp.fromDate(cutoff)),
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
    }
};

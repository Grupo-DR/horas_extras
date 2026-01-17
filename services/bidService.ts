import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Bid } from '../types';
import { toFirestoreTimestamp, safeDateParse } from '../utils/dateUtils';

const COLLECTION = 'bids';

export const BidService = {
    // CREATE
    create: async (data: Omit<Bid, 'id'>) => {
        const payload = {
            ...data,
            date: toFirestoreTimestamp(data.date),
            createdAt: Timestamp.now()
        };
        return await addDoc(collection(db, COLLECTION), payload);
    },

    // UPDATE
    update: async (id: string, updates: Partial<Bid>) => {
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
    subscribeByClient: (clientId: string, callback: (bids: Bid[]) => void) => {
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
                } as Bid;
            });
            callback(items);
        });
    },

    // GLOBAL RECENT (For Dashboard)
    subscribeRecentGlobal: (months: number, callback: (data: Bid[]) => void) => {
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
                } as Bid;
            });
            callback(items);
        });
    }
};

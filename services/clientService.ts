import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { Client } from '../types';

const COLLECTION = 'clients';

export const ClientService = {
    // CREATE
    create: async (client: Omit<Client, 'id'>) => {
        return await addDoc(collection(db, COLLECTION), {
            ...client,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
    },

    // UPDATE
    update: async (id: string, updates: Partial<Client>) => {
        await updateDoc(doc(db, COLLECTION, id), {
            ...updates,
            updatedAt: Timestamp.now()
        });
    },

    // DELETE
    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION, id));
    },

    // SUBSCRIBE ALL (For List/Dashboard)
    subscribe: (callback: (clients: Client[]) => void) => {
        const q = query(
            collection(db, COLLECTION),
            orderBy('name', 'asc')
        );

        return onSnapshot(q, (snapshot) => {
            const clients = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Client));
            callback(clients);
        });
    },

    // GET ONE (Real-time)
    subscribeById: (id: string, callback: (client: Client | null) => void) => {
        return onSnapshot(doc(db, COLLECTION, id), (snap) => {
            if (snap.exists()) {
                callback({ id: snap.id, ...snap.data() } as Client);
            } else {
                callback(null);
            }
        });
    }
};

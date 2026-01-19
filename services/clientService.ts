import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    orderBy,
    Timestamp,
    onSnapshot
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Client } from '../types'; // Updated import
import { toFirestoreTimestamp, safeDateParse } from '../utils/dateUtils';

const COLLECTION_NAME = 'clients';

export const ClientService = {
    /**
     * Get all clients ordered by corporate name
     */
    async getAll(): Promise<Client[]> {
        const q = query(collection(db, COLLECTION_NAME), orderBy('corporateName'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: safeDateParse(data.createdAt || data.date), // Fallback
                updatedAt: safeDateParse(data.updatedAt)
            } as Client;
        });
    },

    /**
     * Create a new client
     */
    async create(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const payload = {
            ...data,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            status: data.status || 'ATIVA'
        };
        const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
        return docRef.id;
    },

    /**
     * Update a client
     */
    async update(id: string, updates: Partial<Client>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);
        const payload = {
            ...updates,
            updatedAt: Timestamp.now()
        };
        // Remove undefined fields
        Object.keys(payload).forEach(key => payload[key as keyof typeof payload] === undefined && delete payload[key as keyof typeof payload]);

        await updateDoc(docRef, payload);
    },

    /**
     * Delete a client
     */
    async delete(id: string): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    },

    /**
     * Subscribe to all clients
     */
    subscribeAll: (callback: (clients: Client[]) => void) => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('corporateName'));
        return onSnapshot(q, (snapshot) => {
            const clients = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: safeDateParse(data.createdAt),
                    updatedAt: safeDateParse(data.updatedAt)
                } as Client;
            });
            callback(clients);
        });
    }
};

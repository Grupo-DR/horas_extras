import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    orderBy
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Client } from '../types/crm';

const COLLECTION_NAME = 'clients';

export const ClientService = {
    /**
     * Get all clients ordered by corporate name
     */
    async getAll(): Promise<Client[]> {
        const q = query(collection(db, COLLECTION_NAME), orderBy('corporateName'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Client));
    },

    /**
     * Create a new client
     */
    async create(data: Omit<Client, 'id'>): Promise<string> {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...data,
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    },

    /**
     * Delete a client
     */
    async delete(id: string): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    }
};

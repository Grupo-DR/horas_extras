import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ClientContact as Contact } from '../types';

const COLLECTION_NAME = 'contacts';

export const ContactService = {
    /**
     * Get all contacts
     */
    async getAll(): Promise<Contact[]> {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Contact));
    },

    /**
     * Get contacts by Client ID
     */
    async getByClient(clientId: string): Promise<Contact[]> {
        const q = query(collection(db, COLLECTION_NAME), where('clientId', '==', clientId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Contact));
    },

    /**
     * Create a new contact
     */
    async create(data: Omit<Contact, 'id'>): Promise<string> {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), data);
        return docRef.id;
    },

    /**
     * Delete a contact
     */
    async delete(id: string): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    }
};

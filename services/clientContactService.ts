import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { ClientContact } from '../types';

const COLLECTION = 'client_contacts';

export const ClientContactService = {
    // CREATE
    create: async (contact: Omit<ClientContact, 'id' | 'isActive'>) => {
        return await addDoc(collection(db, COLLECTION), {
            ...contact,
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
    },

    // UPDATE
    update: async (id: string, updates: Partial<ClientContact>) => {
        const docRef = doc(db, COLLECTION, id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    },

    // DELETE (Soft Delete preferível? Por enquanto Hard Delete simples)
    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION, id));
    },

    // SUBSCRIBE BY CLIENT
    subscribeByClient: (clientId: string, callback: (contacts: ClientContact[]) => void) => {
        const q = query(
            collection(db, COLLECTION),
            where('clientId', '==', clientId),
            // where('isActive', '==', true) // Opcional, se quisermos esconder inativos
        );

        return onSnapshot(q, (snapshot) => {
            const contacts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ClientContact));
            callback(contacts);
        });
    },

    // SUBSCRIBE ALL (For Analytics/Dashboard)
    subscribeAll: (callback: (contacts: ClientContact[]) => void) => {
        const q = query(collection(db, COLLECTION));
        return onSnapshot(q, (snapshot) => {
            const contacts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ClientContact));
            callback(contacts);
        });
    },

    // GET ONE
    subscribeById: (id: string, callback: (contact: ClientContact | null) => void) => {
        return onSnapshot(doc(db, COLLECTION, id), (doc) => {
            if (doc.exists()) {
                callback({ id: doc.id, ...doc.data() } as ClientContact);
            } else {
                callback(null);
            }
        });
    }
};

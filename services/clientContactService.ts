import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, Timestamp, getDocs } from 'firebase/firestore';
import { ClientContact } from '../types';
import { safeDateParse } from '../utils/dateUtils';

const COLLECTION = 'client_contacts';

export const ClientContactService = {
    // CREATE
    create: async (contact: Omit<ClientContact, 'id' | 'createdAt' | 'updatedAt'>) => {
        return await addDoc(collection(db, COLLECTION), {
            ...contact,
            isActive: contact.isActive ?? true, // Default true
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
    },

    // UPDATE
    update: async (id: string, updates: Partial<ClientContact>) => {
        const docRef = doc(db, COLLECTION, id);
        const payload = {
            ...updates,
            updatedAt: Timestamp.now()
        };
        // Remove undefined fields
        Object.keys(payload).forEach(key => payload[key as keyof typeof payload] === undefined && delete payload[key as keyof typeof payload]);

        await updateDoc(docRef, payload);
    },

    // DELETE
    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION, id));
    },

    // GET ALL (Promise)
    getAll: async (): Promise<ClientContact[]> => {
        const q = query(collection(db, COLLECTION), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: safeDateParse(data.createdAt),
                updatedAt: safeDateParse(data.updatedAt)
            } as ClientContact;
        });
    },

    // SUBSCRIBE BY CLIENT
    subscribeByClient: (clientId: string, callback: (contacts: ClientContact[]) => void) => {
        const q = query(
            collection(db, COLLECTION),
            where('clientId', '==', clientId)
        );

        return onSnapshot(q, (snapshot) => {
            const contacts = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: safeDateParse(data.createdAt),
                    updatedAt: safeDateParse(data.updatedAt)
                } as ClientContact;
            });
            callback(contacts);
        });
    },

    // SUBSCRIBE ALL (For Analytics/Dashboard)
    subscribeAll: (callback: (contacts: ClientContact[]) => void) => {
        const q = query(collection(db, COLLECTION));
        return onSnapshot(q, (snapshot) => {
            const contacts = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: safeDateParse(data.createdAt),
                    updatedAt: safeDateParse(data.updatedAt)
                } as ClientContact;
            });
            callback(contacts);
        });
    },

    // GET ONE (Subscribe)
    subscribeById: (id: string, callback: (contact: ClientContact | null) => void) => {
        return onSnapshot(doc(db, COLLECTION, id), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                callback({
                    id: doc.id,
                    ...data,
                    createdAt: safeDateParse(data.createdAt),
                    updatedAt: safeDateParse(data.updatedAt)
                } as ClientContact);
            } else {
                callback(null);
            }
        });
    }
};

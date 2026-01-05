import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { User } from '../types';

const COLLECTION_NAME = 'users';

export const UserService = {
    // Fetch all users
    getAll: async (): Promise<User[]> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('name'));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as User));
        } catch (error) {
            console.error("Error fetching users: ", error);
            throw error;
        }
    },

    // Create a new user
    create: async (user: Omit<User, 'id'>): Promise<string> => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), user);
            return docRef.id;
        } catch (error) {
            console.error("Error creating user: ", error);
            throw error;
        }
    },

    // Update a user
    update: async (id: string, user: Partial<User>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, user);
        } catch (error) {
            console.error("Error updating user: ", error);
            throw error;
        }
    },

    // Delete a user
    delete: async (id: string): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting user: ", error);
            throw error;
        }
    }
};

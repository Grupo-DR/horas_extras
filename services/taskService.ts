import { db } from './firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { Task } from '../types';

const COLLECTION = 'tasks';

export const TaskService = {
    getAll: async (): Promise<Task[]> => {
        const snapshot = await getDocs(collection(db, COLLECTION));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
    },

    subscribe: (onUpdate: (tasks: Task[]) => void) => {
        return onSnapshot(collection(db, COLLECTION), (snapshot) => {
            const tasks = snapshot.docs.map(doc => {
                const data = doc.data();
                // Date conversion helper
                const convertDate = (val: any) => {
                    if (!val) return new Date();
                    if (typeof val.toDate === 'function') return val.toDate();
                    if (val instanceof Date) return val;
                    const d = new Date(val);
                    return isNaN(d.getTime()) ? new Date() : d;
                };

                return {
                    id: doc.id,
                    ...data,
                    startDate: convertDate(data.startDate),
                    endDate: convertDate(data.endDate),
                } as Task;
            });
            onUpdate(tasks);
        });
    },

    create: async (task: Omit<Task, 'id'>) => {
        const docRef = await addDoc(collection(db, COLLECTION), task);
        return docRef.id;
    },

    update: async (id: string, task: Partial<Task>) => {
        await updateDoc(doc(db, COLLECTION, id), task);
    },

    delete: async (id: string) => {
        await deleteDoc(doc(db, COLLECTION, id));
    },

    getByInteractionId: async (interactionId: string): Promise<Task[]> => {
        const q = query(collection(db, COLLECTION), where('interactionId', '==', interactionId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
    }
};

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMAChecklistItem } from '../types';

const CHECKLIST_COLLECTION = 'ssma_checklists';

export const ssmaChecklistService = {
    async fetchAllItems(): Promise<SSMAChecklistItem[]> {
        const querySnapshot = await getDocs(collection(db, CHECKLIST_COLLECTION));
        const items: SSMAChecklistItem[] = [];
        querySnapshot.forEach(d => {
            items.push(d.data() as SSMAChecklistItem);
        });
        return items;
    },

    async saveAllItems(items: Omit<SSMAChecklistItem, 'id'>[]): Promise<void> {
        const existingDocs = await getDocs(collection(db, CHECKLIST_COLLECTION));
        const batch = writeBatch(db);
        
        // Remove existing checklist
        existingDocs.forEach(d => {
            batch.delete(d.ref);
        });

        // Insert new
        items.forEach(item => {
            const docRef = doc(collection(db, CHECKLIST_COLLECTION));
            batch.set(docRef, { ...item, id: docRef.id });
        });

        await batch.commit();
    }
};

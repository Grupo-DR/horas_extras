import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMAInspection } from '../types';
import { ssmaAuditService } from './ssmaAuditService';
import { calculateInspecoesFields } from '../domain/calculateSSMAResults';

import { UserProfileDoc } from '../../iam/types';

const COLLECTION_NAME = 'ssma_inspections';

export const ssmaInspectionService = {
    async create(data: Omit<SSMAInspection, 'id' | 'createdAt' | 'updatedAt'>, currentUser: UserProfileDoc): Promise<string> {
        const id = `${data.cc}_${data.ano}_${data.mes}`; // unique composite key or custom
        const docRef = doc(db, COLLECTION_NAME, id);
        
        const now = Timestamp.now().toDate().toISOString();
        const newRecord: SSMAInspection = {
            ...data,
            id,
            createdAt: now,
            createdBy: currentUser.uid,
            createdByNameSnapshot: currentUser.displayName,
            updatedAt: now,
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName,
        } as SSMAInspection;

        // Optionally recalculate
        const calculated = calculateInspecoesFields(newRecord);

        await setDoc(docRef, calculated);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'CREATE',
            entityType: 'INSPECTION_EVENT',
            entityId: id,
            after: calculated as any,
            reason: 'Created inspection record',
            metadata: { ano: data.ano, mes: data.mes, cc: data.cc }
        }, currentUser);

        return id;
    },

    async update(id: string, data: Partial<SSMAInspection>, currentUser: UserProfileDoc): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Inspection record not found');
        }

        const currentData = docSnap.data() as SSMAInspection;

        const updates = {
            ...data,
            updatedAt: Timestamp.now().toDate().toISOString(),
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName,
        };

        const calculated = calculateInspecoesFields({ ...currentData, ...updates } as any);

        await updateDoc(docRef, calculated as any);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'UPDATE',
            entityType: 'INSPECTION_EVENT',
            entityId: id,
            before: currentData as any,
            after: calculated as any,
            reason: 'Updated inspection record'
        }, currentUser);
    },

    async getById(id: string): Promise<SSMAInspection | null> {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;
        return docSnap.data() as SSMAInspection;
    },

    async list(year?: number): Promise<SSMAInspection[]> {
        let q = collection(db, COLLECTION_NAME) as any;
        if (year) {
            q = query(q, where('ano', '==', year));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as SSMAInspection);
    },

    async delete(id: string, currentUser: UserProfileDoc): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Inspection record not found');
        }

        const currentData = docSnap.data() as SSMAInspection;

        await deleteDoc(docRef);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'DELETE',
            entityType: 'INSPECTION_EVENT',
            entityId: id,
            before: currentData as any,
            after: null,
            reason: 'Deleted inspection record'
        }, currentUser);
    }
};

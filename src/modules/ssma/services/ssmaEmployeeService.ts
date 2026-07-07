import { collection, doc, getDocs, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMAEmployee } from '../types';
import { UserProfileDoc } from '../../iam/types';
import { ssmaAuditService } from './ssmaAuditService';

const COLLECTION = 'ssma_employees';

export const ssmaEmployeeService = {
    list: async (): Promise<SSMAEmployee[]> => {
        const snap = await getDocs(collection(db, COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAEmployee));
    },

    getById: async (id: string): Promise<SSMAEmployee | null> => {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SSMAEmployee;
    },

    create: async (input: Omit<SSMAEmployee, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot' | 'updatedAt' | 'updatedBy' | 'updatedByNameSnapshot'>, currentUser: UserProfileDoc): Promise<string> => {
        const newRef = doc(collection(db, COLLECTION));
        const now = new Date().toISOString();
        const docData: SSMAEmployee = {
            ...input,
            id: newRef.id,
            active: true,
            createdAt: now,
            createdBy: currentUser.uid,
            createdByNameSnapshot: currentUser.displayName,
            updatedAt: now,
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName
        };
        await setDoc(newRef, docData);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'CREATE',
            entityType: 'EMPLOYEE',
            entityId: newRef.id,
            entityLabelSnapshot: docData.name,
            after: docData as any
        }, currentUser);

        return newRef.id;
    },

    update: async (id: string, input: Partial<Omit<SSMAEmployee, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot'>>, currentUser: UserProfileDoc): Promise<void> => {
        const ref = doc(db, COLLECTION, id);
        const updates = {
            ...input,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName
        };
        const existing = await ssmaEmployeeService.getById(id);
        if (!existing) throw new Error('Colaborador não encontrado.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'UPDATE',
            entityType: 'EMPLOYEE',
            entityId: id,
            entityLabelSnapshot: existing.name,
            before: existing as any,
            after: { ...existing, ...updates } as any
        }, currentUser);
    },

    disable: async (id: string, reason: string, currentUser: UserProfileDoc): Promise<void> => {
        const ref = doc(db, COLLECTION, id);
        const updates = {
            active: false,
            disabledAt: new Date().toISOString(),
            disabledBy: currentUser.uid,
            disableReason: reason,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName
        };
        const existing = await ssmaEmployeeService.getById(id);
        if (!existing) throw new Error('Colaborador não encontrado.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'DISABLE',
            entityType: 'EMPLOYEE',
            entityId: id,
            entityLabelSnapshot: existing.name,
            reason: reason,
            before: existing as any,
            after: { ...existing, ...updates } as any
        }, currentUser);
    }
};

import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMACostCenter } from '../types';
import { UserProfileDoc } from '../../iam/types';
import { ssmaAuditService } from './ssmaAuditService';

const COLLECTION = 'ssma_cost_centers';

export const ssmaCostCenterService = {
    list: async (): Promise<SSMACostCenter[]> => {
        const snap = await getDocs(collection(db, COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMACostCenter));
    },

    getById: async (id: string): Promise<SSMACostCenter | null> => {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SSMACostCenter;
    },

    create: async (input: Omit<SSMACostCenter, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot' | 'updatedAt' | 'updatedBy' | 'updatedByNameSnapshot'>, currentUser: UserProfileDoc): Promise<string> => {
        const newRef = doc(collection(db, COLLECTION));
        const now = new Date().toISOString();
        const docData: SSMACostCenter = {
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
            entityType: 'COST_CENTER',
            entityId: newRef.id,
            entityLabelSnapshot: `${docData.code} - ${docData.name}`,
            after: docData as any
        }, currentUser);

        return newRef.id;
    },

    update: async (id: string, input: Partial<Omit<SSMACostCenter, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot'>>, currentUser: UserProfileDoc): Promise<void> => {
        const ref = doc(db, COLLECTION, id);
        const updates = {
            ...input,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName
        };
        const existing = await ssmaCostCenterService.getById(id);
        if (!existing) throw new Error('Centro de Custo não encontrado.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'UPDATE',
            entityType: 'COST_CENTER',
            entityId: id,
            entityLabelSnapshot: `${existing.code} - ${existing.name}`,
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
        const existing = await ssmaCostCenterService.getById(id);
        if (!existing) throw new Error('Centro de Custo não encontrado.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'DISABLE',
            entityType: 'COST_CENTER',
            entityId: id,
            entityLabelSnapshot: `${existing.code} - ${existing.name}`,
            reason: reason,
            before: existing as any,
            after: { ...existing, ...updates } as any
        }, currentUser);
    },

    remove: async (id: string, currentUser: UserProfileDoc): Promise<void> => {
        const ref = doc(db, COLLECTION, id);
        const existing = await ssmaCostCenterService.getById(id);
        if (!existing) throw new Error('Centro de Custo não encontrado.');

        await deleteDoc(ref);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'DELETE',
            entityType: 'COST_CENTER',
            entityId: id,
            entityLabelSnapshot: `${existing.code} - ${existing.name}`,
            before: existing as any
        }, currentUser);
    }
};

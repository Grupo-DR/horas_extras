import { collection, doc, getDocs, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMARule } from '../types';
import { UserProfileDoc } from '../../iam/types';
import { ssmaAuditService } from './ssmaAuditService';

const COLLECTION = 'ssma_rules';

export const ssmaRuleService = {
    list: async (): Promise<SSMARule[]> => {
        const snap = await getDocs(collection(db, COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMARule));
    },

    getById: async (id: string): Promise<SSMARule | null> => {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SSMARule;
    },

    create: async (input: Omit<SSMARule, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot' | 'updatedAt' | 'updatedBy' | 'updatedByNameSnapshot'>, currentUser: UserProfileDoc): Promise<string> => {
        const newRef = doc(collection(db, COLLECTION));
        const now = new Date().toISOString();
        const docData: SSMARule = {
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
            entityType: 'RULE',
            entityId: newRef.id,
            entityLabelSnapshot: docData.name,
            after: docData as any
        }, currentUser);

        return newRef.id;
    },

    update: async (id: string, input: Partial<Omit<SSMARule, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot'>>, currentUser: UserProfileDoc): Promise<void> => {
        const ref = doc(db, COLLECTION, id);
        const updates = {
            ...input,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName
        };
        const existing = await ssmaRuleService.getById(id);
        if (!existing) throw new Error('Regra não encontrada.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'UPDATE',
            entityType: 'RULE',
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
        const existing = await ssmaRuleService.getById(id);
        if (!existing) throw new Error('Regra não encontrada.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'DISABLE',
            entityType: 'RULE',
            entityId: id,
            entityLabelSnapshot: existing.name,
            reason: reason,
            before: existing as any,
            after: { ...existing, ...updates } as any
        }, currentUser);
    }
};

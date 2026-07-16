import { collection, doc, getDocs, getDoc, setDoc, updateDoc, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMAForeman } from '../types';
import { UserProfileDoc } from '../../iam/types';
import { ssmaAuditService } from './ssmaAuditService';

const COLLECTION = 'ssma_foremen';
const chunk = <T,>(items: T[], size = 30): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
};

export const ssmaForemanService = {
    list: async (): Promise<SSMAForeman[]> => {
        const snap = await getDocs(collection(db, COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAForeman));
    },

    listByIds: async (ids: string[]): Promise<SSMAForeman[]> => {
        if (!ids.length) return [];
        const result: SSMAForeman[] = [];
        for (const idsChunk of chunk(Array.from(new Set(ids)))) {
            const q = query(collection(db, COLLECTION), where('id', 'in', idsChunk));
            const snap = await getDocs(q);
            result.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAForeman)));
        }
        return result;
    },

    getById: async (id: string): Promise<SSMAForeman | null> => {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SSMAForeman;
    },

    create: async (input: Omit<SSMAForeman, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot' | 'updatedAt' | 'updatedBy' | 'updatedByNameSnapshot'>, currentUser: UserProfileDoc): Promise<string> => {
        const newRef = doc(collection(db, COLLECTION));
        const now = new Date().toISOString();
        const docData: SSMAForeman = {
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
            entityType: 'FOREMAN' as any,
            entityId: newRef.id,
            entityLabelSnapshot: docData.name,
            after: docData as any
        }, currentUser);

        return newRef.id;
    },

    update: async (id: string, input: Partial<Omit<SSMAForeman, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot'>>, currentUser: UserProfileDoc): Promise<void> => {
        const ref = doc(db, COLLECTION, id);
        const updates = {
            ...input,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName
        };
        const existing = await ssmaForemanService.getById(id);
        if (!existing) throw new Error('Encarregado não encontrado.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'UPDATE',
            entityType: 'FOREMAN' as any,
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
        const existing = await ssmaForemanService.getById(id);
        if (!existing) throw new Error('Encarregado não encontrado.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'DISABLE',
            entityType: 'FOREMAN' as any,
            entityId: id,
            entityLabelSnapshot: existing.name,
            reason: reason,
            before: existing as any,
            after: { ...existing, ...updates } as any
        }, currentUser);
    },

    remove: async (id: string, currentUser: UserProfileDoc): Promise<void> => {
        const existing = await ssmaForemanService.getById(id);
        if (!existing) return;

        await deleteDoc(doc(db, COLLECTION, id));

        await ssmaAuditService.createSSMAAuditLog({
            action: 'DELETE' as any,
            entityType: 'FOREMAN' as any,
            entityId: id,
            entityLabelSnapshot: existing.name,
            reason: 'Exclusão permanente solicitada pelo usuário.',
            before: existing as any
        }, currentUser);
    }
};

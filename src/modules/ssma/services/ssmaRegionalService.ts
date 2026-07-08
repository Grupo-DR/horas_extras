import { collection, doc, getDocs, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMARegional } from '../types';
import { UserProfileDoc } from '../../iam/types';
import { ssmaAuditService } from './ssmaAuditService';

const COLLECTION = 'ssma_regionals';
const chunk = <T,>(items: T[], size = 30): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
};

export const ssmaRegionalService = {
    list: async (): Promise<SSMARegional[]> => {
        const snap = await getDocs(collection(db, COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMARegional));
    },

    listByIds: async (ids: string[]): Promise<SSMARegional[]> => {
        if (!ids.length) return [];
        const result: SSMARegional[] = [];
        for (const idsChunk of chunk(Array.from(new Set(ids)))) {
            const q = query(collection(db, COLLECTION), where('id', 'in', idsChunk));
            const snap = await getDocs(q);
            result.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMARegional)));
        }
        return result;
    },

    getById: async (id: string): Promise<SSMARegional | null> => {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SSMARegional;
    },

    create: async (input: Omit<SSMARegional, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot' | 'updatedAt' | 'updatedBy' | 'updatedByNameSnapshot'>, currentUser: UserProfileDoc): Promise<string> => {
        const newRef = doc(collection(db, COLLECTION));
        const now = new Date().toISOString();
        const docData: SSMARegional = {
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
            entityType: 'REGIONAL',
            entityId: newRef.id,
            entityLabelSnapshot: docData.name,
            after: docData as any
        }, currentUser);

        return newRef.id;
    },

    update: async (id: string, input: Partial<Omit<SSMARegional, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot'>>, currentUser: UserProfileDoc): Promise<void> => {
        const ref = doc(db, COLLECTION, id);
        const updates = {
            ...input,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName
        };
        const existing = await ssmaRegionalService.getById(id);
        if (!existing) throw new Error('Regional não encontrada.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'UPDATE',
            entityType: 'REGIONAL',
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
        const existing = await ssmaRegionalService.getById(id);
        if (!existing) throw new Error('Regional não encontrada.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'DISABLE',
            entityType: 'REGIONAL',
            entityId: id,
            entityLabelSnapshot: existing.name,
            reason: reason,
            before: existing as any,
            after: { ...existing, ...updates } as any
        }, currentUser);
    },

    remove: async (id: string, currentUser: UserProfileDoc): Promise<void> => {
        await ssmaRegionalService.disable(id, 'Remocao logica solicitada pelo usuario.', currentUser);
    }
};

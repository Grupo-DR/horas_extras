import { collection, doc, getDocs, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMAEvidence } from '../types';
import { UserProfileDoc } from '../../iam/types';
import { ssmaAuditService } from './ssmaAuditService';

const COLLECTION = 'ssma_evidences';

export const ssmaEvidenceMetadataService = {
    list: async (): Promise<SSMAEvidence[]> => {
        const snap = await getDocs(collection(db, COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAEvidence));
    },

    getById: async (id: string): Promise<SSMAEvidence | null> => {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SSMAEvidence;
    },

    create: async (
        input: Omit<SSMAEvidence, 'id' | 'uploadedAt' | 'uploadedBy' | 'uploadedByNameSnapshot' | 'active'>,
        currentUser: UserProfileDoc
    ): Promise<string> => {
        const newRef = doc(collection(db, COLLECTION));
        const now = new Date().toISOString();
        const docData: SSMAEvidence = {
            ...input,
            id: newRef.id,
            active: true,
            uploadedAt: now,
            uploadedBy: currentUser.uid,
            uploadedByNameSnapshot: currentUser.displayName
        };
        await setDoc(newRef, docData);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'CREATE',
            entityType: 'EVIDENCE',
            entityId: newRef.id,
            entityLabelSnapshot: input.fileName,
            after: docData as any
        }, currentUser);

        return newRef.id;
    },

    disable: async (id: string, currentUser: UserProfileDoc): Promise<void> => {
        const ref = doc(db, COLLECTION, id);
        const updates = {
            active: false
        };
        const existing = await ssmaEvidenceMetadataService.getById(id);
        if (!existing) throw new Error('Metadados da evidência não encontrados.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'DISABLE',
            entityType: 'EVIDENCE',
            entityId: id,
            entityLabelSnapshot: existing.fileName,
            before: existing as any,
            after: { ...existing, ...updates } as any
        }, currentUser);
    },

    listByEvent: async (inspectionEventId: string): Promise<SSMAEvidence[]> => {
        const q = query(
            collection(db, COLLECTION),
            where('inspectionEventId', '==', inspectionEventId),
            where('active', '==', true)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAEvidence));
    }
};

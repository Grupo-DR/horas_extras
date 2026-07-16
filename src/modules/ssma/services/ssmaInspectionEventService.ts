import { collection, doc, getDocs, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMAInspectionEvent } from '../types';
import { UserProfileDoc, Scope } from '../../iam/types';
import { ssmaAuditService } from './ssmaAuditService';
import { validateCancelReason, validateInspectionEventInput } from '../domain/validators';

const COLLECTION = 'ssma_inspection_events';
const chunk = <T,>(items: T[], size = 30): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
};

export const ssmaInspectionEventService = {
    list: async (): Promise<SSMAInspectionEvent[]> => {
        const snap = await getDocs(collection(db, COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAInspectionEvent));
    },

    getById: async (id: string): Promise<SSMAInspectionEvent | null> => {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SSMAInspectionEvent;
    },

    createEvent: async (
        input: Omit<SSMAInspectionEvent, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot'>,
        currentUser: UserProfileDoc
    ): Promise<string> => {
        validateInspectionEventInput({ ...input, status: 'VALID' });
        const newRef = doc(collection(db, COLLECTION));
        const now = new Date().toISOString();
        const docData: SSMAInspectionEvent = {
            ...input,
            id: newRef.id,
            status: 'VALID',
            createdAt: now,
            createdBy: currentUser.uid,
            createdByNameSnapshot: currentUser.displayName
        };
        await setDoc(newRef, docData);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'CREATE',
            entityType: 'INSPECTION_EVENT',
            entityId: newRef.id,
            entityLabelSnapshot: `Inspeção ${input.inspectionType} - CC ${input.costCenterCodeSnapshot}`,
            after: docData as any
        }, currentUser);

        return newRef.id;
    },

    updateEvent: async (
        id: string,
        input: Partial<Omit<SSMAInspectionEvent, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot'>>,
        currentUser: UserProfileDoc
    ): Promise<void> => {
        const ref = doc(db, COLLECTION, id);
        const updates = {
            ...input,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName
        };
        const existing = await ssmaInspectionEventService.getById(id);
        if (!existing) throw new Error('Evento de inspeção não encontrado.');

        validateInspectionEventInput({ ...existing, ...input });

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'UPDATE',
            entityType: 'INSPECTION_EVENT',
            entityId: id,
            entityLabelSnapshot: `Inspeção ${existing.inspectionType} - CC ${existing.costCenterCodeSnapshot}`,
            before: existing as any,
            after: { ...existing, ...updates } as any
        }, currentUser);
    },

    cancelEvent: async (
        id: string,
        reason: string,
        currentUser: UserProfileDoc
    ): Promise<void> => {
        validateCancelReason(reason);
        const ref = doc(db, COLLECTION, id);
        const now = new Date().toISOString();
        const updates = {
            status: 'CANCELLED' as const,
            cancelledAt: now,
            cancelledBy: currentUser.uid,
            cancelledByNameSnapshot: currentUser.displayName,
            cancelReason: reason,
            updatedAt: now,
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName
        };
        const existing = await ssmaInspectionEventService.getById(id);
        if (!existing) throw new Error('Evento de inspeção não encontrado.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'CANCEL',
            entityType: 'INSPECTION_EVENT',
            entityId: id,
            entityLabelSnapshot: `Inspeção ${existing.inspectionType} - CC ${existing.costCenterCodeSnapshot}`,
            reason,
            before: existing as any,
            after: { ...existing, ...updates } as any
        }, currentUser);
    },

    listByCompetence: async (competence: string | string[]): Promise<SSMAInspectionEvent[]> => {
        if (Array.isArray(competence)) {
            if (competence.length === 0) return [];
            const result: SSMAInspectionEvent[] = [];
            for (let i = 0; i < competence.length; i += 10) {
                const chunkArray = competence.slice(i, i + 10);
                const q = query(collection(db, COLLECTION), where('competence', 'in', chunkArray));
                const snap = await getDocs(q);
                result.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAInspectionEvent)));
            }
            return result;
        }
        const q = query(collection(db, COLLECTION), where('competence', '==', competence));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAInspectionEvent));
    },

    listByCompetenceAndScope: async (competence: string | string[], scope: Scope): Promise<SSMAInspectionEvent[]> => {
        if (scope.type === 'ALL') {
            return ssmaInspectionEventService.listByCompetence(competence);
        }

        if (scope.type === 'REGIONAL' && scope.regionals) {
            const result: SSMAInspectionEvent[] = [];
            for (const regionalIds of chunk(scope.regionals)) {
                let q;
                if (Array.isArray(competence)) {
                    // Firestore doesn't support multiple 'in' clauses, so we fetch by regionalIds and filter in memory if multiple competences.
                    q = query(
                        collection(db, COLLECTION),
                        where('regionalId', 'in', regionalIds)
                    );
                    const snap = await getDocs(q);
                    const filtered = snap.docs
                        .map(d => ({ id: d.id, ...d.data() } as SSMAInspectionEvent))
                        .filter(e => competence.includes(e.competence));
                    result.push(...filtered);
                } else {
                    q = query(
                        collection(db, COLLECTION),
                        where('competence', '==', competence),
                        where('regionalId', 'in', regionalIds)
                    );
                    const snap = await getDocs(q);
                    result.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAInspectionEvent)));
                }
            }
            return result;
        }

        if (scope.type === 'COST_CENTER' && scope.costCenters) {
            const result: SSMAInspectionEvent[] = [];
            for (const costCenterIds of chunk(scope.costCenters)) {
                let q;
                if (Array.isArray(competence)) {
                    q = query(
                        collection(db, COLLECTION),
                        where('costCenterId', 'in', costCenterIds)
                    );
                    const snap = await getDocs(q);
                    const filtered = snap.docs
                        .map(d => ({ id: d.id, ...d.data() } as SSMAInspectionEvent))
                        .filter(e => competence.includes(e.competence));
                    result.push(...filtered);
                } else {
                    q = query(
                        collection(db, COLLECTION),
                        where('competence', '==', competence),
                        where('costCenterId', 'in', costCenterIds)
                    );
                    const snap = await getDocs(q);
                    result.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAInspectionEvent)));
                }
            }
            return result;
        }

        return [];
    },

    listByCompetenceForUser: async (competence: string | string[], currentUser: UserProfileDoc): Promise<SSMAInspectionEvent[]> => {
        if (currentUser.isSuperAdmin || currentUser.modules?.ssma?.role === 'SSMA_MANAGER' || currentUser.modules?.ssma?.role === 'SSMA_ADMIN') {
            return ssmaInspectionEventService.listByCompetence(competence);
        }
        const scope = currentUser.modules?.ssma?.scope;
        if (!scope) return [];
        return ssmaInspectionEventService.listByCompetenceAndScope(competence, scope);
    }
};

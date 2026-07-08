import { collection, doc, getDocs, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMAMonthlyTarget } from '../types';
import { UserProfileDoc } from '../../iam/types';
import { ssmaAuditService } from './ssmaAuditService';
import { validateMonthlyTargetInput } from '../domain/validators';

const COLLECTION = 'ssma_monthly_targets';

export const ssmaMonthlyTargetService = {
    list: async (): Promise<SSMAMonthlyTarget[]> => {
        const snap = await getDocs(collection(db, COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAMonthlyTarget));
    },

    getById: async (id: string): Promise<SSMAMonthlyTarget | null> => {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SSMAMonthlyTarget;
    },

    create: async (
        input: Omit<SSMAMonthlyTarget, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot' | 'updatedAt' | 'updatedBy' | 'updatedByNameSnapshot'>,
        currentUser: UserProfileDoc
    ): Promise<string> => {
        validateMonthlyTargetInput(input);
        const id = `${input.competence}_${input.employeeUid}`;
        const ref = doc(db, COLLECTION, id);
        const now = new Date().toISOString();
        const docData: SSMAMonthlyTarget = {
            ...input,
            id,
            active: input.active !== undefined ? input.active : true,
            createdAt: now,
            createdBy: currentUser.uid,
            createdByNameSnapshot: currentUser.displayName,
            updatedAt: now,
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName
        };
        await setDoc(ref, docData);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'CREATE',
            entityType: 'RULE', // We map to RULE or define a new type if needed, targets are related to rules/targets
            entityId: id,
            entityLabelSnapshot: `Meta ${input.competence} - ${input.employeeNameSnapshot}`,
            after: docData as any
        }, currentUser);

        return id;
    },

    update: async (
        id: string,
        input: Partial<Omit<SSMAMonthlyTarget, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot'>>,
        currentUser: UserProfileDoc
    ): Promise<void> => {
        const ref = doc(db, COLLECTION, id);
        const updates = {
            ...input,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.uid,
            updatedByNameSnapshot: currentUser.displayName
        };
        const existing = await ssmaMonthlyTargetService.getById(id);
        if (!existing) throw new Error('Meta mensal não encontrada.');

        validateMonthlyTargetInput({ ...existing, ...input });

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'UPDATE',
            entityType: 'RULE',
            entityId: id,
            entityLabelSnapshot: `Meta ${existing.competence} - ${existing.employeeNameSnapshot}`,
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
        const existing = await ssmaMonthlyTargetService.getById(id);
        if (!existing) throw new Error('Meta mensal não encontrada.');

        await updateDoc(ref, updates);

        await ssmaAuditService.createSSMAAuditLog({
            action: 'DISABLE',
            entityType: 'RULE',
            entityId: id,
            entityLabelSnapshot: `Meta ${existing.competence} - ${existing.employeeNameSnapshot}`,
            reason,
            before: existing as any,
            after: { ...existing, ...updates } as any
        }, currentUser);
    },

    listByCompetence: async (competence: string): Promise<SSMAMonthlyTarget[]> => {
        const q = query(collection(db, COLLECTION), where('competence', '==', competence));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAMonthlyTarget));
    },

    getTargetByEmployeeAndCompetence: async (employeeUid: string, competence: string): Promise<SSMAMonthlyTarget | null> => {
        const id = `${competence}_${employeeUid}`;
        return ssmaMonthlyTargetService.getById(id);
    },

    upsertTarget: async (
        input: Omit<SSMAMonthlyTarget, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot' | 'updatedAt' | 'updatedBy' | 'updatedByNameSnapshot'>,
        currentUser: UserProfileDoc
    ): Promise<string> => {
        const id = `${input.competence}_${input.employeeUid}`;
        const existing = await ssmaMonthlyTargetService.getById(id);

        if (existing) {
            await ssmaMonthlyTargetService.update(id, input, currentUser);
            return id;
        } else {
            return ssmaMonthlyTargetService.create(input, currentUser);
        }
    },

    bulkUpsertTargets: async (
        targets: Omit<SSMAMonthlyTarget, 'id' | 'createdAt' | 'createdBy' | 'createdByNameSnapshot' | 'updatedAt' | 'updatedBy' | 'updatedByNameSnapshot'>[],
        currentUser: UserProfileDoc
    ): Promise<void> => {
        for (const t of targets) {
            await ssmaMonthlyTargetService.upsertTarget(t, currentUser);
        }
    }
};

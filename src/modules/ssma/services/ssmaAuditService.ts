import { collection, doc, setDoc, getDocs, getDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMAAuditLog } from '../types';
import { UserProfileDoc } from '../../iam/types';

const COLLECTION = 'ssma_audit_logs';

export type CreateAuditLogInput = Omit<SSMAAuditLog, 'id' | 'performedAt' | 'performedBy' | 'performedByNameSnapshot' | 'performedByRoleSnapshot'>;

export const ssmaAuditService = {
    createSSMAAuditLog: async (input: CreateAuditLogInput, currentUser: UserProfileDoc): Promise<string> => {
        if (!currentUser || (!currentUser.isSuperAdmin && !currentUser.modules?.ssma?.enabled)) {
            throw new Error('Usuário sem acesso ao módulo SSMA não pode gerar logs.');
        }

        const newRef = doc(collection(db, COLLECTION));
        const logData: SSMAAuditLog = {
            ...input,
            id: newRef.id,
            performedAt: new Date().toISOString(),
            performedBy: currentUser.uid,
            performedByNameSnapshot: currentUser.displayName,
            performedByRoleSnapshot: currentUser.modules?.ssma?.role || 'UNKNOWN'
        };

        // Remove properties undefined to avoid Firestore errors
        Object.keys(logData).forEach(key => {
            if (logData[key as keyof SSMAAuditLog] === undefined) {
                delete logData[key as keyof SSMAAuditLog];
            }
        });

        await setDoc(newRef, logData);
        return newRef.id;
    },

    listSSMAAuditLogs: async (filters?: { entityType?: string; entityId?: string }): Promise<SSMAAuditLog[]> => {
        let q = query(collection(db, COLLECTION), orderBy('performedAt', 'desc'));
        
        if (filters?.entityType) {
            q = query(q, where('entityType', '==', filters.entityType));
        }
        if (filters?.entityId) {
            q = query(q, where('entityId', '==', filters.entityId));
        }

        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAAuditLog));
    },

    getSSMAAuditLogById: async (id: string): Promise<SSMAAuditLog | null> => {
        const snap = await getDoc(doc(db, COLLECTION, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SSMAAuditLog;
    }
};

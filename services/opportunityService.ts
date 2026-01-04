
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    deleteDoc,
    getDocs,
    getDoc,
    Timestamp,
    query,
    orderBy,
    runTransaction,
    DocumentReference
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
    Opportunity,
    OpportunityStatus,
    PipelineStage,
    Task,
    TaskStatus
} from '../types';
import { getExecutionPercent, getNextStage } from '../domain/pipeline';

const OPPORTUNITIES_COLLECTION = 'opportunities';
const TASKS_COLLECTION = 'tasks';

export const OpportunityService = {

    /**
     * Creates a new Opportunity. 
     */
    async create(data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'pipelineStage' | 'probability'>): Promise<string> {
        // Basic validations can remain for Creation
        if (!data.clientName || !data.deadline) {
            throw new Error("Campos obrigatórios: Nome do Cliente e Prazo.");
        }

        const initialStage = PipelineStage.LEAD_RECEBIDO;

        const newOpportunity: Omit<Opportunity, 'id'> = {
            ...data,
            pipelineStage: initialStage,
            probability: getExecutionPercent(initialStage),
            status: OpportunityStatus.ATIVA,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const docRef = await addDoc(collection(db, OPPORTUNITIES_COLLECTION), newOpportunity);
        return docRef.id;
    },

    /**
     * Fetches all opportunities.
     */
    async getAll(): Promise<Opportunity[]> {
        const q = query(collection(db, OPPORTUNITIES_COLLECTION), orderBy('updatedAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                deadline: data.deadline?.toDate?.() || data.deadline,
                createdAt: data.createdAt?.toDate?.() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
                submissionDate: data.submissionDate?.toDate?.() || undefined,
            } as Opportunity;
        });
    },

    /**
     * Updates an opportunity generic fields.
     */
    async update(id: string, data: Partial<Opportunity>): Promise<void> {
        const docRef = doc(db, OPPORTUNITIES_COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: new Date()
        });
    },

    /**
     * Delete an opportunity.
     */
    async delete(id: string): Promise<void> {
        await deleteDoc(doc(db, OPPORTUNITIES_COLLECTION, id));
    },

    /**
     * Advances the opportunity to the next stage and creates a linked Task.
     * Uses a transaction to ensure consistency.
     */
    async advanceOpportunityToNextStage(opportunityId: string): Promise<{ updatedOpportunity: Opportunity, createdTask: Task }> {

        return await runTransaction(db, async (transaction) => {
            // 1. Get Current Opportunity
            const oppRef = doc(db, OPPORTUNITIES_COLLECTION, opportunityId);
            const oppSnap = await transaction.get(oppRef);

            if (!oppSnap.exists()) {
                throw new Error("Oportunidade não encontrada.");
            }

            const currentOpp = oppSnap.data() as Opportunity;

            // 2. Calculate Next Stage
            const nextStage = getNextStage(currentOpp.pipelineStage);

            if (!nextStage) {
                throw new Error("A oportunidade já está na última etapa ou estado inválido.");
            }

            // 3. Prepare Opportunity Updates
            const newProbability = getExecutionPercent(nextStage);
            const updatedOppData = {
                pipelineStage: nextStage,
                probability: newProbability,
                updatedAt: new Date() // Firestore handles Date conversion usu. but best practice
            };

            transaction.update(oppRef, updatedOppData);

            // 4. Create Linked Task
            // "Ao mover ... criar automaticamente uma Ação (tarefa filha) vinculada"
            const newTaskRef = doc(collection(db, TASKS_COLLECTION));

            const newTaskData: Omit<Task, 'id'> = {
                title: `[${nextStage}] - ${currentOpp.title}`,
                description: `Tarefa gerada automaticamente para a etapa ${nextStage}.`,
                opportunityId: opportunityId,
                stageAtCreation: nextStage,
                assigneeId: currentOpp.responsibleId || 'SYSTEM', // Fallback
                status: TaskStatus.PENDING,
                priority: 'MEDIO',
                startDate: new Date(),
                endDate: new Date(),
                needsDetails: true,
                progress: 0,
                observations: '',
                createdAt: new Date(),
                updatedAt: new Date()
            } as any;

            transaction.set(newTaskRef, newTaskData);

            // 5. Return Results
            const convertToDate = (val: any) => (val && val.toDate) ? val.toDate() : val;

            const updatedOpportunity: Opportunity = {
                ...currentOpp,
                ...updatedOppData,
                deadline: convertToDate(currentOpp.deadline),
                createdAt: convertToDate(currentOpp.createdAt),
                submissionDate: convertToDate(currentOpp.submissionDate),
                updatedAt: new Date() // Sync
            };

            const createdTask: Task = {
                id: newTaskRef.id,
                ...newTaskData
            };

            return { updatedOpportunity, createdTask };
        });
    }

};

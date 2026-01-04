
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
import { getExecutionPercent, getNextStage, getStageLabel } from '../domain/pipeline';

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

        // HELPER: Strict String Sanitizer
        const safeStr = (v: any) => typeof v === 'string' ? v : '';

        // HELPER: Strict Date Sanitizer
        const safeDate = (val: any) => {
            if (!val) return new Date(); // Default to now if missing
            if (val instanceof Date) return val;
            if (typeof val.toDate === 'function') return val.toDate(); // Firestore Timestamp
            if (val && typeof val.seconds === 'number') return new Date(val.seconds * 1000); // Raw Timestamp

            // Handle recursion bug objects or other trash
            if (typeof val === 'object') return new Date();

            const parsed = new Date(val);
            return isNaN(parsed.getTime()) ? new Date() : parsed;
        };

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Apply Sanitization
                title: safeStr(data.title),
                clientName: safeStr(data.clientName),
                responsibleId: safeStr(data.responsibleId),

                deadline: safeDate(data.deadline),
                createdAt: safeDate(data.createdAt),
                updatedAt: safeDate(data.updatedAt),
                submissionDate: data.submissionDate ? safeDate(data.submissionDate) : undefined,
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
     * Moves the opportunity to a specific stage and creates a linked Task.
     * Validates if the move is allowed (Next Step OR Special Backwards Rule).
     */
    async moveOpportunity(opportunityId: string, targetStage: PipelineStage): Promise<{ updatedOpportunity: Opportunity, createdTask: Task }> {

        return await runTransaction(db, async (transaction) => {
            // 1. Get Current Opportunity
            const oppRef = doc(db, OPPORTUNITIES_COLLECTION, opportunityId);
            const oppSnap = await transaction.get(oppRef);

            if (!oppSnap.exists()) {
                throw new Error("Oportunidade não encontrada.");
            }

            const currentOpp = oppSnap.data() as Opportunity;
            const currentStage = currentOpp.pipelineStage;

            // 2. Validate Move
            const allowedNext = getNextStage(currentStage);

            // Rule 1: Allow exact next stage
            const isForward = targetStage === allowedNext;

            // Rule 2: Special Backward Rule (Aguardando Resultado -> Revisão)
            const isSpecialBackwards = currentStage === PipelineStage.AGUARDANDO_RESULTADO && targetStage === PipelineStage.REVISAO_FINAL;

            if (!isForward && !isSpecialBackwards) {
                throw new Error(`Movimento inválido: De ${currentStage} para ${targetStage}.`);
            }

            // 3. Prepare Opportunity Updates
            const newProbability = getExecutionPercent(targetStage);
            const updatedOppData = {
                pipelineStage: targetStage,
                probability: newProbability,
                updatedAt: new Date()
            };

            transaction.update(oppRef, updatedOppData);

            // 4. Create Linked Task
            const newTaskRef = doc(collection(db, TASKS_COLLECTION));

            const newTaskData: Omit<Task, 'id'> = {
                title: `[${getStageLabel(targetStage)}] - ${currentOpp.title}`,
                description: `Tarefa gerada automaticamente para a etapa ${getStageLabel(targetStage)}.`,
                opportunityId: opportunityId,
                stageAtCreation: targetStage,
                assigneeId: currentOpp.responsibleId || 'SYSTEM',
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
                updatedAt: new Date()
            };

            const createdTask: Task = {
                id: newTaskRef.id,
                ...newTaskData
            };

            return { updatedOpportunity, createdTask };
        });
    }

};

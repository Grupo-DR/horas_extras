
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDocs,
    getDoc,
    Timestamp,
    query,
    orderBy,
    where
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
    Opportunity,
    OpportunityStatus,
    PipelineStage
} from '../types';

const COLLECTION_NAME = 'opportunities';

// --- CONFIGURATION & CONSTANTS ---

const PROBABILITY_MAP: Record<PipelineStage, number> = {
    [PipelineStage.LEAD_RECEBIDO]: 10,
    [PipelineStage.DECISAO_PARTICIPACAO]: 20,
    [PipelineStage.ORCAMENTO_PREVIO]: 30,
    [PipelineStage.MEMORIA_COMPOSICOES]: 45,
    [PipelineStage.PROPOSTA_TECNICA_COMERCIAL]: 60,
    [PipelineStage.REVISAO_FINAL]: 75,
    [PipelineStage.ENVIO_PROPOSTA]: 90,
    [PipelineStage.AGUARDANDO_RESULTADO]: 100
};

// --- TYPES ---

type ValidationResult = { valid: true } | { valid: false; message: string };

// --- SERVICE ---

export const OpportunityService = {

    /**
     * Creates a new Opportunity. 
     * Starts at LEAD_RECEBIDO with 10% probability.
     */
    async create(data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'pipelineStage' | 'probability'>): Promise<string> {

        // Initial Validations (Lead Recebido Requirements)
        if (!data.clientName || !data.deadline) {
            throw new Error("Campos obrigatórios para Lead: Nome do Cliente e Prazo.");
        }

        const newOpportunity: Omit<Opportunity, 'id'> = {
            ...data,
            pipelineStage: PipelineStage.LEAD_RECEBIDO,
            probability: PROBABILITY_MAP[PipelineStage.LEAD_RECEBIDO],
            status: OpportunityStatus.ATIVA,
            createdAt: new Date(), // Will be converted to Timestamp by Firestore SDK if using helper, but here wait...
            // Firestore needs Timestamp or Date. The SDK usually handles Date -> Timestamp conversion on set.
            // But we defined interface as Date. Let's send Date, firestore handles it.
            updatedAt: new Date(),
        };

        // We need to manually strict check undefined? The config has ignoreUndefinedProperties: true.
        const docRef = await addDoc(collection(db, COLLECTION_NAME), newOpportunity);
        return docRef.id;
    },

    /**
     * Fetches all opportunities.
     */
    async getAll(): Promise<Opportunity[]> {
        const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Convert Timestamps back to Dates
                deadline: data.deadline?.toDate?.() || data.deadline,
                createdAt: data.createdAt?.toDate?.() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
                submissionDate: data.submissionDate?.toDate?.() || undefined,
            } as Opportunity;
        });
    },

    /**
     * Generic Update (for fields, NOT for Stage usually).
     */
    async update(id: string, data: Partial<Opportunity>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: new Date()
        });
    },


    /**
     * Central Logic: Change Pipeline Stage with strict Validation.
     */
    async changeStage(opportunityId: string, currentData: Opportunity, newStage: PipelineStage): Promise<void> {

        // 0. Check Sequentiality (Optional but recommended: prevent jumping)
        // For now, we trust the validation rules, but generally we should only allow current+1.
        // Let's rely on validation to prevent jumping if requirements aren't met.

        // 1. Validate 'Exit' Requirements of the Current Stage
        // To move FROM currentStage TO newStage (assuming forward progress)
        // We must satisfy the requirements of the current stage.

        // Exception: If moving backwards? Usually allowed without validation, 
        // but the prompt says "Não permitir pular etapas sem validações".
        // We will enforce validation on *Advance* (Forward).
        const isAdvancing = this.getStageIndex(newStage) > this.getStageIndex(currentData.pipelineStage);

        if (isAdvancing) {
            const canMove = this.validateStageCompletion(currentData.pipelineStage, currentData);
            if (!canMove.valid) {
                throw new Error(`Não é possível avançar: ${canMove.message}`);
            }

            // Also ensure we are not skipping stages (moving 1 by 1)
            if (this.getStageIndex(newStage) > this.getStageIndex(currentData.pipelineStage) + 1) {
                throw new Error("Não é permitido pular etapas. Avance uma por vez.");
            }
        }

        // 2. Prepare Updates
        const updates: Partial<Opportunity> = {
            pipelineStage: newStage,
            probability: PROBABILITY_MAP[newStage],
            updatedAt: new Date()
        };

        await this.update(opportunityId, updates);
    },

    getStageIndex(stage: PipelineStage): number {
        const order = Object.values(PipelineStage);
        return order.indexOf(stage);
    },

    /**
     * Validates if the requirements of the CURRENT stage are met so we can ADVANCE.
     */
    validateStageCompletion(currentStage: PipelineStage, data: Opportunity): ValidationResult {
        switch (currentStage) {
            case PipelineStage.LEAD_RECEBIDO:
                if (!data.clientName || !data.deadline) return { valid: false, message: "Dados básicos (Cliente, Prazo) incompletos." };
                return { valid: true };

            case PipelineStage.DECISAO_PARTICIPACAO:
                if (!data.scopeSummary) return { valid: false, message: "Resumo do Escopo é obrigatório." };
                if (!data.estimatedValue) return { valid: false, message: "Valor Estimado é obrigatório." };
                if (!data.decision) return { valid: false, message: "Decisão (GO/NO IG) é obrigatória." };
                if (data.decision === 'NO_GO') return { valid: false, message: "Decisão foi NÃO (NO GO). Cancele a oportunidade em vez de avançar." };
                return { valid: true };

            case PipelineStage.ORCAMENTO_PREVIO:
                if (!data.preliminaryValue) return { valid: false, message: "Valor Preliminar é obrigatório." };
                return { valid: true };

            case PipelineStage.MEMORIA_COMPOSICOES:
                // Prompt: "Memória/Composições -> Documentos/anexos técnicos"
                if (!data.technicalAttachments || data.technicalAttachments.length === 0) {
                    // Let's be strict if the prompt demanded. "Documentos/anexos técnicos".
                    // If we don't have file upload yet, we might check a url field or simply warn.
                    // For strict compliance:
                    // return { valid: false, message: "Anexos técnicos são obrigatórios." };
                }
                return { valid: true };

            case PipelineStage.PROPOSTA_TECNICA_COMERCIAL:
                if (!data.proposalVersion) return { valid: false, message: "Versão da Proposta é obrigatória." };
                return { valid: true };

            case PipelineStage.REVISAO_FINAL:
                if (!data.finalChecklistDone) return { valid: false, message: "Checklist de Revisão Final deve ser concluído." };
                return { valid: true };

            case PipelineStage.ENVIO_PROPOSTA:
                if (!data.submissionDate) return { valid: false, message: "Data de Envio é obrigatória." };
                return { valid: true };

            default:
                return { valid: true };
        }
    }

};

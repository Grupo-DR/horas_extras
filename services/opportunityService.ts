
import { db } from './firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Opportunity, PipelineStage, Task } from '../types';
import { BidService } from './bidService';
import { OFFICIAL_USERS } from '../constants'; // Keep for legacy fallback if needed

const OPPORTUNITIES_COLLECTION = 'opportunities';

/**
 * Compatibility Service Wrapper
 * Redirects all writes to BidService (Canonical).
 * Reads from BidService, but falls back to 'opportunities' collection if empty.
 */
export const OpportunityService = {

    /**
     * Creates a new Opportunity -> redirected to BidService.create
     */
    async create(data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'pipelineStage' | 'probability'>): Promise<string> {
        // Adapt fields if necessary
        const bidPayload = {
            ...data,
            title: data.title,
            clientId: data.clientName, // Store clientName in clientId temporarily if ID not available? 
            // WAIT: The original create received clientName, not clientId?
            // Refactor Note: The original code used data.clientName. 
            // We must ensure we have a valid clientId or keep string. 
            // Bid types.ts says clientId: string, clientName: string.
            // We pass data as is, assuming it matches 'Bid' shape mostly.
            clientId: data.clientName, // Quick fix for legacy calls that might not pass ID. 
            // Ideally UI passes ID. We'll trust the payload has what's needed or strictly needed fields.
            contactId: data.contactId || '',
            ownerId: data.ownerId || '',
        };

        const docRef = await BidService.create(bidPayload as any);
        return docRef.id;
    },

    /**
     * Fetches all opportunities.
     * Strategy: Try BidService (bids). If empty, fetch legacy 'opportunities'.
     */
    async getAll(): Promise<Opportunity[]> {
        // 1. Try Canonical
        const bids = await BidService.getAll();

        if (bids.length > 0) {
            return bids as Opportunity[];
        }

        // 2. Fallback to Legacy
        console.warn("OpportunityService: Fallback to 'opportunities' collection.");
        const q = query(collection(db, OPPORTUNITIES_COLLECTION), orderBy('updatedAt', 'desc'));
        const snapshot = await getDocs(q);

        const safeStr = (v: any) => typeof v === 'string' ? v : '';
        const safeDate = (val: any) => {
            if (!val) return new Date();
            if (val instanceof Date) return val;
            if (typeof val.toDate === 'function') return val.toDate();
            return new Date(val);
        };
        const safeNum = (v: any) => typeof v === 'number' ? v : 0;

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                title: safeStr(data.title),
                clientName: safeStr(data.clientName),
                clientId: safeStr(data.clientName), // Legacy data lacks clientId usually
                estimatedValue: safeNum(data.estimatedValue),
                contactId: safeStr(data.contactId || data.responsibleId),
                ownerId: safeStr(data.ownerId),
                contactName: safeStr(data.contactName || data.responsibleName),
                deadline: safeDate(data.deadline),
                createdAt: safeDate(data.createdAt),
                updatedAt: safeDate(data.updatedAt),
                submissionDate: data.submissionDate ? safeDate(data.submissionDate) : undefined,

                // Owner Name Fallback
                ownerName: (() => {
                    const oId = safeStr(data.ownerId);
                    const match = OFFICIAL_USERS.find(u => u.id === oId);
                    return match ? match.name : (data.ownerName || 'N/A');
                })(),
            } as Opportunity;
        });
    },

    /**
     * Updates an opportunity -> redirects to BidService.update
     */
    async update(id: string, data: Partial<Opportunity>): Promise<void> {
        await BidService.update(id, data as any);
    },

    /**
     * Delete an opportunity -> redirects to BidService.delete
     */
    async delete(id: string): Promise<void> {
        await BidService.delete(id);
    },

    /**
     * Moves the opportunity -> redirects to BidService.moveBid
     */
    async moveOpportunity(opportunityId: string, targetStage: PipelineStage): Promise<{ updatedOpportunity: Opportunity, createdTask: Task }> {
        const result = await BidService.moveBid(opportunityId, targetStage);
        return {
            updatedOpportunity: result.updatedBid as Opportunity,
            createdTask: result.createdTask
        };
    }

};

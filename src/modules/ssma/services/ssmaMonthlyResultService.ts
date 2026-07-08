import { collection, doc, getDocs, getDoc, setDoc, query, where } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMAMonthlyPersonResult, SSMAMonthlyCollectiveResult } from '../types';
import { UserProfileDoc } from '../../iam/types';
import { ssmaMonthlyTargetService } from './ssmaMonthlyTargetService';
import { ssmaInspectionEventService } from './ssmaInspectionEventService';
import { calculateCollectiveMonthlyResult, calculateIndividualResult } from '../domain/calculateSSMAResults';

const PERSON_COLLECTION = 'ssma_monthly_person_results';
const COLLECTIVE_COLLECTION = 'ssma_monthly_collective_results';

export const ssmaMonthlyResultService = {
    getPersonResult: async (employeeUid: string, competence: string): Promise<SSMAMonthlyPersonResult | null> => {
        const id = `${competence}_${employeeUid}`;
        const snap = await getDoc(doc(db, PERSON_COLLECTION, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SSMAMonthlyPersonResult;
    },

    listPersonResultsByCompetence: async (competence: string): Promise<SSMAMonthlyPersonResult[]> => {
        const q = query(collection(db, PERSON_COLLECTION), where('competence', '==', competence));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAMonthlyPersonResult));
    },

    savePersonResult: async (result: SSMAMonthlyPersonResult): Promise<void> => {
        const ref = doc(db, PERSON_COLLECTION, result.id);
        await setDoc(ref, result);
    },

    getCollectiveResult: async (id: string): Promise<SSMAMonthlyCollectiveResult | null> => {
        const snap = await getDoc(doc(db, COLLECTIVE_COLLECTION, id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SSMAMonthlyCollectiveResult;
    },

    listCollectiveResultsByCompetence: async (competence: string): Promise<SSMAMonthlyCollectiveResult[]> => {
        const q = query(collection(db, COLLECTIVE_COLLECTION), where('competence', '==', competence));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SSMAMonthlyCollectiveResult));
    },

    saveCollectiveResult: async (result: SSMAMonthlyCollectiveResult): Promise<void> => {
        const ref = doc(db, COLLECTIVE_COLLECTION, result.id);
        await setDoc(ref, result);
    },

    recalculateAndSaveAll: async (competence: string): Promise<{ personResults: SSMAMonthlyPersonResult[], collectiveResults: SSMAMonthlyCollectiveResult[] }> => {
        // 1. Fetch all targets for competence
        const targets = await ssmaMonthlyTargetService.listByCompetence(competence);

        // 2. Fetch all valid inspection events for competence
        const events = await ssmaInspectionEventService.listByCompetence(competence);

        // 3. Calculate and save individual results for each target
        const personResults: SSMAMonthlyPersonResult[] = [];
        for (const target of targets) {
            const res = calculateIndividualResult(events, target);
            await ssmaMonthlyResultService.savePersonResult(res);
            personResults.push(res);
        }

        // 4. Calculate collective results (ALL scope)
        const collectiveResults: SSMAMonthlyCollectiveResult[] = [];
        const globalRes = calculateCollectiveMonthlyResult(events, targets, { competence, scope: { type: 'ALL' } });
        await ssmaMonthlyResultService.saveCollectiveResult(globalRes);
        collectiveResults.push(globalRes);

        // 5. Calculate collective results per Regional
        const regionalIds = new Set<string>();
        events.forEach(e => { if (e.regionalId) regionalIds.add(e.regionalId); });
        for (const regId of regionalIds) {
            const scopeRes = calculateCollectiveMonthlyResult(events, targets, { competence, scope: { type: 'REGIONAL', regionals: [regId] } });
            await ssmaMonthlyResultService.saveCollectiveResult(scopeRes);
            collectiveResults.push(scopeRes);
        }

        // 6. Calculate collective results per Cost Center
        const ccIds = new Set<string>();
        events.forEach(e => { if (e.costCenterId) ccIds.add(e.costCenterId); });
        for (const ccId of ccIds) {
            const scopeRes = calculateCollectiveMonthlyResult(events, targets, { competence, scope: { type: 'COST_CENTER', costCenters: [ccId] } });
            await ssmaMonthlyResultService.saveCollectiveResult(scopeRes);
            collectiveResults.push(scopeRes);
        }

        return { personResults, collectiveResults };
    }
};

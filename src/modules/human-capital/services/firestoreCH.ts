
import { db } from '@/services/firebaseConfig';
import { collection, doc, writeBatch, query, where, getDocs, addDoc, Timestamp, getDoc, setDoc } from 'firebase/firestore';
import { BudgetRecord, SalaryAllocation, PlanningRecord, UserProfile } from '../types';
import { Scope } from '../../iam/types';

const COL_BUDGETS = 'hc_budgets';
const COL_SALARIES = 'hc_salary_allocations';
const COL_PLANNING = 'hc_planning_records';
const COL_AUDIT = 'hc_audit_logs';

// --- BUDGETS ---

// --- HELPERS ---

const safeNumber = (v: any): number => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};

const clean = (obj: any): any => {
    if (!obj) return obj;
    const res: any = {};
    Object.keys(obj).forEach(key => {
        const val = obj[key];
        if (val !== undefined) {
            res[key] = val;
        }
    });
    return res;
};

// --- BUDGETS ---

export const upsertBudgets = async (budgets: BudgetRecord[], user: UserProfile) => {
    const batch = writeBatch(db);
    budgets.forEach(b => {
        // ID: budget_YYYY-MM_CC_normalized
        if (!b.monthKey) return; // Guard clause
        const id = `budget_${b.monthKey}_${b.costCenter}`;
        const ref = doc(db, COL_BUDGETS, id);

        const data = clean({
            ...b,
            value: safeNumber(b.value)
        });

        batch.set(ref, {
            ...data,
            updatedAt: Timestamp.now(),
            updatedBy: user.email
        }, { merge: true });
    });
    await batch.commit();
};

export const getBudgetsByMonthKey = async (monthKey: string, scope?: Scope) => {
    const q = query(collection(db, COL_BUDGETS), where('monthKey', '==', monthKey));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as BudgetRecord);
};

// --- SALARIES ---

export const upsertSalaryAllocations = async (allocations: SalaryAllocation[], user: UserProfile) => {
    // Batches limited to 500. Assuming import isn't huge, or we slice.
    // For now, let's slice just in case.
    const chunks = [];
    for (let i = 0; i < allocations.length; i += 400) {
        chunks.push(allocations.slice(i, i + 400));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(s => {
            // ID: salary_YYYY-MM_CHAPA_CC
            if (!s.monthKey || !s.chapa) return; // Guard
            const id = `salary_${s.monthKey}_${s.chapa}_${s.costCenter}`;
            const ref = doc(db, COL_SALARIES, id);

            const data = clean({
                ...s,
                salary: safeNumber(s.salary),
                allocation: safeNumber(s.allocation)
            });

            batch.set(ref, {
                ...data,
                updatedAt: Timestamp.now(),
                updatedBy: user.email
            }, { merge: true });
        });
        await batch.commit();
    }
};

export const getSalaryAllocationsByMonthKey = async (monthKey: string, scope?: Scope) => {
    const q = query(collection(db, COL_SALARIES), where('monthKey', '==', monthKey));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as SalaryAllocation);
};

// --- PLANNING ---

export const upsertPlanningRecords = async (records: PlanningRecord[], user: UserProfile) => {
    const batch = writeBatch(db);
    records.forEach(r => {
        // ID: Use r.id if present, or construct
        // ID: plan_YYYY-MM-DD_CHAPA_CC_TYPE
        if (!r.date || !r.chapa) return;
        const id = r.id || `plan_${r.date}_${r.chapa}_${r.costCenter}_${r.type}`;
        const ref = doc(db, COL_PLANNING, id);

        const data = clean({
            ...r,
            plannedHours: safeNumber(r.plannedHours)
        });

        batch.set(ref, {
            ...data,
            id, // ensure ID is saved
            updatedAt: Timestamp.now(),
            updatedBy: user.email
        }, { merge: true });
    });
    await batch.commit();
};

export const getPlanningRecords = async (monthKey: string, type: 'DAILY' | 'MONTHLY', scope?: Scope) => {
    // Note: We need to filter by month start.
    // 'date' field is string 'YYYY-MM-DD' or 'YYYY-MM'.
    // Firestore string prefix matching usually via >= and <=
    const start = monthKey;
    const end = monthKey + '\uf8ff';

    // We also need to match TYPE.
    // Compound query requires index. If fails, we might filter in memory.
    // Let's try compound.
    const q = query(
        collection(db, COL_PLANNING),
        where('date', '>=', start),
        where('date', '<=', end),
        where('type', '==', type)
    );

    // If index missing, this might fail console.error.
    // We can just query by date and filter type in memory, safer for now without deploying indexes manually.
    // Actually, 'date' is enough to narrow down to month.

    const q2 = query(
        collection(db, COL_PLANNING),
        where('date', '>=', start),
        where('date', '<=', end)
    );

    const snapshot = await getDocs(q2);
    const all = snapshot.docs.map(d => d.data() as PlanningRecord);
    return all.filter(r => r.type === type);
};

// --- AUDIT ---

export const writeAudit = async (action: string, meta: any, user: UserProfile) => {
    try {
        await addDoc(collection(db, COL_AUDIT), {
            action,
            metadata: meta,
            userEmail: user.email,
            timestamp: Timestamp.now()
        });
    } catch (e) {
        console.error("Audit Log Failed", e);
    }
};

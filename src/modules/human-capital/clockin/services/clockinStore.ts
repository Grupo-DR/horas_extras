import { db } from '@/services/firebaseConfig';
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, setDoc, Timestamp, where, writeBatch } from 'firebase/firestore';
import { Scope } from '../../../iam/types';
import { UserProfile } from '../../types';
import { getScopedDocs, writeAudit } from '../../services/firestoreCH';
import { getCCRegional } from '../../data/ccMaster';
import { ClockinCostCenterFences, ClockinImportMeta, ClockinPunch, ClockinSite } from '../domain/clockinTypes';

/**
 * Persistência da Auditoria de Ponto.
 *
 * hc_clockin_days/{data}_{cc}: todas as batidas de um CC em um dia, num array.
 *   Um mês (~15 mil batidas) vira ~600 documentos em vez de 15 mil — leitura
 *   barata e escopo por CC/regional nas regras do Firestore.
 * hc_clockin_imports/{importId}: histórico dos uploads.
 * hc_clockin_fences/{cc}: cercas das obras cadastradas no portal.
 */
const COL_DAYS = 'hc_clockin_days';
const COL_IMPORTS = 'hc_clockin_imports';
const COL_FENCES = 'hc_clockin_fences';

/** Margem para o limite de 1 MB por documento (~1 KB por batida). */
const MAX_PUNCHES_PER_DOC = 800;
const BATCH_SIZE = 100;
const MAX_BATCH_BYTES = 4_000_000;

interface ClockinDayDoc {
    date: string;
    costCenter: string;
    regional: string;
    punches: ClockinPunch[];
    importId: string;
    updatedAt?: unknown;
    updatedBy?: string;
}

/** Firestore não aceita undefined. */
const stripUndefined = <T extends object>(obj: T): T =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

const dayDocId = (date: string, costCenter: string) => `${date}_${costCenter || 'SEM_CC'}`;

export interface SaveClockinProgress {
    done: number;
    total: number;
}

/**
 * Grava as batidas importadas. Reimportar o mesmo período não duplica: as
 * batidas de cada dia/CC são unidas às já gravadas pelo id da batida.
 */
export const saveClockinPunches = async (
    punches: ClockinPunch[],
    meta: ClockinImportMeta,
    user: UserProfile,
    onProgress?: (progress: SaveClockinProgress) => void
): Promise<{ newPunches: number }> => {
    const groups = new Map<string, ClockinPunch[]>();
    punches.forEach(p => {
        const id = dayDocId(p.date, p.costCenter);
        const list = groups.get(id);
        if (list) list.push(p);
        else groups.set(id, [p]);
    });

    const existing = await getScopedDocs<ClockinDayDoc & { _id?: string }>(COL_DAYS, { type: 'ALL' }, 'costCenter', [
        where('date', '>=', meta.periodStart),
        where('date', '<=', meta.periodEnd)
    ]);
    const existingById = new Map(existing.map(d => [dayDocId(d.date, d.costCenter), d]));

    let newPunches = 0;
    const docs = Array.from(groups.entries()).map(([id, list]) => {
        const previous = existingById.get(id)?.punches || [];
        const merged = new Map(previous.map(p => [p.id, p]));
        list.forEach(p => {
            if (!merged.has(p.id)) newPunches++;
            merged.set(p.id, p);
        });
        const all = Array.from(merged.values()).sort((a, b) => a.punchedAt.localeCompare(b.punchedAt));
        if (all.length > MAX_PUNCHES_PER_DOC) {
            throw new Error(`O CC ${list[0].costCenter} tem ${all.length} batidas em ${list[0].date}, acima do limite de ${MAX_PUNCHES_PER_DOC} por dia.`);
        }
        return { id, data: { date: list[0].date, costCenter: list[0].costCenter, regional: getCCRegional(list[0].costCenter), punches: all.map(stripUndefined) } };
    });

    // Lotes limitados por quantidade e por tamanho (requisição do Firestore ≤ 10 MB).
    const batches: Array<typeof docs> = [];
    let current: typeof docs = [];
    let currentBytes = 0;
    docs.forEach(entry => {
        const bytes = JSON.stringify(entry.data).length;
        if (current.length > 0 && (current.length >= BATCH_SIZE || currentBytes + bytes > MAX_BATCH_BYTES)) {
            batches.push(current);
            current = [];
            currentBytes = 0;
        }
        current.push(entry);
        currentBytes += bytes;
    });
    if (current.length) batches.push(current);

    let done = 0;
    for (const group of batches) {
        const batch = writeBatch(db);
        group.forEach(({ id, data }) => {
            batch.set(doc(db, COL_DAYS, id), {
                ...data,
                importId: meta.importId,
                updatedAt: Timestamp.now(),
                updatedBy: user.email
            });
        });
        await batch.commit();
        done += group.length;
        onProgress?.({ done, total: docs.length });
    }

    await setDoc(doc(db, COL_IMPORTS, meta.importId), { ...meta, newPunches, createdAt: Timestamp.now() });
    await writeAudit('CLOCKIN_IMPORT', { ...meta, newPunches, dayDocs: docs.length }, user);
    return { newPunches };
};

/** Batidas do período (YYYY-MM-DD, inclusivo) dentro do escopo do usuário. */
export const getClockinPunches = async (startDate: string, endDate: string, scope?: Scope): Promise<ClockinPunch[]> => {
    const days = await getScopedDocs<ClockinDayDoc>(COL_DAYS, scope, 'costCenter', [
        where('date', '>=', startDate),
        where('date', '<=', endDate)
    ]);
    return days.flatMap(d => d.punches || []).sort((a, b) => a.punchedAt.localeCompare(b.punchedAt));
};

export const getClockinImports = async (max = 20): Promise<Array<ClockinImportMeta & { newPunches?: number }>> => {
    const snapshot = await getDocs(query(collection(db, COL_IMPORTS), orderBy('uploadedAt', 'desc'), limit(max)));
    return snapshot.docs.map(d => d.data() as ClockinImportMeta & { newPunches?: number });
};

export const getSiteFences = async (scope?: Scope): Promise<ClockinCostCenterFences[]> =>
    getScopedDocs<ClockinCostCenterFences>(COL_FENCES, scope, 'costCenter');

export const saveSiteFences = async (costCenter: string, sites: ClockinSite[], user: UserProfile): Promise<ClockinCostCenterFences> => {
    const record: ClockinCostCenterFences = {
        costCenter,
        regional: getCCRegional(costCenter),
        sites: sites.map(s => ({ name: s.name.trim() || 'Obra', lat: s.lat, lon: s.lon, radius: s.radius })),
        updatedAt: new Date().toISOString(),
        updatedBy: user.email
    };
    if (record.sites.length === 0) {
        await deleteDoc(doc(db, COL_FENCES, costCenter));
    } else {
        await setDoc(doc(db, COL_FENCES, costCenter), record);
    }
    await writeAudit('CLOCKIN_FENCE_UPDATE', { costCenter, sites: record.sites.length }, user);
    return record;
};

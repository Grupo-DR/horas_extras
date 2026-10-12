import {
    collection,
    doc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp,
    Timestamp,
    DocumentData
} from 'firebase/firestore';
import { db } from '../../../services/firebaseConfig';

const SCHEDULES = 'bi_report_schedules';
const SOURCES = 'bi_data_sources';
const SOURCE_UPDATES = 'bi_data_source_updates';

export interface BiReportSchedule {
    reportId: string;
    area: string;
    days: number[];   // 0 = domingo ... 6 = sábado (Date.getDay)
    times: string[];  // 'HH:mm', ordenados
}

/** current = base em uso (alerta por idade); historical = base fechada (sem alerta) */
export type BiDataSourceKind = 'current' | 'historical';

export interface BiDataSource {
    id: string;
    area: string;
    name: string;
    version: string;
    kind: BiDataSourceKind;
    lastUpdatedAt: Date | null;
    lastUpdatedByName: string | null;
}

export interface BiDataSourceUpdate {
    id: string;
    version: string;
    at: Date | null;            // quando a base foi atualizada
    registeredAt: Date | null;  // quando o registro foi feito no portal
    byName: string;
}

export const DEFAULT_SCHEDULE_DAYS = [1, 2, 3, 4, 5];

const toDate = (value: unknown): Date | null =>
    value instanceof Timestamp ? value.toDate() : null;

// 'estimate' evita lastUpdatedAt nulo no snapshot local logo após o clique
const readData = (snap: { data: (opts?: any) => DocumentData | undefined }) =>
    snap.data({ serverTimestamps: 'estimate' }) ?? {};

export const BiStatusService = {
    subscribeSchedules(area: string, onChange: (schedules: Record<string, BiReportSchedule>) => void, onError: (e: Error) => void) {
        const q = query(collection(db, SCHEDULES), where('area', '==', area));
        return onSnapshot(q, (snapshot) => {
            const result: Record<string, BiReportSchedule> = {};
            snapshot.docs.forEach((d) => {
                const data = readData(d);
                result[d.id] = {
                    reportId: d.id,
                    area: data.area,
                    days: data.days ?? [],
                    times: data.times ?? []
                };
            });
            onChange(result);
        }, onError);
    },

    async saveSchedule(reportId: string, area: string, days: number[], times: string[], uid: string): Promise<void> {
        await setDoc(doc(db, SCHEDULES, reportId), {
            area,
            days: [...new Set(days)].sort(),
            times: [...new Set(times)].sort(),
            updatedAt: serverTimestamp(),
            updatedBy: uid
        });
    },

    subscribeDataSources(area: string, onChange: (sources: BiDataSource[]) => void, onError: (e: Error) => void) {
        const q = query(collection(db, SOURCES), where('area', '==', area));
        return onSnapshot(q, (snapshot) => {
            const sources = snapshot.docs.map((d): BiDataSource => {
                const data = readData(d);
                return {
                    id: d.id,
                    area: data.area,
                    name: data.name,
                    version: data.version ?? '',
                    kind: data.kind === 'historical' ? 'historical' : 'current',
                    lastUpdatedAt: toDate(data.lastUpdatedAt),
                    lastUpdatedByName: data.lastUpdatedByName ?? null
                };
            });
            sources.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
            onChange(sources);
        }, onError);
    },

    async createDataSource(area: string, name: string, version: string, kind: BiDataSourceKind, uid: string): Promise<BiDataSource> {
        const ref = await addDoc(collection(db, SOURCES), {
            area,
            name: name.trim(),
            version: version.trim(),
            kind,
            lastUpdatedAt: null,
            lastUpdatedBy: null,
            lastUpdatedByName: null,
            createdAt: serverTimestamp(),
            createdBy: uid
        });
        return { id: ref.id, area, name: name.trim(), version: version.trim(), kind, lastUpdatedAt: null, lastUpdatedByName: null };
    },

    /** Edita cadastro sem registrar atualização (correção de nome/versão/tipo). */
    async updateDataSource(id: string, name: string, version: string, kind: BiDataSourceKind): Promise<void> {
        await updateDoc(doc(db, SOURCES, id), { name: name.trim(), version: version.trim(), kind });
    },

    async deleteDataSource(id: string): Promise<void> {
        await deleteDoc(doc(db, SOURCES, id));
    },

    /**
     * Registra uma atualização da base. Sem `at`, usa o horário do servidor
     * ("Atualizei agora"); com `at`, é um registro retroativo (nunca no futuro).
     * Um registro mais antigo que o atual entra só no histórico, sem mexer na base.
     * Retorna true se passou a ser a última atualização da base.
     */
    async registerUpdate(source: BiDataSource, version: string, user: { uid: string; name: string }, at: Date | null): Promise<boolean> {
        const updatedAt = at ? Timestamp.fromDate(at) : serverTimestamp();
        const isLatest = !at || !source.lastUpdatedAt || at >= source.lastUpdatedAt;

        const batch = writeBatch(db);
        batch.set(doc(collection(db, SOURCE_UPDATES)), {
            sourceId: source.id,
            area: source.area,
            version: version.trim(),
            at: updatedAt,
            registeredAt: serverTimestamp(),
            by: user.uid,
            byName: user.name
        });
        if (isLatest) {
            batch.update(doc(db, SOURCES, source.id), {
                version: version.trim(),
                lastUpdatedAt: updatedAt,
                lastUpdatedBy: user.uid,
                lastUpdatedByName: user.name
            });
        }
        await batch.commit();
        return isLatest;
    },

    async getHistory(sourceId: string, max = 20): Promise<BiDataSourceUpdate[]> {
        const q = query(
            collection(db, SOURCE_UPDATES),
            where('sourceId', '==', sourceId),
            orderBy('at', 'desc'),
            limit(max)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => {
            const data = readData(d);
            return {
                id: d.id,
                version: data.version ?? '',
                at: toDate(data.at),
                registeredAt: toDate(data.registeredAt),
                byName: data.byName ?? ''
            };
        });
    }
};

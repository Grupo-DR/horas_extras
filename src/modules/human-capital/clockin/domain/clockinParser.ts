import { getCCRegional } from '../../data/ccMaster';
import { resolveCarolCostCenter } from './carolCostCenters';
import {
    ClockinFenceCheck,
    ClockinFenceStatus,
    ClockinParseIssue,
    ClockinParseResult,
    ClockinPunch,
    ClockinTimezoneMode
} from './clockinTypes';

/**
 * Normaliza um cabeçalho para comparação: minúsculo, sem acento, espaços únicos,
 * sem ponto final. "Descrição do local" → "descricao do local".
 */
export const normalizeHeader = (value: unknown): string =>
    String(value ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/\.$/, '')
        .trim();

type FieldKey =
    | 'image' | 'name' | 'cpf' | 'supervisorName' | 'deviceId' | 'deviceDescription' | 'mode'
    | 'locationName' | 'date' | 'nsr' | 'gmt' | 'gpsLevel' | 'timezone' | 'coordinates' | 'email'
    | 'phone' | 'pis' | 'geofence' | 'receiptSentAt' | 'timeProvider' | 'accuracy' | 'supervisorCode'
    | 'selfPunch' | 'locationCode' | 'autoDateTime' | 'syncCode' | 'receiptMethod' | 'faceScore'
    | 'dateDiffersFromGps' | 'section' | 'costCenter' | 'nsrProcessedAt' | 'fenceJson' | 'firstSyncDelay';

/** Cabeçalho exato (normalizado) ou prefixo, para os nomes longos da Carol. */
const FIELD_HEADERS: Array<[FieldKey, string, 'exact' | 'prefix']> = [
    ['image', 'imagem', 'exact'],
    ['name', 'nome', 'exact'],
    ['cpf', 'cpf', 'exact'],
    ['supervisorName', 'nome do supervisor', 'exact'],
    ['deviceId', 'codigo do dispositivo', 'exact'],
    ['deviceDescription', 'descricao do dispositivo', 'exact'],
    ['mode', 'modo de marcacao', 'exact'],
    ['locationName', 'descricao do local', 'exact'],
    ['date', 'data', 'exact'],
    ['nsr', 'nsr', 'exact'],
    ['gmt', 'gmt', 'exact'],
    ['gpsLevel', 'nivel de gps', 'exact'],
    ['timezone', 'fuso horario automatico', 'exact'],
    ['coordinates', 'coordenadas', 'exact'],
    ['email', 'e-mail', 'exact'],
    ['phone', 'telefone', 'exact'],
    ['pis', 'codigo pis', 'exact'],
    ['geofence', 'geofence', 'exact'],
    ['receiptSentAt', 'recibo enviado', 'exact'],
    ['timeProvider', 'provedor de data / hora', 'prefix'],
    ['accuracy', 'precisao das coordenadas', 'prefix'],
    ['supervisorCode', 'codigo do supervisor', 'exact'],
    ['selfPunch', 'auto marcacao', 'exact'],
    ['locationCode', 'codigo da localizacao', 'exact'],
    ['autoDateTime', 'data e hora atualizados automaticamente', 'exact'],
    ['syncCode', 'codigo de historico de sincronizacao', 'exact'],
    ['receiptMethod', 'forma como o recibo foi enviado', 'exact'],
    ['faceScore', 'score', 'prefix'],
    ['dateDiffersFromGps', 'define se a data / hora e diferente do gps', 'exact'],
    ['section', 'secao', 'exact'],
    ['costCenter', 'centro de custo', 'exact'],
    ['nsrProcessedAt', 'nsr processado data hora', 'exact'],
    ['fenceJson', 'coordenadas de dispositivos usadas para comparacao de geocerca', 'exact'],
    ['firstSyncDelay', 'diferenca primeira sincronizacao', 'prefix']
];

const REQUIRED_FIELDS: FieldKey[] = ['name', 'cpf', 'date'];

/**
 * Mapeia campo → índice da coluna. A Carol repete "Modo de marcação" (a segunda
 * vem vazia), então fica a PRIMEIRA ocorrência de cada cabeçalho.
 */
export const mapClockinHeaders = (header: unknown[]): Partial<Record<FieldKey, number>> => {
    const normalized = header.map(normalizeHeader);
    const map: Partial<Record<FieldKey, number>> = {};
    FIELD_HEADERS.forEach(([key, label, match]) => {
        const index = normalized.findIndex(h => (match === 'exact' ? h === label : h.startsWith(label)));
        if (index >= 0) map[key] = index;
    });
    return map;
};

const text = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
};

const optionalText = (value: unknown): string | undefined => text(value) || undefined;

const toNumber = (value: unknown): number | null => {
    const raw = text(value).replace(',', '.');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
};

const isYes = (value: unknown): boolean => normalizeHeader(value) === 'sim';

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Converte "dd/mm/aaaa hh:mm" (ou serial do Excel) em "YYYY-MM-DDTHH:mm".
 * Retorna null se não for uma data válida.
 */
export const parseCarolDateTime = (value: unknown): string | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        // Serial do Excel (dias desde 1899-12-30), sem fuso: trata como hora local.
        const totalMinutes = Math.round(value * 24 * 60);
        const base = Date.UTC(1899, 11, 30) + totalMinutes * 60_000;
        const d = new Date(base);
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    }

    const match = text(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!match) return null;
    const [, dd, mm, yyyy, hh = '0', mi = '0'] = match;
    const day = Number(dd), month = Number(mm), hour = Number(hh), minute = Number(mi);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
    return `${yyyy}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
};

/** "-23.91, -46.69" → [lat, lon]; "Não encontrada" → null. */
export const parseCoordinates = (value: unknown): [number, number] | null => {
    const parts = text(value).split(',').map(p => Number(p.trim()));
    if (parts.length !== 2 || parts.some(p => !Number.isFinite(p))) return null;
    const [lat, lon] = parts;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
    return [lat, lon];
};

const parseFenceStatus = (value: unknown): ClockinFenceStatus => {
    const raw = text(value);
    if (raw === '1') return 'INSIDE';
    if (raw === '2') return 'OUTSIDE';
    return 'NOT_EVALUATED';
};

const parseTimezoneMode = (value: unknown): ClockinTimezoneMode => {
    const raw = normalizeHeader(value);
    if (raw === 'habilitado') return 'ENABLED';
    if (raw === 'desabilitado') return 'DISABLED';
    return 'MISSING';
};

/**
 * Lê o JSON de comparação com a cerca:
 * {"company":[],"location":[{"geofence":{x,y},"deviceCoordinate":{x,y},"radius","distance","transition"}],"employee":[]}
 * x = latitude, y = longitude. Vem "no coordinates" ou vazio quando a cerca não foi avaliada.
 */
export const parseFenceJson = (value: unknown): ClockinFenceCheck | null => {
    const raw = text(value);
    if (!raw.startsWith('{')) return null;
    try {
        const parsed = JSON.parse(raw) as Record<string, Array<Record<string, any>>>;
        const entry = [...(parsed.location || []), ...(parsed.employee || []), ...(parsed.company || [])]
            .find(e => e && e.geofence);
        if (!entry) return null;
        const centerLat = Number(entry.geofence.x);
        const centerLon = Number(entry.geofence.y);
        const radius = Number(entry.radius);
        const distance = Number(entry.distance);
        if (![centerLat, centerLon, radius, distance].every(Number.isFinite)) return null;
        return { centerLat, centerLon, radius, distance };
    } catch {
        return null;
    }
};

const digitsOnly = (value: unknown): string => text(value).replace(/\D/g, '');

const imageIdFromUrl = (url: string): string => url.split('/').filter(Boolean).pop() || '';

/**
 * Converte as linhas da planilha (primeira linha = cabeçalho) em batidas
 * normalizadas. Remove duplicatas pelo código de sincronização e descarta o
 * hash biométrico do rosto.
 */
export const parseClockinRows = (rows: unknown[][]): ClockinParseResult => {
    const issues: ClockinParseIssue[] = [];
    if (rows.length === 0) {
        return { punches: [], issues: [{ message: 'Planilha vazia.' }], totalRows: 0, duplicates: 0 };
    }

    const columns = mapClockinHeaders(rows[0]);
    const missing = REQUIRED_FIELDS.filter(f => columns[f] === undefined);
    if (missing.length > 0) {
        return {
            punches: [],
            issues: [{ message: `Colunas obrigatórias não encontradas: ${missing.join(', ')}. Confira se o arquivo é a exportação "Marcações" do Carol Clock In.` }],
            totalRows: rows.length - 1,
            duplicates: 0
        };
    }

    const get = (row: unknown[], key: FieldKey): unknown => {
        const index = columns[key];
        return index === undefined ? undefined : row[index];
    };

    const byId = new Map<string, ClockinPunch>();
    let duplicates = 0;
    let totalRows = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(v => v === null || v === undefined || v === '')) continue;
        totalRows++;
        const excelRow = i + 1;

        const cpf = digitsOnly(get(row, 'cpf')).padStart(11, '0');
        const punchedAt = parseCarolDateTime(get(row, 'date'));
        if (!punchedAt || cpf === '00000000000') {
            issues.push({ row: excelRow, message: !punchedAt ? 'Data da batida inválida.' : 'CPF ausente.' });
            continue;
        }

        const imageUrl = text(get(row, 'image'));
        const syncCode = digitsOnly(get(row, 'syncCode'));
        const id = syncCode || `${cpf}_${punchedAt}_${imageIdFromUrl(imageUrl)}`;
        if (byId.has(id)) {
            duplicates++;
            continue;
        }

        const coordinates = parseCoordinates(get(row, 'coordinates'));
        const { costCenter, carolCostCenter } = resolveCarolCostCenter(text(get(row, 'costCenter')));
        const syncedAtMs = syncCode ? Number(syncCode) : null;
        const selfPunch = isYes(get(row, 'selfPunch'));
        const mode = normalizeHeader(get(row, 'mode')).startsWith('reconhecimento') ? 'FACIAL' : 'PHOTO_APPROVED';

        byId.set(id, {
            id,
            imageUrl,
            name: text(get(row, 'name')),
            cpf,
            email: optionalText(get(row, 'email')),
            phone: optionalText(get(row, 'phone')),
            pis: optionalText(get(row, 'pis')),
            supervisorName: text(get(row, 'supervisorName')),
            supervisorCode: text(get(row, 'supervisorCode')),
            deviceId: text(get(row, 'deviceId')),
            deviceDescription: text(get(row, 'deviceDescription')),
            mode,
            faceScore: toNumber(get(row, 'faceScore')) ?? 0,
            selfPunch,
            locationCode: text(get(row, 'locationCode')),
            locationName: text(get(row, 'locationName')),
            punchedAt,
            date: punchedAt.slice(0, 10),
            gmt: text(get(row, 'gmt')) || '-03:00',
            syncedAtMs: syncedAtMs !== null && Number.isFinite(syncedAtMs) ? syncedAtMs : null,
            nsr: text(get(row, 'nsr')),
            nsrProcessedAt: parseCarolDateTime(get(row, 'nsrProcessedAt')),
            lat: coordinates ? coordinates[0] : null,
            lon: coordinates ? coordinates[1] : null,
            accuracyM: toNumber(get(row, 'accuracy')),
            gpsLowAccuracy: normalizeHeader(get(row, 'gpsLevel')).includes('baixa'),
            fenceStatus: parseFenceStatus(get(row, 'geofence')),
            fenceCheck: parseFenceJson(get(row, 'fenceJson')),
            timezoneMode: parseTimezoneMode(get(row, 'timezone')),
            // Ausente = não conta como adulteração.
            autoDateTime: columns.autoDateTime === undefined ? true : isYes(get(row, 'autoDateTime')),
            dateDiffersFromGps: isYes(get(row, 'dateDiffersFromGps')),
            timeProvider: text(get(row, 'timeProvider')),
            receiptSentAt: parseCarolDateTime(get(row, 'receiptSentAt')),
            receiptMethod: optionalText(get(row, 'receiptMethod')) ?? null,
            firstSyncDelayMin: toNumber(get(row, 'firstSyncDelay')),
            section: text(get(row, 'section')),
            costCenter,
            carolCostCenter,
            regional: costCenter ? getCCRegional(costCenter) : 'Outros'
        });
    }

    const punches = Array.from(byId.values()).sort((a, b) =>
        a.punchedAt === b.punchedAt ? a.name.localeCompare(b.name) : a.punchedAt.localeCompare(b.punchedAt)
    );

    return {
        punches,
        issues,
        totalRows,
        duplicates,
        periodStart: punches[0]?.date,
        periodEnd: punches[punches.length - 1]?.date
    };
};

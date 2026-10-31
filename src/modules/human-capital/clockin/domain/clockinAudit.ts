import {
    AuditedPunch,
    CarolFenceHealth,
    CarolFenceProblem,
    ClockinAlert,
    ClockinAlertCode,
    ClockinCostCenterFences,
    ClockinFenceSource,
    ClockinFenceStatus,
    ClockinPunch,
    ClockinSeverity,
    ClockinSite
} from './clockinTypes';
import { costCentersMatch, isKnownCostCenter } from './carolCostCenters';
import {
    ExpectedCostCenters,
    ExpectedCostCenterSource,
    expectedCostCentersOn,
    matchRmEmployee,
    RmDirectory,
    RmMatch
} from './rmEmployees';

export const EXPECTED_CC_SOURCE_LABEL: Record<ExpectedCostCenterSource, string> = {
    HEADCOUNT: 'headcount',
    RM_ATUAL: 'CC atual no RM',
    CADASTRO: 'cadastro do portal'
};

/** "headcount em 25/09/2026: 301903 (70%), 301806 (30%)" */
export const describeExpected = (expected: ExpectedCostCenters, date: string): string => {
    const ccs = expected.allocations
        .map(a => (expected.allocations.length > 1 ? `${a.costCenter} (${Math.round(a.share * 100)}%)` : a.costCenter))
        .join(', ');
    return expected.source === 'HEADCOUNT'
        ? `headcount em ${date.split('-').reverse().join('/')}: ${ccs}`
        : `${EXPECTED_CC_SOURCE_LABEL[expected.source]} (sem headcount na data): ${ccs}`;
};

export const CLOCKIN_THRESHOLDS = {
    /** Batida enviada mais de X min depois de feita (ficou offline no celular). */
    lateSyncMinutes: 60,
    /** Precisão do GPS pior que X metros. */
    lowAccuracyMeters: 100,
    /** Duas batidas da mesma pessoa em até X min. */
    repeatedPunchMinutes: 5,
    /**
     * Uma jornada abrange as batidas em até X h desde a primeira. Intervalo entre
     * batidas não serve: sem batida de almoço, entrada→saída (10–12 h) se
     * confunde com saída→próxima entrada (11–14 h).
     */
    shiftMaxSpanHours: 16,
    /** Raio a partir do qual a cerca da Carol não restringe nada. */
    unlimitedRadiusMeters: 50_000,
    /** Mediana das batidas mais longe que isso do centro: cerca não é a do local de trabalho. */
    farFromPunchesMeters: 10_000,
    /** Folga máxima dada pela precisão do GPS ao avaliar a cerca da obra. */
    maxAccuracyToleranceMeters: 100
};

/** Coordenadas que a Carol usa quando o endereço do local não é encontrado. */
const DEFAULT_GEOCODE_CENTERS: Array<[number, number]> = [
    [-23.5505, -46.6333] // São Paulo — Praça da Sé
];

export const SEVERITY_ORDER: Record<ClockinSeverity, number> = { high: 3, medium: 2, low: 1 };

export const ALERT_META: Record<ClockinAlertCode, { label: string; severity: ClockinSeverity; description: string }> = {
    TIME_TAMPER: {
        label: 'Hora do celular alterada',
        severity: 'high',
        description: 'Data/hora não atualizada automaticamente ou diferente da hora do GPS.'
    },
    TIMEZONE_MISMATCH: {
        label: 'Fuso diferente do local',
        severity: 'high',
        description: 'Fuso (GMT) da batida diferente do usado pelos demais colaboradores do mesmo local.'
    },
    LATE_SYNC: {
        label: 'Enviada muito depois',
        severity: 'high',
        description: `Batida feita offline e sincronizada mais de ${CLOCKIN_THRESHOLDS.lateSyncMinutes} min depois.`
    },
    PHOTO_APPROVED: {
        label: 'Foto aprovada manualmente',
        severity: 'medium',
        description: 'O rosto não foi reconhecido automaticamente; a foto foi aprovada por uma pessoa.'
    },
    OUTSIDE_FENCE: {
        label: 'Fora da cerca',
        severity: 'medium',
        description: 'Batida fora da cerca eletrônica (da obra, quando cadastrada; senão a da Carol).'
    },
    ODD_PUNCHES: {
        label: 'Jornada com batida faltando',
        severity: 'medium',
        description: 'Número ímpar de batidas na jornada: falta uma entrada ou uma saída.'
    },
    NOT_PROCESSED: {
        label: 'Batida não processada',
        severity: 'medium',
        description: 'Sem NSR ou sem data de processamento na Carol.'
    },
    GPS_UNAVAILABLE: {
        label: 'Sem GPS',
        severity: 'low',
        description: 'Coordenadas não encontradas na batida.'
    },
    GPS_LOW_ACCURACY: {
        label: 'GPS impreciso',
        severity: 'low',
        description: `Precisão baixa ou pior que ${CLOCKIN_THRESHOLDS.lowAccuracyMeters} m.`
    },
    REPEATED_PUNCH: {
        label: 'Batida repetida',
        severity: 'low',
        description: `Duas batidas da mesma pessoa em até ${CLOCKIN_THRESHOLDS.repeatedPunchMinutes} min.`
    },
    NO_RECEIPT: {
        label: 'Sem recibo',
        severity: 'low',
        description: 'Comprovante da batida não enviado ao colaborador.'
    },
    DISMISSED_EMPLOYEE: {
        label: 'Batida após demissão',
        severity: 'high',
        description: 'Batida em data posterior à demissão registrada no RM.'
    },
    NOT_IN_RM: {
        label: 'CPF fora do RM',
        severity: 'medium',
        description: 'O CPF da batida não está no cadastro de funcionários do RM.'
    },
    COST_CENTER_MISMATCH: {
        label: 'CC diferente do RM',
        severity: 'low',
        description: 'O CC da batida na Carol não está entre os CCs do colaborador naquela data (headcount vigente; sem headcount, o CC atual do RM).'
    },
    UNKNOWN_COST_CENTER: {
        label: 'CC não cadastrado',
        severity: 'low',
        description: 'Centro de custo da Carol sem equivalente no TOTVS: obra encerrada, afastamento ou cadastro desatualizado.'
    }
};

export const FENCE_PROBLEM_LABELS: Record<CarolFenceProblem, string> = {
    RADIUS_ZERO: 'Raio 0 m — toda batida sai "fora"',
    RADIUS_UNLIMITED: 'Raio ilimitado — toda batida sai "dentro"',
    DEFAULT_CENTER: 'Centro em coordenada padrão (endereço não encontrado)',
    NO_FENCE_DATA: 'Sem dados de cerca nas batidas',
    FAR_FROM_PUNCHES: 'Cerca longe de onde as pessoas batem (local de cadastro ≠ obra)'
};

const alert = (code: ClockinAlertCode, detail: string): ClockinAlert => ({
    code,
    severity: ALERT_META[code].severity,
    detail
});

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distância em metros entre dois pontos (haversine). */
export const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6_371_000 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
};

export const median = (values: number[]): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const mostCommon = <T,>(items: T[], key: (item: T) => string): T | null => {
    const counts = new Map<string, { item: T; count: number }>();
    items.forEach(item => {
        const k = key(item);
        const current = counts.get(k);
        if (current) current.count++;
        else counts.set(k, { item, count: 1 });
    });
    let best: { item: T; count: number } | null = null;
    counts.forEach(entry => { if (!best || entry.count > best.count) best = entry; });
    return best ? (best as { item: T; count: number }).item : null;
};

/** Minutos desde a época para "YYYY-MM-DDTHH:mm" (hora local, sem fuso). */
export const punchMinutes = (punchedAt: string): number => {
    const [date, time = '00:00'] = punchedAt.split('T');
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mi] = time.split(':').map(Number);
    return Date.UTC(y, m - 1, d, hh, mi) / 60_000;
};

export const locationKey = (punch: Pick<ClockinPunch, 'locationCode' | 'locationName'>): string =>
    punch.locationCode || punch.locationName || 'SEM_LOCAL';

/**
 * Diagnóstico das cercas da Carol por local de cadastro. Um local com problema
 * não gera alerta "fora da cerca" contra o colaborador — o problema é da configuração.
 */
export const buildCarolFenceHealth = (punches: ClockinPunch[]): CarolFenceHealth[] => {
    const groups = new Map<string, ClockinPunch[]>();
    punches.forEach(p => {
        const key = locationKey(p);
        const list = groups.get(key);
        if (list) list.push(p);
        else groups.set(key, [p]);
    });

    return Array.from(groups.entries()).map(([key, list]) => {
        const checks = list.map(p => p.fenceCheck).filter((c): c is NonNullable<typeof c> => c !== null);
        const fence = mostCommon(checks, c => `${c.centerLat.toFixed(5)}|${c.centerLon.toFixed(5)}|${c.radius}`);
        const problems: CarolFenceProblem[] = [];
        let medianDistance: number | null = null;

        if (!fence) {
            problems.push('NO_FENCE_DATA');
        } else {
            if (fence.radius <= 0) problems.push('RADIUS_ZERO');
            if (fence.radius >= CLOCKIN_THRESHOLDS.unlimitedRadiusMeters) problems.push('RADIUS_UNLIMITED');
            if (DEFAULT_GEOCODE_CENTERS.some(([lat, lon]) => haversineMeters(lat, lon, fence.centerLat, fence.centerLon) < 1_000)) {
                problems.push('DEFAULT_CENTER');
            }
            // Só batidas avaliadas pela cerca: tablets da sede sem coordenada puxariam a mediana para perto.
            medianDistance = median(
                list.filter(p => p.lat !== null && p.lon !== null && p.fenceStatus !== 'NOT_EVALUATED')
                    .map(p => haversineMeters(p.lat as number, p.lon as number, fence.centerLat, fence.centerLon))
            );
            if (medianDistance !== null && medianDistance > CLOCKIN_THRESHOLDS.farFromPunchesMeters) {
                problems.push('FAR_FROM_PUNCHES');
            }
        }

        const evaluated = list.filter(p => p.fenceStatus !== 'NOT_EVALUATED');
        return {
            key,
            locationCode: list[0].locationCode,
            locationName: list[0].locationName || 'Sem local',
            punchCount: list.length,
            centerLat: fence?.centerLat ?? null,
            centerLon: fence?.centerLon ?? null,
            radius: fence?.radius ?? null,
            medianDistance,
            insideRate: evaluated.length ? evaluated.filter(p => p.fenceStatus === 'INSIDE').length / evaluated.length : 0,
            problems
        };
    }).sort((a, b) => b.punchCount - a.punchCount);
};

/**
 * Batida contra as cercas da obra: dentro se estiver em qualquer uma, com folga
 * da precisão do GPS (até 100 m). Distância = da cerca mais próxima. Sem GPS → null.
 */
export const evaluateSites = (
    punch: Pick<ClockinPunch, 'lat' | 'lon' | 'accuracyM'>,
    sites: ClockinSite[]
): { inside: boolean; distance: number } | null => {
    if (punch.lat === null || punch.lon === null || sites.length === 0) return null;
    const tolerance = Math.min(punch.accuracyM ?? 0, CLOCKIN_THRESHOLDS.maxAccuracyToleranceMeters);
    let best: { distance: number; inside: boolean } | null = null;
    for (const site of sites) {
        const distance = haversineMeters(punch.lat, punch.lon, site.lat, site.lon);
        const inside = distance - tolerance <= site.radius;
        if (!best || (inside && !best.inside) || (inside === best.inside && distance < best.distance)) {
            best = { distance, inside };
        }
    }
    return best;
};

interface FenceResolution {
    status: ClockinFenceStatus;
    source: ClockinFenceSource;
    distance: number | null;
}

/**
 * Cerca considerada na auditoria:
 * 1. Cerca da obra cadastrada no portal para o CC (recalcula pelas coordenadas do celular);
 * 2. Senão, o status da Carol — desde que a cerca do local não tenha problema de configuração.
 */
export const resolveFence = (
    punch: ClockinPunch,
    siteFences: Map<string, ClockinCostCenterFences>,
    misconfiguredLocations: Set<string>
): FenceResolution => {
    const sites = siteFences.get(punch.costCenter)?.sites || [];
    if (sites.length > 0) {
        const result = evaluateSites(punch, sites);
        if (!result) return { status: 'NOT_EVALUATED', source: 'SITE', distance: null };
        return { status: result.inside ? 'INSIDE' : 'OUTSIDE', source: 'SITE', distance: result.distance };
    }

    if (misconfiguredLocations.has(locationKey(punch))) {
        return { status: 'NOT_EVALUATED', source: 'CAROL_MISCONFIGURED', distance: punch.fenceCheck?.distance ?? null };
    }
    if (punch.fenceStatus === 'NOT_EVALUATED') return { status: 'NOT_EVALUATED', source: 'NONE', distance: null };
    return { status: punch.fenceStatus, source: 'CAROL', distance: punch.fenceCheck?.distance ?? null };
};

const formatDistance = (meters: number): string =>
    meters >= 1_000 ? `${(meters / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : `${Math.round(meters)} m`;

const formatDelay = (minutes: number): string => {
    if (minutes < 120) return `${Math.round(minutes)} min`;
    if (minutes < 48 * 60) return `${(minutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
    return `${(minutes / 1_440).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`;
};

export interface ClockinShift {
    cpf: string;
    name: string;
    /** Data da primeira batida da jornada. */
    date: string;
    punches: AuditedPunch[];
}

/** Agrupa as batidas de cada pessoa em jornadas de até 16 h, cobrindo turnos que viram a meia-noite. */
export const groupShifts = <T extends ClockinPunch>(punches: T[]): Array<{ cpf: string; name: string; date: string; punches: T[] }> => {
    const byPerson = new Map<string, T[]>();
    punches.forEach(p => {
        const list = byPerson.get(p.cpf);
        if (list) list.push(p);
        else byPerson.set(p.cpf, [p]);
    });

    const shifts: Array<{ cpf: string; name: string; date: string; punches: T[] }> = [];
    const maxSpan = CLOCKIN_THRESHOLDS.shiftMaxSpanHours * 60;
    byPerson.forEach(list => {
        const sorted = [...list].sort((a, b) => a.punchedAt.localeCompare(b.punchedAt) || (a.syncedAtMs ?? 0) - (b.syncedAtMs ?? 0));
        let current: T[] = [];
        sorted.forEach(p => {
            if (current.length > 0 && punchMinutes(p.punchedAt) - punchMinutes(current[0].punchedAt) > maxSpan) {
                shifts.push({ cpf: current[0].cpf, name: current[0].name, date: current[0].date, punches: current });
                current = [];
            }
            current.push(p);
        });
        if (current.length) shifts.push({ cpf: current[0].cpf, name: current[0].name, date: current[0].date, punches: current });
    });
    return shifts;
};

export interface AuditOptions {
    siteFences?: ClockinCostCenterFences[];
    fenceHealth?: CarolFenceHealth[];
    /** Diretório do RM (buildRmDirectory) para achar chapa e CC de cada pessoa. */
    rmDirectory?: RmDirectory;
}

/** Aplica todas as regras de auditoria às batidas. */
export const auditPunches = (punches: ClockinPunch[], options: AuditOptions = {}): AuditedPunch[] => {
    const health = options.fenceHealth ?? buildCarolFenceHealth(punches);
    const misconfigured = new Set(health.filter(h => h.problems.length > 0).map(h => h.key));
    const siteFences = new Map((options.siteFences || []).map(f => [f.costCenter, f]));

    // Fuso esperado por local = o mais comum entre as batidas do local.
    const gmtByLocation = new Map<string, string>();
    const gmtGroups = new Map<string, ClockinPunch[]>();
    punches.forEach(p => {
        const key = locationKey(p);
        const list = gmtGroups.get(key);
        if (list) list.push(p);
        else gmtGroups.set(key, [p]);
    });
    gmtGroups.forEach((list, key) => gmtByLocation.set(key, mostCommon(list, p => p.gmt)?.gmt || '-03:00'));

    // Um cruzamento por pessoa (CPF), não por batida.
    const rmByCpf = new Map<string, RmMatch>();
    const rmMatchOf = (p: ClockinPunch): RmMatch | null => {
        if (!options.rmDirectory) return null;
        let match = rmByCpf.get(p.cpf);
        if (!match) {
            match = matchRmEmployee(p, options.rmDirectory);
            rmByCpf.set(p.cpf, match);
        }
        return match;
    };

    const audited: AuditedPunch[] = punches.map(p => {
        const alerts: ClockinAlert[] = [];

        if (!p.autoDateTime) alerts.push(alert('TIME_TAMPER', 'Data/hora do celular não atualizada automaticamente.'));
        else if (p.dateDiffersFromGps) alerts.push(alert('TIME_TAMPER', 'Hora do celular diferente da hora do GPS.'));

        const expectedGmt = gmtByLocation.get(locationKey(p));
        if (expectedGmt && p.gmt !== expectedGmt) {
            alerts.push(alert('TIMEZONE_MISMATCH', `GMT ${p.gmt}; o local usa ${expectedGmt}.`));
        }

        if (p.firstSyncDelayMin !== null && p.firstSyncDelayMin > CLOCKIN_THRESHOLDS.lateSyncMinutes) {
            alerts.push(alert('LATE_SYNC', `Sincronizada ${formatDelay(p.firstSyncDelayMin)} depois da batida.`));
        }

        if (p.mode === 'PHOTO_APPROVED') alerts.push(alert('PHOTO_APPROVED', 'Sem reconhecimento facial automático.'));

        const fence = resolveFence(p, siteFences, misconfigured);
        if (fence.status === 'OUTSIDE') {
            const where = fence.source === 'SITE' ? 'da obra' : 'da Carol';
            alerts.push(alert('OUTSIDE_FENCE', fence.distance !== null ? `A ${formatDistance(fence.distance)} da cerca ${where}.` : `Fora da cerca ${where}.`));
        }

        if (p.lat === null || p.lon === null) alerts.push(alert('GPS_UNAVAILABLE', 'Coordenadas não encontradas.'));
        else if (p.gpsLowAccuracy || (p.accuracyM !== null && p.accuracyM > CLOCKIN_THRESHOLDS.lowAccuracyMeters)) {
            alerts.push(alert('GPS_LOW_ACCURACY', p.accuracyM !== null ? `Precisão de ${formatDistance(p.accuracyM)}.` : 'Precisão baixa.'));
        }

        if (!p.nsr || p.nsr === '0' || !p.nsrProcessedAt) alerts.push(alert('NOT_PROCESSED', 'Sem NSR ou sem processamento.'));

        if (!p.receiptSentAt || (p.receiptMethod || '').toLowerCase() === 'nothing') {
            alerts.push(alert('NO_RECEIPT', 'Recibo não enviado.'));
        }

        if (!isKnownCostCenter(p.costCenter)) {
            alerts.push(alert('UNKNOWN_COST_CENTER', p.costCenter ? `CC ${p.carolCostCenter || p.costCenter} da Carol não existe no TOTVS.` : 'Batida sem centro de custo.'));
        }

        const rm = rmMatchOf(p);
        const expected = rm?.employee && options.rmDirectory
            ? expectedCostCentersOn(options.rmDirectory, rm.employee, p.date)
            : null;
        if (expected && !expected.allocations.some(a => costCentersMatch(p, a.costCenter))) {
            alerts.push(alert('COST_CENTER_MISMATCH', `Carol: ${p.costCenter}; ${describeExpected(expected, p.date)} (chapa ${rm!.employee!.chapa}).`));
        }
        if (rm?.employee?.dataDemissao && rm.employee.dataDemissao < p.date) {
            alerts.push(alert('DISMISSED_EMPLOYEE', `Chapa ${rm.employee.chapa} demitida em ${rm.employee.dataDemissao.split('-').reverse().join('/')}.`));
        }
        // Só acusa ausência quando o cadastro do RM (com CPF) foi carregado; pelo nome não é conclusivo.
        if (options.rmDirectory?.hasRmRegistry && rm?.by !== 'CPF') {
            alerts.push(alert('NOT_IN_RM', rm?.employee ? `Achado só pelo nome (chapa ${rm.employee.chapa}), não pelo CPF.` : 'CPF não encontrado no cadastro do RM.'));
        }

        return {
            ...p,
            alerts,
            effectiveFence: fence.status,
            fenceSource: fence.source,
            effectiveDistance: fence.distance,
            worstSeverity: null,
            rm,
            expectedCostCenters: expected
        };
    });

    // Regras por jornada.
    groupShifts(audited).forEach(shift => {
        if (shift.punches.length % 2 === 1) {
            shift.punches.forEach(p => p.alerts.push(alert('ODD_PUNCHES', `${shift.punches.length} batida(s) na jornada de ${shift.date.split('-').reverse().join('/')}.`)));
        }
        for (let i = 1; i < shift.punches.length; i++) {
            const diff = punchMinutes(shift.punches[i].punchedAt) - punchMinutes(shift.punches[i - 1].punchedAt);
            if (diff <= CLOCKIN_THRESHOLDS.repeatedPunchMinutes) {
                shift.punches[i].alerts.push(alert('REPEATED_PUNCH', `${diff} min depois da batida anterior.`));
            }
        }
    });

    audited.forEach(p => {
        p.worstSeverity = p.alerts.reduce<ClockinSeverity | null>(
            (worst, a) => (!worst || SEVERITY_ORDER[a.severity] > SEVERITY_ORDER[worst] ? a.severity : worst),
            null
        );
    });

    return audited;
};

export interface ClockinSummary {
    punchCount: number;
    employeeCount: number;
    shiftCount: number;
    punchesWithAlert: number;
    bySeverity: Record<ClockinSeverity, number>;
    byCode: Record<ClockinAlertCode, number>;
    facialRate: number;
    avgFaceScore: number;
    insideRate: number;
    /** Colaboradores (por CPF) encontrados no RM; null quando não houve cruzamento. */
    rmCoverage: { matched: number; matchedByCpf: number; ambiguous: number; notFound: number; mismatched: number } | null;
}

export const summarizeAudit = (audited: AuditedPunch[]): ClockinSummary => {
    const byCode = Object.fromEntries(Object.keys(ALERT_META).map(k => [k, 0])) as Record<ClockinAlertCode, number>;
    const bySeverity: Record<ClockinSeverity, number> = { high: 0, medium: 0, low: 0 };
    let withAlert = 0;
    let facial = 0;
    let scoreSum = 0;
    let evaluated = 0;
    let inside = 0;

    audited.forEach(p => {
        if (p.worstSeverity) {
            withAlert++;
            bySeverity[p.worstSeverity]++;
        }
        new Set(p.alerts.map(a => a.code)).forEach(code => { byCode[code]++; });
        if (p.mode === 'FACIAL') {
            facial++;
            scoreSum += p.faceScore;
        }
        if (p.effectiveFence !== 'NOT_EVALUATED') {
            evaluated++;
            if (p.effectiveFence === 'INSIDE') inside++;
        }
    });

    let rmCoverage: ClockinSummary['rmCoverage'] = null;
    if (audited.some(p => p.rm)) {
        const status = new Map<string, RmMatch>();
        const mismatched = new Set<string>();
        audited.forEach(p => {
            if (p.rm) status.set(p.cpf, p.rm);
            if (p.alerts.some(a => a.code === 'COST_CENTER_MISMATCH')) mismatched.add(p.cpf);
        });
        const values = Array.from(status.values()).map(m => m.status);
        rmCoverage = {
            matched: values.filter(s => s === 'MATCHED').length,
            matchedByCpf: Array.from(status.values()).filter(m => m.by === 'CPF').length,
            ambiguous: values.filter(s => s === 'AMBIGUOUS').length,
            notFound: values.filter(s => s === 'NOT_FOUND').length,
            mismatched: mismatched.size
        };
    }

    return {
        rmCoverage,
        punchCount: audited.length,
        employeeCount: new Set(audited.map(p => p.cpf)).size,
        shiftCount: groupShifts(audited).length,
        punchesWithAlert: withAlert,
        bySeverity,
        byCode,
        facialRate: audited.length ? facial / audited.length : 0,
        avgFaceScore: facial ? scoreSum / facial : 0,
        insideRate: evaluated ? inside / evaluated : 0
    };
};

export interface ClockinGroupRow {
    key: string;
    label: string;
    punchCount: number;
    employeeCount: number;
    high: number;
    medium: number;
    low: number;
}

/** Ranking por um agrupador (CC, regional, colaborador, supervisor...). */
export const groupAudit = (
    audited: AuditedPunch[],
    keyOf: (p: AuditedPunch) => string,
    labelOf: (p: AuditedPunch) => string
): ClockinGroupRow[] => {
    const map = new Map<string, ClockinGroupRow & { cpfs: Set<string> }>();
    audited.forEach(p => {
        const key = keyOf(p);
        let row = map.get(key);
        if (!row) {
            row = { key, label: labelOf(p), punchCount: 0, employeeCount: 0, high: 0, medium: 0, low: 0, cpfs: new Set() };
            map.set(key, row);
        }
        row.punchCount++;
        row.cpfs.add(p.cpf);
        if (p.worstSeverity) row[p.worstSeverity]++;
    });
    return Array.from(map.values())
        .map(({ cpfs, ...row }) => ({ ...row, employeeCount: cpfs.size }))
        .sort((a, b) => b.high - a.high || b.medium - a.medium || b.low - a.low || b.punchCount - a.punchCount);
};

export interface SuggestedSite {
    lat: number;
    lon: number;
    radius: number;
    /** Batidas cobertas por este ponto. */
    sample: number;
}

/**
 * Sugere cercas para um CC a partir de onde as pessoas realmente bateram:
 * agrupa as batidas em pontos de concentração (~1,5 km), do mais frequente
 * para o menos, e propõe centro (mediana) e raio (p90, entre 50 m e 1 km).
 * Um CC de manutenção de via pode ter vários pontos.
 */
export const suggestSitesFromPunches = (punches: ClockinPunch[], maxSites = 5): SuggestedSite[] => {
    let remaining = punches
        .filter(p => p.lat !== null && p.lon !== null && (p.accuracyM ?? 0) <= CLOCKIN_THRESHOLDS.lowAccuracyMeters)
        .map(p => ({ lat: p.lat as number, lon: p.lon as number }));
    const minSample = Math.max(5, Math.ceil(remaining.length * 0.05));
    const sites: SuggestedSite[] = [];

    while (sites.length < maxSites && remaining.length >= minSample) {
        const buckets = new Map<string, number>();
        remaining.forEach(p => {
            const key = `${p.lat.toFixed(2)}|${p.lon.toFixed(2)}`;
            buckets.set(key, (buckets.get(key) || 0) + 1);
        });
        const [topKey] = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1])[0];
        const [seedLat, seedLon] = topKey.split('|').map(Number);
        const members = remaining.filter(p => haversineMeters(seedLat, seedLon, p.lat, p.lon) <= 1_500);
        if (members.length < minSample) break;

        const lat = median(members.map(p => p.lat)) as number;
        const lon = median(members.map(p => p.lon)) as number;
        const distances = members.map(p => haversineMeters(lat, lon, p.lat, p.lon)).sort((a, b) => a - b);
        const p90 = distances[Math.floor(distances.length * 0.9)] ?? 0;
        sites.push({ lat, lon, radius: Math.min(1_000, Math.max(50, Math.ceil(p90 / 10) * 10)), sample: members.length });

        const memberSet = new Set(members);
        remaining = remaining.filter(p => !memberSet.has(p));
    }
    return sites;
};

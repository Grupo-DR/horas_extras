/**
 * Auditoria de Ponto — tipos do domínio.
 *
 * Origem: exportação "Marcações" do TOTVS Carol Clock In (batida pelo celular
 * com foto do rosto + GPS + cerca eletrônica). Hoje chega por upload do Excel;
 * no futuro pode vir por endpoint — por isso o parser trabalha sobre linhas
 * genéricas (cabeçalho → valor) e não sobre o arquivo.
 */

import type { ExpectedCostCenters, RmMatch } from './rmEmployees';

/** Resultado da cerca eletrônica da Carol (coluna "Geofence": 0, 1, 2). */
export type ClockinFenceStatus = 'INSIDE' | 'OUTSIDE' | 'NOT_EVALUATED';

/** "Reconhecimento Facial" (score > 0) ou "Foto aprovada" (aprovação manual, score 0). */
export type ClockinMode = 'FACIAL' | 'PHOTO_APPROVED';

export type ClockinTimezoneMode = 'ENABLED' | 'DISABLED' | 'MISSING';

/** Detalhe da comparação com a cerca (coluna JSON da Carol). Só existe em batidas faciais. */
export interface ClockinFenceCheck {
    centerLat: number;
    centerLon: number;
    radius: number;
    distance: number;
}

/** Uma batida normalizada. Não guarda o hash biométrico do rosto (LGPD art. 11). */
export interface ClockinPunch {
    /** Código de histórico de sincronização (epoch ms) — único por batida. */
    id: string;
    imageUrl: string;
    name: string;
    cpf: string;
    email?: string;
    phone?: string;
    pis?: string;
    supervisorName: string;
    supervisorCode: string;
    deviceId: string;
    deviceDescription: string;
    mode: ClockinMode;
    /** 0 em "Foto aprovada". Sem nota mínima: quanto maior, melhor. */
    faceScore: number;
    /** "Auto marcação" = Sim: o próprio colaborador marcou no celular dele. */
    selfPunch: boolean;
    /** Local de CADASTRO do colaborador na Carol — não é onde ele bateu. */
    locationCode: string;
    locationName: string;
    /** Data/hora local da batida: YYYY-MM-DDTHH:mm */
    punchedAt: string;
    /** YYYY-MM-DD */
    date: string;
    gmt: string;
    /** Instante da sincronização com segundos (epoch ms). */
    syncedAtMs: number | null;
    nsr: string;
    nsrProcessedAt: string | null;
    lat: number | null;
    lon: number | null;
    accuracyM: number | null;
    gpsLowAccuracy: boolean;
    fenceStatus: ClockinFenceStatus;
    fenceCheck: ClockinFenceCheck | null;
    timezoneMode: ClockinTimezoneMode;
    /** "Data e hora atualizados automaticamente" */
    autoDateTime: boolean;
    /** "Define se a data / hora é diferente do GPS" */
    dateDiffersFromGps: boolean;
    timeProvider: string;
    receiptSentAt: string | null;
    receiptMethod: string | null;
    /** Minutos entre a batida e a primeira sincronização (batida offline). */
    firstSyncDelayMin: number | null;
    section: string;
    /** CC do portal (TOTVS, já traduzido de CAROL_CC_ALIASES), sem pontos. */
    costCenter: string;
    /** CC como veio da Carol, sem pontos (difere de costCenter quando há tradução). */
    carolCostCenter: string;
    regional: string;
}

export interface ClockinParseIssue {
    /** Linha no Excel (1-based, incluindo cabeçalho). */
    row?: number;
    message: string;
}

export interface ClockinParseResult {
    punches: ClockinPunch[];
    issues: ClockinParseIssue[];
    totalRows: number;
    duplicates: number;
    periodStart?: string;
    periodEnd?: string;
}

// ─── Cercas por obra (cadastradas no portal) ────────────────────────────────

export interface ClockinSite {
    name: string;
    lat: number;
    lon: number;
    /** metros */
    radius: number;
}

/** Cercas de um centro de custo. A batida está dentro se estiver em qualquer uma. */
export interface ClockinCostCenterFences {
    costCenter: string;
    regional: string;
    sites: ClockinSite[];
    updatedAt?: string;
    updatedBy?: string;
}

// ─── Auditoria ──────────────────────────────────────────────────────────────

export type ClockinSeverity = 'high' | 'medium' | 'low';

export type ClockinAlertCode =
    | 'TIME_TAMPER'
    | 'TIMEZONE_MISMATCH'
    | 'LATE_SYNC'
    | 'PHOTO_APPROVED'
    | 'OUTSIDE_FENCE'
    | 'GPS_UNAVAILABLE'
    | 'GPS_LOW_ACCURACY'
    | 'NOT_PROCESSED'
    | 'NO_RECEIPT'
    | 'ODD_PUNCHES'
    | 'REPEATED_PUNCH'
    | 'UNKNOWN_COST_CENTER'
    | 'COST_CENTER_MISMATCH'
    | 'DISMISSED_EMPLOYEE'
    | 'NOT_IN_RM';

export interface ClockinAlert {
    code: ClockinAlertCode;
    severity: ClockinSeverity;
    detail: string;
}

/** De onde veio o status de cerca usado na auditoria. */
export type ClockinFenceSource = 'SITE' | 'CAROL' | 'CAROL_MISCONFIGURED' | 'NONE';

export interface AuditedPunch extends ClockinPunch {
    alerts: ClockinAlert[];
    /** Status final da cerca (obra cadastrada > Carol). */
    effectiveFence: ClockinFenceStatus;
    fenceSource: ClockinFenceSource;
    /** Distância (m) até a cerca considerada, quando conhecida. */
    effectiveDistance: number | null;
    /** Maior gravidade entre os alertas, ou null. */
    worstSeverity: ClockinSeverity | null;
    /** Colaborador no RM (headcount/cadastro), quando o diretório foi informado. */
    rm: RmMatch | null;
    /** CC(s) onde a pessoa deveria estar na data da batida (headcount vigente > CC atual do RM). */
    expectedCostCenters: ExpectedCostCenters | null;
}

export type CarolFenceProblem =
    | 'RADIUS_ZERO'
    | 'RADIUS_UNLIMITED'
    | 'DEFAULT_CENTER'
    | 'NO_FENCE_DATA'
    | 'FAR_FROM_PUNCHES';

/** Saúde da cerca configurada na Carol para um local de cadastro. */
export interface CarolFenceHealth {
    /** Chave do local (código, nome ou SEM_LOCAL) — ver locationKey(). */
    key: string;
    locationCode: string;
    locationName: string;
    punchCount: number;
    centerLat: number | null;
    centerLon: number | null;
    radius: number | null;
    /** Mediana da distância das batidas até o centro da cerca (m). */
    medianDistance: number | null;
    insideRate: number;
    problems: CarolFenceProblem[];
}

export interface ClockinImportMeta {
    importId: string;
    fileName: string;
    uploadedAt: string;
    uploadedBy: string;
    periodStart: string;
    periodEnd: string;
    punchCount: number;
}

// src/modules/ssma/types.ts
import { SSMARole } from '../iam/types';

export type SSMAInspectionType = string;

export type SSMAFunctionGroup = 'MANAGER' | 'SITE_MANAGER' | 'FOREMAN' | 'SUPERVISOR' | 'TECHNICIAN';

export type SSMAStatus = 'ATENDE' | 'NAO_ATENDE';

export type SSMAEventStatus = 'VALID' | 'CANCELLED';

export interface AuditableRecord {
    createdAt?: string;
    createdBy?: string;
    createdByNameSnapshot?: string;
    updatedAt?: string;
    updatedBy?: string;
    updatedByNameSnapshot?: string;
    disabledAt?: string;
    disabledBy?: string;
    disabledByNameSnapshot?: string;
    disableReason?: string;
}

export interface SSMARegional extends AuditableRecord {
    id: string;
    name: string;
    code?: string;
    responsavelId?: string;
    active: boolean;
}

export interface SSMACostCenter extends AuditableRecord {
    id: string;
    code: string;
    regionalId: string;
    name: string;
    engenheiroId?: string;
    supervisorId?: string;
    tstIds?: string[];
    encarregadoIds?: string[];
    active: boolean;
}

export interface SSMAForeman extends AuditableRecord {
    id: string;
    name: string;
    active: boolean;
}

export interface SSMAEmployee extends AuditableRecord {
    id: string;
    uid?: string;
    name: string;
    email?: string;
    functionGroup: SSMAFunctionGroup;
    roleSnapshot?: SSMARole;
    costCenterId?: string;
    costCenterIds?: string[];
    regionalId?: string;
    regionalIds?: string[];
    targetIFS?: number;
    targetAlojamento?: number;
    targetRDO?: number;
    active: boolean;
}

export interface SSMARule extends AuditableRecord {
    id: string;
    name?: string;
    description?: string;
    ruleRevisionId?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    inspectionType: SSMAInspectionType;
    functionGroup: SSMAFunctionGroup;
    monthlyTarget: number;
    targets?: any[]; // legacy
    active: boolean;
}

export interface SSMAInspecaoEvidencia {
    id: string;
    tipo: 'IFS' | 'Alojamento';
    data: string;
    executorRole: 'Gerente Regional' | 'Engenheiro de Obra' | 'Supervisor de SSMA' | 'Técnico de Segurança' | 'Encarregado';
    executorNome: string;
    comentario: string;
    fotoUrl: string;
    fotoUrls?: string[];
}

export interface SSMAInspection extends AuditableRecord {
    id: string;
    ano: number;
    mes: string;
    cc: string; // codigo do centro de custo
    greg: string; // Regional (GREG) nome
    gestor: string;
    encarregado: string;
    supssma: string;
    tst: string;
    qtdeRdo: number;

    // Realizados
    realizadoGestorIFS: number;
    realizadoGestorAlojamento: number;
    realizadoEncarregadoIFS: number;
    realizadoEncarregadoAlojamento: number;
    realizadoSupssmaIFS: number;
    realizadoSupssmaAlojamento: number;
    realizadoTstIFS: number;
    realizadoTstAlojamento: number;

    // Metas Calculadas
    metaGestorIFS: number;
    metaGestorAlojamento: number;
    metaEncarregadoIFS: number;
    metaEncarregadoAlojamento: number;
    metaSupssmaIFS: number;
    metaSupssmaAlojamento: number;
    metaTstIFS: number;
    metaTstAlojamento: number;

    // Resultados (%)
    resultadoGestor: number;
    resultadoEncarregado: number;
    resultadoSupssma: number;
    resultadoTst: number;
    resultadoGeral: number;
    status: 'ATENDE' | 'NÃO ATENDE';

    evidencias?: SSMAInspecaoEvidencia[];
}

export type SSMAAuditEntityType = 
    | 'REGIONAL'
    | 'COST_CENTER'
    | 'EMPLOYEE'
    | 'RULE'
    | 'INSPECTION_EVENT'
    | 'EVIDENCE'
    | 'DASHBOARD'
    | 'SYSTEM';

export interface SSMAAuditLog {
    id: string;
    action: string;
    entityType: SSMAAuditEntityType;
    entityId: string;
    entityLabelSnapshot?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    reason?: string;
    performedAt: string;
    performedBy: string;
    performedByNameSnapshot: string;
    performedByRoleSnapshot?: string;
    regionalId?: string;
    costCenterId?: string;
    competence?: string;
    metadata?: Record<string, unknown>;
}

// --- Sprint 2 New Types ---

export type SSMATargetFunctionGroup = 'GREG' | 'GESTOR' | 'SUPSSMA' | 'TST' | 'ENCARREGADO';

export interface SSMAMonthlyTarget extends AuditableRecord {
    id: string; // competence_employeeUid
    competence: string; // YYYY-MM
    employeeUid: string;
    employeeNameSnapshot: string;
    employeeEmailSnapshot?: string;
    functionGroup: SSMATargetFunctionGroup;
    roleSnapshot: SSMARole;
    metaIFS: number;
    metaAlojamento: number;
    metaHotel: number;
    active: boolean;
}

export interface SSMAChecklistItem {
    id: string; // ID gerado (ex: hash ou UUID baseado na descrição)
    inspectionType: string;
    category: string;
    ncClassification: string;
    description: string;
    validityStart?: string;
    validityEnd?: string;
}

export type SSMAInspectionItemStatus = 'CONFORME' | 'NAO_CONFORME' | 'NA' | 'PENDENTE';

export interface SSMAInspectionItemResult {
    itemId: string;
    status: SSMAInspectionItemStatus;
    comment: string;
    evidenceUrls: string[];
}

export interface SSMAInspectionEvent extends AuditableRecord {
    id: string;
    competence: string; // YYYY-MM
    date: string; // YYYY-MM-DD
    inspectionType: string; // Era 'IFS' | 'ALOJAMENTO', agora dinâmico
    regionalId: string;
    regionalNameSnapshot: string;
    costCenterId: string;
    costCenterCodeSnapshot: string;
    costCenterNameSnapshot: string;
    executorUid: string;
    executorNameSnapshot: string;
    executorEmailSnapshot?: string;
    executorFunctionGroup: SSMATargetFunctionGroup;
    executorRoleSnapshot: SSMARole;
    comments?: string; // Comentário geral (legado ou opcional)
    items?: SSMAInspectionItemResult[]; // Resultados granulares dos itens
    status: 'VALID' | 'CANCELLED';
    cancelledAt?: string;
    cancelledBy?: string;
    cancelledByNameSnapshot?: string;
    cancelReason?: string;
}

export interface SSMAEvidence {
    id: string;
    inspectionEventId: string;
    competence: string;
    regionalId: string;
    costCenterId: string;
    storagePath: string;
    downloadUrl: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    uploadedBy: string;
    uploadedByNameSnapshot: string;
    active: boolean;
}

export interface SSMAMonthlyPersonResult {
    id: string; // competence_employeeUid
    competence: string;
    employeeUid: string;
    employeeNameSnapshot: string;
    functionGroup: SSMATargetFunctionGroup;
    realIFS: number;
    realAlojamento: number;
    realHotel: number;
    realTotal: number;
    metaIFS: number;
    metaAlojamento: number;
    metaHotel: number;
    metaTotal: number;
    resultadoIndividual: number | null;
    status: 'SEM_META' | 'ATENDE' | 'NAO_ATENDE' | 'REALIZADO_SEM_META';
    recalculatedAt: string;
}

export interface SSMAMonthlyCollectiveResult {
    id: string; // competence_scopeType[_regionalId|_costCenterId]
    competence: string;
    scopeType: 'ALL' | 'REGIONAL' | 'COST_CENTER';
    regionalId?: string;
    costCenterId?: string;
    realIFS_GREG: number;
    realAloj_GREG: number;
    realHotel_GREG: number;
    realIFS_GESTOR: number;
    realAloj_GESTOR: number;
    realHotel_GESTOR: number;
    realIFS_SUPSSMA: number;
    realAloj_SUPSSMA: number;
    realHotel_SUPSSMA: number;
    realIFS_TST: number;
    realAloj_TST: number;
    realHotel_TST: number;
    realIFS_ENCARREGADO: number;
    realAloj_ENCARREGADO: number;
    realHotel_ENCARREGADO: number;
    metaIFS_GREG: number;
    metaAloj_GREG: number;
    metaHotel_GREG: number;
    metaIFS_GESTOR: number;
    metaAloj_GESTOR: number;
    metaHotel_GESTOR: number;
    metaIFS_SUPSSMA: number;
    metaAloj_SUPSSMA: number;
    metaHotel_SUPSSMA: number;
    metaIFS_TST: number;
    metaAloj_TST: number;
    metaHotel_TST: number;
    metaIFS_ENCARREGADO: number;
    metaAloj_ENCARREGADO: number;
    metaHotel_ENCARREGADO: number;
    totalRealizado: number;
    totalMeta: number;
    resultadoColetivo: number | null;
    recalculatedAt: string;
}

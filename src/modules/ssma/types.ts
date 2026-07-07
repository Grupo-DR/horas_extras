// src/modules/ssma/types.ts

export type SSMAInspectionType = 'IFS' | 'ALOJAMENTO';

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

export interface SSMAEmployee extends AuditableRecord {
    id: string;
    uid?: string;
    name: string;
    email?: string;
    functionGroup: SSMAFunctionGroup;
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

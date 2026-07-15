import { SSMAEvidence, SSMAInspectionEvent, SSMAInspectionType, SSMATargetFunctionGroup } from '../types';

export const SSMA_ALLOWED_EVIDENCE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const SSMA_MAX_EVIDENCE_SIZE_BYTES = 10 * 1024 * 1024;

const VALID_INSPECTION_TYPES: SSMAInspectionType[] = ['IFS', 'ALOJAMENTO'];
const VALID_FUNCTION_GROUPS: SSMATargetFunctionGroup[] = ['GREG', 'GESTOR', 'SUPSSMA', 'TST', 'ENCARREGADO'];

export const isValidCompetence = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export const isValidISODate = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value);

export const isValidInspectionType = (value: string): value is SSMAInspectionType => {
    return VALID_INSPECTION_TYPES.includes(value as SSMAInspectionType);
};

export const isValidTargetFunctionGroup = (value: string): value is SSMATargetFunctionGroup => {
    return VALID_FUNCTION_GROUPS.includes(value as SSMATargetFunctionGroup);
};

export const validateNonNegativeMeta = (value: number, label = 'Meta'): void => {
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${label} deve ser um numero nao negativo.`);
    }
};

export const validateInspectionEventInput = (
    event: Pick<SSMAInspectionEvent, 'competence' | 'date' | 'inspectionType' | 'regionalId' | 'costCenterId' | 'executorUid' | 'executorFunctionGroup' | 'status'>
): void => {
    if (!isValidCompetence(event.competence)) throw new Error('Competencia invalida. Use YYYY-MM.');
    if (!isValidISODate(event.date)) throw new Error('Data invalida. Use YYYY-MM-DD.');
    if (!event.inspectionType) throw new Error('Tipo de inspecao invalido.');
    if (!event.regionalId) throw new Error('Regional obrigatoria.');
    if (!event.costCenterId) throw new Error('Centro de custo obrigatorio.');
    if (!event.executorUid) throw new Error('Executor obrigatorio.');
    if (!isValidTargetFunctionGroup(event.executorFunctionGroup)) throw new Error('Grupo de meta do executor invalido.');
    if (!['VALID', 'CANCELLED'].includes(event.status)) throw new Error('Status do lancamento invalido.');
};

export const validateMonthlyTargetInput = (target: {
    competence: string;
    employeeUid: string;
    functionGroup: SSMATargetFunctionGroup;
    metaIFS: number;
    metaAlojamento: number;
    metaHotel: number;
}): void => {
    if (!isValidCompetence(target.competence)) throw new Error('Competencia invalida. Use YYYY-MM.');
    if (!target.employeeUid) throw new Error('Colaborador obrigatorio.');
    if (!isValidTargetFunctionGroup(target.functionGroup)) throw new Error('Grupo de meta invalido.');
    validateNonNegativeMeta(target.metaIFS, 'Meta IFS');
    validateNonNegativeMeta(target.metaAlojamento, 'Meta Alojamento');
    validateNonNegativeMeta(target.metaHotel, 'Meta Hotel');
};

export const validateCancelReason = (reason: string): void => {
    if (!reason.trim()) throw new Error('Informe o motivo do cancelamento.');
};

export const validateEvidenceFile = (file: Pick<File, 'type' | 'size'>): void => {
    if (!SSMA_ALLOWED_EVIDENCE_MIME_TYPES.includes(file.type)) {
        throw new Error('Tipo de arquivo nao permitido. Use JPEG, PNG, WEBP ou PDF.');
    }
    if (file.size > SSMA_MAX_EVIDENCE_SIZE_BYTES) {
        throw new Error('Arquivo acima do limite de 10MB.');
    }
};

export const validateEvidenceMetadata = (
    evidence: Pick<SSMAEvidence, 'inspectionEventId' | 'competence' | 'regionalId' | 'costCenterId' | 'mimeType' | 'sizeBytes' | 'storagePath'>
): void => {
    if (!evidence.inspectionEventId) throw new Error('Evento da evidencia obrigatorio.');
    if (!isValidCompetence(evidence.competence)) throw new Error('Competencia da evidencia invalida.');
    if (!evidence.regionalId) throw new Error('Regional da evidencia obrigatoria.');
    if (!evidence.costCenterId) throw new Error('Centro de custo da evidencia obrigatorio.');
    validateEvidenceFile({ type: evidence.mimeType, size: evidence.sizeBytes } as File);
    if (!evidence.storagePath.startsWith(`ssma/evidences/${evidence.competence}/${evidence.regionalId}/${evidence.costCenterId}/`)) {
        throw new Error('Caminho da evidencia fora do padrao SSMA.');
    }
};

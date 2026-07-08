import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../../../services/firebaseConfig';
import { UserProfileDoc } from '../../iam/types';
import { validateEvidenceFile, validateEvidenceMetadata } from '../domain/validators';
import { SSMAEvidence, SSMAInspecaoEvidencia, SSMAInspection, SSMAInspectionEvent } from '../types';
import { ssmaEvidenceMetadataService } from './ssmaEvidenceMetadataService';
import { ssmaInspectionService } from './ssmaInspectionService';

const safeStorageFileName = (fileName: string): string => {
    return `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
};

export const ssmaEvidenceService = {
    uploadInspectionEventEvidence: async (
        event: SSMAInspectionEvent,
        file: File,
        currentUser: UserProfileDoc
    ): Promise<SSMAEvidence> => {
        if (!currentUser || (!currentUser.isSuperAdmin && !currentUser.modules?.ssma?.enabled)) {
            throw new Error('Usuario sem acesso ao modulo SSMA.');
        }
        validateEvidenceFile(file);

        const storagePath = `ssma/evidences/${event.competence}/${event.regionalId}/${event.costCenterId}/${event.id}/${safeStorageFileName(file.name)}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, file, {
            contentType: file.type,
            customMetadata: {
                inspectionEventId: event.id,
                competence: event.competence,
                regionalId: event.regionalId,
                costCenterId: event.costCenterId,
                uploadedBy: currentUser.uid
            }
        });

        const downloadUrl = await getDownloadURL(storageRef);
        const metadata = {
            inspectionEventId: event.id,
            competence: event.competence,
            regionalId: event.regionalId,
            costCenterId: event.costCenterId,
            storagePath,
            downloadUrl,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size
        };
        validateEvidenceMetadata(metadata);

        const evidenceId = await ssmaEvidenceMetadataService.create(metadata, currentUser);
        const evidence = await ssmaEvidenceMetadataService.getById(evidenceId);
        if (!evidence) throw new Error('Metadados da evidencia nao encontrados apos upload.');
        return evidence;
    },

    /**
     * Legacy adapter for ssma_inspections. The Sprint 3+ operational flow must use
     * uploadInspectionEventEvidence and ssma_evidences metadata instead.
     */
    uploadEvidence: async (
        inspectionId: string,
        file: File,
        evidenciaData: Omit<SSMAInspecaoEvidencia, 'id' | 'fotoUrl'>,
        currentUser: UserProfileDoc
    ): Promise<SSMAInspecaoEvidencia> => {
        if (!currentUser || (!currentUser.isSuperAdmin && !currentUser.modules?.ssma?.enabled)) {
            throw new Error('Usuario sem acesso ao modulo SSMA.');
        }
        validateEvidenceFile(file);

        const inspection = await ssmaInspectionService.getById(inspectionId);
        if (!inspection) throw new Error('Registro mensal legado nao encontrado.');

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const storagePath = `ssma/evidences/legacy/${year}-${month}/${inspection.cc}/${inspection.id}/${safeStorageFileName(file.name)}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file, { contentType: file.type });
        const downloadUrl = await getDownloadURL(storageRef);

        const newEvidencia: SSMAInspecaoEvidencia = {
            ...evidenciaData,
            id: `ev_${Date.now()}`,
            fotoUrl: downloadUrl
        };

        const updatedEvidencias = [...(inspection.evidencias || []), newEvidencia];
        const updateData: Partial<SSMAInspection> = {
            evidencias: updatedEvidencias
        };

        await ssmaInspectionService.update(inspection.id, updateData, currentUser);
        return newEvidencia;
    }
};

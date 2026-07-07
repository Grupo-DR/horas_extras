import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../../services/firebaseConfig';
import { SSMAInspection, SSMAInspecaoEvidencia } from '../types';
import { UserProfileDoc } from '../../iam/types';
import { ssmaInspectionService } from './ssmaInspectionService';
import { ssmaAuditService } from './ssmaAuditService';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ssmaEvidenceService = {
    uploadEvidence: async (
        inspectionId: string,
        file: File,
        evidenciaData: Omit<SSMAInspecaoEvidencia, 'id' | 'fotoUrl'>,
        currentUser: UserProfileDoc
    ): Promise<SSMAInspecaoEvidencia> => {
        // 1. Validar usuário autenticado
        if (!currentUser || !currentUser.modules?.ssma?.enabled) {
            throw new Error('Usuário sem acesso ao módulo SSMA.');
        }

        // 2. Validar evento
        const inspection = await ssmaInspectionService.getById(inspectionId);
        if (!inspection) throw new Error('Registro mensal de inspeção não encontrado.');

        // 3. Validar arquivo
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            throw new Error('Tipo de arquivo não permitido. Apenas JPEG, PNG, WEBP e PDF são aceitos.');
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            throw new Error('Arquivo excede o limite de 10MB.');
        }

        // 4. Gerar storage path e enviar
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storagePath = `ssma/evidences/${year}/${month}/${inspection.cc}/${inspection.id}/${safeFileName}`;

        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        // 5. Atualizar array no evento original
        const newEvidencia: SSMAInspecaoEvidencia = {
            ...evidenciaData,
            id: `ev_${Date.now()}`,
            fotoUrl: downloadUrl
        };

        const updatedEvidencias = [...(inspection.evidencias || []), newEvidencia];
        
        // Em vez de só atualizar o array, precisamos incrementar os "realizados"
        const updateData: Partial<SSMAInspection> = {
            evidencias: updatedEvidencias
        };

        // Incrementadores automáticos
        if (evidenciaData.executorRole === 'Gerente Regional' || evidenciaData.executorRole === 'Engenheiro de Obra') {
            if (evidenciaData.tipo === 'IFS') updateData.realizadoGestorIFS = (inspection.realizadoGestorIFS || 0) + 1;
            if (evidenciaData.tipo === 'Alojamento') updateData.realizadoGestorAlojamento = (inspection.realizadoGestorAlojamento || 0) + 1;
        } else if (evidenciaData.executorRole === 'Encarregado') {
            if (evidenciaData.tipo === 'IFS') updateData.realizadoEncarregadoIFS = (inspection.realizadoEncarregadoIFS || 0) + 1;
            if (evidenciaData.tipo === 'Alojamento') updateData.realizadoEncarregadoAlojamento = (inspection.realizadoEncarregadoAlojamento || 0) + 1;
        } else if (evidenciaData.executorRole === 'Supervisor de SSMA') {
            if (evidenciaData.tipo === 'IFS') updateData.realizadoSupssmaIFS = (inspection.realizadoSupssmaIFS || 0) + 1;
            if (evidenciaData.tipo === 'Alojamento') updateData.realizadoSupssmaAlojamento = (inspection.realizadoSupssmaAlojamento || 0) + 1;
        } else if (evidenciaData.executorRole === 'Técnico de Segurança') {
            if (evidenciaData.tipo === 'IFS') updateData.realizadoTstIFS = (inspection.realizadoTstIFS || 0) + 1;
            if (evidenciaData.tipo === 'Alojamento') updateData.realizadoTstAlojamento = (inspection.realizadoTstAlojamento || 0) + 1;
        }

        await ssmaInspectionService.update(inspection.id, updateData, currentUser.uid, currentUser.displayName);

        return newEvidencia;
    }
};

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../../services/firebaseConfig';
import { SSMAInspection, SSMAInspectionEvent, SSMAEvidence, SSMAMonthlyTarget } from '../types';
import { UserProfileDoc } from '../../iam/types';
import { ssmaEmployeeService } from './ssmaEmployeeService';
import { ssmaInspectionService } from './ssmaInspectionService';
import { ssmaInspectionEventService } from './ssmaInspectionEventService';
import { ssmaEvidenceMetadataService } from './ssmaEvidenceMetadataService';
import { ssmaMonthlyTargetService } from './ssmaMonthlyTargetService';
import { getCompetenceFromDate, mapRoleToFunctionGroup } from '../domain/calculateSSMAResults';
import { SSMARole } from '../../iam/types';

// Map Portuguese Month Names to numbers for competence
const MONTH_MAP: Record<string, string> = {
    'Janeiro': '01',
    'Fevereiro': '02',
    'Março': '03',
    'Abril': '04',
    'Maio': '05',
    'Junho': '06',
    'Julho': '07',
    'Agosto': '08',
    'Setembro': '09',
    'Outubro': '10',
    'Novembro': '11',
    'Dezembro': '12'
};

const getMonthNumber = (name: string): string => {
    return MONTH_MAP[name] || '01';
};

export const ssmaMigrationService = {
    migrateLegacyInspections: async (currentUser: UserProfileDoc): Promise<{ eventsCreated: number, targetsCreated: number }> => {
        // 1. Fetch all employees to resolve names to uids and roles
        const employees = await ssmaEmployeeService.list();
        const employeeMap = new Map<string, typeof employees[0]>();
        employees.forEach(e => {
            employeeMap.set(e.name.trim().toLowerCase(), e);
        });

        // 2. Fetch all legacy inspections
        const legacyInspections = await ssmaInspectionService.list();
        
        let eventsCreated = 0;
        let targetsCreated = 0;

        // 3. For each legacy inspection
        for (const inspection of legacyInspections) {
            const competence = `${inspection.ano}-${getMonthNumber(inspection.mes)}`;

            // Create target models for the managers/technicians assigned to this inspection if they exist
            const rolesToProcess: { name: string, role: SSMARole, targetIFS: number, targetAloj: number }[] = [
                { name: inspection.gestor, role: 'SSMA_SITE_MANAGER', targetIFS: inspection.metaGestorIFS || 1, targetAloj: inspection.metaGestorAlojamento || 1 },
                { name: inspection.encarregado, role: 'SSMA_FOREMAN', targetIFS: inspection.metaEncarregadoIFS || 20, targetAloj: inspection.metaEncarregadoAlojamento || 1 },
                { name: inspection.supssma, role: 'SSMA_SUPERVISOR', targetIFS: inspection.metaSupssmaIFS || 1, targetAloj: inspection.metaSupssmaAlojamento || 1 },
                { name: inspection.tst, role: 'SSMA_TECHNICIAN', targetIFS: inspection.metaTstIFS || 1, targetAloj: inspection.metaTstAlojamento || 1 }
            ];

            for (const item of rolesToProcess) {
                if (!item.name || item.name === 'Não atribuído') continue;
                
                const emp = employeeMap.get(item.name.trim().toLowerCase());
                const uid = emp?.uid || `legacy_uid_${item.name.replace(/\s+/g, '_')}`;

                // Check if target already exists for this competence and uid
                const existingTarget = await ssmaMonthlyTargetService.getTargetByEmployeeAndCompetence(uid, competence);
                if (!existingTarget) {
                    const functionGroup = mapRoleToFunctionGroup(item.role);
                    await ssmaMonthlyTargetService.upsertTarget({
                        competence,
                        employeeUid: uid,
                        employeeNameSnapshot: item.name,
                        employeeEmailSnapshot: emp?.email || '',
                        functionGroup,
                        roleSnapshot: item.role,
                        metaIFS: item.targetIFS,
                        metaAlojamento: item.targetAloj,
                        metaHotel: 0,
                        active: true
                    }, currentUser);
                    targetsCreated++;
                }
            }

            // Convert legacy evidence list to events
            if (inspection.evidencias && inspection.evidencias.length > 0) {
                for (const evidence of inspection.evidencias) {
                    const emp = employeeMap.get(evidence.executorNome.trim().toLowerCase());
                    const uid = emp?.uid || `legacy_uid_${evidence.executorNome.replace(/\s+/g, '_')}`;
                    
                    let role: SSMARole = 'SSMA_TECHNICIAN';
                    if (evidence.executorRole === 'Gerente Regional') role = 'SSMA_REGIONAL_MANAGER';
                    else if (evidence.executorRole === 'Engenheiro de Obra') role = 'SSMA_SITE_MANAGER';
                    else if (evidence.executorRole === 'Supervisor de SSMA') role = 'SSMA_SUPERVISOR';
                    else if (evidence.executorRole === 'Técnico de Segurança') role = 'SSMA_TECHNICIAN';
                    else if (evidence.executorRole === 'Encarregado') role = 'SSMA_FOREMAN';

                    const functionGroup = mapRoleToFunctionGroup(role);

                    // Create inspection event
                    const eventId = await ssmaInspectionEventService.createEvent({
                        competence,
                        date: evidence.data || `${inspection.ano}-${getMonthNumber(inspection.mes)}-01`,
                        inspectionType: evidence.tipo === 'IFS' ? 'IFS' : 'ALOJAMENTO',
                        regionalId: emp?.regionalId || 'legacy_regional',
                        regionalNameSnapshot: inspection.greg || 'Regional 01',
                        costCenterId: emp?.costCenterId || 'legacy_cc',
                        costCenterCodeSnapshot: inspection.cc,
                        costCenterNameSnapshot: `Obra ${inspection.cc}`,
                        executorUid: uid,
                        executorNameSnapshot: evidence.executorNome,
                        executorEmailSnapshot: emp?.email || '',
                        executorFunctionGroup: functionGroup,
                        executorRoleSnapshot: role,
                        comments: evidence.comentario || '',
                        status: 'VALID'
                    }, currentUser);

                    eventsCreated++;

                    // Create evidence metadata
                    if (evidence.fotoUrl) {
                        await ssmaEvidenceMetadataService.create({
                            inspectionEventId: eventId,
                            competence,
                            regionalId: emp?.regionalId || 'legacy_regional',
                            costCenterId: emp?.costCenterId || 'legacy_cc',
                            storagePath: evidence.fotoUrl.startsWith('http') ? evidence.fotoUrl : 'legacy_storage_path',
                            downloadUrl: evidence.fotoUrl,
                            fileName: `legacy_photo_${Date.now()}.jpg`,
                            mimeType: 'image/jpeg',
                            sizeBytes: 0
                        }, currentUser);
                    }
                }
            }
        }

        return { eventsCreated, targetsCreated };
    }
};

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { UserProfileDoc } from '../../../iam/types';
import { canEditEvent, canSelectExecutor } from '../../domain/permissions';
import {
    deriveCompetenceFromDate,
    employeeFunctionGroupToTargetGroup,
    roleToTargetFunctionGroup,
    ssmaRoleLabel
} from '../../domain/inspectionEventHelpers';
import { CreateSSMAInspectionEventInput } from '../../hooks/useCreateSSMAInspectionEvent';
import { validateSSMAEvidenceFile } from '../../hooks/useSSMAEvidenceUpload';
import { SSMACostCenter, SSMAEmployee, SSMAInspectionEvent, SSMAInspectionType, SSMARegional } from '../../types';
import { EvidenceUploadPanel } from './EvidenceUploadPanel';

interface Props {
    open: boolean;
    event?: SSMAInspectionEvent | null;
    profile: UserProfileDoc | null;
    regionals: SSMARegional[];
    costCenters: SSMACostCenter[];
    employees: SSMAEmployee[];
    submitting: boolean;
    onClose: () => void;
    onSubmit: (input: CreateSSMAInspectionEventInput, files: File[], originalEvent?: SSMAInspectionEvent | null) => Promise<void>;
    onEvidenceChanged?: () => void;
}

interface ExecutorOption {
    uid: string;
    name: string;
    email?: string;
    role: string;
    functionGroup: CreateSSMAInspectionEventInput['executorFunctionGroup'];
}

const today = () => new Date().toISOString().slice(0, 10);

const getEmployeeRole = (employee: SSMAEmployee): string => {
    return (employee as any).roleSnapshot || 'SSMA_TECHNICIAN';
};

const isEmployeeInRegional = (
    employee: SSMAEmployee,
    regionalId: string,
    costCenters: SSMACostCenter[]
): boolean => {
    if (employee.regionalIds?.includes(regionalId)) return true;
    const employeeCostCenters = new Set(employee.costCenterIds || []);
    return costCenters.some(costCenter => {
        if (costCenter.regionalId !== regionalId) return false;
        return (
            employeeCostCenters.has(costCenter.id) ||
            costCenter.engenheiroId === employee.id ||
            costCenter.supervisorId === employee.id ||
            costCenter.tstIds?.includes(employee.id) ||
            costCenter.encarregadoIds?.includes(employee.id)
        );
    });
};

export const InspectionEventFormModal: React.FC<Props> = ({
    open,
    event,
    profile,
    regionals,
    costCenters,
    employees,
    submitting,
    onClose,
    onSubmit,
    onEvidenceChanged
}) => {
    const [date, setDate] = useState(today());
    const [regionalId, setRegionalId] = useState('');
    const [costCenterId, setCostCenterId] = useState('');
    const [inspectionType, setInspectionType] = useState<SSMAInspectionType>('IFS');
    const [executorUid, setExecutorUid] = useState('');
    const [comments, setComments] = useState('');
    const [files, setFiles] = useState<File[]>([]);

    const competence = deriveCompetenceFromDate(date);
    const canChooseExecutor = canSelectExecutor(profile);
    const ssmaRole = profile?.modules?.ssma?.role || 'SSMA_VIEWER';

    useEffect(() => {
        if (!open) return;
        setDate(event?.date || today());
        setRegionalId(event?.regionalId || regionals[0]?.id || '');
        setCostCenterId(event?.costCenterId || '');
        setInspectionType(event?.inspectionType || 'IFS');
        setExecutorUid(event?.executorUid || profile?.uid || '');
        setComments(event?.comments || '');
        setFiles([]);
    }, [event, open, profile?.uid, regionals]);

    const filteredCostCenters = useMemo(() => {
        return costCenters.filter(costCenter => !regionalId || costCenter.regionalId === regionalId);
    }, [costCenters, regionalId]);

    useEffect(() => {
        if (!open) return;
        if (costCenterId && filteredCostCenters.some(costCenter => costCenter.id === costCenterId)) return;
        setCostCenterId(filteredCostCenters[0]?.id || '');
    }, [costCenterId, filteredCostCenters, open]);

    const selectedRegional = regionals.find(regional => regional.id === regionalId);
    const selectedCostCenter = costCenters.find(costCenter => costCenter.id === costCenterId);

    const executorOptions = useMemo<ExecutorOption[]>(() => {
        if (!profile) return [];

        if (!canChooseExecutor) {
            return [{
                uid: profile.uid,
                name: profile.displayName || profile.email,
                email: profile.email,
                role: ssmaRole,
                functionGroup: roleToTargetFunctionGroup(ssmaRole)
            }];
        }

        const activeEmployees = employees.filter(employee => employee.active !== false && employee.uid);
        const scopedEmployees = ssmaRole === 'SSMA_REGIONAL_MANAGER'
            ? activeEmployees.filter(employee => regionalId && isEmployeeInRegional(employee, regionalId, costCenters))
            : activeEmployees;

        const options = scopedEmployees.map(employee => ({
            uid: employee.uid || employee.id,
            name: employee.name,
            email: employee.email,
            role: getEmployeeRole(employee),
            functionGroup: employeeFunctionGroupToTargetGroup(employee)
        }));

        if (event && !options.some(option => option.uid === event.executorUid)) {
            options.push({
                uid: event.executorUid,
                name: event.executorNameSnapshot,
                email: event.executorEmailSnapshot,
                role: event.executorRoleSnapshot,
                functionGroup: event.executorFunctionGroup
            });
        }

        return options;
    }, [canChooseExecutor, costCenters, employees, event, profile, regionalId, ssmaRole]);

    useEffect(() => {
        if (!open || !executorOptions.length) return;
        if (executorOptions.some(option => option.uid === executorUid)) return;
        setExecutorUid(executorOptions[0].uid);
    }, [executorOptions, executorUid, open]);

    if (!open) return null;

    const selectedExecutor = executorOptions.find(option => option.uid === executorUid);
    const isCancelled = event?.status === 'CANCELLED';
    const readOnly = !!event && !canEditEvent(profile, event);

    const handleSubmit = async (submitEvent: React.FormEvent) => {
        submitEvent.preventDefault();
        if (!selectedRegional || !selectedCostCenter || !selectedExecutor) return;
        const invalidFile = files.map(validateSSMAEvidenceFile).find(Boolean);
        if (invalidFile) {
            toast.error(invalidFile);
            return;
        }

        await onSubmit({
            competence,
            date,
            inspectionType,
            regionalId: selectedRegional.id,
            regionalNameSnapshot: selectedRegional.name,
            costCenterId: selectedCostCenter.id,
            costCenterCodeSnapshot: selectedCostCenter.code,
            costCenterNameSnapshot: selectedCostCenter.name,
            executorUid: selectedExecutor.uid,
            executorNameSnapshot: selectedExecutor.name,
            executorEmailSnapshot: selectedExecutor.email || '',
            executorFunctionGroup: selectedExecutor.functionGroup,
            executorRoleSnapshot: selectedExecutor.role as any,
            comments: comments.trim(),
            status: event?.status || 'VALID'
        }, files, event);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">{event ? 'Editar lancamento' : 'Novo lancamento'}</h3>
                        <p className="text-sm text-gray-500">Evento real com executor, obra e evidencias separadas.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded p-2 text-gray-500 hover:bg-gray-100" title="Fechar">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1">
                            <span className="text-sm font-medium text-gray-700">Data do lancamento</span>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={readOnly || isCancelled} required className="h-10 w-full rounded border border-gray-300 px-3 text-sm" />
                        </label>
                        <label className="space-y-1">
                            <span className="text-sm font-medium text-gray-700">Competencia</span>
                            <input type="text" value={competence} readOnly className="h-10 w-full rounded border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600" />
                        </label>
                        <label className="space-y-1">
                            <span className="text-sm font-medium text-gray-700">Regional</span>
                            <select value={regionalId} onChange={e => setRegionalId(e.target.value)} disabled={readOnly || isCancelled} required className="h-10 w-full rounded border border-gray-300 px-3 text-sm">
                                {regionals.map(regional => <option key={regional.id} value={regional.id}>{regional.name}</option>)}
                            </select>
                        </label>
                        <label className="space-y-1">
                            <span className="text-sm font-medium text-gray-700">Obra / Centro de custo</span>
                            <select value={costCenterId} onChange={e => setCostCenterId(e.target.value)} disabled={readOnly || isCancelled} required className="h-10 w-full rounded border border-gray-300 px-3 text-sm">
                                {filteredCostCenters.map(costCenter => <option key={costCenter.id} value={costCenter.id}>{costCenter.code} - {costCenter.name}</option>)}
                            </select>
                        </label>
                        <label className="space-y-1">
                            <span className="text-sm font-medium text-gray-700">Tipo de inspecao</span>
                            <select value={inspectionType} onChange={e => setInspectionType(e.target.value as SSMAInspectionType)} disabled={readOnly || isCancelled} required className="h-10 w-full rounded border border-gray-300 px-3 text-sm">
                                <option value="IFS">IFS</option>
                                <option value="ALOJAMENTO">ALOJAMENTO</option>
                            </select>
                        </label>
                        <label className="space-y-1">
                            <span className="text-sm font-medium text-gray-700">Executor</span>
                            <select value={executorUid} onChange={e => setExecutorUid(e.target.value)} disabled={!canChooseExecutor || readOnly || isCancelled} required className="h-10 w-full rounded border border-gray-300 px-3 text-sm">
                                {executorOptions.map(option => (
                                    <option key={option.uid} value={option.uid}>{option.name} - {ssmaRoleLabel(option.role)}</option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1 md:col-span-2">
                            <span className="text-sm font-medium text-gray-700">Comentario</span>
                            <textarea value={comments} onChange={e => setComments(e.target.value)} disabled={readOnly || isCancelled} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                        </label>
                        {!event && (
                            <label className="space-y-1 md:col-span-2">
                                <span className="text-sm font-medium text-gray-700">Evidencias</span>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/jpeg,image/png,image/webp,application/pdf"
                                    onChange={e => setFiles(Array.from(e.target.files || []))}
                                    className="block w-full rounded border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                                />
                                <p className="text-xs text-gray-500">Os arquivos serao enviados ao Storage apos criar o lancamento.</p>
                            </label>
                        )}
                    </div>

                    {event && (
                        <div className="mt-5 border-t border-gray-200 pt-4">
                            <EvidenceUploadPanel event={event} canManage={!readOnly && !isCancelled} onChanged={onEvidenceChanged} />
                        </div>
                    )}

                    <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
                        <button type="button" onClick={onClose} className="h-10 rounded border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
                        <button type="submit" disabled={submitting || readOnly || isCancelled} className="h-10 rounded bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50">
                            {submitting ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

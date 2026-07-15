import React, { useEffect, useMemo, useState } from 'react';
import { X, Camera, Trash2, Info } from 'lucide-react';
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
import { SSMACostCenter, SSMAEmployee, SSMAInspectionEvent, SSMARegional, SSMAInspectionItemStatus } from '../../types';
import { EvidenceUploadPanel } from './EvidenceUploadPanel';
import { useSSMAStore } from '../../store/useSSMAStore';
import { useSSMAFormStore, FormItemState } from '../../store/useSSMAFormStore';

export interface FormSubmitData {
    input: CreateSSMAInspectionEventInput;
    generalFiles: File[];
    itemFiles: { itemId: string; files: File[] }[];
}

interface Props {
    open: boolean;
    event?: SSMAInspectionEvent | null;
    profile: UserProfileDoc | null;
    regionals: SSMARegional[];
    costCenters: SSMACostCenter[];
    employees: SSMAEmployee[];
    submitting: boolean;
    onClose: () => void;
    onSubmit: (data: FormSubmitData, originalEvent?: SSMAInspectionEvent | null) => Promise<void>;
    onEvidenceChanged?: () => void;
    forceReadOnly?: boolean;
}

interface ExecutorOption {
    uid: string;
    name: string;
    email?: string;
    role: string;
    functionGroup: CreateSSMAInspectionEventInput['executorFunctionGroup'];
}

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
    onEvidenceChanged,
    forceReadOnly
}) => {
    const { inspectionTypes, getItemsByType, fetchChecklist } = useSSMAStore();
    const store = useSSMAFormStore();
    const [generalFiles, setGeneralFiles] = useState<File[]>([]);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    useEffect(() => {
        if (open) fetchChecklist();
    }, [open, fetchChecklist]);

    const canChooseExecutor = canSelectExecutor(profile);
    const ssmaRole = profile?.modules?.ssma?.role || 'SSMA_VIEWER';

    useEffect(() => {
        if (!open) return;
        store.resetForm();
        setGeneralFiles([]);
        
        if (event) {
            store.setDate(event.date);
            store.setCostCenterId(event.costCenterId);
            store.setInspectionType(event.inspectionType);
            store.setExecutorUid(event.executorUid);
            store.setComments(event.comments || '');
            
            if (event.items) {
                const initItems: Record<string, FormItemState> = {};
                event.items.forEach(i => {
                    initItems[i.itemId] = { status: i.status, comment: i.comment, files: [] };
                });
                useSSMAFormStore.setState({ items: initItems });
            }
        } else {
            store.setExecutorUid(profile?.uid || '');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, event, profile?.uid]);

    const competence = deriveCompetenceFromDate(store.date);
    const selectedCostCenter = costCenters.find(cc => cc.id === store.costCenterId);
    const regionalId = selectedCostCenter?.regionalId || '';
    const selectedRegional = regionals.find(r => r.id === regionalId);

    useEffect(() => {
        if (!open || event || !store.inspectionType) return;
        const currentItems = getItemsByType(store.inspectionType);
        store.initializeForType(currentItems.map(i => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store.inspectionType, open, event]);

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
        if (executorOptions.some(option => option.uid === store.executorUid)) return;
        store.setExecutorUid(executorOptions[0].uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [executorOptions, open]);

    useEffect(() => {
        if (!open) return;
        if (store.costCenterId && costCenters.some(c => c.id === store.costCenterId)) return;
        store.setCostCenterId(costCenters[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [costCenters, open]);

    if (!open) return null;

    const selectedExecutor = executorOptions.find(option => option.uid === store.executorUid);
    const isCancelled = event?.status === 'CANCELLED';
    const readOnly = forceReadOnly || (!!event && !canEditEvent(profile, event));
    const dynamicTypes = inspectionTypes();

    const handleSubmit = async (submitEvent: React.FormEvent) => {
        submitEvent.preventDefault();
        if (!selectedRegional || !selectedCostCenter || !selectedExecutor || !store.inspectionType) {
            toast.error('Preencha os campos obrigatórios.');
            return;
        }

        const eventItems = getItemsByType(store.inspectionType);
        const results: any[] = [];
        const itemFiles: { itemId: string; files: File[] }[] = [];

        // Validate items and files
        for (const file of generalFiles) {
            const err = validateSSMAEvidenceFile(file);
            if (err) { toast.error(err); return; }
        }

        for (const item of eventItems) {
            const state = store.items[item.id];
            if (state && state.status) {
                if (state.status === 'NAO_CONFORME' && !state.comment.trim()) {
                    toast.error(`Item não conforme requer comentário: ${item.description}`);
                    return;
                }
                
                for (const f of state.files) {
                    const err = validateSSMAEvidenceFile(f);
                    if (err) { toast.error(`Arquivo inválido em ${item.description}: ${err}`); return; }
                }

                results.push({
                    itemId: item.id,
                    status: state.status,
                    comment: state.comment,
                    evidenceUrls: event?.items?.find(i => i.itemId === item.id)?.evidenceUrls || []
                });

                if (state.files.length > 0) {
                    itemFiles.push({ itemId: item.id, files: state.files });
                }
            }
        }

        const input: CreateSSMAInspectionEventInput = {
            competence,
            date: store.date,
            inspectionType: store.inspectionType,
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
            comments: store.comments.trim(),
            status: event?.status || 'VALID',
            items: results
        };

        await onSubmit({ input, generalFiles, itemFiles }, event);
    };

    const checklistItems = getItemsByType(store.inspectionType);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
            <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5 bg-slate-50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">{event ? 'Visualizar Inspeção' : 'Nova Inspeção'}</h3>
                        <p className="text-sm text-slate-500">Responda aos itens dinamicamente de acordo com o tipo.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-6 space-y-8">
                    
                    {/* Header Info Grid */}
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                        <label className="space-y-1.5">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Data</span>
                            <input type="date" value={store.date} onChange={e => store.setDate(e.target.value)} disabled={readOnly || isCancelled} required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Competência</span>
                            <input type="text" value={competence} readOnly className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none" />
                        </label>
                        <label className="space-y-1.5 lg:col-span-2">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Obra (CC)</span>
                            <select value={store.costCenterId} onChange={e => store.setCostCenterId(e.target.value)} disabled={readOnly || isCancelled} required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white">
                                <option value="" disabled>Selecione a obra...</option>
                                {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.code} - {cc.name}</option>)}
                            </select>
                            {selectedRegional && <p className="text-[10px] text-slate-500 mt-1">Regional inferida: {selectedRegional.name}</p>}
                        </label>

                        <label className="space-y-1.5 lg:col-span-2">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tipo de Inspeção</span>
                            <select value={store.inspectionType} onChange={e => store.setInspectionType(e.target.value)} disabled={readOnly || isCancelled} required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white">
                                <option value="" disabled>Selecione o tipo...</option>
                                {dynamicTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                {/* Fallbacks se lista vazia */}
                                {!dynamicTypes.length && <>
                                    <option value="IFS">IFS (Legado)</option>
                                    <option value="ALOJAMENTO">ALOJAMENTO (Legado)</option>
                                </>}
                            </select>
                        </label>

                        <label className="space-y-1.5 lg:col-span-2">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Executor</span>
                            <select value={store.executorUid} onChange={e => store.setExecutorUid(e.target.value)} disabled={!canChooseExecutor || readOnly || isCancelled} required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white">
                                {executorOptions.map(option => (
                                    <option key={option.uid} value={option.uid}>{option.name} - {ssmaRoleLabel(option.role)}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {/* Dynamic Checklist Items */}
                    {store.inspectionType && checklistItems.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-slate-200">
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                Itens de Inspeção
                                <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full">{checklistItems.length} itens</span>
                            </h4>
                            <div className="space-y-3">
                                {checklistItems.map((item, idx) => {
                                    const state = store.items[item.id] || { status: null, comment: '', files: [] };
                                    
                                    return (
                                        <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row gap-4 hover:border-slate-300 transition-colors">
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                                                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{item.category}</span>
                                                    {item.ncClassification !== 'N/A' && (
                                                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">Risco: {item.ncClassification}</span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium text-slate-800 leading-snug">{item.description}</p>
                                            </div>
                                            
                                            <div className="flex flex-col gap-3 min-w-[280px]">
                                                {/* Status Selector */}
                                                <div className="flex gap-1 bg-white p-1 rounded-md border border-slate-200">
                                                    {(['CONFORME', 'NAO_CONFORME', 'NA'] as const).map(status => (
                                                        <button
                                                            key={status}
                                                            type="button"
                                                            disabled={readOnly || isCancelled}
                                                            onClick={() => store.setItemStatus(item.id, status)}
                                                            className={`flex-1 text-xs font-bold py-1.5 rounded transition-all ${
                                                                state.status === status 
                                                                    ? (status === 'CONFORME' ? 'bg-emerald-500 text-white shadow-sm' : status === 'NAO_CONFORME' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-600 text-white shadow-sm')
                                                                    : 'text-slate-500 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            {status === 'NAO_CONFORME' ? 'NÃO CONF.' : status === 'NA' ? 'N/A' : 'CONFORME'}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Comment & Photos Toggle */}
                                                {(state.status === 'NAO_CONFORME' || state.comment || state.files.length > 0) && (
                                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <textarea 
                                                            placeholder={state.status === 'NAO_CONFORME' ? "Comentário (Obrigatório para NC)..." : "Comentário (Opcional)..."}
                                                            value={state.comment}
                                                            onChange={e => store.setItemComment(item.id, e.target.value)}
                                                            disabled={readOnly || isCancelled}
                                                            rows={2}
                                                            className={`w-full rounded-md border ${state.status === 'NAO_CONFORME' && !state.comment.trim() ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-blue-500'} px-3 py-2 text-xs outline-none transition-all resize-none`}
                                                        />
                                                        
                                                        {!readOnly && !isCancelled && (
                                                            <div className="flex items-center gap-2">
                                                                <label className="cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 bg-white border border-slate-200 rounded px-2 py-1.5 transition-colors">
                                                                    <Camera size={14} />
                                                                    <span>Anexar Fotos ({state.files.length}/3)</span>
                                                                    <input 
                                                                        type="file" 
                                                                        multiple 
                                                                        accept="image/*" 
                                                                        className="hidden" 
                                                                        onChange={e => {
                                                                            const newFiles = Array.from(e.target.files || []);
                                                                            if (state.files.length + newFiles.length > 3) {
                                                                                toast.error("Máximo de 3 fotos por item.");
                                                                                return;
                                                                            }
                                                                            store.setItemFiles(item.id, [...state.files, ...newFiles]);
                                                                            e.target.value = '';
                                                                        }}
                                                                    />
                                                                </label>
                                                                {state.files.length > 0 && (
                                                                    <button type="button" onClick={() => store.setItemFiles(item.id, [])} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded" title="Remover fotos">
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Visualizar Novas Fotos */}
                                                {state.files.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {state.files.map((f, i) => (
                                                            <div key={i} className="relative w-16 h-16 rounded overflow-hidden border border-slate-200 group">
                                                                <img src={URL.createObjectURL(f)} alt={`Nova Foto ${i+1}`} className="object-cover w-full h-full" />
                                                                <button type="button" onClick={() => {
                                                                    const nextFiles = [...state.files];
                                                                    nextFiles.splice(i, 1);
                                                                    store.setItemFiles(item.id, nextFiles);
                                                                }} className="absolute top-1 right-1 bg-white/80 rounded text-rose-600 hover:text-rose-800 p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Visualizar Evidence Existente */}
                                                {event && event.items && event.items.find(i => i.itemId === item.id)?.evidenceUrls?.length ? (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {event.items.find(i => i.itemId === item.id)?.evidenceUrls.map((url, i) => (
                                                            <div 
                                                                key={i}
                                                                onClick={() => setZoomedImage(url)}
                                                                className="relative cursor-pointer w-16 h-16 rounded overflow-hidden border border-slate-200 shadow-sm group bg-gray-100 flex items-center justify-center"
                                                            >
                                                                <img src={url} alt={`Foto ${i+1}`} className="object-cover w-full h-full group-hover:scale-110 transition-transform" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : null}

                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* General Comments */}
                    <div className="pt-4 border-t border-slate-200">
                        <label className="space-y-1.5">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                <Info size={14}/> Comentários Gerais
                            </span>
                            <textarea value={store.comments} onChange={e => store.setComments(e.target.value)} disabled={readOnly || isCancelled} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-none bg-slate-50" placeholder="Observações adicionais da inspeção..." />
                        </label>
                    </div>

                    {!event && (
                        <div className="pt-4 border-t border-slate-200">
                            <label className="space-y-1.5">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Evidências Gerais (Relatório PDF, etc)</span>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/jpeg,image/png,image/webp,application/pdf"
                                    onChange={e => setGeneralFiles(Array.from(e.target.files || []))}
                                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1 file:text-xs file:font-bold file:text-white file:cursor-pointer bg-slate-50"
                                />
                            </label>
                        </div>
                    )}

                    {event && (
                        <div className="mt-5 border-t border-slate-200 pt-4">
                            <EvidenceUploadPanel event={event} canManage={!readOnly && !isCancelled} onChanged={onEvidenceChanged} />
                        </div>
                    )}

                    <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                        <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 px-5 text-sm font-bold text-slate-700 hover:bg-white transition-colors">Cancelar</button>
                        <button type="submit" disabled={submitting || readOnly || isCancelled} className="h-10 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-md hover:shadow-lg">
                            {submitting ? 'Salvando...' : 'Salvar Inspeção'}
                        </button>
                    </div>
                </form>
            </div>

            {zoomedImage && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomedImage(null)}>
                    <div className="relative max-w-full max-h-full">
                        <button 
                            className="absolute -top-10 right-0 text-white/70 hover:text-white transition"
                            onClick={() => setZoomedImage(null)}
                        >
                            <X size={32} />
                        </button>
                        <img src={zoomedImage} alt="Inspeção Expandida" className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl border border-white/10" />
                    </div>
                </div>
            )}
        </div>
    );
};

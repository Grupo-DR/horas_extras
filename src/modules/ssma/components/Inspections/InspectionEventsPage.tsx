import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { canCreateEvent, getAllowedCostCenters, getAllowedRegionals } from '../../domain/permissions';
import { useCancelSSMAInspectionEvent } from '../../hooks/useCancelSSMAInspectionEvent';
import { useCreateSSMAInspectionEvent, CreateSSMAInspectionEventInput } from '../../hooks/useCreateSSMAInspectionEvent';
import { useSSMACostCenters } from '../../hooks/useSSMACostCenters';
import { useSSMAEmployees } from '../../hooks/useSSMAEmployees';
import { useSSMAEvidenceUpload } from '../../hooks/useSSMAEvidenceUpload';
import { SSMAInspectionEventFilters, useSSMAInspectionEvents } from '../../hooks/useSSMAInspectionEvents';
import { useSSMARegionals } from '../../hooks/useSSMARegionals';
import { useUpdateSSMAInspectionEvent } from '../../hooks/useUpdateSSMAInspectionEvent';
import { ssmaEvidenceMetadataService } from '../../services/ssmaEvidenceMetadataService';
import { SSMAInspectionEvent } from '../../types';
import { InspectionEventFilters } from './InspectionEventFilters';
import { InspectionEventFormModal } from './InspectionEventFormModal';
import { InspectionEventTable } from './InspectionEventTable';

const currentCompetence = () => new Date().toISOString().slice(0, 7);

export const InspectionEventsPage: React.FC = () => {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'events' | 'legacy'>('events');
    const [filters, setFilters] = useState<SSMAInspectionEventFilters>({ competence: currentCompetence(), status: 'VALID' });
    const [formOpen, setFormOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<SSMAInspectionEvent | null>(null);
    const [cancelEventTarget, setCancelEventTarget] = useState<SSMAInspectionEvent | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [evidenceCounts, setEvidenceCounts] = useState<Record<string, number>>({});
    const [countsVersion, setCountsVersion] = useState(0);

    const { data: regionalsRaw, loading: regionalsLoading } = useSSMARegionals();
    const { data: costCentersRaw, loading: costCentersLoading } = useSSMACostCenters();
    const { data: employeesRaw, loading: employeesLoading } = useSSMAEmployees();
    const { events, loading: eventsLoading, error, refetch } = useSSMAInspectionEvents(filters);
    const { createEvent, loading: creating } = useCreateSSMAInspectionEvent();
    const { updateEvent, loading: updating } = useUpdateSSMAInspectionEvent();
    const { cancelEvent, loading: cancelling } = useCancelSSMAInspectionEvent();
    const { uploadEvidence } = useSSMAEvidenceUpload();

    const activeCostCenters = useMemo(() => costCentersRaw.filter(costCenter => costCenter.active !== false), [costCentersRaw]);
    const activeRegionals = useMemo(() => regionalsRaw.filter(regional => regional.active !== false), [regionalsRaw]);
    const allowedCostCenters = useMemo(() => getAllowedCostCenters(profile, activeCostCenters), [activeCostCenters, profile]);
    const allowedRegionals = useMemo(() => getAllowedRegionals(profile, activeRegionals, activeCostCenters), [activeRegionals, activeCostCenters, profile]);
    const allowedRegionalIds = useMemo(() => new Set(allowedRegionals.map(regional => regional.id)), [allowedRegionals]);
    const allowedCostCenterIds = useMemo(() => new Set(allowedCostCenters.map(costCenter => costCenter.id)), [allowedCostCenters]);

    const scopedEmployees = useMemo(() => {
        return employeesRaw.filter(employee => {
            if (!employee.uid) return false;
            if (profile?.isSuperAdmin || profile?.modules?.ssma?.role === 'SSMA_ADMIN' || profile?.modules?.ssma?.role === 'SSMA_MANAGER') return true;
            const isAssignedToAllowedCostCenter = activeCostCenters.some(costCenter => {
                if (!allowedCostCenterIds.has(costCenter.id)) return false;
                return (
                    costCenter.engenheiroId === employee.id ||
                    costCenter.supervisorId === employee.id ||
                    costCenter.tstIds?.includes(employee.id) ||
                    costCenter.encarregadoIds?.includes(employee.id)
                );
            });
            if (profile?.modules?.ssma?.role === 'SSMA_REGIONAL_MANAGER') {
                if (employee.regionalIds?.some(regionalId => allowedRegionalIds.has(regionalId))) return true;
                if (employee.costCenterIds?.some(costCenterId => {
                    const costCenter = activeCostCenters.find(item => item.id === costCenterId);
                    return !!costCenter && allowedRegionalIds.has(costCenter.regionalId);
                })) return true;
                if (isAssignedToAllowedCostCenter) return true;
            }
            return employee.uid === profile?.uid || isAssignedToAllowedCostCenter || employee.costCenterIds?.some(costCenterId => allowedCostCenterIds.has(costCenterId));
        });
    }, [activeCostCenters, allowedCostCenterIds, allowedRegionalIds, employeesRaw, profile]);

    const canCreateAny = !!allowedCostCenters.length && canCreateEvent(profile, {
        regionalId: allowedCostCenters[0].regionalId,
        costCenterId: allowedCostCenters[0].id
    });

    useEffect(() => {
        const eventIds = new Set(events.map(event => event.id));
        if (!eventIds.size) {
            setEvidenceCounts({});
            return;
        }

        ssmaEvidenceMetadataService.list()
            .then(evidences => {
                const nextCounts: Record<string, number> = {};
                evidences
                    .filter(evidence => evidence.active !== false && eventIds.has(evidence.inspectionEventId))
                    .forEach(evidence => {
                        nextCounts[evidence.inspectionEventId] = (nextCounts[evidence.inspectionEventId] || 0) + 1;
                    });
                setEvidenceCounts(nextCounts);
            })
            .catch(err => toast.error(err.message || 'Erro ao carregar contagem de evidencias.'));
    }, [events, countsVersion]);

    const openCreateModal = () => {
        setEditingEvent(null);
        setFormOpen(true);
    };

    const openEditModal = (event: SSMAInspectionEvent) => {
        setEditingEvent(event);
        setFormOpen(true);
    };

    const handleSubmit = async (
        input: CreateSSMAInspectionEventInput,
        files: File[],
        originalEvent?: SSMAInspectionEvent | null
    ) => {
        try {
            if (originalEvent) {
                await updateEvent(originalEvent, input);
                toast.success('Lancamento atualizado.');
                setFormOpen(false);
                setEditingEvent(null);
                await refetch();
                return;
            }

            const eventId = await createEvent(input);
            const createdEvent: SSMAInspectionEvent = {
                ...input,
                id: eventId,
                createdAt: new Date().toISOString(),
                createdBy: profile?.uid,
                createdByNameSnapshot: profile?.displayName
            };

            for (const file of files) {
                await uploadEvidence(createdEvent, file);
            }

            toast.success(files.length ? 'Lancamento criado com evidencias.' : 'Lancamento criado.');
            setFormOpen(false);
            setEditingEvent(null);
            setCountsVersion(version => version + 1);
            await refetch();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao salvar lancamento.');
        }
    };

    const handleCancelEvent = async () => {
        if (!cancelEventTarget) return;
        try {
            await cancelEvent(cancelEventTarget, cancelReason);
            toast.success('Lancamento cancelado.');
            setCancelEventTarget(null);
            setCancelReason('');
            await refetch();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao cancelar lancamento.');
        }
    };

    const loading = eventsLoading || regionalsLoading || costCentersLoading || employeesLoading;

    return (
        <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900">Lancamentos de inspecao</h1>
                    <p className="text-sm text-gray-500">Eventos reais em obra, com executor separado do usuario que registrou.</p>
                </div>
                <button
                    type="button"
                    onClick={openCreateModal}
                    disabled={!canCreateAny}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded bg-gray-900 px-4 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Plus size={16} />
                    Novo lancamento
                </button>
            </div>

            {!allowedCostCenters.length && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Nenhuma obra vinculada ao seu escopo SSMA. Solicite revisao do acesso para criar ou visualizar lancamentos.
                </div>
            )}

            <div className="flex gap-2 border-b border-gray-200">
                <button type="button" onClick={() => setActiveTab('events')} className={`border-b-2 px-3 py-2 text-sm font-semibold ${activeTab === 'events' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}>Eventos reais</button>
                <button type="button" onClick={() => setActiveTab('legacy')} className={`border-b-2 px-3 py-2 text-sm font-semibold ${activeTab === 'legacy' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}>Legado</button>
            </div>

            {activeTab === 'events' ? (
                <>
                    <InspectionEventFilters
                        filters={filters}
                        regionals={allowedRegionals}
                        costCenters={allowedCostCenters}
                        employees={scopedEmployees}
                        onChange={setFilters}
                    />
                    {error && (
                        <div className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                    )}
                    <InspectionEventTable
                        profile={profile}
                        events={events}
                        evidenceCounts={evidenceCounts}
                        loading={loading}
                        onEdit={openEditModal}
                        onCancel={event => {
                            setCancelEventTarget(event);
                            setCancelReason('');
                        }}
                    />
                </>
            ) : (
                <div className="rounded border border-dashed border-gray-200 bg-white p-8 text-sm text-gray-600">
                    Dados legados e lancamentos sinteticos nao sao exibidos na listagem principal da Sprint 3.
                </div>
            )}

            <InspectionEventFormModal
                open={formOpen}
                event={editingEvent}
                profile={profile}
                regionals={allowedRegionals}
                costCenters={allowedCostCenters}
                employees={scopedEmployees}
                submitting={creating || updating}
                onClose={() => {
                    setFormOpen(false);
                    setEditingEvent(null);
                }}
                onSubmit={handleSubmit}
                onEvidenceChanged={() => setCountsVersion(version => version + 1)}
            />

            {cancelEventTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
                    <div className="w-full max-w-md rounded bg-white p-5 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">Apagar lancamento</h3>
                        <p className="mt-1 text-sm text-gray-500">Esta acao cancela o evento. Nenhum documento sera excluido fisicamente.</p>
                        <label className="mt-4 block space-y-1">
                            <span className="text-sm font-medium text-gray-700">Motivo do cancelamento</span>
                            <textarea value={cancelReason} onChange={event => setCancelReason(event.target.value)} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                        </label>
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setCancelEventTarget(null)} className="h-10 rounded border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Voltar</button>
                            <button type="button" onClick={handleCancelEvent} disabled={cancelling || !cancelReason.trim()} className="h-10 rounded bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
                                {cancelling ? 'Cancelando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

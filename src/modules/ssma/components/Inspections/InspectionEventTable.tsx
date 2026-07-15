import React from 'react';
import { Paperclip } from 'lucide-react';
import { canCancelEvent, canEditEvent } from '../../domain/permissions';
import { targetFunctionGroupLabel } from '../../domain/inspectionEventHelpers';
import { SSMAInspectionEvent } from '../../types';
import { UserProfileDoc } from '../../../iam/types';
import { InspectionEventActions } from './InspectionEventActions';
import { InspectionEventStatusBadge } from './InspectionEventStatusBadge';

interface Props {
    profile: UserProfileDoc | null;
    events: SSMAInspectionEvent[];
    evidenceCounts: Record<string, number>;
    loading: boolean;
    onEdit: (event: SSMAInspectionEvent) => void;
    onCancel: (event: SSMAInspectionEvent) => void;
}

export const InspectionEventTable: React.FC<Props> = ({ profile, events, evidenceCounts, loading, onEdit, onCancel }) => {
    if (loading) {
        return <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Carregando lancamentos...</div>;
    }

    if (!events.length) {
        return <div className="rounded border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Nenhum lancamento encontrado para os filtros atuais.</div>;
    }

    return (
        <div className="overflow-hidden rounded border border-gray-200 bg-white">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-3">Data</th>
                            <th className="px-3 py-3">Regional</th>
                            <th className="px-3 py-3">Obra</th>
                            <th className="px-3 py-3">Tipo</th>
                            <th className="px-3 py-3">Executor</th>
                            <th className="px-3 py-3">Função</th>
                            <th className="px-3 py-3">Status</th>
                            <th className="px-3 py-3 text-center">Conforme</th>
                            <th className="px-3 py-3">Evidências</th>
                            <th className="px-3 py-3">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {events.map(event => (
                            <tr key={event.id} className="align-top text-gray-700 hover:bg-gray-50/70">
                                <td className="whitespace-nowrap px-3 py-3">{event.date}</td>
                                <td className="min-w-36 px-3 py-3">{event.regionalNameSnapshot}</td>
                                <td className="min-w-52 px-3 py-3">
                                    <div className="font-medium text-gray-900">{event.costCenterNameSnapshot}</div>
                                    <div className="text-xs text-gray-500">{event.costCenterCodeSnapshot}</div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-900">{event.inspectionType}</td>
                                <td className="min-w-44 px-3 py-3">
                                    <div className="font-medium text-gray-900">{event.executorNameSnapshot}</div>
                                    {event.executorEmailSnapshot && <div className="text-xs text-gray-500">{event.executorEmailSnapshot}</div>}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3">{targetFunctionGroupLabel(event.executorFunctionGroup)}</td>
                                <td className="whitespace-nowrap px-3 py-3"><InspectionEventStatusBadge status={event.status} /></td>
                                <td className="whitespace-nowrap px-3 py-3 text-center">
                                    {event.items && event.items.length > 0 ? (
                                        event.items.some(i => i.status === 'NAO_CONFORME') ? (
                                            <span className="inline-flex rounded bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">Não Conforme</span>
                                        ) : (
                                            <span className="inline-flex rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Conforme</span>
                                        )
                                    ) : (
                                        <span className="text-xs text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3">
                                    <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                                        <Paperclip size={13} />
                                        {evidenceCounts[event.id] || 0}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-3">
                                    <InspectionEventActions
                                        event={event}
                                        canEdit={canEditEvent(profile, event)}
                                        canCancel={canCancelEvent(profile, event)}
                                        onEdit={onEdit}
                                        onCancel={onCancel}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

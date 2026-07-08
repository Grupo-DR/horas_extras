import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { SSMAEventStatus, SSMAInspectionEvent, SSMAInspectionType } from '../types';
import { canViewEvent, hasSSMAAccess } from '../domain/permissions';
import { ssmaInspectionEventService } from '../services/ssmaInspectionEventService';

export interface SSMAInspectionEventFilters {
    competence?: string;
    regionalId?: string;
    costCenterId?: string;
    inspectionType?: SSMAInspectionType | '';
    executorUid?: string;
    status?: SSMAEventStatus | '';
}

export const useSSMAInspectionEvents = (filters: SSMAInspectionEventFilters = {}) => {
    const { profile } = useAuth();
    const [events, setEvents] = useState<SSMAInspectionEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!hasSSMAAccess(profile)) {
            setEvents([]);
            setError('Usuario sem acesso ao modulo SSMA.');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const rawEvents = filters.competence && profile
                ? await ssmaInspectionEventService.listByCompetenceForUser(filters.competence, profile)
                : await ssmaInspectionEventService.list();

            setEvents(rawEvents.filter(event => canViewEvent(profile, event)));
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar lancamentos.');
        } finally {
            setLoading(false);
        }
    }, [filters.competence, profile]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredEvents = useMemo(() => {
        return events
            .filter(event => !filters.regionalId || event.regionalId === filters.regionalId)
            .filter(event => !filters.costCenterId || event.costCenterId === filters.costCenterId)
            .filter(event => !filters.inspectionType || event.inspectionType === filters.inspectionType)
            .filter(event => !filters.executorUid || event.executorUid === filters.executorUid)
            .filter(event => !filters.status || event.status === filters.status)
            .sort((a, b) => `${b.date}-${b.createdAt || ''}`.localeCompare(`${a.date}-${a.createdAt || ''}`));
    }, [events, filters]);

    return {
        events: filteredEvents,
        allEvents: events,
        loading,
        error,
        refetch: loadData
    };
};

import React from 'react';
import { useCrm } from '../../contexts/CrmContext';
import { calculateClientHealth } from '../../domain/relationshipAnalytics';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, TrendingUp, Users, CalendarOff, ArrowRight, CheckCircle2 } from 'lucide-react';

// Actually, let's inline isInteractionRecent logic or keep it if we can't delete file yet.
// Logic was: interaction.date > subDays(now, 7).
import { subDays, isAfter } from 'date-fns';

export const RelationshipDashboard: React.FC = () => {
    // @ts-ignore
    const { clients, interactions, bids, clientContacts } = useCrm(); // Expecting clientContacts
    const navigate = useNavigate();

    // Processamento de Dados (Analytics em Tempo Real)
    const clientHealths = clients.map(client => {
        // Pre-filter data for this client
        const clientInteractions = interactions.filter((i: any) => i.clientId === client.id);
        const clientBids = (bids || []).filter((o: any) => o.clientId === client.id);
        const contacts = (clientContacts || []).filter((c: any) => c.clientId === client.id);

        const health = calculateClientHealth(clientInteractions, clientBids, contacts);
        return { client, ...health };
    });

    // Filtros de Risco
    // 'EM_RISCO' is the new 'RISK'. Also maybe 'PERDIDA'?
    const clientsInRisk = clientHealths.filter(c => c.status === 'EM_RISCO' || c.status === 'PERDIDA');

    // Inline "isInteractionRecent" logic (7 days)
    const cutoff7d = subDays(new Date(), 7);
    const recentInteractionsCount = interactions.filter((i: any) => {
        const date = typeof i.date === 'string' ? parseISO(i.date) : i.date;
        return isAfter(date, cutoff7d);
    }).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Radar de Relacionamento</h1>
                <span className="text-sm text-slate-500">Inteligência Comercial</span>
            </div>

            {/* --- KPIS --- */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Card Risco */}
                <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-red-600">Clientes em Risco</p>
                            <p className="text-2xl font-bold text-red-700">{clientsInRisk.length}</p>
                        </div>
                    </div>
                </div>

                {/* Card Atividade */}
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-blue-600">Interações (7 dias)</p>
                            <p className="text-2xl font-bold text-blue-700">{recentInteractionsCount}</p>
                        </div>
                    </div>
                </div>

                {/* Card Base */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-600">Carteira Ativa</p>
                            <p className="text-2xl font-bold text-slate-900">{clients.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- TABELA DE RISCO --- */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <CalendarOff className="h-5 w-5 text-red-500" />
                        Prioridade: Clientes Silenciosos
                    </h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-3 font-medium">Cliente</th>
                                <th className="px-6 py-3 font-medium">Última Interação</th>
                                <th className="px-6 py-3 font-medium">Tempo de Silêncio</th>
                                <th className="px-6 py-3 font-medium text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {clientsInRisk.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <CheckCircle2 className="h-8 w-8 text-green-500/50" />
                                            <p>Nenhum cliente em risco crítico. Excelente gestão!</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                clientsInRisk.map(({ client, silenceDays, lastInteraction }) => (
                                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">{client.tradeName}</td>
                                        <td className="px-6 py-4 text-slate-500">
                                            {lastInteraction
                                                ? format(lastInteraction, 'dd/MM/yyyy')
                                                : 'Nunca contatado'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                                {silenceDays} dias
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => navigate(`/crm/clients/${client.id}`)}
                                                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                                            >
                                                Ver Detalhes <ArrowRight className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

import React from 'react';
import { ClientHealthMetrics, ClientContact, Interaction } from '../../types';
import { Building2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientCardProps {
    clientName: string;
    metrics: ClientHealthMetrics;
    onRegisterInteraction: () => void;
    onViewDetails: () => void;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: any }> = {
    'ATIVA': { color: 'bg-green-100 text-green-700 border-green-200', label: 'Relacionamento Ativo', icon: CheckCircle },
    'ATENCAO': { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Atenção Necessária', icon: AlertTriangle },
    'EM_RISCO': { color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Em Risco', icon: AlertTriangle },
    'PERDIDA': { color: 'bg-red-100 text-red-700 border-red-200', label: 'Carteira Perdida', icon: Building2 }, // Icon fallback
};

export const ClientCard: React.FC<ClientCardProps> = ({
    clientName,
    metrics,
    onRegisterInteraction,
    onViewDetails
}) => {
    const statusCfg = STATUS_CONFIG[metrics.status] || STATUS_CONFIG['ATENCAO'];
    const StatusIcon = statusCfg.icon;

    return (
        <div className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-full">
            {/* Header */}
            <div className="p-5 border-b border-slate-100">
                <div className="flex justify-between items-start mb-2">
                    <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                    </span>
                </div>
                <h3
                    onClick={onViewDetails}
                    className="text-lg font-bold text-slate-800 line-clamp-1 cursor-pointer hover:text-blue-600 transition-colors"
                >
                    {clientName}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                    Score Geral: <span className="font-semibold text-slate-700">{metrics.score}/100</span>
                </p>
            </div>

            {/* Metrics */}
            <div className="p-5 flex-1 space-y-3">
                {/* Silence Check */}
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        Última Interação
                    </span>
                    <span className={`font-medium ${metrics.silenceDays > 60 ? 'text-red-600' : 'text-slate-700'}`}>
                        {metrics.silenceDays === 999 ? 'Nunca' : `${metrics.silenceDays} dias`}
                    </span>
                </div>

                {/* Active Contacts */}
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Contatos Ativos (90d)</span>
                    <span className="font-medium text-slate-700">{metrics.activeContacts90d}</span>
                </div>

                {/* Bid Trend */}
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Volumetria (Tendência)</span>
                    <span className={`font-medium text-xs px-2 py-0.5 rounded ${metrics.bidTrend === 'ZEROU' || metrics.bidTrend === 'CAINDO' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                        }`}>
                        {metrics.bidTrend}
                    </span>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-xl grid grid-cols-2 gap-3">
                <button
                    onClick={onRegisterInteraction}
                    className="w-full py-2 px-3 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
                >
                    Interagir
                </button>
                <button
                    onClick={onViewDetails}
                    className="w-full py-2 px-3 bg-blue-600 border border-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                    Detalhes
                </button>
            </div>
        </div>
    );
};

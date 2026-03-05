import React, { useMemo } from 'react';
import { Briefcase, CheckCircle2, XCircle, AlertCircle, Calendar, Clock, Lock } from 'lucide-react';
import { getCCName, getCCRegional } from '../data/ccMaster';

interface ApprovalPanelProps {
    records: any[]; // Mesma interface que alimenta a PlanningTable
    onApprove: (costCenter: string) => void;
    onReject: (costCenter: string) => void;
}

export const ApprovalPanel: React.FC<ApprovalPanelProps> = ({ records, onApprove, onReject }) => {

    // Group records by Cost Center
    const grouped = useMemo(() => {
        const map = new Map<string, {
            name: string;
            regional: string;
            totalHours: number;
            totalCost: number;
            headcount: number;
            statusBreakdown: { approved: number, pending: number, draft: number };
            teams: any[];
        }>();

        records.forEach(r => {
            const cc = r.costCenter || 'S/ CC';
            if (!map.has(cc)) {
                map.set(cc, {
                    name: getCCName(cc),
                    regional: getCCRegional(cc),
                    totalHours: 0,
                    totalCost: 0,
                    headcount: 0,
                    statusBreakdown: { approved: 0, pending: 0, draft: 0 },
                    teams: []
                });
            }

            const group = map.get(cc)!;
            group.totalHours += r.plannedHours || 0;
            group.totalCost += r.customEstCost || 0;
            group.headcount += r.headcount || 0;

            // Increment status breakdown (treating team-level aggregated status)
            const st = r.estStatus || 'approved';
            if (st === 'approved') group.statusBreakdown.approved++;
            if (st === 'pending') group.statusBreakdown.pending++;
            if (st === 'draft') group.statusBreakdown.draft++;

            group.teams.push(r);
        });

        // Retornar somentes os CCs que têm ALGUMA coisa pendente
        return Array.from(map.entries())
            .filter(([_, data]) => data.statusBreakdown.pending > 0)
            .sort((a, b) => b[1].totalCost - a[1].totalCost);
    }, [records]);

    if (grouped.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Tudo em dia!</h3>
                <p className="text-slate-500 mt-2">Nenhum centro de custo aguardando aprovação no momento.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-6">
                <AlertCircle size={20} className="text-amber-500" />
                <h3 className="font-bold text-slate-800">Obras Aguardando Aprovação</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {grouped.map(([cc, data]) => (
                    <div key={cc} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-start justify-between">
                            <div className="flex items-start gap-3">
                                <div className="mt-1 p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                                    <Briefcase size={18} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{cc} - {data.name}</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">{data.regional}</p>
                                </div>
                            </div>
                            <div className="flex bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-[10px] font-bold uppercase items-center gap-1 shrink-0">
                                <Clock size={12} /> {data.statusBreakdown.pending} Turmas Pendentes
                            </div>
                        </div>

                        <div className="p-5 flex-1 grid grid-cols-3 gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Efetivo</span>
                                <span className="text-lg font-black font-mono text-slate-700">{data.headcount}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Horas Planejadas</span>
                                <span className="text-lg font-black font-mono text-slate-700">{data.totalHours}h</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Custo Estimado</span>
                                <span className="text-lg font-black font-mono text-emerald-700">R$ {data.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        {/* Status visual breakdown row if mixed */}
                        {(data.statusBreakdown.approved > 0 || data.statusBreakdown.draft > 0) && (
                            <div className="px-5 pb-3">
                                <p className="text-[10px] text-slate-400 italic">
                                    Atenção: Este C.C. possui outras planilhas em status misto ({data.statusBreakdown.approved} aprovadas, {data.statusBreakdown.draft} rascunhos). Apenas os registros pendentes desta aba serão afetados.
                                </p>
                            </div>
                        )}

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => {
                                    if (window.confirm(`Você irá aprovar as planilhas pendentes da obra ${cc}. Continuar?`)) {
                                        onApprove(cc);
                                    }
                                }}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 size={16} /> Aprovar Faturamento
                            </button>
                            <button
                                onClick={() => {
                                    if (window.confirm(`Você irá rejeitar as planilhas pendentes da obra ${cc}, forçando o retorno ao status Rascunho. Continuar?`)) {
                                        onReject(cc);
                                    }
                                }}
                                className="px-4 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <XCircle size={16} /> Devolver
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

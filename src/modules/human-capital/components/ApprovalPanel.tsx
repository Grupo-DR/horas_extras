import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Briefcase, Calendar, CheckCircle2, Clock, X, XCircle } from 'lucide-react';
import { getCCName, getCCRegional } from '../data/ccMaster';

type ApprovalStatus = 'approved' | 'pending' | 'draft' | 'rejected' | string;

interface ApprovalDetailRow {
    id: string;
    date: string;
    ccName: string;
    employeeName: string;
    employeeRole: string;
    hours: number;
    status: ApprovalStatus;
}

interface ApprovalRecord {
    id: string;
    description: string;
    costCenter: string;
    headcount: number;
    plannedHours: number;
    customEstCost: number;
    estStatus?: ApprovalStatus;
    detailRows?: ApprovalDetailRow[];
}

interface ApprovalPanelProps {
    records: ApprovalRecord[];
    onApprove: (costCenter: string) => void;
    onReject: (costCenter: string) => void;
    mode: 'DAILY' | 'MONTHLY';
}

const formatDateBR = (value: string): string => {
    if (!value) return '-';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('pt-BR');
};

const statusBadgeClass = (status: ApprovalStatus): string => {
    if (status === 'pending') return 'bg-amber-100 text-amber-700';
    if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'draft') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-600';
};

export const ApprovalPanel: React.FC<ApprovalPanelProps> = ({ records, onApprove, onReject, mode }) => {
    const [selectedCC, setSelectedCC] = useState<string | null>(null);

    // Group records by cost center
    const grouped = useMemo(() => {
        const map = new Map<string, {
            name: string;
            regional: string;
            totalHours: number;
            totalCost: number;
            headcount: number;
            statusBreakdown: { approved: number; pending: number; draft: number };
            records: ApprovalRecord[];
            detailRows: ApprovalDetailRow[];
        }>();

        records.forEach((r) => {
            const cc = r.costCenter || 'S/ CC';
            if (!map.has(cc)) {
                map.set(cc, {
                    name: getCCName(cc),
                    regional: getCCRegional(cc),
                    totalHours: 0,
                    totalCost: 0,
                    headcount: 0,
                    statusBreakdown: { approved: 0, pending: 0, draft: 0 },
                    records: [],
                    detailRows: []
                });
            }

            const group = map.get(cc)!;
            group.totalHours += r.plannedHours || 0;
            group.totalCost += r.customEstCost || 0;
            group.headcount += r.headcount || 0;

            const st = r.estStatus || 'approved';
            if (st === 'approved') group.statusBreakdown.approved++;
            if (st === 'pending') group.statusBreakdown.pending++;
            if (st === 'draft') group.statusBreakdown.draft++;

            group.records.push(r);

            if (Array.isArray(r.detailRows) && r.detailRows.length > 0) {
                group.detailRows.push(...r.detailRows);
            }
        });

        return Array.from(map.entries())
            .filter(([_, data]) => data.statusBreakdown.pending > 0)
            .map(([cc, data]) => {
                const orderedRows = [...data.detailRows].sort((a, b) => {
                    if (a.date === b.date) {
                        if (a.ccName === b.ccName) {
                            return a.employeeName.localeCompare(b.employeeName);
                        }
                        return a.ccName.localeCompare(b.ccName);
                    }
                    return a.date.localeCompare(b.date);
                });

                return [cc, { ...data, detailRows: orderedRows }] as const;
            })
            .sort((a, b) => b[1].totalCost - a[1].totalCost);
    }, [records]);

    const selectedGroup = useMemo(
        () => grouped.find(([cc]) => cc === selectedCC) ?? null,
        [grouped, selectedCC]
    );

    useEffect(() => {
        if (!selectedCC) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSelectedCC(null);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedCC]);

    const handleApprove = (costCenter: string) => {
        if (window.confirm(`Voce ira aprovar as planilhas pendentes da obra ${costCenter}. Continuar?`)) {
            onApprove(costCenter);
            setSelectedCC(null);
        }
    };

    const handleReject = (costCenter: string) => {
        if (window.confirm(`Voce ira devolver as planilhas pendentes da obra ${costCenter}, retornando ao status Rascunho. Continuar?`)) {
            onReject(costCenter);
            setSelectedCC(null);
        }
    };

    if (grouped.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Tudo em dia!</h3>
                <p className="text-slate-500 mt-2">Nenhum centro de custo aguardando aprovacao no momento.</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-6">
                    <AlertCircle size={20} className="text-amber-500" />
                    <h3 className="font-bold text-slate-800">Obras aguardando aprovacao</h3>
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
                                    <Clock size={12} /> {data.statusBreakdown.pending} Registros pendentes
                                </div>
                            </div>

                            <div className="p-5 flex-1 grid grid-cols-3 gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Efetivo</span>
                                    <span className="text-lg font-black font-mono text-slate-700">{data.headcount}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Horas planejadas</span>
                                    <span className="text-lg font-black font-mono text-slate-700">{data.totalHours}h</span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Custo estimado</span>
                                    <span className="text-lg font-black font-mono text-emerald-700">R$ {data.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            {(data.statusBreakdown.approved > 0 || data.statusBreakdown.draft > 0) && (
                                <div className="px-5 pb-3">
                                    <p className="text-[10px] text-slate-400 italic">
                                        Atencao: este C.C. possui planilhas em status misto ({data.statusBreakdown.approved} aprovadas, {data.statusBreakdown.draft} rascunhos). Apenas os registros pendentes serao afetados.
                                    </p>
                                </div>
                            )}

                            <div className="p-4 bg-slate-50 border-t border-slate-100">
                                <button
                                    onClick={() => setSelectedCC(cc)}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    <Calendar size={16} /> Revisar planejamento
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedGroup && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] overflow-hidden flex flex-col max-h-[92vh]">
                        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
                            <div>
                                <h3 className="text-lg font-bold">{selectedGroup[0]} - {selectedGroup[1].name}</h3>
                                <p className="text-indigo-200 text-xs mt-0.5">
                                    {selectedGroup[1].regional} | {selectedGroup[1].statusBreakdown.pending} registros pendentes
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedCC(null)}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                title="Fechar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Efetivo</span>
                                <span className="text-lg font-black font-mono text-slate-700">{selectedGroup[1].headcount}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Horas planejadas</span>
                                <span className="text-lg font-black font-mono text-slate-700">{selectedGroup[1].totalHours}h</span>
                            </div>
                            <div className="flex flex-col text-left md:text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Custo estimado</span>
                                <span className="text-lg font-black font-mono text-emerald-700">R$ {selectedGroup[1].totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {selectedGroup[1].detailRows.length === 0 ? (
                                <div className="py-16 text-center text-slate-400 px-6">
                                    <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                                    <p className="font-bold text-slate-600">Sem linhas diarias pendentes para exibir.</p>
                                    <p className="text-sm mt-1">
                                        {mode === 'MONTHLY'
                                            ? 'A visualizacao detalhada por dia depende da base diaria (modo diario).'
                                            : 'Os registros pendentes não possuem horas lançadas no período selecionado.'}
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full text-xs min-w-[860px]">
                                    <thead className="sticky top-0 z-20 bg-slate-100 text-slate-600">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-[10px] border-b border-slate-200">Data</th>
                                            <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-[10px] border-b border-slate-200">Centro de Custo</th>
                                            <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-[10px] border-b border-slate-200">Colaborador</th>
                                            <th className="px-4 py-3 text-left font-black uppercase tracking-wider text-[10px] border-b border-slate-200">Funcao</th>
                                            <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-[10px] border-b border-slate-200">Horas</th>
                                            <th className="px-4 py-3 text-right font-black uppercase tracking-wider text-[10px] border-b border-slate-200">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedGroup[1].detailRows.map((row) => (
                                            <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="px-4 py-3 text-slate-600">{formatDateBR(row.date)}</td>
                                                <td className="px-4 py-3 text-slate-700 font-semibold">{row.ccName}</td>
                                                <td className="px-4 py-3 text-slate-700">{row.employeeName}</td>
                                                <td className="px-4 py-3 text-slate-500">{row.employeeRole || '-'}</td>
                                                <td className="px-4 py-3 text-right font-mono font-black text-slate-700">{row.hours.toFixed(1)}h</td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${statusBadgeClass(row.status)}`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                Linhas detalhadas: {selectedGroup[1].detailRows.length}
                            </p>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => setSelectedCC(null)}
                                    className="flex-1 sm:flex-none px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Fechar
                                </button>
                                <button
                                    onClick={() => handleReject(selectedGroup[0])}
                                    className="flex-1 sm:flex-none px-4 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    <XCircle size={16} /> Devolver
                                </button>
                                <button
                                    onClick={() => handleApprove(selectedGroup[0])}
                                    className="flex-1 sm:flex-none px-4 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 size={16} /> Aprovar planejamento
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};


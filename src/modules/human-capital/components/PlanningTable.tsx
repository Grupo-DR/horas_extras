import React, { useMemo, useState } from 'react';
import { Building2, Briefcase, User, Calendar, Lock, Clock, FileEdit, PencilLine } from 'lucide-react';
import { getCCRegional, getCCName, normalizeCC } from '../data/ccMaster';
import { formatDecimalHours } from '../utils/formatters';

interface PlanningMetrics {
    totalHours: number;
    totalHeadcount: number;
    estimatedCost: number;
}

interface PlanningMemberRecord {
    id: string;
    description: string;
    chapa: string;
    plannedHours: number;
    customEstCost: number;
    estStatus?: string;
}

interface PlanningCostCenterRecord {
    id: string;
    description: string;
    costCenter: string;
    headcount: number;
    plannedHours: number;
    customEstCost: number;
    estStatus?: string;
    members?: PlanningMemberRecord[];
}

interface PlanningNode {
    id: string;
    name: string;
    type: 'REGIONAL' | 'CC' | 'RECORD';
    metrics: PlanningMetrics;
    children: PlanningNode[];
    rawRecord?: PlanningCostCenterRecord | PlanningMemberRecord;
}

const statusIcon = (status?: string) => {
    if (status === 'approved') return <Lock size={12} className="text-emerald-500" />;
    if (status === 'pending') return <Clock size={12} className="text-amber-500" />;
    if (status === 'draft') return <FileEdit size={12} className="text-blue-400" />;
    return null;
};

const PlanningTreeRow: React.FC<{
    node: PlanningNode;
    level: number;
    onPlanCC?: (costCenter: string) => void;
}> = ({ node, level, onPlanCC }) => {
    const [isExpanded, setIsExpanded] = useState(level === 0);
    const hasChildren = node.children.length > 0;

    const formatCost = (value: number) => {
        if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'k';
        return value.toFixed(0);
    };

    if (node.type === 'RECORD' && node.rawRecord) {
        const rec = node.rawRecord as PlanningMemberRecord;
        return (
            <div
                className="flex items-center justify-between py-2.5 pr-4 border-b border-slate-50 bg-white hover:bg-slate-50 transition-colors"
                style={{ paddingLeft: `${(level * 1.5) + 1}rem` }}
            >
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200 ml-4 shrink-0" />
                    <User size={14} className="text-slate-400" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-700">{rec.description}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{rec.chapa}</span>
                        {statusIcon(rec.estStatus)}
                    </div>
                </div>
                <div className="flex items-center gap-6 justify-end">
                    <span className="w-16 text-center text-xs font-mono text-slate-600">1</span>
                    <span className="w-20 text-right text-xs font-mono font-bold text-slate-800">{formatDecimalHours(rec.plannedHours)}</span>
                    <span className="w-24 text-right text-xs font-mono text-emerald-600 font-semibold">R$ {formatCost(rec.customEstCost)}</span>
                    <div className="w-20" />
                </div>
            </div>
        );
    }

    const isRegional = node.type === 'REGIONAL';
    const bgClass = isRegional
        ? 'bg-slate-100/80 hover:bg-slate-200/60 border-slate-200'
        : 'bg-slate-50/80 hover:bg-slate-100/80 border-slate-100';

    return (
        <>
            <div
                className={`flex items-center justify-between py-3 pr-4 border-b transition-colors cursor-pointer ${bgClass}`}
                style={{ paddingLeft: `${(level * 1.5) + 1}rem` }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 flex-1 min-w-[250px]">
                    <div className="w-4 flex justify-center shrink-0">
                        <span className={`font-bold text-xs ${level === 0 ? 'text-slate-600' : 'text-slate-400'}`}>{isExpanded ? '▼' : '▶'}</span>
                    </div>
                    <div className="p-1 bg-white rounded shadow-sm shrink-0">
                        {isRegional ? <Building2 size={16} className="text-blue-600" /> : <Briefcase size={16} className="text-indigo-500" />}
                    </div>
                    <span className={`text-sm truncate ${isRegional ? 'font-black text-slate-800' : 'font-bold text-slate-700'}`}>{node.name}</span>
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-[9px] font-bold text-slate-500">
                        {isRegional ? `${node.children.length} CCs` : `${node.children.length} Colab.`}
                    </span>
                </div>

                <div className="flex items-center gap-6 justify-end shrink-0">
                    <div className="w-16 text-center text-xs font-mono font-bold text-slate-700">{node.metrics.totalHeadcount}</div>
                    <div className="w-20 text-right text-xs font-mono font-black text-slate-800">{formatDecimalHours(node.metrics.totalHours)}</div>
                    <div className="w-24 text-right text-xs font-mono font-black text-emerald-700">R$ {formatCost(node.metrics.estimatedCost)}</div>
                    <div className="w-20 flex justify-end">
                        {node.type === 'CC' && onPlanCC && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPlanCC(node.id);
                                }}
                                className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                title="Planejar Centro de Custo"
                            >
                                <PencilLine size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {isExpanded && hasChildren && (
                <div className="flex flex-col w-full">
                    {node.children.map(child => (
                        <PlanningTreeRow key={child.id} node={child} level={level + 1} onPlanCC={onPlanCC} />
                    ))}
                </div>
            )}
        </>
    );
};

interface PlanningTableProps {
    records: PlanningCostCenterRecord[];
    onPlanCC?: (costCenter: string) => void;
}

export const PlanningTable: React.FC<PlanningTableProps> = ({ records, onPlanCC }) => {
    const hierarchicalData = useMemo(() => {
        type CcData = { name: string; metrics: PlanningMetrics; record?: PlanningCostCenterRecord };
        const regionalMap = new Map<string, { metrics: PlanningMetrics; ccs: Map<string, CcData> }>();

        records.forEach(r => {
            const rawCC = r.costCenter || 'S/ CC';
            const cc = normalizeCC(rawCC);
            const ccName = getCCName(cc);
            const reg = getCCRegional(cc) || 'Sem Regional';
            const hours = Number(r.plannedHours) || 0;
            const headcount = Number(r.headcount) || 0;
            const estCost = Number(r.customEstCost) || 0;

            if (!regionalMap.has(reg)) {
                regionalMap.set(reg, { metrics: { totalHours: 0, totalHeadcount: 0, estimatedCost: 0 }, ccs: new Map() });
            }

            const regData = regionalMap.get(reg)!;
            if (!regData.ccs.has(cc)) {
                regData.ccs.set(cc, {
                    name: `${cc} - ${ccName}`,
                    metrics: { totalHours: 0, totalHeadcount: 0, estimatedCost: 0 },
                    record: r
                });
            }

            const ccData = regData.ccs.get(cc)!;
            regData.metrics.totalHours += hours;
            regData.metrics.totalHeadcount += headcount;
            regData.metrics.estimatedCost += estCost;

            ccData.metrics.totalHours += hours;
            ccData.metrics.totalHeadcount += headcount;
            ccData.metrics.estimatedCost += estCost;
            ccData.record = r;
        });

        return Array.from(regionalMap.entries())
            .map(([regName, regData]) => ({
                id: regName,
                name: regName,
                type: 'REGIONAL' as const,
                metrics: regData.metrics,
                children: Array.from(regData.ccs.entries())
                    .map(([ccCode, ccData]) => {
                        const members = ccData.record?.members || [];
                        return {
                            id: ccCode,
                            name: ccData.name,
                            type: 'CC' as const,
                            metrics: ccData.metrics,
                            children: members
                                .map(member => ({
                                    id: member.id,
                                    name: member.description,
                                    type: 'RECORD' as const,
                                    metrics: {
                                        totalHours: member.plannedHours || 0,
                                        totalHeadcount: 1,
                                        estimatedCost: member.customEstCost || 0
                                    },
                                    rawRecord: member,
                                    children: []
                                }))
                                .sort((a, b) => b.metrics.totalHours - a.metrics.totalHours)
                        };
                    })
                    .sort((a, b) => b.metrics.totalHours - a.metrics.totalHours)
            }))
            .sort((a, b) => b.metrics.totalHours - a.metrics.totalHours);
    }, [records]);

    if (records.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
                <Calendar size={48} className="text-slate-200 mb-4" />
                <h3 className="text-lg font-bold text-slate-700">Nenhum planejamento encontrado</h3>
                <p className="text-slate-500 max-w-sm mt-2">Utilize o botão de planejamento por Centro de Custo para iniciar o lançamento do período.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col animate-fade-in">
            <div className="flex items-center justify-between py-3 pr-4 pl-4 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                <span className="flex-1">Estrutura Operacional (Regional &gt; Centro de Custo &gt; Colaborador)</span>
                <div className="flex items-center gap-6 justify-end shrink-0">
                    <span className="w-16 text-center" title="Efetivo Convocado">Efetivo</span>
                    <span className="w-20 text-right" title="Volume de Horas">Horas</span>
                    <span className="w-24 text-right" title="Custo Estimado">Custo (R$)</span>
                    <span className="w-20 text-center">Ações</span>
                </div>
            </div>

            <div className="min-w-[800px]">
                {hierarchicalData.map(node => (
                    <PlanningTreeRow key={node.id} node={node} level={0} onPlanCC={onPlanCC} />
                ))}
            </div>
        </div>
    );
};

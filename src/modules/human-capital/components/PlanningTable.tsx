import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Building2, Briefcase, Users, Calendar, Clock, DollarSign, Trash2, Edit2 } from 'lucide-react';
import { getCCRegional, getCCName, normalizeCC } from '../data/ccMaster';
import { PlanningRecord } from '../types';
import { formatDecimalHours } from '../utils/formatters';

interface PlanningMetrics {
    totalHours: number;
    totalHeadcount: number;
    estimatedCost: number;
}

interface PlanningNode {
    id: string;
    name: string;
    type: 'REGIONAL' | 'CC' | 'RECORD';
    metrics: PlanningMetrics;
    records?: any[]; // Apenas para o nível CC guardar as turmas originais
    children: PlanningNode[];
    rawRecord?: any; // Apenas para o nível RECORD (a turma em si)
}

const PlanningTreeRow: React.FC<{
    node: PlanningNode;
    level: number;
    onEdit?: (r: any) => void;
    onDelete?: (id: string) => void;
}> = ({ node, level, onEdit, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(level === 0);
    const isRecord = node.type === 'RECORD';
    const hasChildren = node.children && node.children.length > 0;

    const getIcon = () => {
        if (node.type === 'REGIONAL') return <Building2 size={16} className="text-blue-600" />;
        if (node.type === 'CC') return <Briefcase size={16} className="text-indigo-500" />;
        return <Users size={14} className="text-slate-400" />;
    };

    const formatCost = (v: number) => {
        if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
        return v.toFixed(0);
    };

    // Linha de Detalhe Operacional (A Turma)
    if (isRecord && node.rawRecord) {
        const r = node.rawRecord;
        return (
            <div className="flex items-center justify-between py-2.5 pr-4 border-b border-slate-50 bg-white hover:bg-slate-50 transition-colors" style={{ paddingLeft: `${(level * 1.5) + 1}rem` }}>
                <div className="flex items-center gap-3 flex-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200 ml-4 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{r.description || 'Turma de Trabalho'}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1"><Calendar size={10} /> {r.date} • {r.shift}</span>
                    </div>
                </div>
                <div className="flex items-center gap-6 justify-end">
                    <span className="w-16 text-center text-xs font-mono text-slate-600">{r.headcount}</span>
                    <span className="w-20 text-right text-xs font-mono font-bold text-slate-800">{r.plannedHours}h</span>
                    <span className="w-24 text-right text-xs font-mono text-emerald-600 font-semibold">R$ {formatCost(node.metrics.estimatedCost)}</span>
                    <div className="w-16 flex justify-end gap-2">
                        {onEdit && <button onClick={() => onEdit(r)} className="p-1 text-slate-400 hover:text-blue-600"><Edit2 size={14} /></button>}
                        {onDelete && <button onClick={() => onDelete(r.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>}
                    </div>
                </div>
            </div>
        );
    }

    // Linha Agrupadora (Regional ou CC)
    const bgClass = level === 0 ? 'bg-slate-100/80 hover:bg-slate-200/60 border-slate-200' : 'bg-slate-50/80 hover:bg-slate-100/80 border-slate-100';

    return (
        <React.Fragment>
            <div
                className={`flex items-center justify-between py-3 pr-4 border-b transition-colors cursor-pointer ${bgClass}`}
                style={{ paddingLeft: `${(level * 1.5) + 1}rem` }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 flex-1 min-w-[250px]">
                    <div className="w-4 flex justify-center shrink-0">
                        <span className={`font-bold text-xs ${level === 0 ? 'text-slate-600' : 'text-slate-400'}`}>{isExpanded ? '▼' : '▶'}</span>
                    </div>
                    <div className="p-1 bg-white rounded shadow-sm shrink-0">{getIcon()}</div>
                    <span className={`text-sm truncate ${level === 0 ? 'font-black text-slate-800' : 'font-bold text-slate-700'}`}>
                        {node.name}
                    </span>
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-[9px] font-bold text-slate-500">
                        {node.type === 'REGIONAL' ? `${node.children.length} Obras` : `${node.children.length} Turmas`}
                    </span>
                </div>

                <div className="flex items-center gap-6 justify-end shrink-0">
                    <div className="w-16 text-center text-xs font-mono font-bold text-slate-700">{node.metrics.totalHeadcount}</div>
                    <div className="w-20 text-right text-xs font-mono font-black text-slate-800">{node.metrics.totalHours}h</div>
                    <div className="w-24 text-right text-xs font-mono font-black text-emerald-700">R$ {formatCost(node.metrics.estimatedCost)}</div>
                    <div className="w-16" /> {/* Espaço das actions */}
                </div>
            </div>

            {isExpanded && hasChildren && (
                <div className="flex flex-col w-full">
                    {node.children.map(child => <PlanningTreeRow key={child.id} node={child} level={level + 1} onEdit={onEdit} onDelete={onDelete} />)}
                </div>
            )}
        </React.Fragment>
    );
};

interface PlanningTableProps {
    records: any[]; // The flat array of planning records
    onEdit?: (r: any) => void;
    onDelete?: (id: string) => void;
    salariesMap?: Record<string, number>; // Opcional, mantido para futura integração de cálculo exato
}

export const PlanningTable: React.FC<PlanningTableProps> = ({ records, onEdit, onDelete, salariesMap }) => {
    const hierarchicalData = useMemo(() => {
        const regionalMap = new Map<string, { metrics: PlanningMetrics, ccs: Map<string, { name: string, metrics: PlanningMetrics, records: any[] }> }>();

        records.forEach(r => {
            const rawCC = r.costCenter || 'S/ CC';
            const cc = normalizeCC(rawCC);
            const ccName = getCCName(cc);
            const reg = getCCRegional(cc) || 'Sem Regional';

            const hours = Number(r.plannedHours) || 0;
            const hc = Number(r.headcount) || 0;

            // Utiliza o custo real calculado no Planning.tsx, ou o básico de R$ 25/h se não existir
            const estCost = r.customEstCost !== undefined ? r.customEstCost : (hours * 25);

            if (!regionalMap.has(reg)) {
                regionalMap.set(reg, { metrics: { totalHours: 0, totalHeadcount: 0, estimatedCost: 0 }, ccs: new Map() });
            }
            const regData = regionalMap.get(reg)!;

            if (!regData.ccs.has(cc)) {
                regData.ccs.set(cc, { name: ccName, metrics: { totalHours: 0, totalHeadcount: 0, estimatedCost: 0 }, records: [] });
            }
            const ccData = regData.ccs.get(cc)!;

            // Acumula
            regData.metrics.totalHours += hours;
            regData.metrics.totalHeadcount += hc;
            regData.metrics.estimatedCost += estCost;

            ccData.metrics.totalHours += hours;
            ccData.metrics.totalHeadcount += hc;
            ccData.metrics.estimatedCost += estCost;

            ccData.records.push({ ...r, estCost }); // Guarda o record original
        });

        // Constrói a árvore a partir dos mapas
        return Array.from(regionalMap.entries()).map(([regName, regData]) => ({
            id: regName, name: regName, type: 'REGIONAL' as const, metrics: regData.metrics,
            children: Array.from(regData.ccs.entries()).map(([ccCode, ccData]) => ({
                id: ccCode, name: `${ccCode} - ${ccData.name}`, type: 'CC' as const, metrics: ccData.metrics,
                children: ccData.records.map(rec => ({
                    id: rec.id, name: rec.description || 'Turma', type: 'RECORD' as const,
                    metrics: { totalHours: rec.plannedHours, totalHeadcount: rec.headcount, estimatedCost: rec.estCost },
                    rawRecord: rec, children: []
                }))
            })).sort((a, b) => b.metrics.totalHours - a.metrics.totalHours)
        })).sort((a, b) => b.metrics.totalHours - a.metrics.totalHours);

    }, [records]);

    if (records.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
                <Calendar size={48} className="text-slate-200 mb-4" />
                <h3 className="text-lg font-bold text-slate-700">Nenhum planejamento encontrado</h3>
                <p className="text-slate-500 max-w-sm mt-2">Utilize os botões acima para importar uma planilha ou criar um novo planejamento manualmente.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col animate-fade-in">
            {/* Cabeçalho da Tabela */}
            <div className="flex items-center justify-between py-3 pr-4 pl-4 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[800px]">
                <span className="flex-1">Estrutura Operacional (Regional &gt; Obra &gt; Turmas)</span>
                <div className="flex items-center gap-6 justify-end shrink-0">
                    <span className="w-16 text-center" title="Efetivo Convocado">Efetivo</span>
                    <span className="w-20 text-right" title="Volume de Horas">Horas</span>
                    <span className="w-24 text-right" title="Custo Estimado">Custo (R$)</span>
                    <span className="w-16 text-center">Ações</span>
                </div>
            </div>

            {/* Corpo da Tabela Hierárquica */}
            <div className="min-w-[800px]">
                {hierarchicalData.map(node => (
                    <PlanningTreeRow
                        key={node.id}
                        node={node}
                        level={0}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}
            </div>
        </div>
    );
};


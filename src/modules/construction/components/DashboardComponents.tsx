import React from 'react';
import { formatCurrencyWithZero } from '../utils/calculations';
import { X } from 'lucide-react';

// Custom Tooltip para o gráfico de evolução diária
export const CustomDailyTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    const equipments = data.equipments || [];
    const totalReal = data.real || 0;
    const totalPlan = data.plan || 0;
    const difference = totalReal - totalPlan;

    return (
        <div className="bg-white p-4 rounded-xl shadow-2xl border-2 border-slate-200 min-w-[300px]">
            <p className="font-black text-sm text-slate-900 mb-3 border-b pb-2">{data.name}</p>

            <div className="space-y-2 mb-3">
                <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Planejado:</span>
                    <span className="text-sm font-bold text-slate-700">{formatCurrencyWithZero(totalPlan)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Realizado:</span>
                    <span className="text-sm font-bold text-indigo-600">{formatCurrencyWithZero(totalReal)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-xs font-bold text-slate-700">Diferença:</span>
                    <span className={`text-sm font-bold ${difference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {difference >= 0 ? '+' : ''}{formatCurrencyWithZero(difference)}
                    </span>
                </div>
            </div>

            {equipments.length > 0 && (
                <div className="border-t pt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Equipamentos ({equipments.length})</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                        {equipments.map((eq: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded">
                                <span className="font-bold text-slate-700">{eq.frota}</span>
                                <div className="flex gap-2">
                                    <span className="text-slate-500">{formatCurrencyWithZero(eq.value)}</span>
                                    {eq.planned > 0 && (
                                        <span className="text-slate-400">({formatCurrencyWithZero(eq.planned)})</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Modal para detalhes de categoria (Pareto)
interface CategoryDetailModalProps {
    category: any;
    onClose: () => void;
    type: 'revenue' | 'idle';
}

export const CategoryDetailModal: React.FC<CategoryDetailModalProps> = ({ category, onClose, type }) => {
    if (!category) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">{category.name || category.category}</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            {type === 'revenue' ? 'Faturamento por Equipamento' : 'Horas Improdutivas por Equipamento'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl mb-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Planejado</p>
                            <p className="text-lg font-black text-slate-700">{formatCurrencyWithZero(category.planned || 0)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{type === 'idle' ? 'Improdutivo' : 'Realizado'}</p>
                            <p className="text-lg font-black text-indigo-600">{formatCurrencyWithZero(category.actual || category.idle || 0)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Diferença</p>
                            <p className={`text-lg font-black ${((category.actual || category.idle || 0) - (category.planned || 0)) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {((category.actual || category.idle || 0) - (category.planned || 0)) >= 0 ? '+' : ''}{formatCurrencyWithZero((category.actual || category.idle || 0) - (category.planned || 0))}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">Equipamentos</p>
                    {category.equipmentDetails && category.equipmentDetails.length > 0 ? (
                        <div className="space-y-2">
                            {category.equipmentDetails.map((eq: any, i: number) => (
                                <div key={i} className="bg-white border border-slate-200 p-4 rounded-xl hover:shadow-md transition-shadow">
                                    {type === 'idle' ? (
                                        <>
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-slate-900">{eq.frota}</span>
                                                <span className="text-sm font-bold text-red-600">{formatCurrencyWithZero(eq.idle)}</span>
                                            </div>
                                            <div className="mt-2">
                                                <p className="text-[9px] text-slate-400 uppercase">Valor Improdutivo</p>
                                                <p className="text-sm font-bold text-red-600">{formatCurrencyWithZero(eq.idle)}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-slate-900">{eq.frota}</span>
                                                <span className={`text-sm font-bold ${eq.difference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {eq.difference >= 0 ? '+' : ''}{formatCurrencyWithZero(eq.difference)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 mt-2">
                                                <div>
                                                    <p className="text-[9px] text-slate-400 uppercase">Planejado</p>
                                                    <p className="text-sm font-bold text-slate-600">{formatCurrencyWithZero(eq.planned)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] text-slate-400 uppercase">Realizado</p>
                                                    <p className="text-sm font-bold text-indigo-600">{formatCurrencyWithZero(eq.actual)}</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 italic">Nenhum equipamento encontrado</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// Modal para detalhes de um dia específico
interface DayDetailModalProps {
    day: any;
    onClose: () => void;
}

export const DayDetailModal: React.FC<DayDetailModalProps> = ({ day, onClose }) => {
    if (!day) return null;

    const records = day.records || [];
    const totalReal = day.real || 0;
    const totalPlan = day.plan || 0;
    const difference = totalReal - totalPlan;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">{day.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">Registros de RDO do Dia</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-50 p-3 rounded-xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Planejado</p>
                        <p className="text-lg font-black text-slate-700">{formatCurrencyWithZero(totalPlan)}</p>
                    </div>
                    <div className="bg-indigo-50 p-3 rounded-xl">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase">Realizado</p>
                        <p className="text-lg font-black text-indigo-600">{formatCurrencyWithZero(totalReal)}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${difference >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <p className="text-[10px] font-bold uppercase" style={{ color: difference >= 0 ? '#10b981' : '#ef4444' }}>Diferença</p>
                        <p className={`text-lg font-black ${difference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {difference >= 0 ? '+' : ''}{formatCurrencyWithZero(difference)}
                        </p>
                    </div>
                </div>

                {/* RDO Records Table */}
                <div className="flex-1 overflow-auto">
                    {records.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-50 z-10">
                                <tr className="border-b border-slate-200">
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Frota</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Localização</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Descrição do Serviço</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Unidade</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Produção</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-amber-700 uppercase tracking-wider text-right bg-amber-50/50">Total</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Planejado</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-slate-700 uppercase tracking-wider text-right">Diferença</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {records.map((record: any, idx: number) => {
                                    // Calculate planned value for this specific record (if exists in planning)
                                    const plannedValue = 0; // TODO: Match with planning data if needed
                                    const difference = (record.financials?.total || 0) - plannedValue;

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className="text-[11px] font-bold text-slate-900">{record.frota}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-slate-700">{record.geo?.cidade || '-'}</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[9px] font-medium text-slate-400 uppercase">{record.geo?.trecho || ''}</span>
                                                        {record.trechoFinal && record.geo?.trecho && <span className="text-[9px] text-slate-300">|</span>}
                                                        <span className="text-[9px] text-slate-400 font-mono">{record.trechoFinal || ''}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-[11px] text-slate-700 font-medium">{record.financials?.descricao || record.item}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-[10px] font-bold text-slate-600 uppercase">{record.financials?.unidade || '-'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-bold text-slate-900 text-right">
                                                {record.producao?.toLocaleString() || '0'}
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-bold text-amber-600 text-right bg-amber-50/20">
                                                {formatCurrencyWithZero(record.financials?.total || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-bold text-slate-600 text-right">
                                                {formatCurrencyWithZero(plannedValue)}
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-bold text-right">
                                                <span className={difference >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                    {difference >= 0 ? '+' : ''}{formatCurrencyWithZero(difference)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <p className="text-sm italic">Nenhum registro de RDO encontrado para este dia</p>
                        </div>
                    )}
                </div>

                {/* Footer Summary */}
                {records.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                        <p className="text-xs text-slate-500">
                            <span className="font-bold">{records.length}</span> registro{records.length !== 1 ? 's' : ''} encontrado{records.length !== 1 ? 's' : ''}
                        </p>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Total do Dia</p>
                            <p className="text-xl font-black text-amber-600">{formatCurrencyWithZero(totalReal)}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

import React, { useState } from 'react';
import { X, Calendar, User, MapPin, HardHat, Truck, AlertTriangle, FileText, ChevronRight, Database, Trash2 } from 'lucide-react';
import { ContractTeam, ExtractedRDO } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    team: ContractTeam | null;
    onDeleteRDO?: (rdo: ExtractedRDO) => void;
}

export const TeamDetailsModal: React.FC<Props> = ({ isOpen, onClose, team, onDeleteRDO }) => {
    const [selectedRDO, setSelectedRDO] = useState<ExtractedRDO | null>(null);

    if (!isOpen || !team) return null;

    const rdos = team.rdos || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">

                {/* HEADER */}
                <div className="flex justify-between items-center p-6 border-b shrink-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <HardHat className="text-blue-600" />
                            {team.name}
                        </h2>
                        <div className="flex gap-4 text-sm text-slate-500 mt-1">
                            <span className="flex items-center gap-1"><MapPin size={14} /> {team.location}</span>
                            <span className="flex items-center gap-1"><User size={14} /> {team.leaderName}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* SIDEBAR: RDO LIST */}
                    <div className="w-80 border-r bg-slate-50 flex flex-col overflow-hidden shrink-0">
                        <div className="p-4 border-b bg-slate-100/50">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histórico de RDOs</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {rdos.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-sm">
                                    <FileText size={32} className="mx-auto mb-2 opacity-50" />
                                    Nenhum RDO vinculado.
                                </div>
                            ) : (
                                rdos.map((rdo, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedRDO(rdo)}
                                        className={`group relative p-3 rounded-lg border cursor-pointer transition-all ${selectedRDO === rdo
                                            ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500'
                                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                            }`}
                                    >
                                        {onDeleteRDO && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`Tem certeza que deseja excluir o RDO ${rdo.relatorio?.numero}?`)) {
                                                        onDeleteRDO(rdo);
                                                        if (selectedRDO === rdo) setSelectedRDO(null);
                                                    }
                                                }}
                                                className="absolute top-2 right-2 p-1 bg-white hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                title="Excluir RDO"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                        <div className="flex justify-between items-start mb-2 pr-6">
                                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                                RDO {rdo.relatorio?.numero || 'N/A'}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {rdo.relatorio?.data || 'Data N/D'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                            <span className={`w-2 h-2 rounded-full ${(rdo.clima?.manha?.condicao?.toLowerCase().includes('chuva') || rdo.clima?.tarde?.condicao?.toLowerCase().includes('chuva')) ? 'bg-red-400' : 'bg-green-400'}`}></span>
                                            {rdo.relatorio?.dia_semana || 'Dia N/D'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* MAIN CONTENT: RDO DETAIL */}
                    <div className={`flex-1 overflow-y-auto p-8 bg-slate-50/30 ${!selectedRDO ? 'flex items-center justify-center' : ''}`}>
                        {!selectedRDO ? (
                            <div className="text-center text-slate-400">
                                <FileText size={48} className="mx-auto mb-4 text-slate-300" />
                                <h3 className="text-lg font-medium text-slate-600">Selecione um RDO</h3>
                                <p>Clique na lista ao lado para ver os detalhes.</p>
                            </div>
                        ) : (
                            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

                                {/* 1. HEADER INFO */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">RDO Nº</label>
                                        <p className="text-xl font-bold text-slate-800">{selectedRDO.relatorio?.numero}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Data</label>
                                        <p className="text-base font-medium text-slate-800">{selectedRDO.relatorio?.data} <span className="text-sm text-slate-400">({selectedRDO.relatorio?.dia_semana})</span></p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Obra</label>
                                        <p className="text-base font-medium text-slate-800 truncate" title={selectedRDO.relatorio?.obra || ''}>
                                            {selectedRDO.relatorio?.obra}
                                        </p>
                                    </div>

                                    {/* Additional Fields */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Contratante</label>
                                        <p className="text-sm font-medium text-slate-700">{selectedRDO.relatorio?.contratante || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Responsável</label>
                                        <p className="text-sm font-medium text-slate-700">{selectedRDO.relatorio?.responsavel || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Prazo Contratual</label>
                                        <p className="text-sm font-medium text-slate-700">
                                            {selectedRDO.relatorio?.prazo_contratual_dias ? `${selectedRDO.relatorio.prazo_contratual_dias} dias` : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Prazo (Vencer/Decor)</label>
                                        <div className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                            <span className="text-orange-600">
                                                {selectedRDO.relatorio?.prazo_a_vencer_dias ? `${selectedRDO.relatorio.prazo_a_vencer_dias}d` : '-'}
                                            </span>
                                            <span className="text-slate-300">/</span>
                                            <span>
                                                {selectedRDO.relatorio?.prazo_decorrido_dias ? `${selectedRDO.relatorio.prazo_decorrido_dias}d` : '-'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="md:col-span-4 border-t pt-4 mt-2 flex items-center gap-6">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Horário Trabalho</label>
                                            <p className="text-sm font-mono font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded w-fit">
                                                {selectedRDO.horario_trabalho?.entrada_saida || '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Horas Trab.</label>
                                            <p className="text-sm font-bold text-slate-700">
                                                {selectedRDO.horario_trabalho?.horas_trabalhadas || '-'}h
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. WEATHER */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <h3 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                                        <span className="bg-sky-100 text-sky-600 p-1 rounded"><Database size={14} /></span>
                                        Condições Climáticas
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-sky-50 p-4 rounded-lg border border-sky-100">
                                            <div className="text-xs font-bold text-sky-700 uppercase mb-2">Manhã</div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-slate-700">{selectedRDO.clima?.manha?.tempo || '-'}</span>
                                                <span className="text-xs bg-white px-2 py-1 rounded text-slate-500 border">{selectedRDO.clima?.manha?.condicao || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                                            <div className="text-xs font-bold text-orange-700 uppercase mb-2">Tarde</div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-slate-700">{selectedRDO.clima?.tarde?.tempo || '-'}</span>
                                                <span className="text-xs bg-white px-2 py-1 rounded text-slate-500 border">{selectedRDO.clima?.tarde?.condicao || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. LABOR */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                            <User size={18} className="text-slate-400" /> Mão de Obra
                                        </h3>
                                        <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded-full text-xs font-bold">
                                            {selectedRDO.mao_de_obra?.length || 0}
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                                <tr>
                                                    <th className="px-6 py-3">Nome</th>
                                                    <th className="px-6 py-3">Função</th>
                                                    <th className="px-6 py-3 text-center">Início/Fim</th>
                                                    <th className="px-6 py-3 text-center">Intervalo</th>
                                                    <th className="px-6 py-3 text-right">Horas</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {selectedRDO.mao_de_obra?.map((mo, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="px-6 py-3 text-slate-700 font-medium">{mo.nome}</td>
                                                        <td className="px-6 py-3 text-slate-500 text-xs">{mo.funcao}</td>
                                                        <td className="px-6 py-3 text-center text-slate-400 font-mono text-xs">{mo.entrada_saida || '-'}</td>
                                                        <td className="px-6 py-3 text-center text-slate-400 font-mono text-xs">{mo.intervalo || '-'}</td>
                                                        <td className="px-6 py-3 text-right text-slate-600 font-mono">{mo.horas}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 4. EQUIPMENT */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                            <Truck size={18} className="text-slate-400" /> Equipamentos
                                        </h3>
                                        <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded-full text-xs font-bold">
                                            {selectedRDO.equipamentos?.length || 0}
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                                <tr>
                                                    <th className="px-6 py-3">Código</th>
                                                    <th className="px-6 py-3">Descrição</th>
                                                    <th className="px-6 py-3 text-center">Qtd</th>
                                                    <th className="px-6 py-3 text-right">Horário/Tempo</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {selectedRDO.equipamentos?.map((eq: any, idx) => {
                                                    // Handle string vs object format safely
                                                    const isString = typeof eq === 'string';
                                                    const codigo = isString ? '-' : (eq.codigo || '-');
                                                    const descricao = isString ? eq : eq.descricao;
                                                    const qtd = isString ? 1 : eq.quantidade;
                                                    const horario = isString ? '' : (eq.horario || '');
                                                    const horasTotais = isString ? '' : (eq.horas_totais || 0);

                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50">
                                                            <td className="px-6 py-3 font-mono text-xs text-blue-600 font-bold">{codigo}</td>
                                                            <td className="px-6 py-3 text-slate-700">{descricao}</td>
                                                            <td className="px-6 py-3 text-center text-slate-600">{qtd}</td>
                                                            <td className="px-6 py-3 text-right text-slate-600 font-mono">
                                                                <div className="flex flex-col items-end">
                                                                    <span>{horario}</span>
                                                                    {horasTotais > 0 && <span className="text-xs font-bold">({horasTotais}h)</span>}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 5. ACTIVITIES */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                            <FileText size={18} className="text-slate-400" /> Atividades Executadas
                                        </h3>
                                        <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded-full text-xs font-bold">
                                            {selectedRDO.atividades?.length || 0}
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                                <tr>
                                                    <th className="px-6 py-3 w-2/3">Descrição</th>
                                                    <th className="px-6 py-3 text-center">Unid.</th>
                                                    <th className="px-6 py-3 text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {selectedRDO.atividades?.map((act, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="px-6 py-3 text-slate-700">{act.descricao}</td>
                                                        <td className="px-6 py-3 text-center text-slate-500 text-xs">{act.unidade}</td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase border border-green-200">
                                                                {act.status || 'EXEC'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )) || (
                                                        <tr>
                                                            <td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic">
                                                                Nenhuma atividade registrada.
                                                            </td>
                                                        </tr>
                                                    )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 5. OCCURRENCES */}
                                {(selectedRDO.ocorrencias?.length > 0) && (
                                    <div className="bg-red-50 rounded-xl shadow-sm border border-red-100 p-6">
                                        <h3 className="font-bold text-red-700 flex items-center gap-2 mb-4">
                                            <AlertTriangle size={18} /> Ocorrências
                                        </h3>
                                        <ul className="list-disc list-inside space-y-2 text-red-800 text-sm">
                                            {selectedRDO.ocorrencias.map((oc, idx) => (
                                                <li key={idx}>{oc}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* 6. COMMENTS */}
                                {(selectedRDO.comentarios?.length > 0) && (
                                    <div className="bg-slate-100 rounded-xl shadow-sm border border-slate-200 p-6">
                                        <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
                                            <FileText size={18} /> Comentários
                                        </h3>
                                        <ul className="list-disc list-inside space-y-2 text-slate-600 text-sm">
                                            {selectedRDO.comentarios.map((c, idx) => (
                                                <li key={idx}>{c}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

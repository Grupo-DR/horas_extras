import React, { useState } from 'react';
import { Contract, ContractStatus } from '../types';
import { differenceInDays, format } from 'date-fns';
import { AlertTriangle, Calendar, CheckCircle, Clock, Plus, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { MeasurementForm } from './MeasurementForm';
import { useNavigate } from 'react-router-dom';

interface Props {
    contract: Contract;
    onViewDetails: (contract: Contract) => void;
    onEdit: (contract: Contract) => void;
    onDelete: (contractId: string) => void;
}

export const ContractCard: React.FC<Props> = ({ contract, onViewDetails, onEdit, onDelete }) => {

    // 1. Financial Calcs
    const accumulatedValue = (contract.measurements || []).reduce((acc, m) => acc + (m.value || 0), 0);
    const remainingValue = (contract.totalValue || 0) - accumulatedValue;
    const financialProgress = contract.totalValue > 0 ? (accumulatedValue / contract.totalValue) * 100 : 0;

    // 2. Temporal Calcs
    const now = new Date();
    const start = new Date(contract.startDate);
    const end = new Date(contract.endDate);

    const totalDays = differenceInDays(end, start) || 1;
    const elapsedDays = differenceInDays(now, start);
    const daysRemaining = differenceInDays(end, now);

    const timeProgress = Math.min(Math.max((elapsedDays / totalDays) * 100, 0), 100);

    // 3. Health Logic: Alert if Time > Financial + 10%
    const isLagging = timeProgress > (financialProgress + 10);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onViewDetails(contract)}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow relative group cursor-pointer"
        >
            {/* HEADER */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg line-clamp-1" title={contract.name}>{contract.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                        <div title="Número do Contrato">
                            <span className="font-bold text-slate-700 uppercase" style={{ fontSize: '0.65rem' }}>Contrato:</span> {contract.contractNumber}
                        </div>
                        <div title="Contratante">
                            <span className="font-bold text-slate-700 uppercase" style={{ fontSize: '0.65rem' }}>Contratante:</span> {contract.clientName}
                        </div>
                        <div title="Contratada">
                            <span className="font-bold text-slate-700 uppercase" style={{ fontSize: '0.65rem' }}>Contratada:</span> {contract.contractorName}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${contract.status === ContractStatus.ACTIVE ? 'bg-green-100 text-green-700' :
                        contract.status === ContractStatus.FINISHED ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                        {contract.status === ContractStatus.ACTIVE ? 'EM ANDAMENTO' :
                            contract.status === ContractStatus.FINISHED ? 'CONCLUÍDO' : 'SUSPENSO'}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(contract); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar Contrato"
                        >
                            <Pencil size={16} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(contract.id); }}
                            className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Contrato"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* BODY */}
            <div className="p-5 space-y-6">

                {/* FINANCIAL BLOCK */}
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Progressão Financeira</span>
                        <span className="text-sm font-bold text-slate-800">
                            {financialProgress.toFixed(1)}% ({accumulatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                        </span>
                    </div>
                    {/* TAILWIND GLASSMORPHISM BAR */}
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                            className={`h-2.5 rounded-full shadow-lg transition-all duration-500 ${isLagging ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${financialProgress}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-slate-400">
                        <span>Total: {contract.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        <span>Saldo: {remainingValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    {contract.events && contract.events.length > 0 && (
                        <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 flex justify-between items-center">
                            <span className="font-bold">Alterações de Escopo:</span>
                            <span>
                                {contract.events.reduce((acc, evt) => acc + (evt.valueDelta || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                    )}
                </div>

                {/* TEMPORAL BLOCK */}
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Progressão de Tempo</span>
                        <span className="text-sm font-bold text-slate-800">
                            {timeProgress.toFixed(1)}% ({elapsedDays > 0 ? elapsedDays : 0} dias)
                        </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                            className="h-2.5 rounded-full bg-blue-500 shadow-lg transition-all duration-500"
                            style={{ width: `${timeProgress}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-slate-400">
                        <span>Início: {format(start, 'dd/MM/yyyy')}</span>
                        <span>Fim: {format(end, 'dd/MM/yyyy')} ({daysRemaining > 0 ? daysRemaining : 0} dias rest.)</span>
                    </div>
                </div>

                {/* HEALTH ALERT */}
                {isLagging ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                        <AlertTriangle className="text-amber-600 flex-shrink-0" size={18} />
                        <div>
                            <p className="text-xs font-bold text-amber-800">Atenção: Desempenho Abaixo do Cronograma</p>
                            <p className="text-xs text-amber-700 mt-1">
                                Financeiro está {Math.round(timeProgress - financialProgress)}% atrás do tempo decorrido.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="h-[66px] flex items-center justify-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                        <CheckCircle size={14} className="mr-1.5" /> Cronograma Saudável
                    </div>
                )}

            </div>

            {/* FOOTER ACTIONS - Replaced with Click Hint */}
            <div className="px-5 pb-5 pt-0">
                <div className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 font-bold text-xs uppercase tracking-wide group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-all">
                    Ver Detalhes & Medições <ExternalLink size={12} />
                </div>
            </div>

        </motion.div>
    );
};

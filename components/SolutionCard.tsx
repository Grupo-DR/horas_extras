import React from 'react';
import { DataSolution } from '../types';
import { Calendar, User, Users, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface Props {
    solution: DataSolution;
    onExplore: (solutionId: string) => void;
}

export const SolutionCard: React.FC<Props> = ({ solution, onExplore }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full"
        >
            <div className="p-5 flex flex-col h-full">
                {/* HEADER */}
                <div className="flex justify-between items-start mb-4 gap-4">
                    <h3 className="font-bold text-slate-800 text-lg leading-tight line-clamp-2">
                        {solution.name}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase whitespace-nowrap ${solution.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' :
                            solution.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                'bg-slate-100 text-slate-600'
                        }`}>
                        {solution.status === 'ACTIVE' ? 'Ativo' :
                            solution.status === 'COMPLETED' ? 'Concluído' : 'Pausado'}
                    </span>
                </div>

                <p className="text-slate-500 text-sm mb-6 flex-1 line-clamp-3">
                    {solution.description || 'Sem descrição.'}
                </p>

                {/* METADATA */}
                <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <User size={16} className="text-slate-400" />
                        <span className="font-medium">Líder:</span>
                        <span>{solution.responsibleName}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="font-medium">Prazo:</span>
                        <span>
                            {solution.deadline ? format(solution.deadline, "dd 'de' MMM, yyyy", { locale: ptBR }) : 'N/A'}
                        </span>
                    </div>

                    <div className="flex items-start gap-2 text-sm text-slate-600">
                        <Users size={16} className="text-slate-400 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                            {solution.stakeholders.length > 0 ? (
                                solution.stakeholders.map((stale, idx) => (
                                    <span key={idx} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs">
                                        {stale}
                                    </span>
                                ))
                            ) : (
                                <span className="text-slate-400 italic">Sem stakeholders</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ACTION */}
                <button
                    onClick={() => onExplore(solution.id)}
                    className="w-full mt-auto bg-slate-50 hover:bg-slate-100 text-blue-600 border border-slate-200 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors group"
                >
                    Explorar Ações
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </motion.div>
    );
};

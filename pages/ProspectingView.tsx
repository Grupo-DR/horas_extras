import React, { useState, useEffect, useRef } from 'react';
import {
    Plus,
    MoreVertical,
    Calendar,
    Building2,
    Clock,
    User,
    History,
    Target,
    Trash2,
    Edit,
    X,
    Handshake
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInDays, isBefore, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Prospect, ProspectStage } from '../types';
import { ProspectService } from '../services/prospectService';
import { ProspectFormModal } from '../components/crm/ProspectFormModal';

// --- Components ---

const DurationMetrics = ({ start, currentStageStart }: { start: Date, currentStageStart: Date }) => {
    const totalDays = differenceInDays(new Date(), start);
    const stageDays = differenceInDays(new Date(), currentStageStart);

    return (
        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
            <div className="flex items-center gap-1" title={`Tempo nesta etapa (${stageDays} dias)`}>
                <History size={10} className="text-blue-500" />
                <span className="text-slate-600">{stageDays}d na etapa</span>
            </div>
            <div className="w-px h-3 bg-slate-200" />
            <div className="flex items-center gap-1" title={`Tempo total de vida (${totalDays} dias)`}>
                <Clock size={10} className="text-slate-400" />
                <span>{totalDays}d total</span>
            </div>
        </div>
    );
};

export const ProspectingView: React.FC = () => {
    const [prospects, setProspects] = useState<Prospect[]>([]);
    const [loading, setLoading] = useState(true);
    const [draggedProspectId, setDraggedProspectId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Subscribe to Data
    useEffect(() => {
        const unsubscribe = ProspectService.subscribeAll((data) => {
            setProspects(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Menu State
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Columns Definition
    const columns: { id: ProspectStage; title: string; subtitle: string; color: string }[] = [
        {
            id: 'MAPEAR_CONTATO',
            title: '1. Mapear Contato',
            subtitle: 'Quem decide?',
            color: 'border-slate-300 bg-slate-50'
        },
        {
            id: 'FAZER_CONTATO',
            title: '2. Fazer Contato',
            subtitle: 'Tentativa ativa',
            color: 'border-blue-200 bg-blue-50'
        },
        {
            id: 'ESTABELECER_RELACAO',
            title: '3. Estabelecer Relação',
            subtitle: 'Diálogo ativo',
            color: 'border-indigo-200 bg-indigo-50'
        },
        {
            id: 'DIAGNOSTICO',
            title: '4. Diagnóstico',
            subtitle: 'Entender contexto',
            color: 'border-purple-200 bg-purple-50'
        },
        {
            id: 'QUALIFICACAO',
            title: '5. Qualificação',
            subtitle: 'Vale investir?',
            color: 'border-emerald-200 bg-emerald-50'
        }
    ];

    const getStageCount = (stage: ProspectStage) => prospects.filter(p => p.stage === stage).length;

    // --- Handlers ---

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedProspectId(id);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, targetStage: ProspectStage) => {
        e.preventDefault();
        if (!draggedProspectId) return;

        // Optimistic Update (Optional, but safer to rely on subscription or just wait)
        // For simplicity and correctness with the timer reset logic on server/service side:
        await ProspectService.moveStage(draggedProspectId, targetStage);

        setDraggedProspectId(null);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este prospect?')) {
            await ProspectService.delete(id);
            setOpenMenuId(null);
        }
    };

    const handleEdit = (id: string) => {
        alert(`Editar prospect ${id} (Funcionalidade em desenvolvimento)`);
        setOpenMenuId(null);
    };

    return (
        <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden bg-[#F0F4F8]" onClick={() => setOpenMenuId(null)}>
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Handshake className="text-blue-600" />
                        Gestão de Prospecção de Novos Clientes
                    </h1>
                    <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
                        Pipeline de Prospecção
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg shadow-blue-600/20 transition-all active:scale-95 font-medium"
                    >
                        <Plus size={20} />
                        Prospecção
                    </button>
                </div>
            </div>

            {/* KANBAN BOARD (Unchanged logic, just keeping structure) */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                <div className="flex h-full gap-4 min-w-[1400px]">
                    {columns.map(col => {
                        const count = getStageCount(col.id);

                        return (
                            <div
                                key={col.id}
                                className={`flex-1 flex flex-col rounded-xl border transition-colors duration-200 ${col.color.split(' ')[0]} ${col.color.split(' ')[1]} backdrop-blur-sm min-w-[280px]`}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, col.id)}
                            >
                                {/* Column Header */}
                                <div className="p-3 border-b border-slate-200/50 flex flex-col gap-1 sticky top-0 bg-opacity-90 z-10 pointer-events-none">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-slate-800 text-sm truncate" title={col.title}>{col.title}</h3>
                                        <span className="bg-white text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
                                            {count}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{col.subtitle}</span>
                                </div>

                                {/* Column Content */}
                                <div className="p-2 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                    {prospects.filter(p => p.stage === col.id).map(card => {
                                        const isLate = isBefore(card.nextActionDate, startOfToday());
                                        const actionStyle = isLate
                                            ? 'bg-red-50 border-red-100 text-red-700'
                                            : 'bg-green-50 border-green-100 text-green-700';

                                        return (
                                            <motion.div
                                                key={card.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, card.id)}
                                                whileHover={{ y: -2, scale: 1.01 }}
                                                whileDrag={{ scale: 1.05, zIndex: 50 }}
                                                className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative overflow-visible"
                                            >
                                                {/* Card Content (Unchanged) */}
                                                {/* Left Stripe */}
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-blue-600 rounded-l-lg" />

                                                {/* Header: Company & Action Menu */}
                                                <div className="flex justify-between items-start mb-2 pl-2 relative">
                                                    <div className="flex flex-col">
                                                        <h4 className="font-bold text-slate-800 text-sm leading-tight hover:text-blue-600 transition-colors">
                                                            {card.company}
                                                        </h4>
                                                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                                                            <Building2 size={10} />
                                                            {card.location}
                                                        </div>
                                                    </div>

                                                    <div className="relative" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === card.id ? null : card.id); }}
                                                            className="text-slate-300 hover:text-slate-600 opacity-100 transition-opacity p-1 rounded-full hover:bg-slate-100"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>

                                                        {/* Dropdown Menu */}
                                                        <AnimatePresence>
                                                            {openMenuId === card.id && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                                                    className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-50 overflow-hidden"
                                                                >
                                                                    <button
                                                                        onClick={() => handleEdit(card.id)}
                                                                        className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                                                                    >
                                                                        <Edit size={12} /> Editar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(card.id)}
                                                                        className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50"
                                                                    >
                                                                        <Trash2 size={12} /> Excluir
                                                                    </button>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>

                                                {/* Contact Info & Owner */}
                                                <div className="pl-2 mb-3 flex items-start justify-between">
                                                    <div>
                                                        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                                            <User size={12} className="text-slate-400" />
                                                            {card.contactName}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 ml-4 truncate max-w-[120px]">
                                                            {card.contactRole}
                                                        </div>
                                                    </div>

                                                    {/* Responsible Person Avatar */}
                                                    <div className="flex flex-col items-end" title={`Responsável: ${card.owner.name}`}>
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center text-[10px] font-bold">
                                                            {card.owner.initials}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Strategic Observation */}
                                                <div className="pl-2 mb-3">
                                                    <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[10px] text-slate-600 italic leading-relaxed">
                                                        "{card.strategicObservation}"
                                                    </div>
                                                </div>

                                                {/* Footer: Timeline & Next Action */}
                                                <div className="pl-2 pt-2 border-t border-slate-50 flex flex-col gap-2">

                                                    {/* Duration Metrics */}
                                                    <DurationMetrics start={card.createdAt} currentStageStart={card.stageStartedAt} />

                                                    {/* Next Action - Conditional Styling */}
                                                    <div className={`rounded-md p-2 border mt-1 shadow-sm ${actionStyle}`}>
                                                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold mb-1">
                                                            <Calendar size={10} />
                                                            Próxima Ação
                                                            <span className={`ml-auto font-normal normal-case`}>
                                                                {format(card.nextActionDate, "dd/MM", { locale: ptBR })}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-medium line-clamp-2">
                                                            {card.nextAction}
                                                        </p>
                                                    </div>
                                                </div>

                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal */}
            <ProspectFormModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    );
};

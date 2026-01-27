import React, { useState } from 'react';
import {
    Search,
    Filter,
    Plus,
    MoreVertical,
    Calendar,
    Building2,
    Clock,
    User,
    History,
    Target
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Types ---

type ProspectStage = 'MAPEAR_CONTATO' | 'FAZER_CONTATO' | 'ESTABELECER_RELACAO' | 'DIAGNOSTICO' | 'QUALIFICACAO';

interface Prospect {
    id: string;
    company: string;
    contactName: string;
    contactRole: string;
    stage: ProspectStage;
    location: string;

    // Dates for Time Tracking
    createdAt: Date;       // For Total Time
    stageStartedAt: Date;  // For Time in Stage

    // Responsibility
    owner: {
        name: string;
        initials: string;
        avatarUrl?: string;
    };

    // Activity
    lastContactDate: Date;
    nextAction: string;
    nextActionDate: Date;
    strategicObservation: string;

    // Metadata
    estimatedValue?: number;
    tags?: string[];
}

// --- Mock Data ---

const MOCK_PROSPECTS: Prospect[] = [
    {
        id: '1',
        company: 'Construtora Exemplo Ltda',
        contactName: 'João Silva',
        contactRole: 'Diretor de Obras',
        stage: 'MAPEAR_CONTATO',
        location: 'São Paulo, SP',
        createdAt: new Date('2024-01-05'),
        stageStartedAt: new Date('2024-01-05'),
        owner: { name: 'Antonio Augusto', initials: 'AA' },
        lastContactDate: new Date('2024-01-10'),
        nextAction: 'Buscar perfil no LinkedIn',
        nextActionDate: new Date('2024-01-28'),
        strategicObservation: 'Empresa em expansão no setor industrial.',
        tags: ['Industrial']
    },
    {
        id: '2',
        company: 'Incorporadora Modelo S.A.',
        contactName: 'Maria Santos',
        contactRole: 'Gerente de Suprimentos',
        stage: 'FAZER_CONTATO',
        location: 'Rio de Janeiro, RJ',
        createdAt: new Date('2023-12-20'),
        stageStartedAt: new Date('2024-01-15'),
        owner: { name: 'Felipe Costa', initials: 'FC' },
        lastContactDate: new Date('2024-01-20'),
        nextAction: 'Ligar para agendar café',
        nextActionDate: new Date('2024-01-29'),
        strategicObservation: 'Focada em redução de custos.',
        estimatedValue: 1200000
    },
    {
        id: '3',
        company: 'Engenharia & Cia',
        contactName: 'Carlos Oliveira',
        contactRole: 'Gerente Técnico',
        stage: 'ESTABELECER_RELACAO',
        location: 'Curitiba, PR',
        createdAt: new Date('2023-11-10'),
        stageStartedAt: new Date('2024-01-10'),
        owner: { name: 'Antonio Augusto', initials: 'AA' },
        lastContactDate: new Date('2023-12-15'),
        nextAction: 'Enviar case de sucesso similar',
        nextActionDate: new Date('2024-01-30'),
        strategicObservation: 'Interessado em nossa tecnologia de monitoramento.',
        estimatedValue: 300000
    },
    {
        id: '4',
        company: 'Tech Solutions',
        contactName: 'Ana Souza',
        contactRole: 'CEO',
        stage: 'DIAGNOSTICO',
        location: 'Belo Horizonte, MG',
        createdAt: new Date('2023-12-01'),
        stageStartedAt: new Date('2024-01-20'),
        owner: { name: 'Marina Silva', initials: 'MS' },
        lastContactDate: new Date('2024-01-25'),
        nextAction: 'Apresentar proposta técnica preliminar',
        nextActionDate: new Date('2024-02-01'),
        strategicObservation: 'Precisa de solução para Q2 2024.',
        estimatedValue: 500000
    },
    {
        id: '5',
        company: 'Retail Group',
        contactName: 'Pedro Costa',
        contactRole: 'Diretor de Expansão',
        stage: 'QUALIFICACAO',
        location: 'Porto Alegre, RS',
        createdAt: new Date('2023-10-15'),
        stageStartedAt: new Date('2024-01-05'),
        owner: { name: 'Felipe Costa', initials: 'FC' },
        lastContactDate: new Date('2024-01-26'),
        nextAction: 'Validar orçamento com board',
        nextActionDate: new Date('2024-02-05'),
        strategicObservation: 'Budget aprovado, decisão em breve.',
        estimatedValue: 2000000
    }
];

// --- Components ---

const DurationMetrics = ({ start, currentStageStart }: { start: Date, currentStageStart: Date }) => {
    const totalDays = differenceInDays(new Date(), start);
    const stageDays = differenceInDays(new Date(), currentStageStart);

    return (
        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
            <div className="flex items-center gap-1" title="Tempo nesta etapa">
                <History size={10} className="text-blue-500" />
                <span className="text-slate-600">{stageDays}d na etapa</span>
            </div>
            <div className="w-px h-3 bg-slate-200" />
            <div className="flex items-center gap-1" title="Tempo total desde a criação">
                <Clock size={10} className="text-slate-400" />
                <span>{totalDays}d total</span>
            </div>
        </div>
    );
};

export const ProspectingView: React.FC = () => {
    // Columns Definition
    const columns: { id: ProspectStage; title: string; subtitle: string; limit?: number; color: string }[] = [
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
            limit: 15,
            color: 'border-indigo-200 bg-indigo-50'
        },
        {
            id: 'DIAGNOSTICO',
            title: '4. Diagnóstico',
            subtitle: 'Entender contexto',
            limit: 7,
            color: 'border-purple-200 bg-purple-50'
        },
        {
            id: 'QUALIFICACAO',
            title: '5. Qualificação',
            subtitle: 'Vale investir?',
            color: 'border-emerald-200 bg-emerald-50'
        }
    ];

    const getStageCount = (stage: ProspectStage) => MOCK_PROSPECTS.filter(p => p.stage === stage).length;

    return (
        <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden bg-[#F0F4F8]">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Target className="text-blue-600" />
                        Gestão de Prospecção
                    </h1>
                    <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
                        Funil de Novos Clientes
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg shadow-blue-600/20 transition-all active:scale-95 font-medium">
                        <Plus size={20} />
                        Novo Prospect
                    </button>
                </div>
            </div>

            {/* KANBAN BOARD */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                <div className="flex h-full gap-4 min-w-[1400px]">
                    {columns.map(col => {
                        const count = getStageCount(col.id);
                        const isOverLimit = col.limit ? count > col.limit : false;

                        return (
                            <div key={col.id} className={`flex-1 flex flex-col rounded-xl border ${col.color.split(' ')[0]} ${col.color.split(' ')[1]} backdrop-blur-sm min-w-[280px]`}>
                                {/* Column Header */}
                                <div className="p-3 border-b border-slate-200/50 flex flex-col gap-1 sticky top-0 bg-opacity-90 z-10">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-slate-800 text-sm truncate" title={col.title}>{col.title}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold shadow-sm ${isOverLimit ? 'bg-red-100 text-red-600' : 'bg-white text-slate-600'}`}>
                                            {count} {col.limit && <span className="text-slate-400 font-normal">/ {col.limit}</span>}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{col.subtitle}</span>
                                </div>

                                {/* Column Content */}
                                <div className="p-2 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                    {MOCK_PROSPECTS.filter(p => p.stage === col.id).map(card => (
                                        <motion.div
                                            key={card.id}
                                            whileHover={{ y: -2, scale: 1.01 }}
                                            className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                                        >
                                            {/* Left Stripe based on status? keeping generic blue for now */}
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-blue-600 rounded-l-lg" />

                                            {/* Header: Company & Action Menu */}
                                            <div className="flex justify-between items-start mb-2 pl-2">
                                                <div className="flex flex-col">
                                                    <h4 className="font-bold text-slate-800 text-sm leading-tight hover:text-blue-600 transition-colors">
                                                        {card.company}
                                                    </h4>
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                                                        <Building2 size={10} />
                                                        {card.location}
                                                    </div>
                                                </div>
                                                <button className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                                    <MoreVertical size={14} />
                                                </button>
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

                                                {/* Next Action - Highlighted */}
                                                <div className="bg-blue-50/50 rounded-md p-2 border border-blue-100/50 mt-1">
                                                    <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-blue-700 mb-1">
                                                        <Calendar size={10} />
                                                        Próxima Ação
                                                        <span className="ml-auto text-blue-600 font-normal normal-case">
                                                            {format(card.nextActionDate, "dd/MM", { locale: ptBR })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-700 font-medium line-clamp-2">
                                                        {card.nextAction}
                                                    </p>
                                                </div>
                                            </div>

                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

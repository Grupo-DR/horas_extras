import React, { useState } from 'react';
import {
    Search,
    Filter,
    Plus,
    MoreVertical,
    MapPin,
    Calendar,
    Building2,
    AlertTriangle,
    Clock,
    ArrowRight,
    User,
    MessageSquare
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, differenceInDays, addDays } from 'date-fns';
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

    // Rules & Mandatory Fields
    lastContactDate: Date;
    nextAction: string;
    nextActionDate: Date;
    strategicObservation: string; // 1 line max ideally

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
        lastContactDate: new Date('2024-01-10'), // > 15 days alert?
        nextAction: 'Buscar perfil no LinkedIn',
        nextActionDate: new Date('2024-01-28'),
        strategicObservation: ' Empresa em expansão no setor industrial.',
        tags: ['Industrial']
    },
    {
        id: '2',
        company: 'Incorporadora Modelo S.A.',
        contactName: 'Maria Santos',
        contactRole: 'Gerente de Suprimentos',
        stage: 'FAZER_CONTATO',
        location: 'Rio de Janeiro, RJ',
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
        lastContactDate: new Date('2023-12-15'), // Old! Should alert
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
        lastContactDate: new Date('2024-01-26'),
        nextAction: 'Validar orçamento com board',
        nextActionDate: new Date('2024-02-05'),
        strategicObservation: 'Budget aprovado, decisão em breve.',
        estimatedValue: 2000000
    }
];

// --- Components ---

const StatusBadge = ({ date }: { date: Date }) => {
    const days = differenceInDays(new Date(), date);

    if (days > 30) {
        return (
            <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100" title="Sem contato há mais de 30 dias">
                <AlertTriangle size={10} />
                <span>{days}d sem contato</span>
            </div>
        );
    }

    if (days > 15) {
        return (
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                <Clock size={10} />
                <span>{days}d</span>
            </div>
        );
    }

    return (
        <div className="text-[10px] text-slate-400 font-medium">
            {days === 0 ? 'Hoje' : `${days}d atrás`}
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
                        <User className="text-blue-600" />
                        Gestão de Prospecção
                    </h1>
                    <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
                        <span className="font-semibold text-slate-700">Regra de Ouro:</span>
                        “Contato sem ação agendada é cartão morto.”
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
                                            {/* Priority Stripe (?) or just clean look */}
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-blue-600 rounded-l-lg" />

                                            {/* Header: Company & Action Menu */}
                                            <div className="flex justify-between items-start mb-2 pl-2">
                                                <h4 className="font-bold text-slate-800 text-sm leading-tight hover:text-blue-600 transition-colors">
                                                    {card.company}
                                                </h4>
                                                <button className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                                    <MoreVertical size={14} />
                                                </button>
                                            </div>

                                            {/* Contact Info */}
                                            <div className="pl-2 mb-3">
                                                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                                    <User size={12} className="text-slate-400" />
                                                    {card.contactName}
                                                </div>
                                                <div className="text-[10px] text-slate-500 ml-4 truncate">
                                                    {card.contactRole}
                                                </div>
                                            </div>

                                            {/* Strategic Observation */}
                                            <div className="pl-2 mb-3">
                                                <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[10px] text-slate-600 italic leading-relaxed">
                                                    "{card.strategicObservation}"
                                                </div>
                                            </div>

                                            {/* Footer: Dates & Next Action (CRITICAL) */}
                                            <div className="pl-2 pt-2 border-t border-slate-50 flex flex-col gap-2">

                                                {/* Last Contact */}
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] text-slate-400">Último contato:</span>
                                                    <StatusBadge date={card.lastContactDate} />
                                                </div>

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

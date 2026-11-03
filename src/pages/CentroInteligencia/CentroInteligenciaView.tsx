import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Building2, CircleDollarSign, FileText, LineChart, Shield, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { canManageProfiles } from '../../modules/iam/types';
import { MarketTicker } from './MarketTicker';
import { BRAND_NAVY, PortalTopBar } from './PortalTopBar';
import { SectorEventsPanel } from './SectorEventsPanel';

/** Malha de "planta de engenharia" usada no destaque. */
const BLUEPRINT_GRID: React.CSSProperties = {
    backgroundImage:
        'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),' +
        'linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
    backgroundSize: '28px 28px'
};

interface ModuleTile {
    title: string;
    description: string;
    path: string;
    icon: React.ElementType;
}

const MODULES: ModuleTile[] = [
    { title: 'Financeiro', description: 'Relatórios financeiros para decisões estratégicas.', path: '/powerbi-viewer?area=Financeiro', icon: CircleDollarSign },
    { title: 'Capital Humano', description: 'Gestão de pessoas, headcount e horas extras.', path: '/human-capital', icon: Users },
    { title: 'Gestão de Contratos', description: 'Saúde financeira e prazos dos contratos de obra.', path: '/powerbi-viewer?area=Gestão de Contratos', icon: FileText },
    { title: 'Comercial', description: 'Prospecções, orçamentos e CRM de clientes.', path: '/commercial', icon: TrendingUp },
    { title: 'SSMA', description: 'Segurança, meio ambiente, alojamentos e frentes.', path: '/ssma', icon: ShieldCheck },
    { title: 'Obras', description: 'Produção nos canteiros e eficiência dos projetos.', path: '/construction-selection', icon: Building2 }
];

const IAM_MODULE: ModuleTile = {
    title: 'Painel Master (IAM)',
    description: 'Usuários, perfis de acesso e permissões.',
    path: '/admin/users',
    icon: Shield
};

/** "antonio.silva" → "Antonio"; "Renata Branco" → "Renata". */
const firstName = (name?: string): string => {
    const first = (name || '').trim().split(/[\s.]+/)[0] || '';
    return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
};

const greeting = (hour: number): string => (hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite');

/** Card de área, numerado como prancha técnica; inverte para azul-marinho no hover. */
const ModuleCard: React.FC<{ module: ModuleTile; index: number; onOpen: (path: string) => void }> = ({ module, index, onOpen }) => {
    const Icon = module.icon;
    return (
        <button
            type="button"
            onClick={() => onOpen(module.path)}
            className="group relative flex h-full min-h-[150px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left transition duration-300 hover:border-[#0b1d4f] hover:bg-[#0b1d4f] focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30"
        >
            <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-[#0b1d4f] transition group-hover:border-white/20 group-hover:bg-white/10 group-hover:text-white">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="font-mono text-xs font-semibold text-slate-300 transition group-hover:text-white/50">
                    {String(index + 1).padStart(2, '0')}
                </span>
            </div>
            <div className="mt-4">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900 transition group-hover:text-white">
                    {module.title}
                    <ArrowUpRight className="h-4 w-4 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
                </span>
                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-slate-500 transition group-hover:text-blue-100/80">
                    {module.description}
                </span>
            </div>
        </button>
    );
};

/** Atalho compacto para a página de Indicadores de Mercado, abaixo da agenda. */
const IndicatorsShortcut: React.FC<{ onOpen: () => void }> = ({ onOpen }) => (
    <button
        type="button"
        onClick={onOpen}
        className="group flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-[#0b1d4f] focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30"
    >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-[#0b1d4f]">
            <LineChart className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">Indicadores de Mercado</span>
            <span className="block truncate text-[11px] text-slate-500">Selic, inflação, INCC, dólar, Focus e PIB da construção</span>
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#0b1d4f]" aria-hidden="true" />
    </button>
);

export const CentroInteligenciaView: React.FC = () => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    const now = new Date();
    const today = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const modules = canManageProfiles(profile) ? [...MODULES, IAM_MODULE] : MODULES;
    const name = firstName(user?.name);

    return (
        // No desktop a tela cabe na janela (sem rolagem); só a agenda rola por dentro.
        <div className="flex min-h-screen flex-col bg-[#f3f5f9] lg:h-screen lg:overflow-hidden">
            <PortalTopBar />
            <MarketTicker />

            <main className="grid min-h-0 flex-1 gap-5 p-5 lg:grid-cols-12 lg:p-6">
                {/* Em janelas baixas a coluna rola sozinha em vez de cortar os cards. */}
                <div className="flex min-h-0 flex-col gap-5 lg:col-span-8 lg:overflow-y-auto xl:col-span-9">
                    <section
                        className="relative flex min-h-[176px] shrink-0 overflow-hidden rounded-3xl text-white lg:h-[30%] lg:max-h-[260px]"
                        style={{ backgroundColor: BRAND_NAVY }}
                    >
                        <div className="absolute inset-0" style={BLUEPRINT_GRID} aria-hidden="true" />
                        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" aria-hidden="true" />

                        <div className="relative z-10 flex flex-1 flex-col justify-center px-7 py-6 lg:px-10">
                            <p className="text-xs font-medium capitalize text-blue-200/80">{today}</p>
                            <h1 className="mt-1.5 text-3xl font-bold tracking-tight lg:text-4xl">
                                {greeting(now.getHours())}{name ? `, ${name}` : ''}
                            </h1>
                            <p className="mt-2 max-w-md text-sm text-blue-100/80">
                                Escolha uma área para começar.
                            </p>
                        </div>

                        <div className="relative hidden w-[42%] max-w-[560px] md:block">
                            <img
                                src="/assets/nova_capa.jpeg"
                                alt="Obra do Grupo DR vista do alto"
                                className="absolute inset-0 h-full w-full object-cover object-[center_42%]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-[#0b1d4f] via-[#0b1d4f]/40 to-transparent" aria-hidden="true" />
                        </div>
                    </section>

                    <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="areas">
                        <h2 id="areas" className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Áreas do portal
                        </h2>
                        <div className="grid flex-1 auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {modules.map((module, index) => (
                                <ModuleCard key={module.path} module={module} index={index} onOpen={navigate} />
                            ))}
                        </div>
                    </section>
                </div>

                <div className="flex max-h-[760px] min-h-0 flex-col gap-4 lg:col-span-4 lg:max-h-none xl:col-span-3">
                    <SectorEventsPanel className="flex-1" />
                    <IndicatorsShortcut onOpen={() => navigate('/indicadores')} />
                </div>
            </main>
        </div>
    );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Building2, CircleDollarSign, FileText, LogOut, Shield, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { canManageProfiles } from '../../modules/iam/types';
import { SectorEventsPanel } from './SectorEventsPanel';

interface ModuleTile {
    title: string;
    description: string;
    path: string;
    icon: React.ElementType;
    /** Fundo e cor do ícone. */
    accent: string;
}

const MODULES: ModuleTile[] = [
    {
        title: 'Financeiro',
        description: 'Relatórios financeiros para apoiar gestores em decisões estratégicas.',
        path: '/powerbi-viewer?area=Financeiro',
        icon: CircleDollarSign,
        accent: 'bg-blue-50 text-blue-600'
    },
    {
        title: 'Capital Humano',
        description: 'Gestão de pessoas e horas extras, essencial para a saúde da empresa.',
        path: '/human-capital',
        icon: Users,
        accent: 'bg-emerald-50 text-emerald-600'
    },
    {
        title: 'Gestão de Contratos',
        description: 'Gestão contratual de obras para garantir saúde financeira e prazos.',
        path: '/powerbi-viewer?area=Gestão de Contratos',
        icon: FileText,
        accent: 'bg-indigo-50 text-indigo-600'
    },
    {
        title: 'Comercial',
        description: 'Prospecções, orçamentos, inteligência comercial e CRM de clientes.',
        path: '/commercial',
        icon: TrendingUp,
        accent: 'bg-orange-50 text-orange-600'
    },
    {
        title: 'SSMA',
        description: 'Inspeções de segurança, meio ambiente, alojamentos e frentes de serviço.',
        path: '/ssma',
        icon: ShieldCheck,
        accent: 'bg-teal-50 text-teal-600'
    },
    {
        title: 'Obras',
        description: 'Acompanhamento e produção nos canteiros e eficiência de projetos.',
        path: '/construction-selection',
        icon: Building2,
        accent: 'bg-amber-50 text-amber-600'
    }
];

const IAM_MODULE: ModuleTile = {
    title: 'Painel Master (IAM)',
    description: 'Gestão de usuários, perfis de acesso e permissões dos módulos.',
    path: '/admin/users',
    icon: Shield,
    accent: 'bg-rose-50 text-rose-600'
};

/** "antonio.silva" → "Antonio"; "Renata Branco" → "Renata". */
const firstName = (name?: string): string => {
    const first = (name || '').trim().split(/[\s.]+/)[0] || '';
    return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
};

const greeting = (hour: number): string => (hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite');

const initials = (name?: string): string =>
    (name || 'US').split(/[\s.]+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();

const ModuleCard: React.FC<{ module: ModuleTile; onOpen: (path: string) => void }> = ({ module, onOpen }) => {
    const Icon = module.icon;
    return (
        <button
            type="button"
            onClick={() => onOpen(module.path)}
            className="group relative flex flex-col items-start rounded-3xl border border-slate-200/70 bg-white/80 p-6 text-left shadow-sm backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/60 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30"
        >
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${module.accent} transition duration-300 group-hover:scale-110`}>
                <Icon className="h-6 w-6" />
            </span>
            <span className="mt-5 text-base font-semibold text-slate-900">{module.title}</span>
            <span className="mt-1.5 text-sm leading-relaxed text-slate-500">{module.description}</span>
            <ArrowUpRight
                className="absolute right-5 top-5 h-5 w-5 text-slate-300 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-600"
                aria-hidden="true"
            />
        </button>
    );
};

export const CentroInteligenciaView: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout, profile } = useAuth();

    const now = new Date();
    const today = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const modules = canManageProfiles(profile) ? [...MODULES, IAM_MODULE] : MODULES;
    const name = firstName(user?.name);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div
            className="min-h-full bg-slate-50"
            style={{
                backgroundImage:
                    'radial-gradient(60rem 30rem at 10% -10%, rgba(59,130,246,0.14), transparent 60%),' +
                    'radial-gradient(50rem 28rem at 95% 0%, rgba(11,29,79,0.10), transparent 60%)'
            }}
        >
            <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <img src="/assets/dr-logo.png" alt="Grupo DR" className="h-8 w-auto" />
                        <span className="h-6 w-px bg-slate-200" aria-hidden="true" />
                        <span className="text-sm font-semibold tracking-tight text-slate-700">Centro de Inteligência</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-semibold leading-tight text-slate-800">{user?.name || 'Usuário'}</p>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{user?.role || 'Membro'}</p>
                        </div>
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
                        ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0b1d4f] text-xs font-bold text-white">
                                {initials(user?.name)}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={handleLogout}
                            title="Sair"
                            aria-label="Sair"
                            className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 pb-16 pt-10">
                <section className="mb-10">
                    <p className="text-sm font-medium capitalize text-slate-500">{today}</p>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                        {greeting(now.getHours())}{name ? `, ${name}` : ''}
                    </h1>
                    <p className="mt-2 max-w-2xl text-slate-500">
                        Escolha uma área para acessar indicadores, rotinas e relatórios do Grupo DR.
                    </p>
                </section>

                <div className="grid gap-8 xl:grid-cols-3">
                    <section className="xl:col-span-2" aria-labelledby="areas">
                        <h2 id="areas" className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Áreas do portal
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {modules.map(module => (
                                <ModuleCard key={module.path} module={module} onOpen={navigate} />
                            ))}
                        </div>
                    </section>

                    <SectorEventsPanel />
                </div>
            </main>
        </div>
    );
};

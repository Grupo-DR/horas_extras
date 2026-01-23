import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Database, BarChart, Settings, CheckSquare, Users, LogOut, User as UserIcon } from 'lucide-react';
import { AppModule } from '../types';
import { useAuth } from '../contexts/AuthContext';

import { ModuleKey } from '../types/auth'; // Import ModuleKey

export const Sidebar: React.FC = () => {

    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Helper to check permission
    const canView = (module: ModuleKey) => {
        if (!user) return false;
        if (user.systemRole === 'ADMIN') return true;
        const access = user.permissions?.[module];
        return access === 'VIEW' || access === 'EDIT';
    };

    const menuItems = [
        {
            module: AppModule.COMMERCIAL,
            label: 'Comercial',
            icon: LayoutDashboard,
            path: '/comercial',
            authModule: 'commercial_dashboard' as ModuleKey
        },
        {
            module: AppModule.CONTRACTS,
            label: 'Contratos',
            icon: FileText,
            path: '/contratos',
            authModule: 'financial' as ModuleKey
        },
        {
            module: AppModule.DATA_CENTER,
            label: 'Dados',
            icon: Database,
            path: '/dados',
            authModule: 'strategic_planning' as ModuleKey
        },
        {
            module: AppModule.KPI,
            label: 'KPIs',
            icon: BarChart,
            path: '/kpis',
            authModule: 'strategic_planning' as ModuleKey // KPIs usually strategic
        },
        {
            module: 'ACTIONS',
            label: 'Ações',
            icon: CheckSquare,
            path: '/acoes',
            authModule: 'operational_planning' as ModuleKey
        },
        {
            module: 'CRM',
            label: 'Relacionamento',
            icon: Users,
            path: '/crm',
            authModule: 'crm' as ModuleKey
        },
    ];

    const visibleItems = menuItems.filter(item => canView(item.authModule));

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="fixed left-0 top-0 h-full w-20 hover:w-72 flex flex-col items-center py-6 bg-white border-r border-slate-200 shadow-xl z-50 transition-all duration-300 group overflow-hidden">
            {/* BRAND */}
            <div className="mb-8 flex justify-center w-full shrink-0">
                <div className="flex flex-col items-center gap-2 group-hover:items-start group-hover:px-6 transition-all duration-300 w-full">
                    <img
                        src="/assets/dr-logo.png"
                        alt="DR"
                        className="h-7 w-auto object-contain transition-all duration-300 group-hover:h-8"
                        draggable={false}
                    />
                    <img
                        src="/assets/nexus.png"
                        alt="Nexus"
                        className="h-4 w-auto object-contain transition-all duration-300 group-hover:h-5"
                        draggable={false}
                    />
                </div>
            </div>

            {/* NAV */}
            <nav className="flex-1 flex flex-col gap-4 w-full px-3 shrink-0">
                {visibleItems.map((item) => (
                    <NavLink
                        key={item.module}
                        to={item.path}
                        className={({ isActive }) => `
              relative flex items-center justify-center group-hover:justify-start group-hover:px-4 p-3 rounded-xl transition-all duration-300 gap-3
              ${isActive
                                ? 'bg-blue-50 text-blue-600 shadow-inner'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                            }
            `}
                    >
                        <item.icon size={22} strokeWidth={2} className="shrink-0 transition-transform hover:scale-110" />

                        {/* Label - Hidden on Collapse, Visible on Hover */}
                        <span className="text-sm font-semibold opacity-0 whitespace-nowrap group-hover:opacity-100 transition-opacity duration-300 absolute left-14 group-hover:static group-hover:translate-x-0 w-0 group-hover:w-auto overflow-hidden">
                            {item.label}
                        </span>

                        {/* Collapsed Tooltip (Only visible when NOT hovered on sidebar group? No, hard to do pure CSS without conflict. Kept simple: Hover expands sidebar, so tooltip logic changes) */}
                        {/* Actually, if sidebar expands, we don't need the tooltip. I'll remove the tooltip logic as the expansion serves the purpose better and cleaner. */}

                        {/* Active Indicator */}
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full scale-0 opacity-0 transition-all duration-300 data-[active=true]:scale-100 data-[active=true]:opacity-100" />
                    </NavLink>
                ))}

                {/* Settings Link - Admin Only */}
                {user?.systemRole === 'ADMIN' && (
                    <NavLink
                        to="/config/equipe"
                        className={({ isActive }) => `
              relative flex items-center justify-center group-hover:justify-start group-hover:px-4 p-3 rounded-xl transition-all duration-300 gap-3 mt-2
              ${isActive
                                ? 'bg-indigo-50 text-indigo-600 shadow-inner'
                                : 'text-slate-400 hover:text-indigo-600 hover:bg-white/50'
                            }
            `}
                    >
                        <Settings size={22} strokeWidth={2} className="shrink-0 transition-transform hover:scale-110" />
                        <span className="text-sm font-semibold opacity-0 whitespace-nowrap group-hover:opacity-100 transition-opacity duration-300 w-0 group-hover:w-auto overflow-hidden">
                            Gestão de Equipe
                        </span>
                    </NavLink>
                )}
            </nav>

            {/* USER FOOTER */}
            <div className="mt-auto w-full px-3 pt-4 border-t border-slate-100 shrink-0">
                <div className="flex items-center justify-center group-hover:justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-white group-hover:border-slate-200 transition-all duration-300 gap-2 overflow-hidden relative min-h-[50px]">

                    {/* Avatar */}
                    <div className="shrink-0">
                        {user?.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt={user.name}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm"
                            />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold border border-blue-700 shadow-sm">
                                {getInitials(user?.name || 'User')}
                            </div>
                        )}
                    </div>

                    {/* Identification - Visible ONLY on Group Hover */}
                    <NavLink to="/config/conta" className="flex flex-col min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-0 group-hover:w-auto group-hover:flex-1 hover:bg-slate-100/50 rounded p-1 cursor-pointer">
                        <span className="text-sm font-semibold text-slate-700 truncate block">
                            {user?.name || 'Usuário'}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium truncate block">
                            {user?.role || 'Membro'}
                        </span>
                    </NavLink>

                    {/* Logout - Visible ONLY on Group Hover */}
                    <button
                        onClick={handleLogout}
                        title="Sair"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 w-0 group-hover:w-auto disabled:opacity-0"
                    >
                        <LogOut size={18} />
                    </button>

                </div>
            </div>
        </aside>
    );
};


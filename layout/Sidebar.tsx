import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Database, BarChart, Settings, CheckSquare } from 'lucide-react';
import { AppModule } from '../types';

export const Sidebar: React.FC = () => {
    const menuItems = [
        { module: AppModule.COMMERCIAL, label: 'Comercial', icon: LayoutDashboard, path: '/comercial' },
        { module: AppModule.CONTRACTS, label: 'Contratos', icon: FileText, path: '/contratos' },
        { module: AppModule.DATA_CENTER, label: 'Dados', icon: Database, path: '/dados' },
        { module: AppModule.KPI, label: 'KPIs', icon: BarChart, path: '/kpis' },
        { module: 'ACTIONS', label: 'Ações', icon: CheckSquare, path: '/acoes' }, // New Module
    ];

    return (
        <aside className="fixed left-0 top-0 h-full w-20 flex flex-col items-center py-6 bg-white border-r border-slate-200 shadow-xl z-50">
            {/* BRAND */}
            <div className="mb-8 flex justify-center w-full">
                <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <span className="text-white font-black text-xs tracking-tighter">DR</span>
                </div>
            </div>

            {/* NAV */}
            <nav className="flex-1 flex flex-col gap-4 w-full px-3">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.module}
                        to={item.path}
                        className={({ isActive }) => `
              relative group flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-300
              ${isActive
                                ? 'bg-blue-50 text-blue-600 shadow-inner'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                            }
            `}
                    >
                        <item.icon size={22} strokeWidth={2} className="mb-1 transition-transform group-hover:scale-110" />
                        <span className="text-[9px] font-bold tracking-wide uppercase opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-2 bg-slate-800 text-white px-1.5 py-0.5 rounded shadow-lg pointer-events-none z-50 whitespace-nowrap">
                            {item.label}
                        </span>

                        {/* Active Indicator */}
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full scale-0 opacity-0 transition-all duration-300 data-[active=true]:scale-100 data-[active=true]:opacity-100" />
                    </NavLink>
                ))}
            </nav>

            <button className="mt-auto p-3 text-slate-400 hover:text-slate-600 transition-colors">
                <Settings size={20} />
            </button>
        </aside>
    );
};

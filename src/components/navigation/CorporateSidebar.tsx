import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, Grid, ChevronLeft, ChevronRight } from 'lucide-react';
import { ModuleSwitcher } from '../ModuleSwitcher';

export type SidebarItem = {
    key: string;
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    onClick?: () => void;
    to?: string;
    isActive?: boolean;
    authModule?: string;
};

export type SidebarBrand = {
    topLogoSrc?: string;
    secondLogoSrc?: string;
    title?: string;
    subtitle?: string;
};

export type CorporateSidebarProps = {
    brand: SidebarBrand;
    items: SidebarItem[];
    userDisplay: { name: string; role?: string; avatarUrl?: string };
    onLogout: () => void;
    accountLinkTo?: string;
    storageKey?: string;
};

export const CorporateSidebar: React.FC<CorporateSidebarProps> = ({
    brand,
    items,
    userDisplay,
    onLogout,
    accountLinkTo = '#'
}) => {
    const [isModuleSwitcherOpen, setIsModuleSwitcherOpen] = useState(false);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    return (
        <>
            <ModuleSwitcher isOpen={isModuleSwitcherOpen} onClose={() => setIsModuleSwitcherOpen(false)} />
            {/* The wrapper handles layout space. The inner aside is absolute so it can overlap on hover without pushing the main content constantly. */}
            <div className={`relative h-screen shrink-0 transition-all duration-300 w-20`}>
                <aside
                    className={`absolute left-0 top-0 h-full flex flex-col pt-6 pb-4 bg-white border-r border-slate-200 shadow-xl z-50 transition-all duration-300 overflow-hidden group hover:w-72 w-20`}
                >
                    {/* BRAND */}
                    <div className="mb-8 flex justify-center w-full shrink-0">
                        <div className={`flex flex-col items-center gap-2 transition-all duration-300 w-full group-hover:items-start group-hover:px-6`}>
                            {brand.topLogoSrc && (
                                <img
                                    src={brand.topLogoSrc}
                                    alt="Brand Logo"
                                    className={`w-auto object-contain transition-all duration-300 h-7 group-hover:h-8`}
                                    draggable={false}
                                />
                            )}

                            {brand.secondLogoSrc ? (
                                <img
                                    src={brand.secondLogoSrc}
                                    alt="Secondary Logo"
                                    className={`w-auto object-contain transition-all duration-300 mt-1 h-4 group-hover:h-5`}
                                    draggable={false}
                                />
                            ) : (
                                (brand.title || brand.subtitle) && (
                                    <div className={`transition-opacity duration-300 mt-1 flex flex-col items-start whitespace-nowrap opacity-0 h-0 w-0 overflow-hidden group-hover:opacity-100 group-hover:h-auto group-hover:w-auto`}>
                                        {brand.title && <span className="text-sm font-bold text-gray-900 leading-tight block">{brand.title}</span>}
                                        {brand.subtitle && <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block">{brand.subtitle}</span>}
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    {/* NAV */}
                    <nav className="flex-1 flex flex-col gap-4 w-full px-3 shrink-0 overflow-hidden" style={{ scrollbarWidth: 'none' }}>
                        {items.map((item) => {
                            const content = (
                                <>
                                    <item.icon size={22} strokeWidth={2} className="shrink-0 transition-transform group-hover:scale-110" />

                                    {/* Label */}
                                    <span className={`text-sm font-semibold whitespace-nowrap transition-all duration-300 absolute left-14 opacity-0 w-0 group-hover:static group-hover:opacity-100 group-hover:translate-x-0 group-hover:w-auto`}>
                                        {item.label}
                                    </span>

                                    {/* Active Indicator */}
                                    <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full transition-all duration-300 ${item.isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
                                </>
                            );

                            const baseClasses = `relative flex items-center p-3 rounded-xl transition-all duration-300 group/item justify-center group-hover:justify-start group-hover:px-4
                            ${item.isActive
                                    ? 'bg-blue-50 text-blue-600 shadow-inner'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`;

                            if (item.to) {
                                return (
                                    <NavLink
                                        key={item.key}
                                        to={item.to}
                                        className={({ isActive }) => `
                                        ${baseClasses}
                                        ${isActive ? 'bg-blue-50 text-blue-600 shadow-inner' : ''}
                                    `}
                                    >
                                        {({ isActive: routeActive }) => (
                                            <>
                                                <item.icon size={22} strokeWidth={2} className="shrink-0 transition-transform group-hover/item:scale-110" />
                                                <span className={`text-sm font-semibold whitespace-nowrap transition-all duration-300 absolute left-14 opacity-0 w-0 group-hover:static group-hover:opacity-100 group-hover:translate-x-0 group-hover:w-auto overflow-hidden`}>
                                                    {item.label}
                                                </span>

                                                <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full transition-all duration-300 ${routeActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
                                            </>
                                        )}
                                    </NavLink>
                                );
                            } else {
                                return (
                                    <button
                                        key={item.key}
                                        onClick={item.onClick}
                                        className={baseClasses}
                                    >
                                        {content}
                                    </button>
                                );
                            }
                        })}
                    </nav>

                    {/* USER FOOTER */}
                    <div className="mt-auto w-full px-3 pt-4 border-t border-slate-100 shrink-0">
                        <div className={`flex items-center p-2 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-slate-200 transition-all duration-300 gap-2 overflow-hidden relative min-h-[50px] justify-center group-hover:justify-between`}>

                            {/* Avatar */}
                            <div className="shrink-0 group/avatar relative cursor-pointer">
                                {userDisplay.avatarUrl ? (
                                    <img
                                        src={userDisplay.avatarUrl}
                                        alt={userDisplay.name}
                                        className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm"
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold border border-blue-700 shadow-sm">
                                        {getInitials(userDisplay.name || 'User')}
                                    </div>
                                )}
                            </div>

                            {/* Details - Visible ONLY when Expanded or Hovered */}
                            <div className={`flex items-center overflow-hidden transition-all duration-300 opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto group-hover:flex-1`}>
                                {accountLinkTo && accountLinkTo !== '#' ? (
                                    <NavLink to={accountLinkTo} className="flex flex-col min-w-0 flex-1 hover:bg-slate-100/50 rounded p-1 cursor-pointer">
                                        <span className="text-sm font-semibold text-slate-700 truncate block">
                                            {userDisplay.name || 'Usuário'}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium truncate block">
                                            {userDisplay.role || 'Membro'}
                                        </span>
                                    </NavLink>
                                ) : (
                                    <div className="flex flex-col min-w-0 flex-1 p-1">
                                        <span className="text-sm font-semibold text-slate-700 truncate block">
                                            {userDisplay.name || 'Usuário'}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium truncate block">
                                            {userDisplay.role || 'Membro'}
                                        </span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center">
                                    <button
                                        onClick={() => setIsModuleSwitcherOpen(true)}
                                        title="Trocar Módulo"
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                                    >
                                        <Grid size={18} />
                                    </button>

                                    <button
                                        onClick={onLogout}
                                        title="Sair"
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                    >
                                        <LogOut size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </>
    );
};

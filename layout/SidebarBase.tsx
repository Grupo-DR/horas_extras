import React from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';

export type SidebarItem = {
    key: string;
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    onClick?: () => void;
    to?: string;
    isActive?: boolean;
    authModule?: string; // Optional permission check key if needed externally, though filtering should happen before passing items
};

export type SidebarBrand = {
    topLogoSrc?: string;
    secondLogoSrc?: string;
    title?: string;
    subtitle?: string;
};

export type SidebarBaseProps = {
    brand: SidebarBrand;
    items: SidebarItem[];
    userDisplay: { name: string; role?: string; avatarUrl?: string };
    onLogout: () => void;
    accountLinkTo?: string; // Optional link for the profile section
};

export const SidebarBase: React.FC<SidebarBaseProps> = ({
    brand,
    items,
    userDisplay,
    onLogout,
    accountLinkTo = '#'
}) => {
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    return (
        <aside className="fixed left-0 top-0 h-full w-20 hover:w-72 flex flex-col items-center py-6 bg-white border-r border-slate-200 shadow-xl z-50 transition-all duration-300 group overflow-hidden">
            {/* BRAND */}
            <div className="mb-8 flex justify-center w-full shrink-0">
                <div className="flex flex-col items-center gap-2 group-hover:items-start group-hover:px-6 transition-all duration-300 w-full">
                    {brand.topLogoSrc && (
                        <img
                            src={brand.topLogoSrc}
                            alt="Brand Logo"
                            className="h-7 w-auto object-contain transition-all duration-300 group-hover:h-8"
                            draggable={false}
                        />
                    )}

                    {brand.secondLogoSrc ? (
                        <img
                            src={brand.secondLogoSrc}
                            alt="Secondary Logo"
                            className="h-4 w-auto object-contain transition-all duration-300 group-hover:h-5 mt-1"
                            draggable={false}
                        />
                    ) : (
                        (brand.title || brand.subtitle) && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 mt-1 flex flex-col items-start whitespace-nowrap">
                                {brand.title && <span className="text-sm font-bold text-gray-900 leading-tight">{brand.title}</span>}
                                {brand.subtitle && <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{brand.subtitle}</span>}
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* NAV */}
            <nav className="flex-1 flex flex-col gap-4 w-full px-3 shrink-0">
                {items.map((item) => {
                    const content = (
                        <>
                            <item.icon size={22} strokeWidth={2} className="shrink-0 transition-transform hover:scale-110" />

                            {/* Label */}
                            <span className="text-sm font-semibold opacity-0 whitespace-nowrap group-hover:opacity-100 transition-opacity duration-300 absolute left-14 group-hover:static group-hover:translate-x-0 w-0 group-hover:w-auto overflow-hidden">
                                {item.label}
                            </span>

                            {/* Active Indicator */}
                            <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full scale-0 opacity-0 transition-all duration-300 ${item.isActive ? 'scale-100 opacity-100' : ''}`} />
                        </>
                    );

                    const baseClasses = `relative flex items-center justify-center group-hover:justify-start group-hover:px-4 p-3 rounded-xl transition-all duration-300 gap-3
                        ${item.isActive
                            ? 'bg-blue-50 text-blue-600 shadow-inner'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
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
                            // Note: NavLink handles isActive internally via context usually, but if we pass isActive prop explicitly it overrides or we can rely on NavLink's callback style. 
                            // Here we used the callback style in the original. 
                            // To support both modes (NavLink handling active state vs passed prop), we might need to adjust.
                            // For simplicity and strictly following the requirement "If to exists render as NavLink", we leave generic NavLink behavior.
                            // BUT, we need to ensure styling consistency.
                            // Let's use the className callback if it's a NavLink to ensure it behaves exactly like the original.
                            >
                                {({ isActive: routeActive }) => (
                                    <>
                                        <item.icon size={22} strokeWidth={2} className="shrink-0 transition-transform hover:scale-110" />
                                        <span className="text-sm font-semibold opacity-0 whitespace-nowrap group-hover:opacity-100 transition-opacity duration-300 absolute left-14 group-hover:static group-hover:translate-x-0 w-0 group-hover:w-auto overflow-hidden">
                                            {item.label}
                                        </span>
                                        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full scale-0 opacity-0 transition-all duration-300 ${routeActive ? 'scale-100 opacity-100' : ''}`} />
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
                <div className="flex items-center justify-center group-hover:justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-white group-hover:border-slate-200 transition-all duration-300 gap-2 overflow-hidden relative min-h-[50px]">

                    {/* Avatar */}
                    <div className="shrink-0">
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

                    {/* Identification - Visible ONLY on Group Hover */}
                    {accountLinkTo && accountLinkTo !== '#' ? (
                        <NavLink to={accountLinkTo} className="flex flex-col min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-0 group-hover:w-auto group-hover:flex-1 hover:bg-slate-100/50 rounded p-1 cursor-pointer">
                            <span className="text-sm font-semibold text-slate-700 truncate block">
                                {userDisplay.name || 'Usuário'}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium truncate block">
                                {userDisplay.role || 'Membro'}
                            </span>
                        </NavLink>
                    ) : (
                        <div className="flex flex-col min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-0 group-hover:w-auto group-hover:flex-1 p-1">
                            <span className="text-sm font-semibold text-slate-700 truncate block">
                                {userDisplay.name || 'Usuário'}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium truncate block">
                                {userDisplay.role || 'Membro'}
                            </span>
                        </div>
                    )}

                    {/* Logout - Visible ONLY on Group Hover */}
                    <button
                        onClick={onLogout}
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

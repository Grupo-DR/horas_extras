import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

export const BRAND_NAVY = '#0b1d4f';

const initials = (name?: string): string =>
    (name || 'US').split(/[\s.]+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();

/** Barra superior do portal: logo (volta ao início), usuário e sair. */
export const PortalTopBar: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-8">
            <button type="button" onClick={() => navigate('/')} className="flex items-center gap-3" aria-label="Ir para o início">
                <img src="/assets/dr-logo.png" alt="Grupo DR" className="h-8 w-auto" />
                <span className="h-6 w-px bg-slate-200" aria-hidden="true" />
                <span className="text-sm font-semibold tracking-tight text-slate-700">Centro de Inteligência</span>
            </button>
            <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold leading-tight text-slate-800">{user?.name || 'Usuário'}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{user?.role || 'Membro'}</p>
                </div>
                {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
                ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: BRAND_NAVY }}>
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
        </header>
    );
};

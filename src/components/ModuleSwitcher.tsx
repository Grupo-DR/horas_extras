import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, LayoutDashboard, Users, HardHat, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ModuleSwitcherProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ModuleSwitcher: React.FC<ModuleSwitcherProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, profile, hasModuleAccess } = useAuth();

    if (!isOpen) return null;

    const modules = [
        {
            id: 'commercial',
            name: 'Comercial & Contratos',
            description: 'Gestão de contratos, CRM e prospecção.',
            icon: LayoutDashboard,
            path: '/',
            color: 'bg-blue-600',
            textColor: 'text-blue-600',
            bgLight: 'bg-blue-50',
            allowed: profile?.isSuperAdmin || hasModuleAccess('commercial')
        },
        {
            id: 'human_capital',
            name: 'Capital Humano',
            description: 'Controle de horas, planejamento e efetivo.',
            icon: Users,
            path: '/human-capital',
            color: 'bg-emerald-600',
            textColor: 'text-emerald-600',
            bgLight: 'bg-emerald-50',
            allowed: profile?.isSuperAdmin || hasModuleAccess('human_capital')
        },
        {
            id: 'construction',
            name: 'Gestão de Obras',
            description: 'RDOs, medições e acompanhamento de obras.',
            icon: HardHat,
            path: '/construction',
            color: 'bg-amber-600',
            textColor: 'text-amber-600',
            bgLight: 'bg-amber-50',
            allowed: profile?.isSuperAdmin || !!(profile?.modules?.construction?.enabled)
        }
    ];

    const handleNavigate = (path: string) => {
        navigate(path);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100 opacity-100">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Navegação entre Módulos</h2>
                        <p className="text-sm text-gray-500 mt-1">Selecione o módulo que deseja acessar</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {modules.map((module) => {
                        const isCurrent = module.path === '/'
                            ? location.pathname === '/' || (!location.pathname.startsWith('/human-capital') && !location.pathname.startsWith('/construction'))
                            : location.pathname.startsWith(module.path);

                        return (
                            <button
                                key={module.id}
                                onClick={() => module.allowed && handleNavigate(module.path)}
                                disabled={!module.allowed}
                                className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all duration-200 group relative overflow-hidden
                  ${isCurrent
                                        ? `border-${module.textColor.split('-')[1]}-200 bg-${module.textColor.split('-')[1]}-50 ring-2 ring-${module.textColor.split('-')[1]}-500 ring-offset-2`
                                        : 'border-gray-100 hover:border-gray-200 hover:shadow-lg'
                                    }
                  ${!module.allowed ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                `}
                            >
                                <div className={`w-12 h-12 rounded-xl ${module.bgLight} ${module.textColor} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                                    <module.icon size={24} />
                                </div>

                                <div className="space-y-1 relative z-10">
                                    <h3 className={`font-bold ${isCurrent ? module.textColor : 'text-gray-900'}`}>{module.name}</h3>
                                    <p className="text-xs text-gray-500 leading-relaxed min-h-[40px]">{module.description}</p>
                                </div>

                                {!isCurrent && module.allowed && (
                                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                        <ArrowRight size={16} className={`${module.textColor}`} />
                                    </div>
                                )}

                                {isCurrent && (
                                    <div className="absolute top-4 right-4">
                                        <span className="relative flex h-3 w-3">
                                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${module.color} opacity-75`}></span>
                                            <span className={`relative inline-flex rounded-full h-3 w-3 ${module.color}`}></span>
                                        </span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-500">
                        O acesso aos módulos é controlado pelas permissões do seu perfil.
                    </p>
                </div>
            </div>
        </div>
    );
};

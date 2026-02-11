import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, CheckSquare, Users, Target, Settings } from 'lucide-react';
import { AppModule } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ModuleKey } from '../types/auth';
import { SidebarBase, SidebarItem } from './SidebarBase';
import { canManageProfiles } from '../src/modules/iam/types';

export const Sidebar: React.FC = () => {

    const { user, logout, profile } = useAuth();
    const navigate = useNavigate();

    // Helper to check permission
    const canView = (module: ModuleKey) => {
        if (!user) return false;
        if (user.systemRole === 'ADMIN') return true;
        const access = user.permissions?.[module];
        return access === 'VIEW' || access === 'EDIT';
    };

    const rawItems = [
        {
            module: AppModule.COMMERCIAL,
            label: 'Comercial',
            icon: LayoutDashboard,
            path: '/',
            authModule: 'commercial_dashboard' as ModuleKey
        },
        {
            module: 'PROSPECTING',
            label: 'Prospecção',
            icon: Target,
            path: '/prospecting',
            authModule: 'commercial_dashboard' as ModuleKey
        },
        {
            module: AppModule.CONTRACTS,
            label: 'Contratos',
            icon: FileText,
            path: '/contracts',
            authModule: 'contracts' as ModuleKey
        },
        {
            module: 'ACTIONS',
            label: 'Ações',
            icon: CheckSquare,
            path: '/actions',
            authModule: 'operational_planning' as ModuleKey
        },
        {
            module: 'CRM',
            label: 'Clientes',
            icon: Users,
            path: '/crm/clients',
            authModule: 'crm' as ModuleKey
        },

    ];

    const visibleItems = rawItems.filter(item => canView(item.authModule));

    // Map to SidebarItem format
    const sidebarItems: SidebarItem[] = visibleItems.map(item => ({
        key: item.module,
        label: item.label,
        icon: item.icon,
        to: item.path,
    }));

    // Add Settings if Admin
    if (user?.systemRole === 'ADMIN') {
        sidebarItems.push({
            key: 'SETTINGS',
            label: 'Gestão de Equipe',
            icon: Settings,
            to: '/config/team'
        });
    }

    // Add IAM if has permission
    if (canManageProfiles(profile)) {
        sidebarItems.push({
            key: 'IAM',
            label: 'Gestão de Usuários',
            icon: Users,
            to: '/users'
        });
    }


    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <SidebarBase
            brand={{
                topLogoSrc: "/assets/dr-logo.png",
                secondLogoSrc: "/assets/nexus.png"
            }}
            items={sidebarItems}
            userDisplay={{
                name: user?.name || 'Usuário',
                role: user?.role || 'Membro',
                avatarUrl: user?.avatarUrl
            }}
            onLogout={handleLogout}
            accountLinkTo="/config/account"
        />
    );
};

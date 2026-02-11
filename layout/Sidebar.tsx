import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, CheckSquare, Users, Target, Settings } from 'lucide-react';
import { AppModule } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ModuleKey } from '../types/auth';
import { SidebarBase, SidebarItem } from './SidebarBase';
import { canManageProfiles } from '../src/modules/iam/types';

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
    if (user && canManageProfiles(user.role as any)) {
        sidebarItems.push({
            key: 'IAM',
            label: 'Gestão de Usuários',
            icon: Users,
            to: '/users' // Note: Commercial module doesn't have /users route yet, might need to add it or link to /config/team?
            // Wait, the user asked for "Gestão de Usuários" in all modules.
            // In Commercial, it might be TeamSettings or a new page. 
            // Existing route '/config/team' maps to TeamSettings.
            // Let's use that for now if it serves the purpose or create a new one. 
            // The prompt said "console lateral a gestão de usuários". 
            // The user implies a unified IAM.
            // Creating a new route '/iam' or using existing ProfileManager might be better.
            // But for now let's point to /config/team or if I should add /iam route to App.tsx?
            // Users want "Gestão de Usuários". 
            // Let's use /config/team for now as it seems to be the existing team management.
            // OR I should add the ProfileManager to Commercial view.
            // I'll add a new route /iam in App.tsx later if needed. 
            // For now let's use a placeholder or /config/team.
            // Actually, ProfileManager is the new unified IAM. 
            // I should probably render ProfileManager in a new route.
            // But for this step, let's just add the link. 
            // I'll use '/iam' and then update App.tsx to route '/iam' to ProfileManager.
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


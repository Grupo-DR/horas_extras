import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileCheck, Database, Gavel } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CorporateSidebar, SidebarItem } from '../../components/navigation/CorporateSidebar';
import { canManageSSMARegisters, hasSSMAAccess } from './domain/permissions';

import { SSMADashboard } from './components/Dashboard/SSMADashboard';
import { InspectionEventList } from './components/Inspections/InspectionEventList';
import RegistersView from './components/Registers/RegistersView';
import { RulesView } from './components/Rules/RulesView';

type Tab = 'dashboard' | 'inspections' | 'registers' | 'rules';

export default function SSMAApp() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const { profile, logout: signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut();
    navigate('/login');
  };

  const sidebarItems: SidebarItem[] = useMemo(() => {
    const items: SidebarItem[] = [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, onClick: () => setActiveTab('dashboard'), isActive: activeTab === 'dashboard' },
      { key: 'inspections', label: 'Inspeções', icon: FileCheck, onClick: () => setActiveTab('inspections'), isActive: activeTab === 'inspections' },
    ];
    if (canManageSSMARegisters(profile)) {
      items.push({ key: 'registers', label: 'Cadastros', icon: Database, onClick: () => setActiveTab('registers'), isActive: activeTab === 'registers' });
    }
    if (hasSSMAAccess(profile)) {
      items.push({ key: 'rules', label: 'Metas', icon: Gavel, onClick: () => setActiveTab('rules'), isActive: activeTab === 'rules' });
    }
    return items;
  }, [activeTab, profile]);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Saúde, Segurança e Meio Ambiente';
      case 'inspections': return 'Inspeções SSMA';
      case 'registers': return 'Cadastros e Entidades';
      case 'rules': return 'Metas SSMA';
      default: return 'SSMA';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <CorporateSidebar
        brand={{ topLogoSrc: "/assets/dr-logo.png", title: "SSMA", subtitle: "Gestão de Inspeções" }}
        items={sidebarItems}
        userDisplay={{
          name: profile?.displayName || 'Usuário',
          role: profile?.modules?.ssma?.role || 'Membro',
          avatarUrl: profile?.avatarUrl
        }}
        onLogout={handleLogout}
        accountLinkTo="/config/account"
        storageKey="drnexus.sidebar.collapsed.ssma"
      />

      <main className="flex-1 flex flex-col overflow-hidden relative bg-gray-50/30 transition-all duration-300">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">
              {getPageTitle()}
            </h2>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pt-2 pb-4 px-4 lg:pt-3 lg:pb-8 lg:px-8 scroll-smooth">
          <div className="mt-2 animate-in fade-in duration-500 slide-in-from-bottom-2">
            {activeTab === 'dashboard' && <SSMADashboard />}
            {activeTab === 'inspections' && <InspectionEventList />}
            {activeTab === 'registers' && <RegistersView />}
            {activeTab === 'rules' && <RulesView />}
          </div>
        </div>
      </main>
    </div>
  );
}

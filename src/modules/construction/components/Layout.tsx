
import React from 'react';
import {
  LayoutDashboard, Table, UploadCloud, HardHat,
  Coins, CalendarRange, Download, Trash2, Cloud, LogOut, History, Users, Truck
} from 'lucide-react';
import { ViewType } from '../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { ModuleSwitcher } from '../../../components/ModuleSwitcher';
import { canManageProfiles } from '../../iam/types';
import { CorporateSidebar, SidebarItem } from '../../../components/navigation/CorporateSidebar';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewType;
  setView: (view: ViewType) => void;
  hasData: boolean;
  onExportBackup: () => void;
  onClearData: () => void;
}

const Layout: React.FC<LayoutProps> = ({
  children, activeView, setView, hasData, onExportBackup, onClearData
}) => {
  const navigate = useNavigate();
  const { logout, user, profile } = useAuth(); // Need profile permissions
  const [isSwitcherOpen, setIsSwitcherOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarItems: SidebarItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, onClick: () => setView('dashboard'), isActive: activeView === 'dashboard' },
    { key: 'history', label: 'Histórico de RDOs', icon: History, onClick: () => setView('history'), isActive: activeView === 'history' },
    { key: 'planning', label: 'Planejamento', icon: CalendarRange, onClick: () => setView('planning'), isActive: activeView === 'planning' },
    { key: 'services', label: 'Catálogo SAP', icon: Coins, onClick: () => setView('services'), isActive: activeView === 'services' },
    { key: 'upload', label: 'Importar Dados', icon: UploadCloud, onClick: () => setView('upload'), isActive: activeView === 'upload' },
    { key: 'equipments', label: 'Equipamentos', icon: Truck, onClick: () => setView('equipments'), isActive: activeView === 'equipments' },
  ];

  if (canManageProfiles(profile)) {
    sidebarItems.push({ key: 'iam', label: 'Gestão de Usuários', icon: Users, onClick: () => setView('iam'), isActive: activeView === 'iam' });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <CorporateSidebar
        brand={{ topLogoSrc: "/assets/dr-logo.png", title: "Obras", subtitle: "Gestão de Projetos" }}
        items={sidebarItems}
        userDisplay={{ name: user?.name || 'Usuário', role: user?.role || 'Membro', avatarUrl: user?.avatarUrl }}
        onLogout={handleLogout}
        storageKey="drnexus.sidebar.collapsed.obras"
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 relative">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-slate-800 capitalize">
            {activeView === 'upload' ? 'Importação de Dados' :
              activeView === 'dashboard' ? 'Painel de Indicadores' :
                activeView === 'services' ? 'Tabela de Preços SAP' :
                  activeView === 'planning' ? 'Planejamento de Frota' :
                    activeView === 'iam' ? 'Gestão de Usuários' :
                      activeView === 'equipments' ? 'Gestão de Equipamentos' : 'Tabela de Operações'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                Database: Firestore
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
              <div className={`w-2 h-2 rounded-full ${hasData ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                {hasData ? 'Base Carregada' : 'Aguardando Import'}
              </span>
            </div>
          </div>
        </header>

        <div className="p-8">
          {children}
        </div>
      </main>
    </div >
  );
};

export default Layout;

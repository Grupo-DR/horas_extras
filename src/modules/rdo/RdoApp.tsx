import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import './index.css';
import { Building2, FileText, LayoutDashboard, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { CorporateSidebar, SidebarItem } from '../../components/navigation/CorporateSidebar';
import { useUiState, useUiActions, useUiStore, MainMenu } from './src/stores/uiStore';
import { useProjectActions } from './src/stores/projectStore';
import { useTeamActions } from './src/stores/teamStore';
import { useRdoActions, useRdoStore } from './src/stores/rdoStore';
import { usePlanningActions } from './src/stores/planningStore';
import { DashboardPage } from './src/modules/dashboard/pages/DashboardPage';
import { ProjectsPage } from './src/modules/projects/pages/ProjectsPage';
import { ContractIntelligencePage } from './src/modules/contract-intelligence/pages/ContractIntelligencePage';
import { PlanningPage } from './src/modules/planning/pages/PlanningPage';
import { ProjectModal } from './src/modules/projects/components/ProjectModal';
import { LocalDataRecoveryBanner } from './components/LocalDataRecoveryBanner';

const MENU: { id: MainMenu; label: string; icon: SidebarItem['icon'] }[] = [
  { id: 'DASHBOARD', label: 'Painel Geral', icon: LayoutDashboard },
  { id: 'PROJECTS', label: 'Minhas Obras', icon: Building2 },
  { id: 'CONTRACT_INTELLIGENCE', label: 'Inteligência Contratual', icon: FileText },
  { id: 'PLANNING', label: 'Planejamento', icon: ClipboardList },
];

function App() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeMenu } = useUiState();
  const { setActiveMenu, setLoading, setError } = useUiActions();

  const { loadProjects } = useProjectActions();
  const { loadTeams } = useTeamActions();
  const { loadRdos } = useRdoActions();
  const { loadPlanningData } = usePlanningActions();
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const loadedProjects = await loadProjects();
        await loadTeams();
        await loadRdos();
        await loadPlanningData(loadedProjects);
        setDataReady(true);
      } catch (e) {
        console.error("Error loading initial data", e);
        const detail = e instanceof Error ? e.message : '';
        setError("Erro ao carregar dados. Verifique a conexão com o banco.");
        toast.error(`Erro ao carregar o RDO Online. ${detail}`.trim());
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [loadProjects, loadTeams, loadRdos, loadPlanningData, setLoading, setError]);

  const openMenu = (menu: MainMenu) => {
    setActiveMenu(menu);
    if (menu === 'PROJECTS') {
      // Volta da tela de upload para a lista de RDOs da turma.
      const ui = useUiStore.getState();
      if (ui.currentView === 'UPLOAD_ANALYSIS') ui.actions.setCurrentView('RDO_LIST');
    } else {
      useRdoStore.getState().actions.setCurrentRDO(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarItems: SidebarItem[] = MENU.map(({ id, label, icon }) => ({
    key: id,
    label,
    icon,
    onClick: () => openMenu(id),
    isActive: activeMenu === id,
  }));

  const activeLabel = MENU.find(m => m.id === activeMenu)?.label ?? 'RDO Online';

  return (
    // Mesma estrutura dos outros módulos (painel VLI, Capital Humano, SSMA): barra lateral do portal + conteúdo claro.
    <div className="rdo-theme flex h-screen overflow-hidden text-slate-900 font-inter">
      <CorporateSidebar
        brand={{ topLogoSrc: "/assets/dr-logo.png", title: "RDO Online", subtitle: "Gestão de Obras" }}
        items={sidebarItems}
        userDisplay={{ name: user?.name || 'Usuário', role: user?.role || 'Membro', avatarUrl: user?.avatarUrl }}
        onLogout={handleLogout}
        accountLinkTo="/config/account"
        storageKey="drnexus.sidebar.collapsed.rdo"
      />

      <main className="relative flex-1 overflow-y-auto bg-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 px-8 py-4 backdrop-blur-md">
          <h1 className="text-xl font-bold text-slate-800">{activeLabel}</h1>
        </header>

        <div className="p-5 lg:p-8">
          <LocalDataRecoveryBanner ready={dataReady} />
          {activeMenu === 'DASHBOARD' && <DashboardPage />}
          {activeMenu === 'PROJECTS' && <ProjectsPage />}
          {activeMenu === 'CONTRACT_INTELLIGENCE' && <ContractIntelligencePage />}
          {activeMenu === 'PLANNING' && <PlanningPage />}
        </div>
      </main>

      <ProjectModal />
    </div>
  );
}

export default App;

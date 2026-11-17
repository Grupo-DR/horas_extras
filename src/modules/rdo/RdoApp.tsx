import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import './index.css';
import { Building2, FileText, LayoutDashboard, ClipboardList } from 'lucide-react';
import { PortalTopBar } from '../../pages/CentroInteligencia/PortalTopBar';
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

const MENU: { id: MainMenu; label: string; icon: React.ElementType }[] = [
  { id: 'DASHBOARD', label: 'Painel Geral', icon: LayoutDashboard },
  { id: 'PROJECTS', label: 'Minhas Obras', icon: Building2 },
  { id: 'CONTRACT_INTELLIGENCE', label: 'Inteligência Contratual', icon: FileText },
  { id: 'PLANNING', label: 'Planejamento', icon: ClipboardList },
];

function App() {
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

  return (
    // Mesma aparência da tela inicial: barra superior branca, fundo cinza-claro, cartões brancos.
    <div className="rdo-theme flex h-screen flex-col overflow-hidden bg-[#f3f5f9] text-slate-900 font-inter">
      <PortalTopBar title="RDO Online" />

      <nav
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-5 lg:px-8"
        aria-label="Seções do RDO Online"
      >
        {MENU.map(({ id, label, icon: Icon }) => {
          const active = activeMenu === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => openMenu(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition ${
                active
                  ? 'border-[#0b1d4f] font-semibold text-[#0b1d4f]'
                  : 'border-transparent font-medium text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 overflow-y-auto p-5 lg:p-8">
        <LocalDataRecoveryBanner ready={dataReady} />
        {activeMenu === 'DASHBOARD' && <DashboardPage />}
        {activeMenu === 'PROJECTS' && <ProjectsPage />}
        {activeMenu === 'CONTRACT_INTELLIGENCE' && <ContractIntelligencePage />}
        {activeMenu === 'PLANNING' && <PlanningPage />}
      </main>

      <ProjectModal />
    </div>
  );
}

export default App;

import React, { useEffect } from 'react';
import './index.css';
import {
  Building2, FileText, LayoutDashboard, ClipboardList, Menu, X, BarChart2, Home, LogOut
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiState, useUiActions } from './src/stores/uiStore';
import { useProjectActions } from './src/stores/projectStore';
import { useTeamActions } from './src/stores/teamStore';
import { useRdoActions } from './src/stores/rdoStore';
import { usePlanningActions } from './src/stores/planningStore';
import { DashboardPage } from './src/modules/dashboard/pages/DashboardPage';
import { ProjectsPage } from './src/modules/projects/pages/ProjectsPage';
import { ContractIntelligencePage } from './src/modules/contract-intelligence/pages/ContractIntelligencePage';
import { PlanningPage } from './src/modules/planning/pages/PlanningPage';
import { ProjectModal } from './src/modules/projects/components/ProjectModal';
import logoImg from './vector/logo.png';

function App() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    activeMenu,
    isMobileMenuOpen
  } = useUiState();

  const {
    setActiveMenu,
    setIsMobileMenuOpen,
    setLoading,
    setError
  } = useUiActions();

  const { loadProjects } = useProjectActions();
  const { loadTeams } = useTeamActions();
  const { loadRdos } = useRdoActions();
  const { loadPlanningData } = usePlanningActions();

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const loadedProjects = await loadProjects();
        await loadTeams();
        await loadRdos();
        await loadPlanningData(loadedProjects);
      } catch (e) {
        console.error("Error loading initial data", e);
        setError("Erro ao carregar dados. Verifique a conexão com o banco.");
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [loadProjects, loadTeams, loadRdos, loadPlanningData, setLoading, setError]);

  const Sidebar = () => (
    <div className={`
      fixed inset-y-0 left-0 z-40 w-72 glass-panel text-white transform transition-transform duration-300 ease-in-out
      ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:inset-0
      border-r border-white/5
    `}>
      <div className="flex flex-col h-full">
        <div className="p-8 border-b border-white/5 flex flex-col items-center justify-center gap-1.5">
          <img src={logoImg} alt="DR Capital Humano" className="w-40 h-auto object-contain mb-3" />
          <span className="text-sm uppercase tracking-[0.15em] font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-center">
            Analytics RDO
          </span>
          <span className="text-xs text-slate-400/90 font-medium text-center">
            IA Aplicada em Gestão Ágil e Eficiente
          </span>
        </div>

        <nav className="flex-1 p-6 space-y-3">
          <button
            onClick={() => { setActiveMenu('DASHBOARD'); useRdoStore.getState().actions.setCurrentRDO(null); }}
            className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 ${activeMenu === 'DASHBOARD'
                ? 'bg-gradient-premium text-white shadow-xl shadow-blue-600/20 scale-[1.02]'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-semibold text-sm">Painel Geral</span>
          </button>

          <button
            onClick={() => {
              setActiveMenu('PROJECTS');
              const currentView = useUiStore.getState().currentView;
              if (currentView === 'UPLOAD_ANALYSIS') useUiStore.getState().actions.setCurrentView('RDO_LIST');
            }}
            className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 ${activeMenu === 'PROJECTS'
                ? 'bg-gradient-premium text-white shadow-xl shadow-blue-600/20 scale-[1.02]'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
          >
            <Building2 className="w-5 h-5" />
            <span className="font-semibold text-sm">Minhas Obras</span>
          </button>

          <button
            onClick={() => { setActiveMenu('CONTRACT_INTELLIGENCE'); useRdoStore.getState().actions.setCurrentRDO(null); }}
            className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 ${activeMenu === 'CONTRACT_INTELLIGENCE'
                ? 'bg-gradient-premium text-white shadow-xl shadow-blue-600/20 scale-[1.02]'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
          >
            <FileText className="w-5 h-5" />
            <span className="font-semibold text-sm">Inteligência Contratual</span>
          </button>

          <button
            onClick={() => { setActiveMenu('PLANNING'); useRdoStore.getState().actions.setCurrentRDO(null); }}
            className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-300 ${activeMenu === 'PLANNING'
                ? 'bg-gradient-premium text-white shadow-xl shadow-blue-600/20 scale-[1.02]'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
          >
            <ClipboardList className="w-5 h-5" />
            <span className="font-semibold text-sm">Planejamento</span>
          </button>
        </nav>

        <div className="p-6 mt-auto">
          <div className="flex items-center p-3 rounded-2xl bg-white/5 border border-white/5 gap-3 group relative">
            <div className="shrink-0 relative">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600/80 text-white flex items-center justify-center text-xs font-bold border border-blue-500/30 shadow-sm">
                  {user?.name ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() : 'US'}
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-slate-100 truncate block">
                {user?.name || 'Usuário'}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium truncate block">
                {user?.role || 'Membro'}
              </span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute right-3 bg-[#0d1425] pl-2 rounded-l-lg shadow-[-10px_0_10px_#0d1425]">
              <button
                onClick={() => navigate('/')}
                title="Saguão Principal"
                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors shrink-0"
              >
                <Home size={18} />
              </button>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                title="Sair"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="rdo-theme flex h-screen bg-slate-950 text-slate-50 font-inter overflow-hidden selection:bg-blue-500/30" style={{
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(139, 92, 246, 0.15) 0px, transparent 50%)',
      backgroundAttachment: 'fixed',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale'
    }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-blue-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="md:hidden glass-panel border-b border-white/5 p-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-premium p-1.5 rounded-lg">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white tracking-tight">RDO Pro</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        <main className="flex-1 overflow-y-auto p-4 sm:p-10 relative z-10 custom-scrollbar">
          {activeMenu === 'DASHBOARD' && <DashboardPage />}
          {activeMenu === 'PROJECTS' && <ProjectsPage />}
          {activeMenu === 'CONTRACT_INTELLIGENCE' && <ContractIntelligencePage />}
          {activeMenu === 'PLANNING' && <PlanningPage />}
        </main>
      </div>

      <ProjectModal />
    </div>
  );
}

// Import useRdoStore inside App component or dynamically to access inside onClick handlers
import { useRdoStore } from './src/stores/rdoStore';
import { useUiStore } from './src/stores/uiStore';

export default App;

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchOvertimeData } from '@/src/modules/human-capital/services/totvs';
import Dashboard from '@/src/modules/human-capital/components/Dashboard';
import DataGrid from '@/src/modules/human-capital/components/DataGrid';
import GeminiPanel from '@/src/modules/human-capital/components/GeminiPanel';
import AnalysisPanel from '@/src/modules/human-capital/components/AnalysisPanel';
import FilterBar, { FilterState } from '@/src/modules/human-capital/components/FilterBar';
import ProfileManager from '@/src/modules/human-capital/components/ProfileManager';
import Planning from '@/src/modules/human-capital/components/Planning';
import { canManageProfiles, canPlan } from '@/src/modules/human-capital/services/auth';
import { formatDateForApi } from '@/src/modules/human-capital/utils/formatters';
import { LayoutDashboard, Table, Settings, Database, CheckCircle2, AlertTriangle, Menu, Sparkles, CalendarRange, UserCog, LogOut, BarChart3, RefreshCw, X } from 'lucide-react';
import { ApiConfig, OvertimeRecord, FetchStatus, UserProfile } from '@/src/modules/human-capital/types';

// Configuração padrão da API TOTVS
const DEFAULT_CONFIG: ApiConfig = {
  url: 'https://drconstrutora116480.rm.cloudtotvs.com.br:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/TOTVSTOTAL/0/P',
  username: 'api',
  password: 'drdr@Prov!!',
  startDate: '07/01/2025',
  endDate: '01/01/2027'
};

enum Tab {
  DASHBOARD = 'dashboard',
  DATA = 'data',
  PLANNING = 'planning',
  ANALYSIS = 'analysis',
  PROFILES = 'profiles',
  SETTINGS = 'settings'
}

const HumanCapitalDashboard: React.FC = () => {
  const { user: nexusUser, logout: signOut } = useAuth();

  // Adapter: Converte o usuário do Portal-Commercial para o formato esperado pelo RH
  const currentUser: UserProfile | null = useMemo(() => nexusUser ? ({
    id: nexusUser.id,
    name: nexusUser.name || nexusUser.email || 'Usuário',
    email: nexusUser.email || '',
    role: 'DEV_MASTER', // TODO: Mapear roles reais do Portal-Commercial
    avatar: '👤'
  }) : null, [nexusUser]);

  const [simulatedUser, setSimulatedUser] = useState<UserProfile | null>(null);
  const effectiveUser = simulatedUser || currentUser;

  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG);
  const [data, setData] = useState<OvertimeRecord[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    startDate: '',
    endDate: '',
    function: '',
    costCenter: '',
    type: '',
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    dateMode: 'CALENDAR'
  });

  useEffect(() => {
    if (effectiveUser) {
      loadData();
    }
  }, [effectiveUser]);

  const loadData = async () => {
    setStatus('loading');
    const apiConfig = {
      ...config,
      startDate: filters.startDate ? formatDateForApi(filters.startDate) : config.startDate,
      endDate: filters.endDate ? formatDateForApi(filters.endDate) : config.endDate
    };
    const records = await fetchOvertimeData(apiConfig);
    setData(records);
    setStatus('success');
  };

  const scopedData = useMemo(() => {
    if (!effectiveUser) return [];
    return data;
  }, [data, effectiveUser]);

  const filterOptions = useMemo(() => {
    const functions = new Set<string>();
    const costCenters = new Set<string>();
    const events = new Set<string>();
    const years = new Set<string>();

    scopedData.forEach(item => {
      if (item.FUNCAO) functions.add(item.FUNCAO);
      if (item.CODCCUSTO) costCenters.add(item.CODCCUSTO);
      if (item.EVENTO) events.add(item.EVENTO);
      if (item.DATA) years.add(new Date(item.DATA).getFullYear().toString());
    });

    return {
      functions: Array.from(functions).sort(),
      costCenters: Array.from(costCenters).sort(),
      types: Array.from(events).sort(), // Map events to types
      years: Array.from(years).sort().reverse()
    };
  }, [scopedData]);

  const filteredData = useMemo(() => {
    return scopedData.filter(item => {
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesSearch = !filters.searchTerm ||
        (item.NOME && item.NOME.toLowerCase().includes(searchLower)) ||
        (item.CHAPA && item.CHAPA.includes(searchLower));
      const matchesFunction = !filters.function || item.FUNCAO === filters.function;
      const matchesCostCenter = !filters.costCenter || item.CODCCUSTO === filters.costCenter;
      const matchesEvent = !filters.type || item.EVENTO === filters.type;
      return matchesSearch && matchesFunction && matchesCostCenter && matchesEvent;
    });
  }, [scopedData, filters]);

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      startDate: '',
      endDate: '',
      function: '',
      costCenter: '',
      type: '',
      year: new Date().getFullYear().toString(),
      month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
      dateMode: 'CALENDAR'
    });
  };

  if (!effectiveUser) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-blue-600 font-medium">Carregando Perfil Capital Humano...</div></div>;

  const NavItem = ({ tab, icon, label, restrictedTo }: { tab: Tab; icon: React.ReactNode; label: string, restrictedTo?: boolean }) => {
    if (restrictedTo === false) return null;
    return (
      <button
        onClick={() => { setActiveTab(tab); setIsSidebarOpen(false); }}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors mb-1 ${activeTab === tab
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar do Módulo RH */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:transform-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center space-x-3">
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200">
              <Database className="text-white" size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Capital <span className="text-indigo-600">Humano</span></h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Módulo TOTVS Analytics</p>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden ml-auto p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 p-4 overflow-y-auto">
            <NavItem tab={Tab.DASHBOARD} icon={<LayoutDashboard size={20} />} label="Visão Geral" />
            <NavItem tab={Tab.DATA} icon={<Table size={20} />} label="Dados Detalhados" />
            <NavItem tab={Tab.PLANNING} icon={<CalendarRange size={20} />} label="Planejamento" restrictedTo={canPlan(effectiveUser.role)} />
            <NavItem tab={Tab.ANALYSIS} icon={<BarChart3 size={20} />} label="Análise Financeira" />
            <NavItem tab={Tab.PROFILES} icon={<UserCog size={20} />} label="Gestão de Perfis" restrictedTo={canManageProfiles(effectiveUser.role)} />
            <NavItem tab={Tab.SETTINGS} icon={<Settings size={20} />} label="Configurações" />
          </nav>
          <div className="p-4 border-t border-gray-100 space-y-3 bg-gray-50/50">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white cursor-pointer shadow-lg hover:shadow-xl transition-shadow" onClick={() => setShowAiPanel(true)}>
              <div className="flex items-center space-x-2 mb-2">
                <Sparkles size={16} />
                <span className="font-medium text-sm">Gemini AI</span>
              </div>
              <p className="text-xs text-indigo-100 opacity-90 leading-relaxed">Clique para gerar insights inteligentes sobre horas extras.</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-gray-50/30">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Menu size={24} /></button>
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">
              {activeTab === Tab.DASHBOARD && 'Dashboard Geral'}
              {activeTab === Tab.DATA && 'Gerenciamento de Dados'}
              {activeTab === Tab.PLANNING && 'Planejamento de Horas'}
              {activeTab === Tab.ANALYSIS && 'Análise de Evolução Financeira'}
              {activeTab === Tab.PROFILES && 'Administração de Usuários'}
              {activeTab === Tab.SETTINGS && 'Configuração do Sistema'}
            </h2>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide flex items-center space-x-1.5 shadow-sm ${status === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
            {status === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            <span>{status === 'success' ? 'Conectado TOTVS' : 'Modo Simulação'}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
          {(activeTab === Tab.DASHBOARD || activeTab === Tab.DATA || activeTab === Tab.ANALYSIS) && (
            <FilterBar filters={filters} setFilters={setFilters} options={filterOptions} onClear={clearFilters} />
          )}

          <div className="animate-in fade-in duration-500 slide-in-from-bottom-2">
            {activeTab === Tab.DASHBOARD && <Dashboard data={filteredData} />}
            {activeTab === Tab.DATA && <DataGrid data={filteredData} />}
            {activeTab === Tab.ANALYSIS && <AnalysisPanel data={filteredData} selectedYear={filters.year} />}
            {activeTab === Tab.PLANNING && canPlan(effectiveUser.role) && <Planning user={effectiveUser} employees={scopedData} />}
            {activeTab === Tab.PROFILES && canManageProfiles(effectiveUser.role) && <ProfileManager currentUser={effectiveUser} onProfileChange={setSimulatedUser} />}
            {activeTab === Tab.SETTINGS && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-500">
                <Settings className="mx-auto mb-4 text-gray-300" size={48} />
                <p>Configurações de conexão são gerenciadas centralmente pelo Admin.</p>
              </div>
            )}
          </div>
        </div>

        {showAiPanel && (
          <div className="absolute inset-y-0 right-0 w-full sm:w-[450px] shadow-2xl z-40 bg-white border-l border-gray-100 animate-in slide-in-from-right duration-300">
            <GeminiPanel data={filteredData} isVisible={true} onClose={() => setShowAiPanel(false)} />
          </div>
        )}
      </main>
    </div>
  );
};

export default HumanCapitalDashboard;

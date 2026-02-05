
import React, { useState, useEffect, useMemo } from 'react';
import { ApiConfig, OvertimeRecord, FetchStatus, UserProfile } from './types';
import { fetchOvertimeData } from './services/totvs';
import Dashboard from './components/Dashboard';
import DataGrid from './components/DataGrid';
import GeminiPanel from './components/GeminiPanel';
import AnalysisPanel from './components/AnalysisPanel';
import FilterBar, { FilterState } from './components/FilterBar';
import Login from './components/Login';
import ProfileManager from './components/ProfileManager';
import Planning from './components/Planning';
import { canManageProfiles, canPlan } from './services/auth';
import { formatDateForApi } from './utils/formatters';
import { LayoutDashboard, Table, Settings, Database, CheckCircle2, AlertTriangle, Menu, Sparkles, CalendarRange, UserCog, LogOut, BarChart3, RefreshCw } from 'lucide-react';

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

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
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
    selectedFunction: '',
    selectedCostCenter: '',
    selectedEvent: '',
    selectedYear: '',
    selectedMonth: '',
    periodMode: 'CALENDAR'
  });

  useEffect(() => {
    if (currentUser) {
        loadData();
    }
  }, [currentUser]);

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
    if (!currentUser) return [];
    switch (currentUser.role) {
        case 'LEVEL_B_01':
            return data.filter(item => item.CODCCUSTO === currentUser.costCenter);
        case 'LEVEL_C_01':
            return data.filter(item => item.CHAPA === currentUser.chapa);
        default:
            return data;
    }
  }, [data, currentUser]);

  const filterOptions = useMemo(() => {
    const functions = new Set<string>();
    const costCenters = new Set<string>();
    const events = new Set<string>();

    scopedData.forEach(item => {
      if (item.FUNCAO) functions.add(item.FUNCAO);
      if (item.CODCCUSTO) costCenters.add(item.CODCCUSTO);
      if (item.EVENTO) events.add(item.EVENTO);
    });

    return {
      functions: Array.from(functions).sort(),
      costCenters: Array.from(costCenters).sort(),
      events: Array.from(events).sort()
    };
  }, [scopedData]);

  const filteredData = useMemo(() => {
    return scopedData.filter(item => {
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesSearch = !filters.searchTerm || 
        (item.NOME && item.NOME.toLowerCase().includes(searchLower)) ||
        (item.CHAPA && item.CHAPA.includes(searchLower));

      const matchesFunction = !filters.selectedFunction || item.FUNCAO === filters.selectedFunction;
      const matchesCostCenter = !filters.selectedCostCenter || item.CODCCUSTO === filters.selectedCostCenter;
      const matchesEvent = !filters.selectedEvent || item.EVENTO === filters.selectedEvent;

      let matchesDate = true;
      if (item.DATA) {
        const itemDate = new Date(item.DATA);
        
        if (filters.selectedYear) {
            if (itemDate.getFullYear().toString() !== filters.selectedYear) {
                matchesDate = false;
            }
        }

        if (matchesDate && filters.startDate) {
            const start = new Date(filters.startDate);
            start.setHours(0, 0, 0, 0);
            if (itemDate.getTime() < start.getTime()) {
                matchesDate = false;
            }
        }
        if (matchesDate && filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            if (itemDate.getTime() > end.getTime()) {
                matchesDate = false;
            }
        }
      }

      return matchesSearch && matchesFunction && matchesCostCenter && matchesEvent && matchesDate;
    });
  }, [scopedData, filters]);

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      startDate: '',
      endDate: '',
      selectedFunction: '',
      selectedCostCenter: '',
      selectedEvent: '',
      selectedYear: '',
      selectedMonth: '',
      periodMode: 'CALENDAR'
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setData([]);
    setActiveTab(Tab.DASHBOARD);
  };

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />;
  }

  const NavItem = ({ tab, icon, label, restrictedTo }: { tab: Tab; icon: React.ReactNode; label: string, restrictedTo?: boolean }) => {
    if (restrictedTo === false) return null;
    return (
        <button
        onClick={() => { setActiveTab(tab); setIsSidebarOpen(false); }}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
            activeTab === tab 
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:transform-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center space-x-3">
             <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
               <Database className="text-white" size={18} />
             </div>
             <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">TOTVS <span className="text-blue-600">Analytics</span></h1>
                <p className="text-xs text-gray-500">Gestão de Horas Extras</p>
             </div>
          </div>

          <nav className="flex-1 p-4">
            <NavItem tab={Tab.DASHBOARD} icon={<LayoutDashboard size={20} />} label="Visão Geral" />
            <NavItem tab={Tab.DATA} icon={<Table size={20} />} label="Dados Detalhados" />
            <NavItem tab={Tab.PLANNING} icon={<CalendarRange size={20} />} label="Planejamento" restrictedTo={canPlan(currentUser.role)} />
            <NavItem tab={Tab.ANALYSIS} icon={<BarChart3 size={20} />} label="Análise Financeira" />
            <NavItem tab={Tab.PROFILES} icon={<UserCog size={20} />} label="Gestão de Perfis" restrictedTo={canManageProfiles(currentUser.role)} />
            <NavItem tab={Tab.SETTINGS} icon={<Settings size={20} />} label="Configurações" />
          </nav>

          <div className="p-4 border-t border-gray-100 space-y-3">
             <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white">
                <div className="flex items-center space-x-2 mb-2">
                    <Sparkles size={16} />
                    <span className="font-medium text-sm">Análise Gemini</span>
                </div>
                <p className="text-xs text-blue-100 mb-3 opacity-90">Descubra insights sobre custos e padrões.</p>
                <button onClick={() => setShowAiPanel(true)} className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm">
                  Abrir Painel IA
                </button>
             </div>
             <div className="flex items-center justify-between px-2 pt-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">{currentUser.avatar || 'U'}</div>
                    <div className="truncate">
                        <p className="text-sm font-bold text-gray-700 truncate">{currentUser.name}</p>
                        <p className="text-xs text-gray-400 truncate">{currentUser.role.replace(/_/g, ' ')}</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Sair">
                    <LogOut size={18} />
                </button>
             </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
            <div className="flex items-center">
                <button onClick={() => setIsSidebarOpen(true)} className="mr-4 lg:hidden p-2 text-gray-600"><Menu size={24} /></button>
                <h2 className="text-xl font-semibold text-gray-800">
                    {activeTab === Tab.DASHBOARD && 'Dashboard Geral'}
                    {activeTab === Tab.DATA && 'Gerenciamento de Dados'}
                    {activeTab === Tab.PLANNING && 'Planejamento de Horas'}
                    {activeTab === Tab.ANALYSIS && 'Análise de Evolução Financeira'}
                    {activeTab === Tab.PROFILES && 'Administração de Usuários'}
                    {activeTab === Tab.SETTINGS && 'Configuração do Sistema'}
                </h2>
            </div>
            <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500 hidden sm:inline-block">Setup: {config.startDate} - {config.endDate}</span>
                <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${status === 'success' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {status === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    <span>{status === 'success' ? 'Conectado' : 'Dados Simulados'}</span>
                </div>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            {(activeTab === Tab.DASHBOARD || activeTab === Tab.DATA || activeTab === Tab.ANALYSIS) && (
              <FilterBar filters={filters} setFilters={setFilters} options={filterOptions} onClear={clearFilters} />
            )}

            {activeTab === Tab.DASHBOARD && <Dashboard data={filteredData} />}
            {activeTab === Tab.DATA && <DataGrid data={filteredData} />}
            {activeTab === Tab.ANALYSIS && <AnalysisPanel data={filteredData} selectedYear={filters.selectedYear} />}
            {activeTab === Tab.PLANNING && canPlan(currentUser.role) && <Planning user={currentUser} employees={scopedData} />}
            {activeTab === Tab.PROFILES && canManageProfiles(currentUser.role) && <ProfileManager currentUser={currentUser} />}
            
            {activeTab === Tab.SETTINGS && (
                <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Configurações de Conexão API</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">URL da API</label>
                            <input type="text" value={config.url} onChange={(e) => setConfig({...config, url: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
                                <input type="text" value={config.username} onChange={(e) => setConfig({...config, username: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                                <input type="password" value={config.password || ''} onChange={(e) => setConfig({...config, password: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <button onClick={loadData} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2">
                                <RefreshCw size={18} className={status === 'loading' ? 'animate-spin' : ''} />
                                <span>{status === 'loading' ? 'Conectando...' : 'Recarregar Dados'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {showAiPanel && (
            <div className="absolute inset-y-0 right-0 w-full sm:w-96 shadow-2xl z-40 transform transition-transform duration-300 ease-out translate-x-0">
                <GeminiPanel data={filteredData} onClose={() => setShowAiPanel(false)} />
            </div>
        )}
      </main>
    </div>
  );
};

export default App;

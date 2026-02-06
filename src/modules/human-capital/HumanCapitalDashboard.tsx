import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOvertimeData } from '@/src/modules/human-capital/services/totvs';
import Dashboard from '@/src/modules/human-capital/components/Dashboard';
import DataGrid from '@/src/modules/human-capital/components/DataGrid';
import GeminiPanel from '@/src/modules/human-capital/components/GeminiPanel';
import AnalysisPanel from '@/src/modules/human-capital/components/AnalysisPanel';
import FilterBar, { FilterState } from '@/src/modules/human-capital/components/FilterBar';
import ProfileManager from '@/src/modules/iam/components/ProfileManager'; // Updated IAM path

import Planning from '@/src/modules/human-capital/components/Planning';
import { canManageProfiles, canPlan } from '../iam/types'; // Updated import
import { formatDateForApi } from '@/src/modules/human-capital/utils/formatters';
import { LayoutDashboard, Table, Settings, Database, CheckCircle2, AlertTriangle, Menu, Sparkles, CalendarRange, UserCog, LogOut, BarChart3, RefreshCw, X, Lock } from 'lucide-react';
import { ApiConfig, OvertimeRecord, FetchStatus, UserProfile } from '@/src/modules/human-capital/types';
import { SidebarBase, SidebarItem } from '../../../layout/SidebarBase';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  const { profile, hasModuleAccess, logout: signOut, isProfileLoading } = useAuth();
  const navigate = useNavigate();

  const currentUser: UserProfile | null = useMemo(() => {
    if (!profile || !profile.modules.human_capital?.enabled) return null;
    return {
      id: profile.uid,
      name: profile.displayName,
      email: profile.email,
      role: profile.modules.human_capital.role,
      scope: profile.modules.human_capital.scope,
      avatar: '👤'
    };
  }, [profile]);

  const [simulatedUser, setSimulatedUser] = useState<UserProfile | null>(null);
  const effectiveUser = simulatedUser || currentUser;

  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG);
  const [data, setData] = useState<OvertimeRecord[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [showAiPanel, setShowAiPanel] = useState(false);

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
    if (!isProfileLoading) {
      if (!hasModuleAccess('human_capital')) {
        // toast.error("Acesso negado ao módulo Capital Humano.");
        // navigate('/'); 
      }
    }
  }, [isProfileLoading, hasModuleAccess, navigate]);

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

  const handleLogout = () => {
    signOut();
    navigate('/login');
  };

  const sidebarItems: SidebarItem[] = useMemo(() => {
    if (!effectiveUser) return [];

    const items: SidebarItem[] = [
      { key: Tab.DASHBOARD, label: "Visão Geral", icon: LayoutDashboard, onClick: () => setActiveTab(Tab.DASHBOARD), isActive: activeTab === Tab.DASHBOARD },
      { key: Tab.DATA, label: "Dados Detalhados", icon: Table, onClick: () => setActiveTab(Tab.DATA), isActive: activeTab === Tab.DATA },
    ];

    if (canPlan(effectiveUser.role)) {
      items.push({ key: Tab.PLANNING, label: "Planejamento", icon: CalendarRange, onClick: () => setActiveTab(Tab.PLANNING), isActive: activeTab === Tab.PLANNING });
    }

    items.push({ key: Tab.ANALYSIS, label: "Análise Financeira", icon: BarChart3, onClick: () => setActiveTab(Tab.ANALYSIS), isActive: activeTab === Tab.ANALYSIS });

    if (canManageProfiles(effectiveUser.role)) {
      items.push({ key: Tab.PROFILES, label: "Gestão de Perfis", icon: UserCog, onClick: () => setActiveTab(Tab.PROFILES), isActive: activeTab === Tab.PROFILES });
    }

    items.push({ key: Tab.SETTINGS, label: "Configurações", icon: Settings, onClick: () => setActiveTab(Tab.SETTINGS), isActive: activeTab === Tab.SETTINGS });

    return items;
  }, [effectiveUser, activeTab]);

  if (isProfileLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-blue-600 font-medium">Carregando perfil...</div></div>;

  if (!hasModuleAccess('human_capital')) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500 gap-4">
      <Lock size={48} className="text-gray-300" />
      <h2 className="text-xl font-bold">Acesso Restrito</h2>
      <p>Seu perfil não possui acesso ao módulo Capital Humano.</p>
      <button onClick={() => navigate('/')} className="text-blue-600 underline text-sm">Voltar ao início</button>
    </div>
  );

  if (!effectiveUser) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-blue-600 font-medium">Carregando Perfil Capital Humano...</div></div>;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <SidebarBase
        brand={{
          topLogoSrc: "/assets/dr-logo.png",
          title: "Capital Humano",
          subtitle: "TOTVS Analytics"
        }}
        items={sidebarItems}
        userDisplay={{
          name: effectiveUser.name || 'Usuário',
          role: effectiveUser.role || 'Membro',
          avatarUrl: effectiveUser.avatar === '👤' ? undefined : effectiveUser.avatar
        }}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-gray-50/30 ml-20 transition-all duration-300">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-4">
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
            <FilterBar filters={filters} setFilters={setFilters} options={filterOptions} onClear={clearFilters} /> // Note: Profile/Scope filter logic might need to be passed here? For now, using scopedData handles visibility.
          )}

          <div className="animate-in fade-in duration-500 slide-in-from-bottom-2">
            {activeTab === Tab.DASHBOARD && <Dashboard data={filteredData} />}
            {activeTab === Tab.DATA && <DataGrid data={filteredData} />}
            {activeTab === Tab.ANALYSIS && <AnalysisPanel data={filteredData} selectedYear={filters.year} />}
            {activeTab === Tab.PLANNING && canPlan(effectiveUser.role) && <Planning user={effectiveUser} employees={scopedData} />}
            {activeTab === Tab.PROFILES && canManageProfiles(effectiveUser.role) && <ProfileManager />}
            {activeTab === Tab.SETTINGS && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-500">
                <Settings className="mx-auto mb-4 text-gray-300" size={48} />
                <p>Configurações de conexão são gerenciadas centralmente pelo Admin.</p>
              </div>
            )}

            <button
              onClick={() => setShowAiPanel(true)}
              className="fixed bottom-6 right-6 bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all z-40 group"
              title="Gemini AI Insights"
            >
              <Sparkles size={24} className="group-hover:animate-pulse" />
            </button>
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

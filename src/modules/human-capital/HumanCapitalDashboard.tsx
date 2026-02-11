import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOvertimeData } from '@/src/modules/human-capital/services/totvs';
import Dashboard from '@/src/modules/human-capital/components/Dashboard';
import DataGrid from '@/src/modules/human-capital/components/DataGrid';
import GeminiPanel from '@/src/modules/human-capital/components/GeminiPanel';
import AnalysisPanel from '@/src/modules/human-capital/components/AnalysisPanel';
import FilterBar, { FilterState } from '@/src/modules/human-capital/components/FilterBar';
import ProfileManager from '@/src/modules/iam/components/ProfileManager';
import Planning from '@/src/modules/human-capital/components/Planning';
import { canManageProfiles, canPlan } from '../iam/types';
import { formatDateForApi } from '@/src/modules/human-capital/utils/formatters';
import { LayoutDashboard, Table, Settings, CheckCircle2, AlertTriangle, Sparkles, CalendarRange, UserCog, Lock, BarChart3 } from 'lucide-react';
import { ApiConfig, OvertimeRecord, FetchStatus, UserProfile, ManualEmployee } from '@/src/modules/human-capital/types';
import { SidebarBase, SidebarItem } from '../../../layout/SidebarBase';
import { useNavigate } from 'react-router-dom';
import { realOvertimeData, RealOvertimeRecord } from '@/src/modules/human-capital/data/realOvertime';
import { getManualEmployees, upsertManualEmployee } from '@/src/modules/human-capital/services/firestoreCH';
import { CreateEmployeeModal } from '@/src/modules/human-capital/components/CreateEmployeeModal';
import { UserPlus } from 'lucide-react';

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

// Helper para inicializar datas corretamente
const getInitialFilters = (): FilterState => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();

  return {
    searchTerm: '',
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    function: '',
    costCenter: '',
    type: '',
    year: year.toString(),
    month: month.toString().padStart(2, '0'),
    dateMode: 'CALENDAR'
  };
};

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

  // Manual Employees State (Global for HC Module)
  const [manualEmployees, setManualEmployees] = useState<ManualEmployee[]>([]);
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false);

  // ... (keeping other lines same if not part of this block, but mainly reverting the state init)

  const [showAiPanel, setShowAiPanel] = useState(false);

  // Inicializa filtros com função helper
  const [filters, setFilters] = useState<FilterState>(getInitialFilters());

  useEffect(() => {
    if (!isProfileLoading) {
      if (!hasModuleAccess('human_capital')) {
        // Handle access denial logic
      }
    }
  }, [isProfileLoading, hasModuleAccess, navigate]);

  // CORREÇÃO CRÍTICA: Adicionado dependência de filtros de data para recarregar API
  useEffect(() => {
    if (effectiveUser) {
      loadData();
    }
  }, [effectiveUser, filters.startDate, filters.endDate]);

  const loadData = async () => {
    setStatus('loading');
    const apiConfig = {
      ...config,
      // Garante que a API receba as datas selecionadas no filtro
      startDate: filters.startDate ? formatDateForApi(filters.startDate) : config.startDate,
      endDate: filters.endDate ? formatDateForApi(filters.endDate) : config.endDate
    };

    // Pequena otimização: se as datas forem inválidas, não busca
    if (!apiConfig.startDate || !apiConfig.endDate) return;

    try {
      const records = await fetchOvertimeData(apiConfig);
      setData(records);
      setStatus('success');
    } catch (e) {
      console.error("Failed to load HC data", e);
      setStatus('error');
    }
  };

  // Carrega colaboradores manuais
  useEffect(() => {
    const loadManual = async () => {
      try {
        const manuals = await getManualEmployees();
        setManualEmployees(manuals);
      } catch (error) {
        console.error("Erro ao carregar colaboradores manuais:", error);
      }
    };
    loadManual();
  }, []);

  const handleCreateEmployee = async (name: string, chapa: string, cc: string, role: string) => {
    if (!effectiveUser) return;
    const newEmp: ManualEmployee = {
      id: chapa,
      chapa,
      name,
      costCenter: cc,
      role,
      status: 'ACTIVE'
    };
    try {
      await upsertManualEmployee(newEmp, effectiveUser);
      setManualEmployees(prev => [...prev, newEmp]);
      alert('Colaborador criado com sucesso!');
    } catch (error) {
      console.error("Erro ao criar colaborador:", error);
      alert('Erro ao criar colaborador.');
    }
  };

  const getRegional = (cc: string): string => {
    const normalized = cc.replace(/\./g, '').trim();
    const REGIONAL_MAP: Record<string, string> = {
      '301201': 'Regional 01', '301502': 'Regional 01', '301503': 'Regional 01',
      '302801': 'Regional 01', '304301': 'Regional 01', '304501': 'Regional 01',
      '301804': 'Regional 02', '301805': 'Regional 02', '301806': 'Regional 02',
      '301903': 'Regional 02', '304401': 'Regional 02', '304402': 'Regional 02',
      '1001': 'Sede', '1002': 'Sede', '1003': 'Sede', '1004': 'Sede', '1005': 'Sede',
      '10101': 'Sede', '10301': 'Sede', '10401': 'Sede', '10501': 'Sede', '10601': 'Sede',
      '300001': 'Sede'
    };
    return REGIONAL_MAP[normalized] || 'Outros';
  };

  const filteredRealOvertime = useMemo(() => {
    if (!effectiveUser?.scope) return realOvertimeData;
    const scope = effectiveUser.scope;

    return realOvertimeData.filter(item => {
      if (scope.type === 'ALL') return true;
      const regional = getRegional(item.costCenter);
      const normalizedCC = item.costCenter.replace(/\./g, '');
      if (scope.type === 'REGIONAL') return scope.regionals.includes(regional);
      if (scope.type === 'COST_CENTER') return scope.costCenters.includes(normalizedCC);
      return false;
    });
  }, [effectiveUser]);

  const scopedData = useMemo(() => {
    if (!effectiveUser) return [];
    if (!data) return [];
    const scope = effectiveUser.scope;
    if (!scope || scope.type === 'ALL') return data;

    return data.filter(item => {
      const cc = item.CODCCUSTO || '';
      const regional = getRegional(cc);
      const normalizedCC = cc.replace(/\./g, '');
      if (scope.type === 'REGIONAL') return scope.regionals.includes(regional);
      if (scope.type === 'COST_CENTER') return scope.costCenters.includes(normalizedCC);
      return false;
    });
  }, [data, effectiveUser]);

  const filterOptions = useMemo(() => {
    const functions = new Set<string>();
    const costCenters = new Set<string>();
    const events = new Set<string>();
    const years = new Set<string>();

    // Usa scopedData para gerar opções relevantes
    scopedData.forEach(item => {
      if (item.FUNCAO) functions.add(item.FUNCAO);
      if (item.CODCCUSTO) costCenters.add(item.CODCCUSTO);
      if (item.EVENTO) events.add(item.EVENTO);
      if (item.DATA) years.add(new Date(item.DATA).getFullYear().toString());
    });

    return {
      functions: Array.from(functions).sort(),
      costCenters: Array.from(costCenters).sort(),
      types: Array.from(events).sort(),
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

      // Nota: Filtro de data já foi aplicado na API, mas podemos reforçar aqui se necessário
      // para garantir consistência visual no front

      return matchesSearch && matchesFunction && matchesCostCenter && matchesEvent;
    });
  }, [scopedData, filters]);

  const clearFilters = () => {
    setFilters(getInitialFilters());
  };

  const handleLogout = () => {
    signOut();
    navigate('/login');
  };

  const sidebarItems: SidebarItem[] = useMemo(() => {
    if (!effectiveUser) return [];
    const items: SidebarItem[] = [
      { key: Tab.DASHBOARD, label: "Visão Geral", icon: LayoutDashboard, onClick: () => setActiveTab(Tab.DASHBOARD), isActive: activeTab === Tab.DASHBOARD },
      { key: Tab.ANALYSIS, label: "Análise de Dados", icon: BarChart3, onClick: () => setActiveTab(Tab.ANALYSIS), isActive: activeTab === Tab.ANALYSIS },
      { key: Tab.DATA, label: "Histórico", icon: Table, onClick: () => setActiveTab(Tab.DATA), isActive: activeTab === Tab.DATA },
    ];
    if (canPlan(effectiveUser.role)) items.push({ key: Tab.PLANNING, label: "Planejamento", icon: CalendarRange, onClick: () => setActiveTab(Tab.PLANNING), isActive: activeTab === Tab.PLANNING });
    if (canManageProfiles(effectiveUser.role)) items.push({ key: Tab.PROFILES, label: "Gestão de Usuários", icon: UserCog, onClick: () => setActiveTab(Tab.PROFILES), isActive: activeTab === Tab.PROFILES });
    items.push({ key: Tab.SETTINGS, label: "Configurações", icon: Settings, onClick: () => setActiveTab(Tab.SETTINGS), isActive: activeTab === Tab.SETTINGS });
    return items;
  }, [effectiveUser, activeTab]);

  if (isProfileLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-blue-600 font-medium">Carregando perfil...</div></div>;
  if (!hasModuleAccess('human_capital')) return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500 gap-4"><Lock size={48} className="text-gray-300" /><h2 className="text-xl font-bold">Acesso Restrito</h2><p>Seu perfil não possui acesso ao módulo Capital Humano.</p><button onClick={() => navigate('/')} className="text-blue-600 underline text-sm">Voltar ao início</button></div>;
  if (!effectiveUser) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-blue-600 font-medium">Carregando Perfil Capital Humano...</div></div>;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <SidebarBase
        brand={{ topLogoSrc: "/assets/dr-logo.png", title: "Capital Humano", subtitle: "TOTVS Analytics" }}
        items={sidebarItems}
        userDisplay={{ name: effectiveUser.name || 'Usuário', role: effectiveUser.role || 'Membro', avatarUrl: effectiveUser.avatar === '👤' ? undefined : effectiveUser.avatar }}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative bg-gray-50/30 ml-20 transition-all duration-300">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">
              {activeTab === Tab.DASHBOARD && 'Dashboard Geral'}
              {activeTab === Tab.ANALYSIS && 'Análise de Dados'}
              {activeTab === Tab.DATA && 'Histórico de Registros'}
              {activeTab === Tab.PLANNING && 'Planejamento de Horas'}
              {activeTab === Tab.PROFILES && 'Administração de Usuários'}
              {activeTab === Tab.SETTINGS && 'Configuração do Sistema'}
            </h2>
            <button
              onClick={() => setIsCreateEmployeeOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors shadow-sm ml-4"
            >
              <UserPlus size={16} /> Novo Colaborador
            </button>
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
            {activeTab === Tab.DASHBOARD && (
              <Dashboard
                data={filteredData}
              />
            )}
            {activeTab === Tab.DATA && <DataGrid data={filteredData} />}
            {activeTab === Tab.ANALYSIS && (
              <AnalysisPanel
                data={filteredData}
                realOvertime={filteredRealOvertime}
                selectedYear={filters.year}
              />
            )}
            {activeTab === Tab.PLANNING && canPlan(effectiveUser.role) && <Planning user={effectiveUser} employees={scopedData} manualEmployees={manualEmployees} />}
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

            {/* Global Modals */}
            <CreateEmployeeModal
              isOpen={isCreateEmployeeOpen}
              onClose={() => setIsCreateEmployeeOpen(false)}
              onSave={handleCreateEmployee}
              costCenters={Array.from(new Set(scopedData.map(d => d.CODCCUSTO))).sort()}
            />
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

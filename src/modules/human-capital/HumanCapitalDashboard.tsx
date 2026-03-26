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
import HeadcountUpload from '@/src/modules/human-capital/components/HeadcountUpload';
import HeadcountGovernance from '@/src/modules/human-capital/components/HeadcountGovernance';
import { canManageProfiles, canPlan } from '../iam/types';
import { formatDateForApi } from '@/src/modules/human-capital/utils/formatters';
import { LayoutDashboard, Table, Settings, CheckCircle2, AlertTriangle, Sparkles, CalendarRange, UserCog, Lock, BarChart3 } from 'lucide-react';
import { ApiConfig, OvertimeRecord, FetchStatus, UserProfile, ManualEmployee, GlobalEmployee } from '@/src/modules/human-capital/types';
import { CorporateSidebar, SidebarItem } from '../../components/navigation/CorporateSidebar';
import { useNavigate } from 'react-router-dom';
import { realOvertimeData, RealOvertimeRecord } from '@/src/modules/human-capital/data/realOvertime';
import { getManualEmployees, upsertManualEmployee } from '@/src/modules/human-capital/services/firestoreCH';
import { CreateEmployeeModal } from '@/src/modules/human-capital/components/CreateEmployeeModal';
import { getCCRegional } from '@/src/modules/human-capital/data/ccMaster';
import { saveGlobalEmployees, getGlobalEmployeesSync, getHeadcountSync } from '@/src/modules/human-capital/services/planning';
import { gerarOvertimeRateado } from '@/src/modules/human-capital/utils/headcountRateio';

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

// regionalMap agora vem de ccMaster.ts — fonte única de verdade
// getRegional delegado para getCCRegional do master

const getInitialFilters = (): FilterState => {
  return {
    searchTerm: '',
    startDate: '2025-01-01',
    endDate: '2026-12-31',
    function: '',
    costCenter: '',
    regional: '',
    type: '',
    year: '2026',
    month: '01',
    dateMode: 'CUSTOM'
  };
};

const parseFilterDate = (dateString: string, fallback: Date): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
  }

  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) return fallback;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
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
      costCenter: profile.modules.human_capital.scope.type === 'COST_CENTER' 
        ? profile.modules.human_capital.scope.costCenters[0] 
        : undefined,
      avatar: profile.avatarUrl || '👤',
      isSuperAdmin: profile.isSuperAdmin
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
  const [globalEmployees, setGlobalEmployees] = useState<GlobalEmployee[]>(() => getGlobalEmployeesSync());

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

  // Esponja de Dados Global: Sempre que carregarmos novos dados ou manuais, verifica se tem nomes novos que faltam
  useEffect(() => {
    if (!effectiveUser || (data.length === 0 && manualEmployees.length === 0)) return;

    // Processa em background
    const timer = setTimeout(() => {
      const currentGlobalMap = new Map(globalEmployees.map(e => [e.chapa, e]));
      const newGlobalEmps: GlobalEmployee[] = [];
      let hasChanges = false;

      data.forEach(e => {
        if (!e.CHAPA) return;
        const existing = currentGlobalMap.get(e.CHAPA);
        if (!existing || existing.nome !== e.NOME || existing.funcao !== e.FUNCAO || existing.costCenter !== e.CODCCUSTO) {
          newGlobalEmps.push({
            chapa: e.CHAPA,
            nome: e.NOME || '',
            funcao: e.FUNCAO || '',
            costCenter: e.CODCCUSTO || ''
          });
          hasChanges = true;
          currentGlobalMap.set(e.CHAPA, newGlobalEmps[newGlobalEmps.length - 1]);
        }
      });

      manualEmployees.forEach(m => {
        if (!m.chapa) return;
        const existing = currentGlobalMap.get(m.chapa);
        if (!existing || existing.nome !== m.name || existing.costCenter !== m.costCenter) {
          newGlobalEmps.push({
            chapa: m.chapa,
            nome: m.name,
            funcao: existing?.funcao || 'Manual',
            costCenter: m.costCenter
          });
          hasChanges = true;
          currentGlobalMap.set(m.chapa, newGlobalEmps[newGlobalEmps.length - 1]);
        }
      });

      if (hasChanges && newGlobalEmps.length > 0) {
        saveGlobalEmployees(newGlobalEmps, effectiveUser).then(() => {
          setGlobalEmployees(Array.from(currentGlobalMap.values()));
        }).catch(console.error);
      }
    }, 2000); // 2 segundos depois pra não travar a renderização imediata da tela

    return () => clearTimeout(timer);
  }, [data, manualEmployees, effectiveUser, globalEmployees.length]);

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

  const getRegional = (cc: string): string => getCCRegional(cc);

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

  /**
   * Headcount do cache local (sincronizado apos cada upload confirmado).
   */
  const headcountRecords = useMemo(() => getHeadcountSync(), [data]);

  /**
   * Base rateada: aplica o motor de headcount sobre o dado bruto TOTVS.
   *  - Chapas COM headcount vigente: CC = headcount, HORAS = horas x distribuicao
   *  - Chapas SEM headcount: mantidas como bruto (CC = TOTVS original, auditavel)
   *  - Sem headcount importado: retorna `data` inalterado (fallback transparente)
   */
  const ratedData = useMemo(
    () => gerarOvertimeRateado(data, headcountRecords),
    [data, headcountRecords]
  );

  const scopedData = useMemo(() => {
    if (!effectiveUser) return [];
    if (!ratedData) return [];
    const scope = effectiveUser.scope;
    if (!scope || scope.type === 'ALL') return ratedData;

    return ratedData.filter(item => {
      const cc = item.CODCCUSTO || '';
      const regional = getRegional(cc);
      const normalizedCC = cc.replace(/\./g, '');
      if (scope.type === 'REGIONAL') return scope.regionals.includes(regional);
      if (scope.type === 'COST_CENTER') return scope.costCenters.includes(normalizedCC);
      return false;
    });
  }, [ratedData, effectiveUser]);

  const filterOptions = useMemo(() => {
    const functions = new Set<string>();
    const costCenters = new Set<string>();
    const events = new Set<string>();
    const years = new Set<string>();
    const regionals = new Set<string>();

    // Usa scopedData para gerar opções relevantes
    scopedData.forEach(item => {
      if (item.FUNCAO) functions.add(item.FUNCAO);
      if (item.CODCCUSTO) {
        costCenters.add(item.CODCCUSTO);
        regionals.add(getRegional(item.CODCCUSTO));
      }
      if (item.EVENTO) events.add(item.EVENTO);
      if (item.DATA) years.add(new Date(item.DATA).getFullYear().toString());
    });

    return {
      functions: Array.from(functions).sort(),
      costCenters: Array.from(costCenters).sort(),
      types: Array.from(events).sort(),
      years: Array.from(years).sort().reverse(),
      regionals: Array.from(regionals).sort()
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
      const matchesRegional = !filters.regional || getRegional(item.CODCCUSTO || '') === filters.regional;

      return matchesSearch && matchesFunction && matchesCostCenter && matchesEvent && matchesRegional;
    });
  }, [scopedData, filters]);

  const comparisonPeriod = useMemo(() => {
    const today = new Date();
    const start = parseFilterDate(filters.startDate, today);
    const end = parseFilterDate(filters.endDate, start);

    if (end < start) {
      return { periodStart: end, periodEnd: start };
    }

    return { periodStart: start, periodEnd: end };
  }, [filters.startDate, filters.endDate]);

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
    if (effectiveUser.isSuperAdmin || canPlan(effectiveUser.role)) items.push({ key: Tab.PLANNING, label: "Planejamento", icon: CalendarRange, onClick: () => setActiveTab(Tab.PLANNING), isActive: activeTab === Tab.PLANNING });
    if (canManageProfiles(profile)) items.push({ key: Tab.PROFILES, label: "Gestão de Usuários", icon: UserCog, onClick: () => setActiveTab(Tab.PROFILES), isActive: activeTab === Tab.PROFILES });
    items.push({ key: Tab.SETTINGS, label: "Configurações", icon: Settings, onClick: () => setActiveTab(Tab.SETTINGS), isActive: activeTab === Tab.SETTINGS });
    return items;
  }, [effectiveUser, activeTab]);

  if (isProfileLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-blue-600 font-medium">Carregando perfil...</div></div>;
  if (!hasModuleAccess('human_capital')) return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500 gap-4"><Lock size={48} className="text-gray-300" /><h2 className="text-xl font-bold">Acesso Restrito</h2><p>Seu perfil não possui acesso ao módulo Capital Humano.</p><button onClick={() => navigate('/')} className="text-blue-600 underline text-sm">Voltar ao início</button></div>;
  if (!effectiveUser) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-blue-600 font-medium">Carregando Perfil Capital Humano...</div></div>;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <CorporateSidebar
        brand={{ topLogoSrc: "/assets/dr-logo.png", title: "Capital Humano", subtitle: "TOTVS Analytics" }}
        items={sidebarItems}
        userDisplay={{ name: effectiveUser.name || 'Usuário', role: effectiveUser.role || 'Membro', avatarUrl: effectiveUser.avatar === '👤' ? undefined : effectiveUser.avatar }}
        onLogout={handleLogout}
        accountLinkTo="/config/account"
        storageKey="drnexus.sidebar.collapsed.human-capital"
      />

      <main className="flex-1 flex flex-col overflow-hidden relative bg-gray-50/30 transition-all duration-300">
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
          </div>
          <div className="flex items-center gap-3">
            {/* Badge status TOTVS */}
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide flex items-center space-x-1.5 shadow-sm ${status === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
              {status === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              <span>{status === 'success' ? 'Conectado TOTVS' : 'Modo Simulação'}</span>
            </div>
            {/* Badge status Headcount */}
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide flex items-center space-x-1.5 shadow-sm ${headcountRecords.length > 0 ? 'bg-teal-100 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
              {headcountRecords.length > 0
                ? <><CheckCircle2 size={14} /><span>HC Ativo · {headcountRecords.length} reg.</span></>
                : <><AlertTriangle size={14} /><span>Sem Headcount</span></>
              }
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pt-2 pb-4 px-4 lg:pt-3 lg:pb-8 lg:px-8 scroll-smooth">
          {(activeTab === Tab.DASHBOARD || activeTab === Tab.DATA || activeTab === Tab.ANALYSIS) && (
            <FilterBar filters={filters} setFilters={setFilters} options={filterOptions} onClear={clearFilters} />
          )}

          <div className="mt-5 animate-in fade-in duration-500 slide-in-from-bottom-2">
            {activeTab === Tab.DASHBOARD && (() => {
              // Compute all monthKeys covered by the active filter
              const buildMonthKeys = (): string[] => {
                const { dateMode, year, endDate, startDate } = filters;
                if (dateMode === 'ANNUAL') {
                  // All 12 months of the selected year
                  return Array.from({ length: 12 }, (_, i) =>
                    `${year}-${String(i + 1).padStart(2, '0')}`
                  );
                }
                if (dateMode === 'PAYROLL' || dateMode === 'CALENDAR') {
                  // Single month: the payment/end month
                  return [endDate.substring(0, 7)];
                }
                // CUSTOM: all months between startDate and endDate
                const keys: string[] = [];
                const [sy, sm] = startDate.substring(0, 7).split('-').map(Number);
                const [ey, em] = endDate.substring(0, 7).split('-').map(Number);
                let cy = sy; let cm = sm;
                while (cy < ey || (cy === ey && cm <= em)) {
                  keys.push(`${cy}-${String(cm).padStart(2, '0')}`);
                  cm++; if (cm > 12) { cm = 1; cy++; }
                }
                return keys;
              };
              return (
                <Dashboard
                  data={filteredData}
                  allData={scopedData}
                  regional={filters.regional}
                  budgetMonthKeys={buildMonthKeys()}
                  onNavigateToEmployee={(name) => {
                    setFilters(prev => ({ ...prev, searchTerm: name }));
                    setActiveTab(Tab.DATA);
                  }}
                  selectedMonth={`${filters.year}-${filters.month}`}
                  user={effectiveUser}
                  periodStart={comparisonPeriod.periodStart}
                  periodEnd={comparisonPeriod.periodEnd}
                />
              );
            })()}
            {activeTab === Tab.DATA && <DataGrid data={filteredData} rawData={headcountRecords.length > 0 ? data : undefined} />}
            {activeTab === Tab.ANALYSIS && (
              <AnalysisPanel
                data={filteredData}
                allData={scopedData}
                realOvertime={filteredRealOvertime}
                selectedYear={filters.year}
                periodStart={comparisonPeriod.periodStart}
                periodEnd={comparisonPeriod.periodEnd}
                filters={filters}
              />
            )}
            {activeTab === Tab.PLANNING && (effectiveUser.isSuperAdmin || canPlan(effectiveUser.role)) && <Planning user={effectiveUser} employees={scopedData} manualEmployees={manualEmployees} headcountRecords={headcountRecords} />}
            {activeTab === Tab.PROFILES && canManageProfiles(profile) && <ProfileManager />}
            {activeTab === Tab.SETTINGS && (
              <div className="space-y-6">
                {/* Governança do headcount ativo */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-base font-semibold text-slate-800 mb-1">Status do Headcount</h3>
                  <p className="text-sm text-slate-500 mb-5">
                    Rastreabilidade do headcount ativo e diagnóstico de conservação de horas.
                  </p>
                  <HeadcountGovernance
                    headcountRecords={headcountRecords}
                    rawData={data}
                    onClear={() => {
                      try { localStorage.removeItem('hc_headcount_cache'); } catch (_) {}
                      window.location.reload();
                    }}
                    onRefresh={() => window.location.reload()}
                  />
                </div>
                {/* Upload / atualização */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-base font-semibold text-slate-800 mb-1">Headcount por Centro de Custo</h3>
                  <p className="text-sm text-slate-500 mb-5">
                    Importe a tabela de distribuição de colaboradores por CC para corrigir o rateio de horas reais.
                  </p>
                  <HeadcountUpload user={effectiveUser} />
                </div>
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

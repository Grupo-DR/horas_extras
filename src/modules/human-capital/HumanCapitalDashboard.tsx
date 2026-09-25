import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOvertimeDataWithMeta, TotvsIntegrationError } from '@/src/modules/human-capital/services/totvs';
import Dashboard from '@/src/modules/human-capital/components/Dashboard';
import AbsenteeismDashboard from '@/src/modules/human-capital/components/AbsenteeismDashboard';
import DataGrid from '@/src/modules/human-capital/components/DataGrid';
import GeminiPanel from '@/src/modules/human-capital/components/GeminiPanel';
import AnalysisPanel from '@/src/modules/human-capital/components/AnalysisPanel';
import FilterBar, { FilterState } from '@/src/modules/human-capital/components/FilterBar';

import Planning from '@/src/modules/human-capital/components/Planning';
import HeadcountUpload from '@/src/modules/human-capital/components/HeadcountUpload';
import HeadcountGovernance from '@/src/modules/human-capital/components/HeadcountGovernance';
import CostCenterStructure from '@/src/modules/human-capital/components/CostCenterStructure';
import { canAccessSettings, canManageHeadcount, canPlan } from '../iam/types';
import { formatDateForApi } from '@/src/modules/human-capital/utils/formatters';
import { getCompetencyRange, getPlanningCompetency } from '@/src/modules/human-capital/utils/planningWorkflow';
import { LayoutDashboard, Table, Settings, CheckCircle2, AlertTriangle, Sparkles, CalendarRange, Lock, BarChart3, Activity, RefreshCw, XCircle, Loader2, Briefcase } from 'lucide-react';
import { ApiConfig, OvertimeRecord, FetchStatus, UserProfile, ManualEmployee, GlobalEmployee, HeadcountRecord, TotvsQueryMeta } from '@/src/modules/human-capital/types';
import { CorporateSidebar, SidebarItem } from '../../components/navigation/CorporateSidebar';
import { useNavigate } from 'react-router-dom';
import { realOvertimeData, RealOvertimeRecord } from '@/src/modules/human-capital/data/realOvertime';
import { getManualEmployees, upsertManualEmployee } from '@/src/modules/human-capital/services/firestoreCH';
import { CreateEmployeeModal } from '@/src/modules/human-capital/components/CreateEmployeeModal';
import { getCCRegional } from '@/src/modules/human-capital/data/ccMaster';
import { saveGlobalEmployees, getGlobalEmployeesSync, getHeadcountSync, getHeadcount, clearHeadcountCache } from '@/src/modules/human-capital/services/planning';
import { gerarOvertimeRateado } from '@/src/modules/human-capital/utils/headcountRateio';
import { formatDateKey, getPayrollCompetencyMonthKey, getPayrollCompetencyMonthKeysForRange } from '@/src/modules/human-capital/utils/overtime';

// Período padrão da consulta TOTVS (MM/DD/AAAA).
// Endereço e credenciais ficam somente na Cloud Function hcFetchOvertime.
const DEFAULT_CONFIG: ApiConfig = {
  startDate: '07/01/2025',
  endDate: '01/01/2027'
};

enum Tab {
  DASHBOARD = 'dashboard',
  ABSENTEEISM = 'absenteeism',
  COST_CENTER_STRUCTURE = 'cost_center_structure',
  DATA = 'data',
  PLANNING = 'planning',
  ANALYSIS = 'analysis',
  SETTINGS = 'settings'
}

const TOTVS_DATA_TABS = new Set<Tab>([Tab.DASHBOARD, Tab.ABSENTEEISM, Tab.DATA, Tab.ANALYSIS]);

const formatQueryTimestamp = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
};

const getTotvsBadge = (status: FetchStatus) => {
  if (status === 'success') {
    return {
      className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      icon: <CheckCircle2 size={14} />,
      label: 'Dados reais TOTVS'
    };
  }

  if (status === 'empty') {
    return {
      className: 'bg-slate-100 text-slate-600 border border-slate-200',
      icon: <CheckCircle2 size={14} />,
      label: 'TOTVS sem registros'
    };
  }

  if (status === 'loading') {
    return {
      className: 'bg-blue-100 text-blue-700 border border-blue-200',
      icon: <Loader2 size={14} className="animate-spin" />,
      label: 'Consultando TOTVS'
    };
  }

  if (status === 'error') {
    return {
      className: 'bg-rose-100 text-rose-700 border border-rose-200',
      icon: <XCircle size={14} />,
      label: 'Erro TOTVS'
    };
  }

  return {
    className: 'bg-slate-100 text-slate-500 border border-slate-200',
    icon: <AlertTriangle size={14} />,
    label: 'TOTVS pendente'
  };
};

const getTotvsNoticeStyle = (status: FetchStatus): string => {
  if (status === 'success') return 'bg-emerald-50 border-emerald-200 text-emerald-800';
  if (status === 'empty') return 'bg-slate-50 border-slate-200 text-slate-700';
  if (status === 'loading') return 'bg-blue-50 border-blue-200 text-blue-800';
  if (status === 'error') return 'bg-rose-50 border-rose-200 text-rose-800';
  return 'bg-amber-50 border-amber-200 text-amber-800';
};

const TotvsStatusNotice: React.FC<{
  status: FetchStatus;
  meta: TotvsQueryMeta | null;
  errorMessage: string | null;
  hasPreviousData: boolean;
  onRetry: () => void;
}> = ({ status, meta, errorMessage, hasPreviousData, onRetry }) => {
  if (status === 'idle' && !meta && !errorMessage) return null;

  const isError = status === 'error';
  const isLoading = status === 'loading';
  const isEmpty = status === 'empty';
  const period = meta?.period;
  const periodLabel = period ? `${period.startDate} a ${period.endDate}` : '-';

  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${getTotvsNoticeStyle(status)}`}>
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 shrink-0">
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : isError ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold">
            {isError && 'Erro ao consultar a integracao TOTVS'}
            {isLoading && 'Consultando dados reais da TOTVS'}
            {isEmpty && 'Sem registros no periodo'}
            {status === 'success' && 'Consulta TOTVS concluida com dados reais'}
            {status === 'idle' && 'Consulta TOTVS ainda nao iniciada'}
          </p>
          <p className="text-xs mt-1 opacity-90">
            {isError
              ? (errorMessage || 'Nao foi possivel consultar os dados reais da TOTVS para o periodo selecionado. Verifique a integracao ou tente novamente.')
              : `Origem: ${meta?.source || 'TOTVS_API'} | Periodo: ${periodLabel} | Consulta: ${formatQueryTimestamp(meta?.queriedAt)} | Linhas retornadas: ${meta?.recordCount ?? 0} | Eventos processados: ${meta?.parsedRecordCount ?? 0}`}
          </p>
          {isError && (
            <p className="text-xs mt-1 opacity-80">
              Periodo preservado: {periodLabel}. {hasPreviousData ? 'Dados anteriores foram preservados, mas nao estao sendo exibidos como resultado atual.' : 'Nenhum dado oficial foi carregado para este periodo.'}
            </p>
          )}
        </div>
      </div>

      {(isError || status === 'idle') && (
        <button
          onClick={onRetry}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/80 hover:bg-white border border-current/20 text-xs font-bold transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} />
          Tentar novamente
        </button>
      )}
    </div>
  );
};

const TotvsBlockingState: React.FC<{
  status: FetchStatus;
  errorMessage: string | null;
  onRetry: () => void;
}> = ({ status, errorMessage, onRetry }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 flex flex-col items-center justify-center text-center">
    {status === 'loading' ? (
      <Loader2 size={36} className="animate-spin text-blue-600 mb-4" />
    ) : (
      <XCircle size={40} className="text-rose-500 mb-4" />
    )}
    <p className="text-base font-bold text-slate-800">
      {status === 'loading' ? 'Carregando dados reais da TOTVS' : 'Dados reais nao carregados'}
    </p>
    <p className="text-sm text-slate-500 mt-2 max-w-2xl">
      {status === 'loading'
        ? 'A tela sera atualizada somente quando a consulta real for concluida.'
        : errorMessage || 'Nao foi possivel consultar os dados reais da TOTVS para o periodo selecionado. Verifique a integracao ou tente novamente.'}
    </p>
    {status !== 'loading' && (
      <button
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors"
      >
        <RefreshCw size={15} />
        Tentar novamente
      </button>
    )}
  </div>
);

// regionalMap agora vem de ccMaster.ts — fonte única de verdade
// getRegional delegado para getCCRegional do master

/**
 * Filtros iniciais na competência VIGENTE da folha (21 do mês anterior a 20).
 * Antes o painel abria sempre em janeiro/2026, com uma consulta vazia ao TOTVS
 * a cada abertura antes de o usuário escolher o período.
 */
const getInitialFilters = (): FilterState => {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const competency = getPlanningCompetency(todayKey);
  const { start, end } = getCompetencyRange(competency);
  const [year, month] = competency.split('-');
  return {
    searchTerm: '',
    startDate: start,
    endDate: end,
    function: '',
    costCenter: '',
    regional: '',
    type: '',
    year,
    month,
    dateMode: 'PAYROLL'
  };
};

const normalizeDateMode = (mode: FilterState['dateMode']): 'PAYROLL' | 'ANNUAL' | 'CUSTOM' =>
  mode === 'ANNUAL' || mode === 'CUSTOM' ? mode : 'PAYROLL';

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

  const effectiveUser = currentUser;

  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG);
  const [data, setData] = useState<OvertimeRecord[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [totvsMeta, setTotvsMeta] = useState<TotvsQueryMeta | null>(null);
  const [totvsError, setTotvsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);

  // Manual Employees State (Global for HC Module)
  const [manualEmployees, setManualEmployees] = useState<ManualEmployee[]>([]);
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false);
  const [globalEmployees, setGlobalEmployees] = useState<GlobalEmployee[]>(() => getGlobalEmployeesSync());
  const [headcountRecords, setHeadcountRecords] = useState<HeadcountRecord[]>(() => getHeadcountSync());


  const [showAiPanel, setShowAiPanel] = useState(false);

  const trustedTotvsData = useMemo(
    () => (status === 'success' || status === 'empty' ? data : []),
    [data, status]
  );

  // Inicializa filtros com função helper
  // Inicializa filtros com função helper
  const [filters, setFilters] = useState<FilterState>(getInitialFilters());

  useEffect(() => {
    if (!isProfileLoading) {
      if (!hasModuleAccess('human_capital')) {
        // Handle access denial logic
      }
    }
  }, [isProfileLoading, hasModuleAccess, navigate]);

  useEffect(() => {
    if (!effectiveUser) return;

    if (activeTab === Tab.SETTINGS && !(effectiveUser.isSuperAdmin || canAccessSettings(effectiveUser.role))) {
      setActiveTab(Tab.DASHBOARD);
    }
  }, [activeTab, effectiveUser]);

  // CORREÇÃO CRÍTICA: Adicionado dependência de filtros de data para recarregar API
  // Otimização: Debounce para carga de dados no modo CUSTOM. 
  // Imediato para PAYROLL/ANNUAL, atrasado para CUSTOM (evita spam de API ao digitar datas)
  useEffect(() => {
    if (!effectiveUser) return;

    if (filters.dateMode !== 'CUSTOM') {
      loadData();
      return;
    }

    const timer = setTimeout(() => {
      loadData();
    }, 800);

    return () => clearTimeout(timer);
  }, [effectiveUser, filters.dateMode, filters.startDate, filters.endDate]);

  const loadData = async () => {
    setStatus('loading');
    setTotvsError(null);
    const apiConfig = {
      ...config,
      // Garante que a API receba as datas selecionadas no filtro
      startDate: filters.startDate ? formatDateForApi(filters.startDate) : config.startDate,
      endDate: filters.endDate ? formatDateForApi(filters.endDate) : config.endDate
    };

    // Pequena otimização: se as datas forem inválidas, não busca
    if (!apiConfig.startDate || !apiConfig.endDate) {
      const errorMessage = 'Periodo invalido para consulta da TOTVS.';
      setTotvsError(errorMessage);
      setTotvsMeta({
        source: 'TOTVS_API',
        queriedAt: new Date().toISOString(),
        period: {
          startDate: apiConfig.startDate || '-',
          endDate: apiConfig.endDate || '-'
        },
        status: 'ERROR',
        recordCount: 0,
        parsedRecordCount: 0,
        errorCode: 'UNEXPECTED_FORMAT',
        errorMessage
      });
      setStatus('error');
      return;
    }

    try {
      const result = await fetchOvertimeDataWithMeta(apiConfig);
      setData(result.data);
      setTotvsMeta(result.meta);
      setStatus(result.meta.status === 'EMPTY' ? 'empty' : 'success');
    } catch (e) {
      const message = e instanceof TotvsIntegrationError
        ? e.userMessage
        : 'Nao foi possivel consultar os dados reais da TOTVS para o periodo selecionado. Verifique a integracao ou tente novamente.';

      console.error("Failed to load HC data", {
        message: e instanceof Error ? e.message : String(e),
        code: e instanceof TotvsIntegrationError ? e.code : undefined,
        httpStatus: e instanceof TotvsIntegrationError ? e.httpStatus : undefined
      });
      setTotvsError(message);
      setTotvsMeta(e instanceof TotvsIntegrationError ? e.meta : {
        source: 'TOTVS_API',
        queriedAt: new Date().toISOString(),
        period: {
          startDate: apiConfig.startDate,
          endDate: apiConfig.endDate
        },
        status: 'ERROR',
        recordCount: 0,
        parsedRecordCount: 0,
        errorCode: 'NETWORK_ERROR',
        errorMessage: message
      });
      setStatus('error');
    }
  };

  // Carrega colaboradores manuais
  useEffect(() => {
    if (!effectiveUser) return;

    const loadManual = async () => {
      try {
        const manuals = await getManualEmployees(effectiveUser.scope);
        setManualEmployees(manuals);
      } catch (error) {
        console.error("Erro ao carregar colaboradores manuais:", error);
      }
    };
    loadManual();
  }, [effectiveUser]);

  // Esponja de Dados Global: Sempre que carregarmos novos dados ou manuais, verifica se tem nomes novos que faltam
  useEffect(() => {
    if (!effectiveUser || (trustedTotvsData.length === 0 && manualEmployees.length === 0)) return;

    // Processa em background
    const timer = setTimeout(() => {
      const currentGlobalMap = new Map(globalEmployees.map(e => [e.chapa, e]));
      const newGlobalEmps: GlobalEmployee[] = [];
      let hasChanges = false;

      trustedTotvsData.forEach(e => {
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
  }, [trustedTotvsData, manualEmployees, effectiveUser, globalEmployees.length]);

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

  const syncHeadcountRecords = useCallback(async (options?: { clearCache?: boolean }) => {
    if (options?.clearCache) {
      clearHeadcountCache();
    }

    try {
      const records = await getHeadcount(undefined, effectiveUser);
      setHeadcountRecords(records);
      return records;
    } catch (error) {
      console.error('Erro ao sincronizar headcount:', error);
      const fallback = getHeadcountSync();
      setHeadcountRecords(fallback);
      return fallback;
    }
  }, [effectiveUser]);

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

  useEffect(() => {
    if (!effectiveUser) return;
    void syncHeadcountRecords();
  }, [effectiveUser, syncHeadcountRecords]);

  /**
   * Base rateada: aplica o motor de headcount sobre o dado bruto TOTVS.
   *  - Chapas COM headcount vigente: CC = headcount, HORAS = horas x distribuicao
   *  - Chapas SEM headcount: mantidas como bruto (CC = TOTVS original, auditavel)
   *  - Sem headcount importado: retorna `data` inalterado (fallback transparente)
   */
  const ratedData = useMemo(
    () => gerarOvertimeRateado(trustedTotvsData, headcountRecords),
    [trustedTotvsData, headcountRecords]
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

    const normalizeRoleStr = (s?: string) => s ? s.trim().replace(/\s+/g, ' ') : '';

    scopedData.forEach(item => {
      const normRole = normalizeRoleStr(item.FUNCAO);
      if (normRole) functions.add(normRole);
      if (item.CODCCUSTO) {
        costCenters.add(item.CODCCUSTO.trim());
        regionals.add(getRegional(item.CODCCUSTO.trim()));
      }
      if (item.EVENTO) events.add(item.EVENTO.trim());
      if (item.DATA) years.add(new Date(item.DATA).getFullYear().toString());
    });

    headcountRecords.forEach(record => {
      const normRole = normalizeRoleStr(record.funcao);
      if (normRole) functions.add(normRole);
      if (record.centroCusto) {
        costCenters.add(record.centroCusto.trim());
        regionals.add(getRegional(record.centroCusto.trim()));
      }
    });

    return {
      functions: Array.from(functions).sort(),
      costCenters: Array.from(costCenters).sort(),
      types: Array.from(events).sort(),
      years: Array.from(years).sort().reverse(),
      regionals: Array.from(regionals).sort()
    };
  }, [scopedData, headcountRecords]);

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

  const normalizedDateMode = useMemo(() => normalizeDateMode(filters.dateMode), [filters.dateMode]);

  const normalizedRangeStartDate = useMemo(
    () => formatDateKey(comparisonPeriod.periodStart),
    [comparisonPeriod.periodStart]
  );

  const normalizedRangeEndDate = useMemo(
    () => formatDateKey(comparisonPeriod.periodEnd),
    [comparisonPeriod.periodEnd]
  );

  const budgetMonthKeys = useMemo(() => {
    if (normalizedDateMode === 'ANNUAL') {
      return Array.from({ length: 12 }, (_, i) =>
        `${filters.year}-${String(i + 1).padStart(2, '0')}`
      );
    }

    if (normalizedDateMode === 'PAYROLL') {
      const monthKey = getPayrollCompetencyMonthKey(normalizedRangeEndDate) || `${filters.year}-${filters.month}`;
      return monthKey ? [monthKey] : [];
    }

    return getPayrollCompetencyMonthKeysForRange(normalizedRangeStartDate, normalizedRangeEndDate);
  }, [normalizedDateMode, filters.year, filters.month, normalizedRangeStartDate, normalizedRangeEndDate]);

  const selectedMonthKey = useMemo(() => {
    if (normalizedDateMode === 'CUSTOM') {
      const customKeys = getPayrollCompetencyMonthKeysForRange(normalizedRangeStartDate, normalizedRangeEndDate);
      if (customKeys.length === 1) return customKeys[0];

      return getPayrollCompetencyMonthKey(normalizedRangeEndDate)
        || customKeys[customKeys.length - 1]
        || `${filters.year}-${filters.month}`;
    }

    if (normalizedDateMode === 'ANNUAL') {
      return `${filters.year}-12`;
    }

    return getPayrollCompetencyMonthKey(normalizedRangeEndDate) || `${filters.year}-${filters.month}`;
  }, [normalizedDateMode, normalizedRangeStartDate, normalizedRangeEndDate, filters.year, filters.month]);

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
    
    // Liberado para a gerência e administradores de Capital Humano
    if (effectiveUser.isSuperAdmin || canManageHeadcount(effectiveUser.role)) {
      items.push({ key: Tab.ABSENTEEISM, label: "Absenteísmo", icon: Activity, onClick: () => setActiveTab(Tab.ABSENTEEISM), isActive: activeTab === Tab.ABSENTEEISM });
      items.push({ key: Tab.COST_CENTER_STRUCTURE, label: "Estrutura", icon: Briefcase, onClick: () => setActiveTab(Tab.COST_CENTER_STRUCTURE), isActive: activeTab === Tab.COST_CENTER_STRUCTURE });
    }
    if (effectiveUser.isSuperAdmin || canPlan(effectiveUser.role)) items.push({ key: Tab.PLANNING, label: "Planejamento", icon: CalendarRange, onClick: () => setActiveTab(Tab.PLANNING), isActive: activeTab === Tab.PLANNING });

    if (effectiveUser.isSuperAdmin || canAccessSettings(effectiveUser.role)) {
      items.push({ key: Tab.SETTINGS, label: "Configurações", icon: Settings, onClick: () => setActiveTab(Tab.SETTINGS), isActive: activeTab === Tab.SETTINGS });
    }
    return items;
  }, [effectiveUser, activeTab, profile]);

  const totvsBadge = getTotvsBadge(status);
  const shouldBlockTotvsDataTab = TOTVS_DATA_TABS.has(activeTab) && (
    status === 'loading' ||
    status === 'error' ||
    status === 'idle'
  );

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
              {activeTab === Tab.ABSENTEEISM && 'Dashboard de Absenteísmo'}
              {activeTab === Tab.COST_CENTER_STRUCTURE && 'Estrutura dos Centros de Custo'}
              {activeTab === Tab.ANALYSIS && 'Análise de Dados'}
              {activeTab === Tab.DATA && 'Histórico de Registros'}
              {activeTab === Tab.PLANNING && 'Planejamento de Horas'}
              {activeTab === Tab.SETTINGS && 'Configuração do Sistema'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Badge status TOTVS */}
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide flex items-center space-x-1.5 shadow-sm ${totvsBadge.className}`}>
              {totvsBadge.icon}
              <span>{totvsBadge.label}</span>
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
          {TOTVS_DATA_TABS.has(activeTab) && (
            <div className="mb-3">
              <TotvsStatusNotice
                status={status}
                meta={totvsMeta}
                errorMessage={totvsError}
                hasPreviousData={data.length > 0}
                onRetry={() => { void loadData(); }}
              />
            </div>
          )}

          {(activeTab === Tab.DASHBOARD || activeTab === Tab.DATA || activeTab === Tab.ANALYSIS || activeTab === Tab.ABSENTEEISM || activeTab === Tab.COST_CENTER_STRUCTURE) && (
            <FilterBar filters={filters} setFilters={setFilters} options={filterOptions} onClear={clearFilters} />
          )}

          <div className="mt-5 animate-in fade-in duration-500 slide-in-from-bottom-2">
            {shouldBlockTotvsDataTab && (
              <TotvsBlockingState status={status} errorMessage={totvsError} onRetry={() => { void loadData(); }} />
            )}

            {!shouldBlockTotvsDataTab && activeTab === Tab.DASHBOARD && (
              <Dashboard
                data={filteredData}
                allData={scopedData}
                regional={filters.regional}
                budgetMonthKeys={budgetMonthKeys}
                dateMode={normalizedDateMode}
                onNavigateToEmployee={(name) => {
                  setFilters(prev => ({ ...prev, searchTerm: name }));
                  setActiveTab(Tab.DATA);
                }}
                selectedMonth={selectedMonthKey}
                user={effectiveUser}
                periodStart={comparisonPeriod.periodStart}
                periodEnd={comparisonPeriod.periodEnd}
              />
            )}
            {!shouldBlockTotvsDataTab && activeTab === Tab.ABSENTEEISM && (
              <AbsenteeismDashboard
                data={filteredData}
                regional={filters.regional}
                costCenter={filters.costCenter}
                functionName={filters.function}
                budgetMonthKeys={budgetMonthKeys}
                dateMode={normalizedDateMode}
                selectedMonth={selectedMonthKey}
                user={effectiveUser}
                periodStart={comparisonPeriod.periodStart}
                periodEnd={comparisonPeriod.periodEnd}
                headcountRecords={headcountRecords}
              />
            )}
            {!shouldBlockTotvsDataTab && activeTab === Tab.DATA && <DataGrid data={filteredData} rawData={headcountRecords.length > 0 ? trustedTotvsData : undefined} />}
            {activeTab === Tab.COST_CENTER_STRUCTURE && (
              <CostCenterStructure 
                headcountRecords={headcountRecords} 
                costCenterFilter={filters.costCenter}
                regionalFilter={filters.regional}
                roleFilter={filters.function}
                periodStart={comparisonPeriod.periodStart}
                periodEnd={comparisonPeriod.periodEnd}
                selectedMonth={selectedMonthKey}
              />
            )}
            {!shouldBlockTotvsDataTab && activeTab === Tab.ANALYSIS && (
              <AnalysisPanel
                data={filteredData}
                allData={scopedData}
                realOvertime={filteredRealOvertime}
                selectedYear={filters.year}
                periodStart={comparisonPeriod.periodStart}
                periodEnd={comparisonPeriod.periodEnd}
                filters={filters}
                user={effectiveUser}
              />
            )}
            {activeTab === Tab.PLANNING && (effectiveUser.isSuperAdmin || canPlan(effectiveUser.role)) && <Planning user={effectiveUser} employees={scopedData} manualEmployees={manualEmployees} headcountRecords={headcountRecords} />}

            {activeTab === Tab.SETTINGS && (effectiveUser.isSuperAdmin || canManageHeadcount(effectiveUser.role)) && (
              <div className="space-y-6">
                {/* Governança do headcount ativo */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-base font-semibold text-slate-800 mb-1">Status do Headcount</h3>
                  <p className="text-sm text-slate-500 mb-5">
                    Rastreabilidade do headcount ativo e diagnóstico de conservação de horas.
                  </p>
                  <HeadcountGovernance
                    headcountRecords={headcountRecords}
                    rawData={trustedTotvsData}
                    onClear={() => { void syncHeadcountRecords({ clearCache: true }); }}
                    onRefresh={() => { void syncHeadcountRecords(); }}
                  />
                </div>
                {/* Upload / atualização */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-base font-semibold text-slate-800 mb-1">Headcount por Centro de Custo</h3>
                  <p className="text-sm text-slate-500 mb-5">
                    Importe a tabela de distribuição de colaboradores por CC para corrigir o rateio de horas reais.
                  </p>
                  <HeadcountUpload
                    user={effectiveUser}
                    onSaved={() => { void syncHeadcountRecords(); }}
                  />
                </div>
              </div>
            )}

            {!shouldBlockTotvsDataTab && (
              <button
                onClick={() => setShowAiPanel(true)}
                className="fixed bottom-6 right-6 bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all z-40 group"
                title="Gemini AI Insights"
              >
                <Sparkles size={24} className="group-hover:animate-pulse" />
              </button>
            )}

            {/* Global Modals */}
            <CreateEmployeeModal
              isOpen={isCreateEmployeeOpen}
              onClose={() => setIsCreateEmployeeOpen(false)}
              onSave={handleCreateEmployee}
              costCenters={Array.from(new Set(scopedData.map(d => d.CODCCUSTO))).sort()}
            />
          </div>
        </div>

        {showAiPanel && !shouldBlockTotvsDataTab && (
          <div className="absolute inset-y-0 right-0 w-full sm:w-[450px] shadow-2xl z-40 bg-white border-l border-gray-100 animate-in slide-in-from-right duration-300">
            <GeminiPanel data={filteredData} isVisible={true} onClose={() => setShowAiPanel(false)} />
          </div>
        )}
      </main>
    </div>
  );
};

export default HumanCapitalDashboard;

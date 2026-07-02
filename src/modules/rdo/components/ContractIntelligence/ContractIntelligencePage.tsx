/**
 * ContractIntelligencePage.tsx
 * Página principal do módulo Contract Intelligence, centralizando 
 * todas as lógicas e visões analíticas da obra.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Brain, Upload, RefreshCw, AlertTriangle, Loader2,
  Calculator, Activity as ActivityIcon, AlertCircle, TrendingDown,
  Settings, CheckSquare, Download, BarChart3, ChevronRight, FileSpreadsheet, Box,
  Sparkles, ArrowLeft
} from 'lucide-react';

import { Project, RDOData, Team } from '../../types';
import { getDimensions, getCompositions } from '../../services/firestoreService';
import { generateUUID } from '../../utils';

import {
  DimensionImportResult, CompositionImportResult,
  MeasurementFact, ProductivityFact, OccurrenceFact, IdlenessFact,
  CompactSummary
} from '../../src/analytics/types/analyticsTypes';

import { buildMonthlyResourceFacts, MonthlyResourceFact } from '../../src/analytics/engines/resourcesMonthlyEngine';
import { buildMeasurementFacts } from '../../src/analytics/engines/measurementEngine';
import { buildProductivityFacts } from '../../src/analytics/engines/productivityEngine';
import { buildOccurrenceFacts } from '../../src/analytics/engines/occurrenceEngine';
import { buildIdlenessFacts } from '../../src/analytics/engines/idlenessEngine';

import { DimensionsUpload } from './DimensionsUpload';
import { CompositionsUpload } from './CompositionsUpload';
import { ResourcesMonthlyTable } from './ResourcesMonthlyTable';
import { ResourcesMatrixTable } from './ResourcesMatrixTable';
import { MeasurementTable } from './MeasurementTable';
import { ProductivityTable } from './ProductivityTable';
import { OccurrencesTable } from './OccurrencesTable';
import { IdlenessTable } from './IdlenessTable';
import { ValidationCenter, ValidationItem } from './ValidationCenter';
import { ExecutiveAnalysisPanel } from './ExecutiveAnalysisPanel';
import { DateRangePicker } from './DateRangePicker';
import { useRdoActions } from '../../src/stores/rdoStore';

// ---------------------------------------------------------------------------
// Props Globais do App
// ---------------------------------------------------------------------------
export interface ContractIntelligencePageProps {
  projects: Project[];
  teams: Team[];
  rdos: RDOData[];
  selectedProject: Project | null;
  onSelectProject: (p: Project | null) => void;
  onNavigateToRDO?: (rdoId: string, teamId: string) => void;
}

// ---------------------------------------------------------------------------
// Tabs & Views
// ---------------------------------------------------------------------------
type ActiveTab = 
  | 'CONFIGURACAO' 
  | 'VALIDACAO' 
  | 'RECURSOS' 
  | 'MEDICAO' 
  | 'PRODUTIVIDADE' 
  | 'OCORRENCIAS' 
  | 'IMPRODUTIVIDADE' 
  | 'AI_ANALYSIS'
  | 'EXPORTACOES';

type LoadingState = 'idle' | 'loading' | 'done' | 'error';

// ---------------------------------------------------------------------------
// Mock de Composições
// ---------------------------------------------------------------------------
const MOCK_COMPOSITIONS: CompositionImportResult = {
  compositionsByService: {
    '3003983': { code: '3003983', description: 'ESCAVAÇÃO', unit: 'm³', unitPrice: 35.82, unitCost: 28.50, teamProduction: 120, items: [] },
    '3004016': { code: '3004016', description: 'ESCAVADEIRA C/MO', unit: 'H', unitPrice: 426.65, unitCost: 350.00, teamProduction: 1, items: [] },
    'MOD_IMPRODUTIVA': { code: 'MOD_IMPRODUTIVA', description: 'Custo HH improdutivo', unit: 'HH', unitPrice: 25.50, unitCost: 25.50, items: [] },
    'EQP_IMPRODUTIVO': { code: 'EQP_IMPRODUTIVO', description: 'Custo Eqp Parado', unit: 'H', unitPrice: 150.00, unitCost: 150.00, items: [] }
  },
  totalServices: 4, successCount: 4, errorCount: 0, issues: [], importedAt: new Date().toISOString()
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNUM = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{ flex: '1 1 180px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente Principal
// ---------------------------------------------------------------------------
export default function ContractIntelligencePage({
  projects, teams, rdos, selectedProject, onSelectProject, onNavigateToRDO
}: ContractIntelligencePageProps) {
  
  const [activeTab, setActiveTab] = useState<ActiveTab>('MEDICAO');
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const rdoActions = useRdoActions();

  const handleCategoryChange = useCallback(async (rdoId: string, occurrenceIndex: number, newCategory: string) => {
    const rdoToUpdate = rdos.find(r => r.id === rdoId);
    if (!rdoToUpdate) return;
    const updatedRdo = JSON.parse(JSON.stringify(rdoToUpdate));
    if (updatedRdo.occurrences && updatedRdo.occurrences[occurrenceIndex]) {
      updatedRdo.occurrences[occurrenceIndex].category = newCategory;
      await rdoActions.saveRdo(updatedRdo);
    }
  }, [rdos, rdoActions]);

  // Filtros Globais
  const [globalDateRange, setGlobalDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });
  const [globalTeamFilter, setGlobalTeamFilter] = useState<string>('ALL');

  // Dimensões dinâmicas por projeto
  const [dimensions, setDimensions] = useState<DimensionImportResult | null>(null);

  // Estados dos Fatos
  const [resourceFacts, setResourceFacts] = useState<MonthlyResourceFact[]>([]);
  const [measureFacts, setMeasureFacts] = useState<MeasurementFact[]>([]);
  const [prodFacts, setProdFacts] = useState<ProductivityFact[]>([]);
  
  // View mode state for Resources Tab
  const [resourceViewMode, setResourceViewMode] = useState<'LIST' | 'MATRIX'>('MATRIX');
  const [occurrenceFacts, setOccurrenceFacts] = useState<OccurrenceFact[]>([]);
  const [idlenessFacts, setIdlenessFacts] = useState<IdlenessFact[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationItem[]>([]);

  // 1. Filtrar RDOs apenas do projeto selecionado
  const projectRdos = useMemo(() => {
    if (!selectedProject) return [];
    // O RDO não tem projectId direto salvo? Na modelagem, o RDO aponta para teamId.
    // E o Team aponta para projectId.
    const projectTeamIds = new Set(teams.filter(t => t.projectId === selectedProject.id).map(t => t.id));
    return rdos.filter(r => projectTeamIds.has(r.teamId));
  }, [selectedProject, rdos, teams]);

  // 2. Carregar Dimensões e Rodar Motores (useCallback/useEffect)
  const runEngines = useCallback(async () => {
    if (!selectedProject) return;
    setLoadingState('loading');
    setErrorMessage('');

    try {
      // Carrega dimensões do DB
      const stored = await getDimensions(selectedProject.id);
      
      // Carrega composições do DB
      const storedComps = await getCompositions(selectedProject.id);
      let activeCompositions = MOCK_COMPOSITIONS;
      if (storedComps) {
        const compositionsByService: Record<string, import('../../src/analytics/types/analyticsTypes').ServiceComposition> = {};
        storedComps.compositions.forEach(c => {
          compositionsByService[c.codigoComposicao] = {
            code: c.codigoComposicao,
            description: c.servicoTratado || c.servicoOriginal,
            unit: c.unidade,
            unitPrice: c.precoUnitarioTotal || 0,
            unitCost: c.custoUnitarioTotal || 0,
            teamProduction: c.producaoEquipe,
            items: []
          };
        });
        activeCompositions = {
          compositionsByService,
          totalServices: storedComps.compositions.length,
          successCount: storedComps.compositions.length,
          errorCount: 0,
          issues: [],
          importedAt: storedComps.extractedAt
        };
      }

      let dimResult: DimensionImportResult | null = null;

      if (stored) {
        const monthSet = new Map<string, string>();
        stored.items.forEach(item =>
          item.monthlyPlan.forEach(mp => {
            if (!monthSet.has(mp.monthKey)) monthSet.set(mp.monthKey, mp.monthLabel);
          })
        );
        const months = Array.from(monthSet.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([monthKey, monthLabel]) => ({ monthKey, monthLabel }));

        dimResult = {
          items: stored.items, holidays: stored.holidays, metadata: stored.metadata,
          months, totalRows: stored.items.length, successCount: stored.items.length,
          errorCount: 0, errors: [], warnings: [], importedAt: stored.updatedAt,
        };
        setDimensions(dimResult);
      }

      const issues: ValidationItem[] = [];
      const addWarning = (msg: string, mod: ValidationItem['module']) => {
        issues.push({ id: generateUUID(), type: 'warning', title: 'Alerta Analítico', description: msg, module: mod });
      };

      // Fatos
      if (dimResult && dimResult.items.length > 0) {
        const { facts, warnings } = buildMonthlyResourceFacts({
          projectId: selectedProject.id, rdos: projectRdos, dimensions: dimResult
        });
        setResourceFacts(facts);
        warnings.forEach(w => addWarning(w, 'RECURSOS'));
      } else {
        issues.push({ id: generateUUID(), type: 'info', title: 'Dimensões Ausentes', description: 'A planilha de dimensões da obra não foi importada. A aba de Recursos estará vazia.', module: 'RECURSOS' });
      }

      if (projectRdos.length > 0) {
        // Measurement
        const mRes = buildMeasurementFacts({ projectId: selectedProject.id, rdos: projectRdos, compositions: activeCompositions, projectServices: selectedProject.services || [] });
        setMeasureFacts(mRes.facts);
        mRes.warnings.forEach(w => addWarning(w, 'MEDICAO'));

        // Productivity
        const pRes = buildProductivityFacts({ projectId: selectedProject.id, rdos: projectRdos, compositions: activeCompositions, projectServices: selectedProject.services || [] });
        setProdFacts(pRes.facts);
        pRes.warnings.forEach(w => addWarning(w, 'PRODUTIVIDADE'));

        // Occurrences
        const oRes = buildOccurrenceFacts({ projectId: selectedProject.id, rdos: projectRdos });
        setOccurrenceFacts(oRes.facts);
        oRes.warnings.forEach(w => addWarning(w, 'OCORRENCIAS'));

        // Idleness
        const iRes = buildIdlenessFacts({ occurrenceFacts: oRes.facts, rdos: projectRdos, compositions: activeCompositions });
        setIdlenessFacts(iRes.facts);
        iRes.warnings.forEach(w => addWarning(w, 'IMPRODUTIVIDADE'));
      } else {
        issues.push({ id: generateUUID(), type: 'info', title: 'Sem RDOs', description: 'Nenhum RDO encontrado para gerar medição e ocorrências.', module: 'GERAL' });
      }

      setValidationIssues(issues);
      setLoadingState('done');
    } catch (err) {
      setErrorMessage(String(err));
      setLoadingState('error');
    }
  }, [selectedProject, projectRdos]);

  useEffect(() => {
    runEngines();
  }, [runEngines]);

  // Aplicação de filtros globais
  const applyFilters = useCallback(<T extends { date: string, teamId?: string }>(facts: T[]) => {
    return facts.filter(f => {
      if (globalTeamFilter !== 'ALL') {
        if (f.teamId && f.teamId !== globalTeamFilter) return false;
      }
      if (globalDateRange.start) {
        const [d, m, y] = f.date.split('/');
        const fDateStr = `${y}-${m}-${d}`;
        if (globalDateRange.end) {
          if (fDateStr < globalDateRange.start || fDateStr > globalDateRange.end) return false;
        } else {
          if (fDateStr !== globalDateRange.start) return false;
        }
      }
      return true;
    });
  }, [globalDateRange, globalTeamFilter]);

  const filteredMeasureFacts = useMemo(() => applyFilters(measureFacts), [measureFacts, applyFilters]);
  const filteredOccurrenceFacts = useMemo(() => applyFilters(occurrenceFacts), [occurrenceFacts, applyFilters]);
  const filteredIdlenessFacts = useMemo(() => applyFilters(idlenessFacts), [idlenessFacts, applyFilters]);
  const filteredProdFacts = useMemo(() => applyFilters(prodFacts), [prodFacts, applyFilters]);

  // 3. KPIs Agregados (useMemo)
  const KPIs = useMemo(() => {
    let valorExecutado = 0;
    let custoTeorico = 0;
    filteredMeasureFacts.forEach(f => { valorExecutado += f.measuredValue; custoTeorico += f.theoreticalCost; });
    const margem = valorExecutado - custoTeorico;

    let horasImpactadas = 0;
    let pleitos = 0;
    filteredOccurrenceFacts.forEach(f => { 
      horasImpactadas += f.impactHours; 
      if (f.eligibility === 'POTENCIAL_PLEITO') pleitos++; 
    });

    const valorPleito = filteredIdlenessFacts.reduce((s, f) => s + f.totalValue, 0);

    return { valorExecutado, custoTeorico, margem, horasImpactadas, pleitos, valorPleito };
  }, [filteredMeasureFacts, filteredOccurrenceFacts, filteredIdlenessFacts]);

  // Cria o Summary Enxuto para a IA
  const compactSummaryForAI = useMemo<CompactSummary>(() => {
    
    // Group occurrences by category
    const occMap = new Map<string, { count: number; impactTimeMinutes: number }>();
    filteredOccurrenceFacts.forEach(f => {
      const current = occMap.get(f.category) || { count: 0, impactTimeMinutes: 0 };
      occMap.set(f.category, { 
        count: current.count + 1, 
        impactTimeMinutes: current.impactTimeMinutes + (f.impactHours * 60)
      });
    });
    
    const occurrencesByType = Array.from(occMap.entries()).map(([type, data]) => ({
      type, count: data.count, impactTimeMinutes: data.impactTimeMinutes
    }));

    // Productivity Top Issues
    const productivityTopIssues = [...filteredProdFacts]
      .filter(f => f.status === 'ABAIXO_COMPOSICAO')
      .sort((a, b) => a.adherence - b.adherence)
      .slice(0, 5)
      .map(f => ({
        activity: f.activityDescription || f.activityCode,
        expected: f.expectedProduction,
        actual: f.actualProduction
      }));

    const validationWarnings = validationIssues
      .filter(v => v.type === 'warning' || v.type === 'error')
      .map(v => `[${v.module}] ${v.description}`);

    return {
      projectName: selectedProject?.name || '',
      periodLabel: 'Todo o Período', // Em versão futura, pode vir do filtro de datas
      totalRdosProcessed: projectRdos.length,
      measuredValue: KPIs.valorExecutado,
      theoreticalCost: KPIs.custoTeorico,
      absoluteMargin: KPIs.margem,
      marginPercent: KPIs.valorExecutado > 0 ? (KPIs.margem / KPIs.valorExecutado) : 0,
      totalOccurrences: filteredOccurrenceFacts.length,
      impactedHours: KPIs.horasImpactadas,
      potentialClaimValue: KPIs.valorPleito,
      occurrencesByType,
      productivityTopIssues,
      validationWarnings
    };
  }, [selectedProject, projectRdos, KPIs, filteredOccurrenceFacts, filteredProdFacts, validationIssues]);

  // Se nenhum projeto for selecionado, exibir tela de seleção
  if (!selectedProject) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Brain size={32} color="#60a5fa" /> Contract Intelligence
          </h1>
          <p style={{ color: '#94a3b8', marginTop: 8 }}>
            Selecione uma obra abaixo para acessar o painel de análises contratuais integradas.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {projects.map(p => (
            <div 
              key={p.id} 
              onClick={() => onSelectProject(p)}
              style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 16, padding: 24, cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: 18, color: '#e2e8f0' }}>{p.name}</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 13 }}>
                <span>Regional: {p.regional || 'N/A'}</span>
                <ChevronRight size={16} />
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div style={{ color: '#64748b' }}>Nenhuma obra cadastrada.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* HEADER DA OBRA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <button 
            onClick={() => onSelectProject(null)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 13, fontWeight: 600, 
              background: 'transparent', border: 'none', padding: 0, marginBottom: 12, cursor: 'pointer' 
            }}
          >
            <ArrowLeft size={16} /> Voltar para Obras
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#60a5fa', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            <Brain size={14} /> Contract Intelligence / {selectedProject.name}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Dashboard Analítico Integrado</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DateRangePicker 
            startDate={globalDateRange.start}
            endDate={globalDateRange.end}
            onChange={(start, end) => setGlobalDateRange({ start, end })}
          />
          <select
            value={globalTeamFilter}
            onChange={e => setGlobalTeamFilter(e.target.value)}
            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', minWidth: 150 }}
          >
            <option value="ALL">Todas as Turmas</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <button onClick={runEngines} disabled={loadingState === 'loading'} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer'
          }}>
            <RefreshCw size={16} style={loadingState === 'loading' ? { animation: 'spin 1s linear infinite' } : {}} /> Atualizar Fatos
          </button>
        </div>
      </div>

      {loadingState === 'error' && (
        <div style={{ padding: 16, background: '#450a0a', color: '#f87171', borderRadius: 12, marginBottom: 24, border: '1px solid #7f1d1d' }}>
          <strong>Erro Crítico:</strong> {errorMessage}
        </div>
      )}

      {/* KPIs Universais */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
        <KpiCard label="RDOs Analisados" value={projectRdos.length} color="#60a5fa" />
        <KpiCard label="Valor Contratual Executado" value={formatBRL(KPIs.valorExecutado)} color="#4ade80" />
        <KpiCard label="Margem Absoluta" value={formatBRL(KPIs.margem)} color={KPIs.margem < 0 ? '#f87171' : '#fbbf24'} />
        <KpiCard label="Ocorrências" value={occurrenceFacts.length} color="#a78bfa" />
        <KpiCard label="Improdutividade (Pleitos)" value={formatBRL(KPIs.valorPleito)} sub={`${formatNUM(KPIs.horasImpactadas)}h perdidas`} color="#f43f5e" />
      </div>

      {/* NAVEGAÇÃO EM ABAS */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { id: 'MEDICAO', icon: Calculator, label: 'Serviços Executados' },
          { id: 'RECURSOS', icon: BarChart3, label: 'Recursos (Histograma)' },
          { id: 'OCORRENCIAS', icon: AlertCircle, label: 'Ocorrências' },
          { id: 'IMPRODUTIVIDADE', icon: TrendingDown, label: 'Improdutividade' },
          { id: 'CONFIGURACAO', icon: Settings, label: 'Configuração' },
          { id: 'VALIDACAO', icon: CheckSquare, label: `Validação (${validationIssues.length})` },
          { id: 'AI_ANALYSIS', icon: Sparkles, label: 'IA Executiva' },
          { id: 'EXPORTACOES', icon: Download, label: 'Exportações' },
        ].map(t => {
          const isActive = activeTab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id} onClick={() => setActiveTab(t.id as ActiveTab)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: '8px 8px 0 0',
                border: 'none', background: isActive ? 'rgba(96,165,250,0.1)' : 'transparent',
                color: isActive ? '#60a5fa' : '#94a3b8', borderBottom: isActive ? '2px solid #60a5fa' : '2px solid transparent',
                cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap'
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* RENDER DA ABA ATIVA */}
      {loadingState === 'loading' ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}><Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 16px' }} /> Processando motores...</div>
      ) : (
        <div style={{ paddingBottom: 60 }}>
          { activeTab === 'CONFIGURACAO' && (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 400px' }}>
                <DimensionsUpload selectedProject={selectedProject} onDimensionsSaved={runEngines} />
              </div>
              <div style={{ flex: '1 1 400px' }}>
                <CompositionsUpload selectedProject={selectedProject} onCompositionsSaved={runEngines} />
              </div>
            </div>
          ) }

          {activeTab === 'VALIDACAO' && <ValidationCenter issues={validationIssues} />}
          
          {activeTab === 'RECURSOS' && (
             dimensions ? (
               <div className="flex flex-col gap-4">
                 <div className="flex gap-2 p-1 bg-slate-900/50 rounded-lg w-fit border border-white/5">
                   <button
                     onClick={() => setResourceViewMode('LIST')}
                     className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                       resourceViewMode === 'LIST' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                     }`}
                   >
                     Tabela Linear
                   </button>
                   <button
                     onClick={() => setResourceViewMode('MATRIX')}
                     className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                       resourceViewMode === 'MATRIX' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                     }`}
                   >
                     Matriz de Planejamento (Pivot)
                   </button>
                 </div>
                 {resourceViewMode === 'LIST' ? (
                   <ResourcesMonthlyTable facts={resourceFacts} />
                 ) : (
                   <ResourcesMatrixTable facts={resourceFacts} />
                 )}
               </div>
             ) : (
             <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Importe as dimensões na aba Configuração para visualizar os Recursos.</div>
             )
          )}
          
          {activeTab === 'MEDICAO' && <MeasurementTable facts={filteredMeasureFacts} projectName={selectedProject.name} teams={teams} onNavigateToRDO={onNavigateToRDO} />}
          
          {activeTab === 'PRODUTIVIDADE' && <ProductivityTable facts={filteredProdFacts} projectName={selectedProject.name} />}
          
          {activeTab === 'OCORRENCIAS' && <OccurrencesTable facts={filteredOccurrenceFacts} projectName={selectedProject.name} teams={teams} onNavigateToRDO={onNavigateToRDO} />}
          
          { activeTab === 'IMPRODUTIVIDADE' && <IdlenessTable facts={filteredIdlenessFacts} projectName={selectedProject.name} /> }
          
          { activeTab === 'AI_ANALYSIS' && <ExecutiveAnalysisPanel summary={compactSummaryForAI} /> }
          
          { activeTab === 'EXPORTACOES' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
              {[
                { title: 'Base Analítica (JSON)', icon: Box, desc: 'Exportar os fatos consolidados brutos em formato JSON.', color: '#a78bfa' },
                { title: 'Tabelas em CSV', icon: FileSpreadsheet, desc: 'Baixar todas as tabelas separadamente em formato CSV.', color: '#4ade80' },
                { title: 'Integrar Power BI', icon: BarChart3, desc: 'Gerar script de integração nativa do modelo estrela.', color: '#fbbf24' }
              ].map(ex => (
                <div key={ex.title} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 24
                }}>
                  <ex.icon size={32} color={ex.color} style={{ marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 8px 0', color: '#f1f5f9', fontSize: 16 }}>{ex.title}</h3>
                  <p style={{ margin: '0 0 24px 0', color: '#94a3b8', fontSize: 13 }}>{ex.desc}</p>
                  <button style={{
                    width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.1)',
                    color: '#fff', cursor: 'pointer', fontWeight: 600
                  }}>Baixar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  Users,
  HardHat,
  Truck,
  Calendar,
  Filter,
  Trash2,
  Info,
  Settings,
  BarChart3,
  RefreshCw,
  Plus,
  Save,
  Download,
  Search,
  ChevronRight
} from 'lucide-react';
import { 
  HistogramItem, 
  HistogramAnalysisRow, 
  HistogramAnalysisSummary,
  RDOData,
  Project,
  Team,
  HistogramCategory,
  HistogramSourceGroup
} from '../types';
import { 
  calculateHistogramAnalysis, 
  generateHistogramAlerts,
  formatMonthLabel,
  generateHistogramFromRdos,
  mergeHistogramItems,
  generateUUID,
  normalizeItemName,
  getRdoMonthKey
} from '../utils/histogramUtils';
import * as db from '../services/firestoreService';
import { exportRDOsToExcel } from '../utils/excelExportUtils';

interface HistogramAnalysisProps {
  projects: Project[];
  teams: Team[];
  rdos: RDOData[];
  selectedProject: Project | null;
  onSelectProject: (project: Project | null) => void;
}

type Tab = 'CONFIG' | 'ANALYSIS';

export const HistogramAnalysis: React.FC<HistogramAnalysisProps> = ({ 
  projects, 
  teams,
  rdos, 
  selectedProject,
  onSelectProject
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('ANALYSIS');
  const [histograms, setHistograms] = useState<HistogramItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SUCCESS' | 'ERROR'>('IDLE');
  
  // Settings state
  const [startMonth, setStartMonth] = useState('2026-01');
  const [endMonth, setEndMonth] = useState('2026-06');
  
  // Selection state
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<HistogramCategory | 'ALL'>('ALL');
  const [tolerance, setTolerance] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');

  // Load histograms for selected project
  useEffect(() => {
    if (selectedProject) {
      setLoading(true);
      db.getHistograms(selectedProject.id).then(items => {
        setHistograms(items);
        if (items.length > 0) {
          // Detect month range from existing items
          const allMonths = items[0].monthlyPlan.map(p => p.monthKey).sort();
          if (allMonths.length > 0) {
            setStartMonth(allMonths[0]);
            setEndMonth(allMonths[allMonths.length - 1]);
          }
        } else {
          setActiveTab('CONFIG'); // Auto switch to config if empty
        }
        setLoading(false);
      });
    } else {
      setHistograms([]);
    }
  }, [selectedProject]);

  // Project RDOS
  const projectRdos = useMemo(() => {
    if (!selectedProject) return [];
    const projectTeamIds = teams
      .filter(t => t.projectId === selectedProject.id)
      .map(t => t.id);
    return rdos.filter(r => projectTeamIds.includes(r.teamId));
  }, [selectedProject, teams, rdos]);

  // Available months from histogram
  const availableMonths = useMemo(() => {
    if (histograms.length === 0) return [];
    const monthMap = new Map<string, string>();
    histograms.forEach(item => {
      item.monthlyPlan.forEach(p => monthMap.set(p.monthKey, p.monthLabel));
    });
    return Array.from(monthMap.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [histograms]);

  // Set default month
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0].key);
    }
  }, [availableMonths, selectedMonth]);

  // Analysis Result
  const analysis = useMemo(() => {
    if (!selectedProject || !selectedMonth || histograms.length === 0) return null;
    return calculateHistogramAnalysis(histograms, projectRdos, selectedMonth, tolerance);
  }, [selectedProject, selectedMonth, histograms, projectRdos, tolerance]);

  // Filtered Rows
  const filteredRows = useMemo(() => {
    if (!analysis) return [];
    let rows = analysis.rows;
    if (categoryFilter !== 'ALL') rows = rows.filter(r => r.category === categoryFilter);
    if (searchTerm) rows = rows.filter(r => r.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
    return rows;
  }, [analysis, categoryFilter, searchTerm]);

  // Alerts
  const alerts = useMemo(() => {
    if (!analysis || !selectedMonth) return [];
    return generateHistogramAlerts(analysis.rows, analysis.summary, selectedMonth);
  }, [analysis, selectedMonth]);

  // --- Handlers ---

  const handleGenerateFromRdo = () => {
    if (!selectedProject) return;
    
    // Determine months to use
    // 1. Detect from RDOs
    const rdoMonths = Array.from(new Set(projectRdos.map(r => getRdoMonthKey(r.date)))).sort();
    
    // 2. Or use range from settings
    // Let's use RDO months + any current range
    const monthKeys = rdoMonths.length > 0 ? rdoMonths : [startMonth];
    
    const fromRdos = generateHistogramFromRdos(selectedProject.id, projectRdos, monthKeys);
    
    if (histograms.length > 0) {
      if (confirm("Deseja mesclar novos itens encontrados nas RDOs com o histograma atual? (Dados preenchidos serão preservados)")) {
        setHistograms(mergeHistogramItems(histograms, fromRdos));
      }
    } else {
      setHistograms(fromRdos);
    }
  };

  const handleAddManualItem = () => {
    if (!selectedProject) return;
    const newItem: HistogramItem = {
      id: generateUUID(),
      projectId: selectedProject.id,
      category: 'MAO_OBRA_DIRETA',
      sourceGroup: 'WORKFORCE',
      name: 'Novo Item',
      normalizedName: 'NOVO ITEM',
      peakQty: 0,
      monthlyPlan: availableMonths.map(m => ({
        monthKey: m.key,
        monthLabel: m.label,
        quantity: 0
      })),
      source: 'MANUAL'
    };
    setHistograms([...histograms, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof HistogramItem, value: any) => {
    setHistograms(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'name') updated.normalizedName = normalizeItemName(value);
      return updated;
    }));
  };

  const handleUpdateMonthQty = (itemId: string, monthKey: string, qty: number) => {
    setHistograms(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        monthlyPlan: item.monthlyPlan.map(p => 
          p.monthKey === monthKey ? { ...p, quantity: qty } : p
        )
      };
    }));
  };

  const handleSave = async () => {
    if (!selectedProject) return;
    setSaveStatus('SAVING');
    try {
      await db.saveHistograms(selectedProject.id, histograms);
      setSaveStatus('SUCCESS');
      setTimeout(() => setSaveStatus('IDLE'), 3000);
    } catch (e) {
      setSaveStatus('ERROR');
    }
  };

  const handleDeleteItem = (id: string) => {
    setHistograms(prev => prev.filter(i => i.id !== id));
  };

  // --- UI Helpers ---

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'ABAIXO': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case 'ACIMA': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'NAO_PLANEJADO': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'SEM_APONTAMENTO': return 'text-rose-600 bg-rose-600/10 border-rose-600/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'EQUIPAMENTOS': return <Truck className="w-4 h-4" />;
      case 'MAO_OBRA_INDIRETA': return <Users className="w-4 h-4" />;
      default: return <HardHat className="w-4 h-4" />;
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'MAO_OBRA_DIRETA': return 'M.O. Direta';
      case 'MAO_OBRA_INDIRETA': return 'M.O. Indireta';
      case 'EQUIPAMENTOS': return 'Equipamentos';
      default: return cat;
    }
  };

  return (
    <div className="animate-fade-in space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-3xl font-bold text-white tracking-tight">Histograma Real da Obra</h2>
          <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-400" />
            Configuração e Análise de Aderência Operacional
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {selectedProject && projectRdos.length > 0 && (
            <button
              onClick={() => {
                exportRDOsToExcel(
                  projectRdos,
                  selectedProject.name,
                  histograms,
                  `Diario_RDO_Consolidado_${selectedProject.name.replace(/\s+/g, '_')}.xlsx`
                );
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg hover:scale-105 active:scale-95 border border-white/10"
              title="Exportar dados diários consolidados de todas as equipes para Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Diário (Excel)</span>
            </button>
          )}

          <select 
            value={selectedProject?.id || ''} 
            onChange={(e) => {
              const p = projects.find(proj => proj.id === e.target.value);
              onSelectProject(p || null);
            }}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer min-w-[200px]"
          >
            <option value="" className="bg-slate-900">Selecionar Obra...</option>
            {projects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
          </select>
        </div>
      </div>

      {!selectedProject ? (
        <div className="glass-panel p-12 rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center space-y-4 shadow-2xl">
          <div className="bg-blue-500/10 p-4 rounded-full">
            <Info className="w-12 h-12 text-blue-400" />
          </div>
          <div className="max-w-md">
            <h3 className="text-xl font-bold text-white">Nenhuma Obra Selecionada</h3>
            <p className="text-slate-400 mt-2">Selecione uma obra para gerenciar o histograma operacional.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs Navigation */}
          <div className="flex gap-2 p-1 bg-white/5 rounded-2xl w-fit">
            <button 
              onClick={() => setActiveTab('ANALYSIS')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'ANALYSIS' ? 'bg-gradient-premium text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <BarChart3 className="w-4 h-4" />
              Análise de Aderência
            </button>
            <button 
              onClick={() => setActiveTab('CONFIG')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'CONFIG' ? 'bg-gradient-premium text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <Settings className="w-4 h-4" />
              Configurar Planejado
            </button>
          </div>

          {activeTab === 'CONFIG' ? (
            /* CONFIGURATION MODE */
            <div className="space-y-6 animate-slide-up">
              <div className="glass-panel p-6 rounded-3xl border border-white/5 shadow-2xl space-y-8">
                 <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between border-b border-white/5 pb-6">
                    <div>
                       <h3 className="text-lg font-bold text-white">Itens Planejados</h3>
                       <p className="text-xs text-slate-500 mt-1">Defina as quantidades planejadas para cada item real da obra.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                       <button 
                        onClick={handleGenerateFromRdo}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-400 hover:bg-blue-500/20 transition-all"
                       >
                         <RefreshCw className="w-4 h-4" />
                         Gerar a partir das RDOs
                       </button>
                       <button 
                        onClick={handleAddManualItem}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/10 transition-all"
                       >
                         <Plus className="w-4 h-4" />
                         Adicionar Item
                       </button>
                       <button 
                        onClick={handleSave}
                        disabled={saveStatus === 'SAVING'}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg ${saveStatus === 'SAVING' ? 'bg-slate-700' : 'bg-gradient-premium shadow-blue-600/20 hover:scale-105'}`}
                       >
                         {saveStatus === 'SAVING' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                         {saveStatus === 'SAVING' ? 'Salvando...' : saveStatus === 'SUCCESS' ? 'Salvo!' : 'Salvar Histograma'}
                       </button>
                    </div>
                 </div>

                 {histograms.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                       <div className="bg-slate-800/50 p-6 rounded-full">
                          <FileSpreadsheet className="w-12 h-12 text-slate-600" />
                       </div>
                       <div className="max-w-xs">
                          <p className="text-slate-400 text-sm">O histograma está vazio. Gere a base a partir das RDOs para começar.</p>
                       </div>
                    </div>
                 ) : (
                    <div className="overflow-x-auto rounded-2xl border border-white/5">
                       <table className="w-full text-left border-collapse">
                          <thead>
                             <tr className="bg-white/5 border-b border-white/5">
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest min-w-[150px]">Categoria</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest min-w-[200px]">Item</th>
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Qtd Pico</th>
                                {availableMonths.map(m => (
                                   <th key={m.key} className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center min-w-[80px]">
                                      {m.label}
                                   </th>
                                ))}
                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Ações</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                             {histograms.map(item => (
                                <tr key={item.id} className="hover:bg-white/5 transition-all">
                                   <td className="px-4 py-2">
                                      <select 
                                         value={item.category} 
                                         onChange={(e) => handleUpdateItem(item.id, 'category', e.target.value)}
                                         className="w-full bg-slate-900/50 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/50"
                                      >
                                         <option value="MAO_OBRA_DIRETA">M.O. Direta</option>
                                         <option value="MAO_OBRA_INDIRETA">M.O. Indireta</option>
                                         <option value="EQUIPAMENTOS">Equipamentos</option>
                                      </select>
                                   </td>
                                   <td className="px-4 py-2">
                                      <input 
                                         type="text" 
                                         value={item.name} 
                                         onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                                         className="w-full bg-slate-900/50 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/50"
                                         placeholder="Nome do item..."
                                      />
                                   </td>
                                   <td className="px-4 py-2">
                                      <input 
                                         type="number" 
                                         value={item.peakQty || ''} 
                                         onChange={(e) => handleUpdateItem(item.id, 'peakQty', parseFloat(e.target.value) || 0)}
                                         className="w-16 mx-auto bg-slate-900/50 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-white text-center outline-none focus:ring-1 focus:ring-blue-500/50"
                                      />
                                   </td>
                                   {availableMonths.map(m => {
                                      const monthVal = item.monthlyPlan.find(p => p.monthKey === m.key)?.quantity || 0;
                                      return (
                                         <td key={m.key} className="px-4 py-2">
                                            <input 
                                               type="number" 
                                               value={monthVal || ''} 
                                               onChange={(e) => handleUpdateMonthQty(item.id, m.key, parseFloat(e.target.value) || 0)}
                                               className="w-16 mx-auto bg-slate-900/50 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-white text-center outline-none focus:ring-1 focus:ring-blue-500/50"
                                            />
                                         </td>
                                      );
                                   })}
                                   <td className="px-4 py-2 text-center">
                                      <button 
                                         onClick={() => handleDeleteItem(item.id)}
                                         className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                                      >
                                         <Trash2 className="w-4 h-4" />
                                      </button>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 )}
              </div>
            </div>
          ) : (
            /* ANALYSIS MODE */
            <div className="space-y-6 animate-fade-in">
              {histograms.length === 0 ? (
                <div className="glass-panel p-12 rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center space-y-6 shadow-2xl">
                   <div className="bg-amber-500/10 p-5 rounded-3xl">
                      <AlertTriangle className="w-12 h-12 text-amber-400" />
                   </div>
                   <div className="max-w-md">
                      <h3 className="text-xl font-bold text-white">Histograma não configurado</h3>
                      <p className="text-slate-400 mt-2">Esta obra ainda não possui um histograma operacional. Gere a base a partir das RDOs para habilitar a análise.</p>
                   </div>
                   <button 
                    onClick={() => setActiveTab('CONFIG')}
                    className="flex items-center gap-2 bg-gradient-premium px-8 py-3 rounded-2xl font-bold text-white hover:scale-105 transition-all shadow-xl shadow-blue-600/20"
                   >
                     Configurar Agora
                   </button>
                </div>
              ) : (
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                     {analysis && (
                        <>
                           <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Aderência Geral</div>
                              <div className="flex items-end justify-between">
                                 <div className={`text-2xl font-bold ${analysis.summary.adherencePercent >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {analysis.summary.adherencePercent.toFixed(1)}%
                                 </div>
                                 <CheckCircle2 className="w-5 h-5 text-slate-600" />
                              </div>
                           </div>
                           <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">M.O. Direta</div>
                              <div className="flex items-end justify-between">
                                 <div className="text-2xl font-bold text-white">{analysis.summary.directLaborAdherencePercent.toFixed(1)}%</div>
                                 <HardHat className="w-5 h-5 text-slate-600" />
                              </div>
                           </div>
                           <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">M.O. Indireta</div>
                              <div className="flex items-end justify-between">
                                 <div className="text-2xl font-bold text-white">{analysis.summary.indirectLaborAdherencePercent.toFixed(1)}%</div>
                                 <Users className="w-5 h-5 text-slate-600" />
                              </div>
                           </div>
                           <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Equipamentos</div>
                              <div className="flex items-end justify-between">
                                 <div className="text-2xl font-bold text-white">{analysis.summary.equipmentAdherencePercent.toFixed(1)}%</div>
                                 <Truck className="w-5 h-5 text-slate-600" />
                              </div>
                           </div>
                        </>
                     )}
                  </div>

                  {/* Analysis Content */}
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                     <div className="lg:col-span-3 space-y-6">
                        <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
                           <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                              <div className="flex flex-wrap gap-4 items-center">
                                 <select 
                                    value={selectedMonth} 
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="px-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white outline-none"
                                 >
                                    {availableMonths.map(m => <option key={m.key} value={m.key} className="bg-slate-900">{m.label}</option>)}
                                 </select>
                                 <select 
                                    value={categoryFilter} 
                                    onChange={(e) => setCategoryFilter(e.target.value as any)}
                                    className="px-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white outline-none"
                                 >
                                    <option value="ALL">Todas Categorias</option>
                                    <option value="MAO_OBRA_DIRETA">M.O. Direta</option>
                                    <option value="MAO_OBRA_INDIRETA">M.O. Indireta</option>
                                    <option value="EQUIPAMENTOS">Equipamentos</option>
                                 </select>
                                 <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input 
                                       type="text" 
                                       placeholder="Buscar item..."
                                       value={searchTerm}
                                       onChange={(e) => setSearchTerm(e.target.value)}
                                       className="pl-9 pr-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/50 min-w-[200px]"
                                    />
                                 </div>
                              </div>
                              <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                 <Filter className="w-3 h-3" /> Tolerância: {tolerance}%
                              </div>
                           </div>

                           <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                 <thead>
                                    <tr className="bg-white/5 border-b border-white/5">
                                       <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria</th>
                                       <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Item</th>
                                       <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Planejado</th>
                                       <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Realizado</th>
                                       <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Desvio %</th>
                                       <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-white/5">
                                    {filteredRows.map((row, idx) => (
                                       <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                          <td className="px-6 py-4">
                                             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                                {getCategoryIcon(row.category)}
                                                {getCategoryLabel(row.category)}
                                             </div>
                                          </td>
                                          <td className="px-6 py-4">
                                             <div className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">{row.itemName}</div>
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                             <span className="text-sm font-bold text-white">{row.plannedQty.toFixed(1)}</span>
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                             <span className="text-sm font-bold text-white">{row.actualQty.toFixed(1)}</span>
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                             <div className={`text-xs font-bold ${row.deviationPercent > 0 ? 'text-blue-400' : row.deviationPercent < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                {row.deviationPercent > 0 ? '+' : ''}{row.deviationPercent.toFixed(1)}%
                                             </div>
                                          </td>
                                          <td className="px-6 py-4">
                                             <div className="flex justify-center">
                                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${getStatusColor(row.status)}`}>
                                                   {row.status.replace('_', ' ')}
                                                </span>
                                             </div>
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        </div>
                     </div>

                     {/* Sidebar Alerts */}
                     <div className="space-y-6">
                        <div className="glass-panel p-6 rounded-3xl border border-white/5 shadow-xl h-full">
                           <div className="flex items-center gap-3 mb-6">
                              <div className="bg-blue-500/20 p-2 rounded-xl">
                                 <AlertTriangle className="w-5 h-5 text-blue-400" />
                              </div>
                              <h3 className="font-bold text-white">Alertas Operacionais</h3>
                           </div>
                           <div className="space-y-4">
                              {alerts.length > 0 ? (
                                 alerts.map((alert, i) => (
                                    <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/5 text-[11px] text-slate-300 leading-relaxed flex gap-3">
                                       <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                       {alert}
                                    </div>
                                 ))
                              ) : (
                                 <div className="text-center py-12">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400/20 mx-auto mb-2" />
                                    <p className="text-slate-500 text-xs">Sem desvios detectados.</p>
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

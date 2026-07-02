import React, { useMemo, useState } from 'react';
import { Project, RDOData, Team, ServiceItem } from '../types';
import { formatMoney } from '../utils';
import { 
  Building2, 
  Search, 
  Filter, 
  Trash2, 
  FileSpreadsheet, 
  TrendingUp, 
  CheckCircle2, 
  Package, 
  ChevronRight,
  Target,
  BarChart2
} from 'lucide-react';

interface ProductionPriceTableProps {
  projects: Project[];
  rdos: RDOData[];
  teams: Team[];
  filterRegional: string;
  setFilterRegional: (reg: string) => void;
  filterProject: string;
  setFilterProject: (projId: string) => void;
}

export const ProductionPriceTable: React.FC<ProductionPriceTableProps> = ({
  projects,
  rdos,
  teams,
  filterRegional,
  setFilterRegional,
  filterProject,
  setFilterProject
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');

  const selectedProject = useMemo(() => 
    projects.find(p => p.id === filterProject) || null
  , [projects, filterProject]);

  const availableRegionals = useMemo(() => 
    Array.from(new Set(projects.map(p => p.regional || 'Sem Regional').filter(Boolean))).sort()
  , [projects]);

  const availableProjects = useMemo(() => 
    projects
      .filter(p => filterRegional === 'all' || (p.regional || 'Sem Regional') === filterRegional)
      .sort((a, b) => a.name.localeCompare(b.name))
  , [projects, filterRegional]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    rdos.forEach(r => {
      const [day, month, year] = r.date.split('/').map(Number);
      if (day && month && year) {
        months.add(`${year}-${String(month).padStart(2, '0')}`);
      }
    });
    return Array.from(months).sort().reverse(); // Show latest months first
  }, [rdos]);

  const formatMonthKey = (key: string) => {
    const [year, month] = key.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  };

  // Aggregate executed quantities for the selected project
  const executedQuantities = useMemo(() => {
    if (!filterProject || filterProject === 'all') return new Map<string, number>();

    const counts = new Map<string, number>();
    
    // Filter RDOS that belong to teams of this project
    const projectTeams = new Set(teams.filter(t => t.projectId === filterProject).map(t => t.id));
    const projectRdos = rdos.filter(r => {
      const matchesTeam = projectTeams.has(r.teamId);
      if (!matchesTeam) return false;
      
      if (filterMonth !== 'all') {
        const [day, month, year] = r.date.split('/').map(Number);
        const rMonthKey = `${year}-${String(month).padStart(2, '0')}`;
        return rMonthKey === filterMonth;
      }
      return true;
    });

    projectRdos.forEach(rdo => {
      rdo.activities.forEach(act => {
        if (act.code && act.quantity) {
          const current = counts.get(act.code) || 0;
          counts.set(act.code, current + act.quantity);
        }
      });
    });

    return counts;
  }, [rdos, teams, filterProject, filterMonth]);

  const filteredServices = useMemo(() => {
    if (!selectedProject?.services) return [];
    
    return selectedProject.services.filter(s => 
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.scope.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [selectedProject, searchTerm]);

  const totals = useMemo(() => {
    let totalValue = 0;
    filteredServices.forEach(s => {
      const qty = executedQuantities.get(s.code) || 0;
      totalValue += qty * s.value;
    });
    return { totalValue };
  }, [filteredServices, executedQuantities]);

  return (
    <div className="animate-fade-in space-y-8 pb-12">
      {/* Filter Header */}
      <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col lg:flex-row gap-6 items-end lg:items-center justify-between shadow-2xl shadow-blue-900/10">
        <div className="flex flex-col md:flex-row gap-6 w-full">
          <div className="flex flex-col gap-2 w-full md:w-52">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Regional</label>
            <div className="relative group">
              <select 
                value={filterRegional} 
                onChange={e => { setFilterRegional(e.target.value); setFilterProject('all'); }}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">Todas as Regionais</option>
                {availableRegionals.map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-64">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Centro de Custo / Obra</label>
            <div className="relative group">
              <select 
                value={filterProject} 
                onChange={e => setFilterProject(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">Selecione uma Obra</option>
                {availableProjects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>
          
          <div className="flex flex-col gap-2 w-full md:w-52">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mês de Referência</label>
            <div className="relative group">
              <select 
                value={filterMonth} 
                onChange={e => setFilterMonth(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">Todo o Período</option>
                {availableMonths.map(m => (
                  <option key={m} value={m} className="bg-slate-900">{formatMonthKey(m)}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Buscar Serviço</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text"
                placeholder="Código ou descrição..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
             onClick={() => { setFilterRegional('all'); setFilterProject('all'); setFilterMonth('all'); setSearchTerm(''); }}
             className="p-3 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all duration-300 border border-white/5"
             title="Limpar Filtros"
          >
             <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!selectedProject || filterProject === 'all' ? (
        <div className="py-28 glass-panel rounded-[40px] border border-dashed border-white/10 flex flex-col items-center justify-center text-center px-6">
          <div className="bg-blue-500/10 p-8 rounded-full mb-8 shadow-inner border border-blue-500/20">
            <Building2 className="w-14 h-14 text-blue-400 opacity-60" />
          </div>
          <h4 className="text-2xl font-black text-white mb-3 tracking-tight">Selecione uma Obra</h4>
          <p className="text-slate-500 max-w-md leading-relaxed font-medium">
            Escolha um centro de custo para visualizar sua tabela de preços e o acumulado de produção.
          </p>
        </div>
      ) : !selectedProject.services || selectedProject.services.length === 0 ? (
        <div className="py-28 glass-panel rounded-[40px] border border-dashed border-white/10 flex flex-col items-center justify-center text-center px-6">
          <div className="bg-amber-500/10 p-8 rounded-full mb-8 shadow-inner border border-amber-500/20">
            <FileSpreadsheet className="w-14 h-14 text-amber-400 opacity-60" />
          </div>
          <h4 className="text-2xl font-black text-white mb-3 tracking-tight">Tabela de Preços Não Encontrada</h4>
          <p className="text-slate-500 max-w-md leading-relaxed font-medium">
            Esta obra ainda não possui uma tabela de preços importada. Vá em "Minhas Obras" para importar a planilha de serviços.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 ml-1">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-3xl font-bold text-white tracking-tight">Tabela de Preços & Produção</h2>
              <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-400" />
                Acompanhamento acumulado para <span className="text-blue-400 font-bold">{selectedProject.name}</span>
              </p>
            </div>
            
            <div className="flex gap-4">
              <div className="glass-card px-6 py-3 rounded-2xl border border-white/5 bg-blue-500/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Executado</p>
                <p className="text-xl font-black text-white mt-1 font-mono">{formatMoney(totals.totalValue)}</p>
              </div>
              <div className="glass-card px-6 py-3 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Itens na Tabela</p>
                <p className="text-xl font-black text-blue-400 mt-1">{selectedProject.services.length}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-[32px] border border-white/5 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/5">
                    <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cód. Item</th>
                    <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Escopo e Descritivo</th>
                    <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Unid.</th>
                    <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qtd. Executada</th>
                    <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {filteredServices.map((service, idx) => {
                    const qty = executedQuantities.get(service.code) || 0;
                    const total = qty * service.value;
                    
                    return (
                      <tr key={idx} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="py-5 px-8 font-mono text-xs text-blue-400/70 font-bold tracking-tight">
                          {service.code}
                        </td>
                        <td className="py-5 px-8">
                          <p className="font-semibold text-slate-200 group-hover:text-white transition-colors">{service.scope}</p>
                        </td>
                        <td className="py-5 px-8 text-center">
                          <span className="px-2.5 py-1 bg-white/5 text-slate-400 text-[10px] font-black rounded-lg border border-white/5">
                            {service.unit}
                          </span>
                        </td>
                        <td className="py-5 px-8 text-center">
                           <div className="flex flex-col items-center gap-1">
                              <span className={`text-sm font-black ${qty > 0 ? 'text-blue-400' : 'text-slate-600'}`}>
                                {qty.toLocaleString('pt-BR')}
                              </span>
                              {qty > 0 && (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">
                                   <TrendingUp className="w-2.5 h-2.5" />
                                   Em Andamento
                                </div>
                              )}
                           </div>
                        </td>
                        <td className="py-5 px-8 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`font-mono font-black text-base ${qty > 0 ? 'text-emerald-400 scale-105' : 'text-slate-700'} transition-transform`}>
                              {formatMoney(total)}
                            </span>
                            {qty > 0 && (
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                 Apontado em RDO
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {filteredServices.length === 0 && (
              <div className="p-20 text-center">
                <Package className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-20" />
                <p className="text-slate-500 font-medium">Nenhum serviço encontrado para sua busca.</p>
              </div>
            )}
            
            <div className="p-8 bg-white/[0.02] border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-lg shadow-emerald-900/5">
                     <BarChart2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Resumo de Produção</p>
                    <p className="text-slate-400 text-xs font-medium mt-0.5">Valores baseados em todos os RDOs aprovados do projeto.</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Geral Executado</p>
                    <p className="text-3xl font-black text-white font-mono mt-1 tracking-tighter shimmer">{formatMoney(totals.totalValue)}</p>
                  </div>
                  <button className="bg-gradient-premium p-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:scale-110 active:scale-95 transition-all">
                     <FileSpreadsheet className="w-6 h-6 text-white" />
                  </button>
               </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

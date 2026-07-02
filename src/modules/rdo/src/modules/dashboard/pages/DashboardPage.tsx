import React from 'react';
import { Trash2, Calendar } from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { FinancialTable } from '../../../../components/FinancialTable';
import { DailyBreakdownTable } from '../../../../components/DailyBreakdownTable';
import { DateRangePicker } from '../../../../components/ContractIntelligence/DateRangePicker';

export const DashboardPage: React.FC = () => {
  const {
    filterMes,
    setFilterMes,
    filterStartDate,
    setFilterStartDate,
    filterEndDate,
    setFilterEndDate,
    filterRegional,
    setFilterRegional,
    filterProject,
    setFilterProject,
    filterTeam,
    setFilterTeam,
    teams,
    dailyPlans,
    contractDataMap,
    handleClearFilters,

    filteredRdos,
    periodLabel,
    chartData, // not used directly in FinancialDashboard but calculated in case needed
    totalRevenueRealized,
    avgDailyRevenue,
    trendValue,
    totalForecast,

    availableRegionals,
    availableProjects,
    filteredProjectsToPass,
    availableMeses
  } = useDashboard();

  return (
    <div className="animate-fade-in space-y-8">
      <div className="glass-panel relative z-[100] p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row gap-6 items-end md:items-center justify-between shadow-2xl shadow-blue-900/10">
        <div className="flex flex-col md:flex-row gap-6 w-full">
          <div className="flex flex-col gap-2 w-full md:w-52">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mês (Medição)</label>
            <select 
              value={filterMes} 
              onChange={e => { setFilterMes(e.target.value); setFilterStartDate(''); setFilterEndDate(''); }}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="all" className="bg-white text-slate-900">Todos</option>
              {availableMeses.map(m => <option key={m} value={m} className="bg-white text-slate-900">{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto relative z-50">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Período</label>
            <DateRangePicker 
              startDate={filterStartDate}
              endDate={filterEndDate}
              onChange={(start, end) => { setFilterStartDate(start); setFilterEndDate(end); }}
            />
          </div>
          <div className="flex flex-col gap-2 w-full md:w-52">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Regional</label>
            <select 
              value={filterRegional} 
              onChange={e => { setFilterRegional(e.target.value); setFilterProject('all'); setFilterTeam('all'); }}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="all" className="bg-white text-slate-900">Todas</option>
              {availableRegionals.map(r => <option key={r} value={r} className="bg-white text-slate-900">{r}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-52">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Obra</label>
            <select 
              value={filterProject} 
              onChange={e => { setFilterProject(e.target.value); setFilterTeam('all'); }}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="all" className="bg-white text-slate-900">Todas</option>
              {availableProjects.map(p => <option key={p.id} value={p.id} className="bg-white text-slate-900">{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-52">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Equipe</label>
            <select 
              value={filterTeam} 
              onChange={e => setFilterTeam(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500/50 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="all" className="bg-white text-slate-900">Todas</option>
              {teams
                .filter(t => filterProject === 'all' || t.projectId === filterProject)
                .map(t => <option key={t.id} value={t.id} className="bg-white text-slate-900">{t.name}</option>)
              }
            </select>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleClearFilters}
            className="p-3 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all duration-300"
            title="Limpar Filtros"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 ml-1">
        <h2 className="text-3xl font-bold text-white tracking-tight">Visão Geral Financeira</h2>
        <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          Compilado referente a <span className="text-blue-400 capitalize">{periodLabel}</span>
        </p>
      </div>

      <FinancialTable
        contractDataMap={contractDataMap}
        filteredRdos={filteredRdos}
        projects={filteredProjectsToPass}
        teams={teams}
        dailyPlans={dailyPlans}
        filterStartDate={filterStartDate}
        filterEndDate={filterEndDate}
        filterMesName={filterMes}
      />

      {(filterMes !== 'all' || filterStartDate || filterEndDate) && (
        <DailyBreakdownTable
          filteredRdos={filteredRdos}
          projects={filteredProjectsToPass}
          teams={teams}
          dailyPlans={dailyPlans}
          filterStartDate={filterStartDate}
          filterEndDate={filterEndDate}
        />
      )}
    </div>
  );
};

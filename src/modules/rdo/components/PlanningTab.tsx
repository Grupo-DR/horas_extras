import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Save, CheckCircle2,
  Building2, AlertCircle, Calendar, Users, FileText, ClipboardList, Activity
} from 'lucide-react';
import { Project, Team, DailyPlan, ContractData } from '../types';
import { makePlanId } from '../services/dailyPlanService';
import { ContractDataTab } from './ContractDataTab';
import { ContractAnalysisTab } from './ContractAnalysisTab';

type PlanningSubTab = 'CONTRACT_DATA' | 'DAILY_PLAN' | 'CONTRACT_ANALYSIS';

interface PlanningTabProps {
  projects: Project[];
  teams: Team[];
  dailyPlans: DailyPlan[];
  onSave: (plans: DailyPlan[]) => void;
  contractDataMap: Record<string, ContractData>;
  onSaveContractData: (data: ContractData) => void;
  onUpdateTeam?: (team: Team) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

const daysBetween = (start: string, end: string): string[] => {
  if (!start || !end) return [];
  const result: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (s > e) return [];
  const cur = new Date(s);
  while (cur <= e) {
    result.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
};

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const fmtBRL = (v: number) =>
  v === 0
    ? ''
    : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const parseBRL = (raw: string): number => {
  const cleaned = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const PlanningTab: React.FC<PlanningTabProps> = ({
  projects, teams, dailyPlans, onSave, contractDataMap, onSaveContractData, onUpdateTeam
}) => {

  // ── Sub-tab state ──────────────────────────────────────────────────────────
  const [subTab, setSubTab] = useState<PlanningSubTab>('CONTRACT_DATA');

  // ── Navigation state ──────────────────────────────────────────────────────
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects[0]?.id ?? ''
  );
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null;
  const currentContractData = contractDataMap[selectedProjectId] ?? null;
  
  const periods = currentContractData?.monthlyEntries ?? [];
  const activePeriod = periods.find(p => p.id === selectedPeriodId) ?? periods[0];

  React.useEffect(() => {
     if (periods.length > 0 && !periods.find(p => p.id === selectedPeriodId)) {
        setSelectedPeriodId(periods[0].id);
     }
  }, [periods, selectedPeriodId]);

  // ── Unsaved local edits: Map<"<teamId>_<date>", number> ───────────────────
  const [edits, setEdits] = useState<Map<string, number>>(new Map());
  const [saved, setSaved] = useState(false);

  // ── Derived data ──────────────────────────────────────────────────────────
  const projectTeams = useMemo(
    () => teams.filter(t => t.projectId === selectedProjectId),
    [teams, selectedProjectId]
  );

  const daysISO = useMemo(() => {
     if (!activePeriod || !activePeriod.startDate || !activePeriod.endDate) return [];
     return daysBetween(activePeriod.startDate, activePeriod.endDate);
  }, [activePeriod]);

  /** Busca o valor salvo (persistido) para uma célula */
  const savedValue = useCallback(
    (teamId: string, isoDate: string): number => {
      const id  = makePlanId(selectedProjectId, teamId, isoDate);
      return dailyPlans.find(p => p.id === id)?.value ?? 0;
    },
    [dailyPlans, selectedProjectId]
  );

  /** Valor atual da célula (edição local tem prioridade sobre persistido) */
  const cellValue = useCallback(
    (teamId: string, isoDate: string): number => {
      const key = `${teamId}_${isoDate}`;
      return edits.has(key) ? (edits.get(key) ?? 0) : savedValue(teamId, isoDate);
    },
    [edits, savedValue]
  );

  const hasUnsaved = edits.size > 0;

  // ── Month navigation ──────────────────────────────────────────────────────
  const prevPeriod = () => {
    if (!activePeriod) return;
    const idx = periods.findIndex(p => p.id === activePeriod.id);
    if (idx > 0) setSelectedPeriodId(periods[idx - 1].id);
    setEdits(new Map());
    setSaved(false);
  };

  const nextPeriod = () => {
    if (!activePeriod) return;
    const idx = periods.findIndex(p => p.id === activePeriod.id);
    if (idx < periods.length - 1) setSelectedPeriodId(periods[idx + 1].id);
    setEdits(new Map());
    setSaved(false);
  };



  const periodBudget = activePeriod?.budget || 0;
  const periodForecast = activePeriod?.forecast || 0;

  const handleUpdateAllocation = (teamId: string, field: 'budgetPct' | 'forecastPct' | 'budgetValue' | 'forecastValue', val: number) => {
    if (!activePeriod || !selectedProjectId) return;
    const cData = contractDataMap[selectedProjectId];
    if (!cData) return;
    
    const updatedEntries = cData.monthlyEntries.map(entry => {
      if (entry.id !== activePeriod.id) return entry;
      const allocations = entry.teamAllocations || [];
      const idx = allocations.findIndex(a => a.teamId === teamId);
      let newAllocations = [...allocations];
      if (idx >= 0) {
        newAllocations[idx] = { ...newAllocations[idx], [field]: val };
      } else {
        newAllocations.push({ teamId, budgetPct: 0, forecastPct: 0, [field]: val });
      }
      return { ...entry, teamAllocations: newAllocations };
    });

    onSaveContractData({ ...cData, monthlyEntries: updatedEntries });
  };

  // ── Cell edit ─────────────────────────────────────────────────────────────
  const handleCellChange = (teamId: string, isoDate: string, raw: string) => {
    const key = `${teamId}_${isoDate}`;
    const val = parseBRL(raw);
    setEdits(prev => {
      const next = new Map(prev);
      // If equal to the persisted value, remove from edits (not "dirty")
      if (val === savedValue(teamId, isoDate)) {
        next.delete(key);
      } else {
        next.set(key, val);
      }
      return next;
    });
    setSaved(false);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    // Start from current persisted plans
    const updated = [...dailyPlans];

    edits.forEach((value, key) => {
      // key = "<teamId>_<YYYY-MM-DD>"
      const underscore = key.indexOf('_');
      const teamId = key.slice(0, underscore);
      const date   = key.slice(underscore + 1);
      const id     = makePlanId(selectedProjectId, teamId, date);

      const idx = updated.findIndex(p => p.id === id);
      const plan: DailyPlan = {
        id,
        projectId: selectedProjectId,
        teamId,
        date,
        value,
        updatedAt: new Date().toISOString(),
      };

      if (idx >= 0) {
        updated[idx] = plan;
      } else {
        updated.push(plan);
      }
    });

    onSave(updated);
    setEdits(new Map());
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Totals ────────────────────────────────────────────────────────────────
  const teamTotals = useMemo(
    () => projectTeams.map(t => ({
      id: t.id,
      total: daysISO.reduce((s, d) => s + cellValue(t.id, d), 0),
    })),
    [projectTeams, daysISO, cellValue]
  );

  const dayTotals = useMemo(
    () => daysISO.map(d => ({
      day: d,
      total: projectTeams.reduce((s, t) => s + cellValue(t.id, d), 0),
    })),
    [daysISO, projectTeams, cellValue]
  );

  const grandTotal = teamTotals.reduce((s, t) => s + t.total, 0);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-white tracking-tight">Planejamento</h2>
        <p className="text-slate-400 text-sm">Dados contratuais e planejamento diário por equipe</p>
      </div>

      {/* ── Project Selector (shared) ── */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <select
          value={selectedProjectId}
          onChange={e => { setSelectedProjectId(e.target.value); setEdits(new Map()); }}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none cursor-pointer transition-all"
        >
          {projects.length === 0 && <option value="" className="bg-slate-900 text-white">Nenhuma obra cadastrada</option>}
          {projects.map(p => (
            <option key={p.id} value={p.id} className="bg-slate-900 text-white">{p.name}</option>
          ))}
        </select>
      </div>

      {/* ── Sub-tab navigation ── */}
      <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-2xl w-fit">
        {([
          ['CONTRACT_DATA', 'Dados do Contrato', FileText],
          ['DAILY_PLAN',    'Planejamento',       ClipboardList],
          ['CONTRACT_ANALYSIS', 'Análise do Contrato', Activity],
        ] as [PlanningSubTab, string, React.ElementType][]).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              subTab === key
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Sub-tab: Dados do Contrato ── */}
      {subTab === 'CONTRACT_DATA' && (
        <ContractDataTab
          project={selectedProject}
          contractData={currentContractData}
          onSave={onSaveContractData}
        />
      )}

      {/* ── Sub-tab: Análise do Contrato ── */}
      {subTab === 'CONTRACT_ANALYSIS' && (
        <ContractAnalysisTab
          project={selectedProject}
          contractData={currentContractData}
        />
      )}

      {/* ── Sub-tab: Planejamento Diário ── */}
      {subTab === 'DAILY_PLAN' && (
        <div className="space-y-6">

        {/* Controls */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col sm:flex-row gap-4 items-start sm:items-center">

          {/* Period Navigator */}
          <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-white/10">
            <button
              onClick={prevPeriod}
              disabled={!activePeriod || periods.findIndex(p => p.id === activePeriod.id) === 0}
              className="p-1 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-col items-center min-w-[200px]">
              <span className="text-sm font-semibold text-white capitalize text-center leading-tight">
                {activePeriod ? activePeriod.name : 'Nenhum Período'}
              </span>
              {activePeriod && activePeriod.startDate && (
                <span className="text-[10px] text-slate-400 font-medium">
                  {new Date(activePeriod.startDate + 'T00:00:00').toLocaleDateString('pt-BR').slice(0, 5)} - {new Date(activePeriod.endDate + 'T00:00:00').toLocaleDateString('pt-BR').slice(0, 5)}
                </span>
              )}
            </div>
            <button
              onClick={nextPeriod}
              disabled={!activePeriod || periods.findIndex(p => p.id === activePeriod.id) === periods.length - 1}
              className="p-1 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Save button + status */}
          <div className="flex items-center gap-3 ml-auto">
            {saved && (
              <span className="flex items-center gap-2 text-emerald-400 text-sm font-medium animate-fade-in">
                <CheckCircle2 className="w-4 h-4" /> Salvo com sucesso
              </span>
            )}
            {hasUnsaved && !saved && (
              <span className="flex items-center gap-2 text-amber-400 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Alterações não salvas
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasUnsaved}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                hasUnsaved
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30'
                  : 'bg-white/5 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>

          {/* Summary */}
          {projectTeams.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Users className="w-3.5 h-3.5" />
              {projectTeams.length} equipe{projectTeams.length !== 1 ? 's' : ''}
              <span className="text-slate-600">•</span>
              <span className="font-mono text-white font-semibold">
                {grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
              </span>
              total no mês
            </div>
          )}
        </div>

      {/* ── Grid ── */}
      {projectTeams.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-white/5 text-center bg-white/[0.02] border-dashed">
          <Users className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-30" />
          <p className="text-slate-500 font-medium">
            {projects.length === 0
              ? 'Cadastre obras e equipes antes de planejar.'
              : 'Esta obra não possui equipes cadastradas.'}
          </p>
        </div>
      ) : periods.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-white/5 text-center bg-white/[0.02] border-dashed">
          <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-30" />
          <p className="text-slate-500 font-medium">Nenhum Período de Medição cadastrado.</p>
          <p className="text-slate-600 text-sm mt-2">Vá até a aba "Dados do Contrato" e adicione um período para liberar o grid diário.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden shadow-2xl shadow-black/20">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="border-collapse text-left" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-white/10">
                  {/* Equipe col */}
                  <th className="sticky left-0 z-20 py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900/95 whitespace-nowrap border-r border-white/5 min-w-[160px]">
                    Equipe
                  </th>
                  <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900/95 whitespace-nowrap border-r border-white/5 w-[100px] text-center">
                    Budget (R$)
                  </th>
                  <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900/95 whitespace-nowrap border-r border-white/5 w-[100px] text-center">
                    Forecast (R$)
                  </th>
                  <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900/95 whitespace-nowrap border-r border-white/5 min-w-[80px]">
                    Tipo
                  </th>
                  {/* Day cols */}
                  {daysISO.map(isoDate => {
                    const dt = new Date(isoDate + 'T00:00:00');
                    const dow = dt.getDay();
                    const dayNum = dt.getDate();
                    const isWeekend = dow === 0 || dow === 6;
                    const isToday = isoDate === todayIso;
                    return (
                      <th
                        key={isoDate}
                        className={`py-2 px-1 text-center whitespace-nowrap border-r border-white/5 min-w-[72px] ${
                          isToday
                            ? 'bg-blue-600/20 text-blue-300'
                            : isWeekend
                            ? 'bg-slate-800/60 text-slate-500'
                            : 'bg-slate-900/80 text-slate-400'
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-widest">
                          {WEEKDAYS[dow]}
                        </div>
                        <div className={`text-xs font-bold mt-0.5 ${isToday ? 'text-blue-300' : 'text-slate-300'}`}>
                          {pad(dayNum)}/{pad(dt.getMonth() + 1)}
                        </div>
                      </th>
                    );
                  })}
                  {/* Total col */}
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800/80 text-right whitespace-nowrap border-l border-white/10 min-w-[120px]">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {projectTeams.map((team, tIdx) => {
                  const teamTotal = teamTotals.find(t => t.id === team.id)?.total ?? 0;
                  const allocation = activePeriod?.teamAllocations?.find(a => a.teamId === team.id);
                  const budgetValue = allocation?.budgetValue || 0;
                  const forecastValue = allocation?.forecastValue || 0;
                  
                  const weekdaysCount = daysISO.filter(iso => {
                    const dow = new Date(iso + 'T00:00:00').getDay();
                    return dow !== 0 && dow !== 6;
                  }).length;

                  const teamBudget = budgetValue;
                  const dailyBudget = weekdaysCount > 0 ? teamBudget / weekdaysCount : 0;
                  const teamForecast = forecastValue;
                  const dailyForecast = weekdaysCount > 0 ? teamForecast / weekdaysCount : 0;
                  const bgBase = tIdx % 2 === 0 ? 'bg-slate-900/20' : 'bg-slate-900/40';

                  return (
                    <React.Fragment key={team.id}>
                      {/* Budget Row */}
                      <tr className={`border-b border-white/5 transition-colors ${bgBase}`}>
                        <td rowSpan={3} className="sticky left-0 z-10 py-2 px-4 text-xs font-semibold text-slate-200 bg-slate-900 border-r border-white/5 whitespace-nowrap align-middle">
                          {team.name}
                        </td>
                        <td rowSpan={3} className="py-2 px-2 border-r border-white/5 align-middle text-center">
                          <input type="text" inputMode="numeric" defaultValue={teamBudget !== 0 ? fmtBRL(teamBudget) : ''} onBlur={e => handleUpdateAllocation(team.id, 'budgetValue', parseBRL(e.target.value))} className="w-20 bg-black/20 border border-white/10 rounded px-1 py-1 text-emerald-400 text-xs text-center outline-none focus:border-emerald-500 placeholder:text-slate-600" placeholder="—" />
                        </td>
                        <td rowSpan={3} className="py-2 px-2 border-r border-white/5 align-middle text-center">
                          <input type="text" inputMode="numeric" defaultValue={teamForecast !== 0 ? fmtBRL(teamForecast) : ''} onBlur={e => handleUpdateAllocation(team.id, 'forecastValue', parseBRL(e.target.value))} className="w-20 bg-black/20 border border-white/10 rounded px-1 py-1 text-blue-400 text-xs text-center outline-none focus:border-blue-500 placeholder:text-slate-600" placeholder="—" />
                        </td>
                        <td className="py-1 px-2 text-[10px] text-slate-500 border-r border-white/5 uppercase tracking-wider font-semibold">
                          Budget
                        </td>
                        {daysISO.map(isoDate => {
                           const isWeekend = [0, 6].includes(new Date(isoDate + 'T00:00:00').getDay());
                           return (
                             <td key={isoDate} className="py-1 px-1 border-r border-white/5 text-emerald-400/50 text-[10px] text-right">
                               {isWeekend ? '—' : fmtBRL(dailyBudget)}
                             </td>
                           );
                        })}
                        <td className="py-1 px-4 text-[10px] text-right font-mono font-semibold text-emerald-400/70 border-l border-white/10 whitespace-nowrap bg-slate-800/30">
                          {fmtBRL(teamBudget)}
                        </td>
                      </tr>

                      {/* Forecast Row */}
                      <tr className={`border-b border-white/5 transition-colors ${bgBase}`}>
                        <td className="py-1 px-2 text-[10px] text-slate-500 border-r border-white/5 uppercase tracking-wider font-semibold">
                          Forecast
                        </td>
                        {daysISO.map(isoDate => {
                           const isWeekend = [0, 6].includes(new Date(isoDate + 'T00:00:00').getDay());
                           return (
                             <td key={isoDate} className="py-1 px-1 border-r border-white/5 text-blue-400/50 text-[10px] text-right">
                               {isWeekend ? '—' : fmtBRL(dailyForecast)}
                             </td>
                           );
                        })}
                        <td className="py-1 px-4 text-[10px] text-right font-mono font-semibold text-blue-400/70 border-l border-white/10 whitespace-nowrap bg-slate-800/30">
                          {fmtBRL(teamForecast)}
                        </td>
                      </tr>

                      {/* Planejado Row */}
                      <tr className={`border-b border-white/5 transition-colors ${bgBase} hover:bg-slate-800/30`}>
                        <td className="py-1 px-2 text-[10px] text-amber-400/80 border-r border-white/5 uppercase tracking-wider font-semibold">
                          Planejado
                        </td>
                        {daysISO.map(isoDate => {
                          const editKey = `${team.id}_${isoDate}`;
                          const val     = cellValue(team.id, isoDate);
                          const isDirty = edits.has(editKey);
                          const dt      = new Date(isoDate + 'T00:00:00');
                          const dow     = dt.getDay();
                          const isWeekend = dow === 0 || dow === 6;

                          return (
                            <td
                              key={isoDate}
                              className={`py-1 px-1 border-r border-white/5 ${
                                isWeekend ? 'bg-slate-800/30' : ''
                              } ${isDirty ? 'bg-amber-500/5' : ''}`}
                            >
                              <input
                                type="text"
                                inputMode="numeric"
                                defaultValue={val !== 0 ? fmtBRL(val) : ''}
                                key={`${team.id}_${isoDate}`}
                                placeholder="—"
                                onChange={e => handleCellChange(team.id, isoDate, e.target.value)}
                                className={`w-full text-right text-xs px-1.5 py-1.5 rounded-lg outline-none transition-all bg-transparent
                                  placeholder:text-slate-700
                                  focus:bg-blue-600/10 focus:ring-1 focus:ring-blue-500/40
                                  ${isDirty ? 'text-amber-300 ring-1 ring-amber-400/30' : 'text-slate-300 hover:bg-white/5'}
                                `}
                              />
                            </td>
                          );
                        })}
                        <td className="py-2 px-4 text-xs text-right font-mono font-semibold text-white border-l border-white/10 whitespace-nowrap bg-slate-800/30">
                          {teamTotal > 0
                            ? teamTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
                            : <span className="text-slate-600">R$ -</span>
                          }
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* Totals footer */}
              <tfoot>
                <tr className="border-t border-white/10 bg-slate-800/60">
                  <td colSpan={4} className="sticky left-0 z-10 py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800/80 border-r border-white/5 whitespace-nowrap text-right">
                    Total diário
                  </td>
                  {dayTotals.map(({ day, total }) => (
                    <td key={day} className="py-2.5 px-1 text-center border-r border-white/5">
                      {total > 0 ? (
                        <span className="text-[10px] font-mono font-bold text-emerald-400 block">
                          {(total / 1000).toFixed(0)}k
                        </span>
                      ) : (
                        <span className="text-slate-700 text-[10px]">—</span>
                      )}
                    </td>
                  ))}
                  <td className="py-2.5 px-4 text-right text-xs font-mono font-bold text-white border-l border-white/10 whitespace-nowrap bg-slate-800/60">
                    {grandTotal > 0
                      ? grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
                      : <span className="text-slate-600">R$ -</span>
                    }
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer hint */}
          <div className="px-6 py-3 border-t border-white/5 bg-slate-900/40 flex items-center justify-between">
            <span className="text-[10px] text-slate-600 uppercase tracking-widest">
              Valores em R$ — separe milhares com ponto (ex: 50.000)
            </span>
            {hasUnsaved && (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600/80 hover:bg-blue-500/80 text-white text-xs font-semibold rounded-lg transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar alterações
              </button>
            )}
          </div>
        </div>
      )}

      </div>
      )}

    </div>
  );
};

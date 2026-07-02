import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Activity } from 'lucide-react';
import { Project, Team, RDOData, DailyPlan } from '../types';
import { calculateRDOTotal } from '../utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DailyBreakdownTableProps {
  filteredRdos: RDOData[];
  projects: Project[];
  teams: Team[];
  dailyPlans?: DailyPlan[];
  filterStartDate?: string; // "YYYY-MM-DD"
  filterEndDate?: string;   // "YYYY-MM-DD"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

/** Converte "DD/MM/YYYY" → "YYYY-MM-DD" */
const rdoDateToISO = (d: string): string => {
  const parts = d.split('/');
  if (parts.length !== 3) return d;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

/** Gera array de ISO strings entre duas datas (inclusive) */
const daysInRange = (startISO: string, endISO: string): string[] => {
  const result: string[] = [];
  const cur = new Date(startISO + 'T00:00:00');
  const end = new Date(endISO   + 'T00:00:00');
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = pad(cur.getMonth() + 1);
    const d = pad(cur.getDate());
    result.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return result;
};

const fmtCompact = (v: number): string => {
  if (v === 0) return '';
  if (Math.abs(v) >= 1_000_000)
    return `${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (Math.abs(v) >= 1_000)
    return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
};

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── Cell color logic ─────────────────────────────────────────────────────────
// realized > 0 e >= planned → verde
// realized > 0 e < planned  → vermelho
// realized > 0 sem planned  → azul
// diff > 0 mas realized = 0 → vazio (só planejado)

const cellStyle = (realized: number, planned: number): string => {
  if (realized === 0 && planned === 0) return '';
  if (realized >= planned && planned > 0)
    return 'bg-emerald-600/70 text-white';
  if (realized > 0 && realized < planned)
    return 'bg-red-600/70 text-white';
  if (realized > 0 && planned === 0)
    return 'bg-blue-600/50 text-white';
  // só planejado, sem realizado
  return 'bg-amber-500/15 text-amber-300';
};

// ─── Data types ───────────────────────────────────────────────────────────────

interface DayCell {
  realized: number;
  planned:  number;
}

interface TeamRow {
  id: string;
  name: string;
  days: Record<string, DayCell>; // iso → { realized, planned }
  total: number;
}

interface ProjectRow {
  id: string;
  name: string;
  days: Record<string, DayCell>;
  total: number;
  teams: TeamRow[];
}

interface RegionalRow {
  name: string;
  days: Record<string, DayCell>;
  total: number;
  projects: ProjectRow[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DailyBreakdownTable: React.FC<DailyBreakdownTableProps> = ({
  filteredRdos,
  projects,
  teams,
  dailyPlans = [],
  filterStartDate,
  filterEndDate,
}) => {

  const [expandedRegionals, setExpandedRegionals] = useState<Set<string>>(new Set(['all']));
  const [expandedProjects,  setExpandedProjects]  = useState<Set<string>>(new Set());
  const [showTeams,         setShowTeams]          = useState(true);

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  };

  // ── Reference period ───────────────────────────────────────────────────────
  const today    = new Date();
  const todayISO = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

  const startISO = filterStartDate || (() => {
    let earliest = '';
    if (filteredRdos.length > 0) {
      earliest = filteredRdos.map(r => rdoDateToISO(r.date)).sort()[0];
    }
    if (dailyPlans && dailyPlans.length > 0) {
      const earliestPlan = dailyPlans.map(p => p.date).sort()[0];
      if (!earliest || earliestPlan < earliest) earliest = earliestPlan;
    }
    
    if (earliest) return earliest;

    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`;
  })();
  
  const endISO = filterEndDate || (() => {
    let latest = '';
    if (filteredRdos.length > 0) {
      latest = filteredRdos.map(r => rdoDateToISO(r.date)).sort().reverse()[0];
    }
    if (dailyPlans && dailyPlans.length > 0) {
      const latestPlan = dailyPlans.map(p => p.date).sort().reverse()[0];
      if (!latest || latestPlan > latest) latest = latestPlan;
    }
    
    if (latest) return latest;

    return todayISO;
  })();

  const days = useMemo(() => daysInRange(startISO, endISO), [startISO, endISO]);

  // ── Build data hierarchy ───────────────────────────────────────────────────
  const rows = useMemo<RegionalRow[]>(() => {
    if (projects.length === 0) return [];

    const regMap = new Map<string, RegionalRow>();

    // Seed
    projects.forEach(p => {
      const reg = p.regional || 'Sem Regional';
      if (!regMap.has(reg)) {
        regMap.set(reg, { name: reg, days: {}, total: 0, projects: [] });
      }
      regMap.get(reg)!.projects.push({
        id: p.id, name: p.name,
        days: {}, total: 0, teams: [],
      });
    });

    // ── Accumulate REALIZED from RDOs ─────────────────────────────────────
    filteredRdos.forEach(rdo => {
      const iso = rdoDateToISO(rdo.date);
      // Only count days within the selected range
      if (iso < startISO || iso > endISO) return;

      const team    = teams.find(t => t.id === rdo.teamId);
      if (!team) return;
      const project = projects.find(p => p.id === team.projectId);
      if (!project) return;

      const value   = calculateRDOTotal(rdo, project);
      const reg     = project.regional || 'Sem Regional';
      const regRow  = regMap.get(reg);
      if (!regRow) return;
      const projRow = regRow.projects.find(p => p.id === project.id);
      if (!projRow) return;

      let teamRow = projRow.teams.find(t => t.id === team.id);
      if (!teamRow) {
        teamRow = { id: team.id, name: team.name, days: {}, total: 0 };
        projRow.teams.push(teamRow);
      }

      // Team day cell
      if (!teamRow.days[iso]) teamRow.days[iso] = { realized: 0, planned: 0 };
      teamRow.days[iso].realized += value;
      teamRow.total              += value;

      // Project day cell
      if (!projRow.days[iso]) projRow.days[iso] = { realized: 0, planned: 0 };
      projRow.days[iso].realized += value;
      projRow.total              += value;

      // Regional day cell
      if (!regRow.days[iso]) regRow.days[iso] = { realized: 0, planned: 0 };
      regRow.days[iso].realized += value;
      regRow.total              += value;
    });

    // ── Accumulate PLANNED from dailyPlans ────────────────────────────────
    dailyPlans.forEach(plan => {
      if (plan.date < startISO || plan.date > endISO) return;
      if (plan.value === 0) return;

      const team    = teams.find(t => t.id === plan.teamId);
      if (!team) return;
      const project = projects.find(p => p.id === plan.projectId);
      if (!project) return;

      const reg     = project.regional || 'Sem Regional';
      const regRow  = regMap.get(reg);
      if (!regRow) return;
      const projRow = regRow.projects.find(p => p.id === project.id);
      if (!projRow) return;

      let teamRow = projRow.teams.find(t => t.id === team.id);
      if (!teamRow) {
        teamRow = { id: team.id, name: team.name, days: {}, total: 0 };
        projRow.teams.push(teamRow);
      }

      if (!teamRow.days[plan.date]) teamRow.days[plan.date] = { realized: 0, planned: 0 };
      teamRow.days[plan.date].planned += plan.value;

      if (!projRow.days[plan.date]) projRow.days[plan.date] = { realized: 0, planned: 0 };
      projRow.days[plan.date].planned += plan.value;

      if (!regRow.days[plan.date]) regRow.days[plan.date] = { realized: 0, planned: 0 };
      regRow.days[plan.date].planned += plan.value;
    });

    return Array.from(regMap.values())
      .filter(r => r.projects.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredRdos, projects, teams, dailyPlans, startISO, endISO]);

  // ── Day totals (for footer) ────────────────────────────────────────────────
  const dayTotals = useMemo(() =>
    days.map(iso => {
      let realized = 0, planned = 0;
      rows.forEach(reg => {
        const c = reg.days[iso];
        if (c) { realized += c.realized; planned += c.planned; }
      });
      return { iso, realized, planned };
    }),
  [days, rows]);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderCell = (cell: DayCell | undefined, iso: string) => {
    const r = cell?.realized ?? 0;
    const p = cell?.planned  ?? 0;
    if (r === 0 && p === 0) {
      return (
        <td key={iso} className="py-1 px-0.5 border-r border-white/5 text-center min-w-[62px]">
          <span className="text-slate-800 text-[10px]">—</span>
        </td>
      );
    }
    const diff = r - p;
    return (
      <td key={iso} className={`py-1 px-0.5 border-r border-white/5 min-w-[62px]`}>
        <div className={`mx-0.5 rounded px-1 py-1 text-center ${cellStyle(r, p)}`}>
          <div className="text-[11px] font-bold leading-tight">{fmtCompact(r) || '—'}</div>
          {p > 0 && (
            <div className={`text-[9px] leading-tight mt-0.5 ${diff >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
              {diff >= 0 ? '+' : ''}{fmtCompact(diff)}
            </div>
          )}
        </div>
      </td>
    );
  };

  if (rows.length === 0) return null;

  const isTodayISO = (iso: string) => iso === todayISO;
  const isWeekend  = (iso: string) => {
    const dow = new Date(iso + 'T00:00:00').getDay();
    return dow === 0 || dow === 6;
  };

  return (
    <div className="mt-10 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Raio-X Diário</h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Realizado vs Planejado · dia a dia ·{' '}
              <span className="text-slate-400">
                {new Date(startISO + 'T00:00:00').toLocaleDateString('pt-BR')}
                {' → '}
                {new Date(endISO + 'T00:00:00').toLocaleDateString('pt-BR')}
              </span>
            </p>
          </div>
        </div>

        {/* Legend + toggle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-[10px] text-slate-500 uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-emerald-600/70 inline-block"/>Acima</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-red-600/70 inline-block"/>Abaixo</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-blue-600/50 inline-block"/>Sem plano</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-amber-500/30 inline-block"/>Só plano</span>
          </div>
          <button
            onClick={() => setShowTeams(v => !v)}
            className="text-[10px] text-slate-500 hover:text-slate-300 border border-white/10 rounded-lg px-3 py-1.5 transition-colors hover:bg-white/5"
          >
            {showTeams ? 'Ocultar equipes' : 'Mostrar equipes'}
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden shadow-2xl shadow-black/20">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse text-left" style={{ minWidth: Math.max(800, 160 + days.length * 64) }}>
            <thead>
              <tr className="border-b border-white/10">
                {/* CC column */}
                <th className="sticky left-0 z-20 py-3 pl-4 pr-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900/95 whitespace-nowrap border-r border-white/5 min-w-[160px]">
                  CC / Equipe
                </th>

                {/* Day columns */}
                {days.map(iso => {
                  const dt  = new Date(iso + 'T00:00:00');
                  const day = dt.getDate();
                  const dow = WEEKDAYS_SHORT[dt.getDay()];
                  const isToday   = isTodayISO(iso);
                  const isWknd    = isWeekend(iso);
                  return (
                    <th
                      key={iso}
                      className={`py-2 px-0.5 text-center whitespace-nowrap border-r border-white/5 min-w-[62px] ${
                        isToday ? 'bg-blue-600/20 text-blue-300'
                        : isWknd ? 'bg-slate-800/60 text-slate-600'
                        : 'bg-slate-900/80 text-slate-500'
                      }`}
                    >
                      <div className="text-[9px] font-bold uppercase">{dow}</div>
                      <div className={`text-[11px] font-bold mt-0.5 ${isToday ? 'text-blue-300' : 'text-slate-300'}`}>
                        {pad(day)}
                      </div>
                    </th>
                  );
                })}

                {/* Total */}
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800/80 text-right whitespace-nowrap border-l border-white/10 min-w-[100px]">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map(reg => {
                const regExp = expandedRegionals.has(reg.name);
                return (
                  <React.Fragment key={reg.name}>
                    {/* Regional row */}
                    <tr
                      className="border-b border-white/5 bg-slate-800/60 border-l-4 border-l-cyan-400 cursor-pointer hover:brightness-110 transition-all"
                      onClick={() => toggle(expandedRegionals, reg.name, setExpandedRegionals)}
                    >
                      <td className="sticky left-0 z-10 py-2 pl-4 pr-3 text-xs font-bold text-white bg-slate-800/80 border-r border-white/5 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {regExp
                            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"/>
                            : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"/>}
                          {reg.name}
                        </span>
                      </td>
                      {days.map(iso => renderCell(reg.days[iso], iso))}
                      <td className="py-2 px-4 text-xs text-right font-mono font-bold text-white border-l border-white/10 whitespace-nowrap bg-slate-800/40">
                        {reg.total > 0 ? fmtBRL(reg.total) : <span className="text-slate-600">—</span>}
                      </td>
                    </tr>

                    {/* Project rows */}
                    {regExp && reg.projects.map(proj => {
                      const projExp = expandedProjects.has(proj.id);
                      return (
                        <React.Fragment key={proj.id}>
                          <tr
                            className={`border-b border-white/5 bg-slate-900/50 border-l-4 border-l-indigo-400/50 transition-all ${proj.teams.length > 0 && showTeams ? 'cursor-pointer hover:brightness-110' : ''}`}
                            onClick={() => proj.teams.length > 0 && showTeams && toggle(expandedProjects, proj.id, setExpandedProjects)}
                          >
                            <td className="sticky left-0 z-10 py-2 pl-8 pr-3 text-xs font-medium text-slate-200 bg-slate-900/80 border-r border-white/5 whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                {proj.teams.length > 0 && showTeams && (
                                  projExp
                                    ? <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0"/>
                                    : <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0"/>
                                )}
                                {proj.name}
                              </span>
                            </td>
                            {days.map(iso => renderCell(proj.days[iso], iso))}
                            <td className="py-2 px-4 text-xs text-right font-mono font-semibold text-slate-200 border-l border-white/10 whitespace-nowrap bg-slate-900/40">
                              {proj.total > 0 ? fmtBRL(proj.total) : <span className="text-slate-600">—</span>}
                            </td>
                          </tr>

                          {/* Team rows */}
                          {projExp && showTeams && proj.teams.map(team => (
                            <tr key={team.id} className="border-b border-white/5 bg-slate-900/20 border-l-4 border-l-slate-700 hover:bg-slate-800/20 transition-colors">
                              <td className="sticky left-0 z-10 py-1.5 pl-12 pr-3 text-[11px] text-slate-400 bg-slate-900/60 border-r border-white/5 whitespace-nowrap">
                                {team.name}
                              </td>
                              {days.map(iso => renderCell(team.days[iso], iso))}
                              <td className="py-1.5 px-4 text-[11px] text-right font-mono text-slate-400 border-l border-white/10 whitespace-nowrap">
                                {team.total > 0 ? fmtBRL(team.total) : <span className="text-slate-600">—</span>}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Footer totals */}
            <tfoot>
              <tr className="border-t border-white/10 bg-slate-800/70">
                <td className="sticky left-0 z-10 py-2.5 pl-4 pr-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800/90 border-r border-white/5 whitespace-nowrap">
                  Total diário
                </td>
                {dayTotals.map(({ iso, realized, planned }) => {
                  const diff = realized - planned;
                  const isWknd = isWeekend(iso);
                  return (
                    <td key={iso} className={`py-2 px-0.5 border-r border-white/5 text-center ${isWknd ? 'bg-slate-800/40' : ''}`}>
                      {realized > 0 ? (
                        <div className="mx-0.5">
                          <div className="text-[11px] font-bold text-white">{fmtCompact(realized)}</div>
                          {planned > 0 && (
                            <div className={`text-[9px] ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {diff >= 0 ? '+' : ''}{fmtCompact(diff)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-700 text-[10px]">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2.5 px-4 text-right text-xs font-mono font-bold text-white border-l border-white/10 whitespace-nowrap bg-slate-800/60">
                  {grandTotal > 0 ? fmtBRL(grandTotal) : <span className="text-slate-600">—</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

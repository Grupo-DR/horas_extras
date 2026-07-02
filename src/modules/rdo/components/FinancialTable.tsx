import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Project, Team, RDOData, DailyPlan } from '../types';
import { formatMoney, calculateRDOTotal } from '../utils';
import { sumPlansForTeamMonth, sumPlansForTeamPeriod } from '../services/dailyPlanService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FinancialTableProps {
  filteredRdos: RDOData[];
  projects: Project[];
  teams: Team[];
  /** Planejamentos diários por equipe — alimenta as colunas de planejamento */
  dailyPlans?: DailyPlan[];
  /** ISO 'YYYY-MM-DD' — "De" filter (início do período programado) */
  filterStartDate?: string;
  filterEndDate?: string;
  filterMesName?: string;
  contractDataMap?: Record<string, import('../types').ContractData>;
}

// ─── Data Node Types ──────────────────────────────────────────────────────────

interface TeamNode {
  id: string;
  name: string;
  // Mês vigente
  budget: number;
  forecast: number;
  plannedMonth: number;
  // Período programado pelo engenheiro
  plannedPeriod: number;
  realized: number;
  // Projeção restante (planejado do mês - realizado, se positivo)
  projected: number;
}

interface ProjectNode extends TeamNode {
  teams: TeamNode[];
}

interface RegionalNode {
  name: string;
  budget: number;
  forecast: number;
  plannedMonth: number;
  plannedPeriod: number;
  realized: number;
  projected: number;
  projects: ProjectNode[];
}

interface RootNode {
  name: string;
  budget: number;
  forecast: number;
  plannedMonth: number;
  plannedPeriod: number;
  realized: number;
  projected: number;
  regionals: RegionalNode[];
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmt = (v: number): string => {
  if (v === 0) return 'R$ -';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
};

const fmtPct = (v: number): string =>
  `${v.toFixed(2).replace('.', ',')}%`;

const isoToDisplay = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const isoToShort = (iso: string): string => {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

// ─── Cell classes ─────────────────────────────────────────────────────────────

const diffClass = (val: number) => {
  if (val > 0) return 'text-emerald-400';
  if (val < 0) return 'text-red-400';
  return 'text-slate-300';
};

const diffBg = (val: number) => {
  if (val > 0) return 'bg-emerald-500/10';
  if (val < 0) return 'bg-red-500/10';
  return '';
};

const pctBadge = (val: number) => {
  if (val >= 5)  return 'bg-emerald-600/80 text-white font-bold';
  if (val < 0)   return 'bg-red-600/80 text-white font-bold';
  return 'text-slate-300';
};

// ─── Row level styles ─────────────────────────────────────────────────────────

type RowLevel = 'root' | 'regional' | 'project' | 'team';

const levelStyle: Record<RowLevel, string> = {
  root:     'bg-slate-800/90 border-l-4 border-l-blue-500 font-bold text-white',
  regional: 'bg-slate-800/60 border-l-4 border-l-cyan-400 font-semibold text-white',
  project:  'bg-slate-900/60 border-l-4 border-l-indigo-400/60 font-medium text-slate-200',
  team:     'bg-slate-900/20 border-l-4 border-l-slate-600 font-normal text-slate-300',
};

const levelIndent: Record<RowLevel, string> = {
  root:     'pl-3',
  regional: 'pl-6',
  project:  'pl-10',
  team:     'pl-14',
};

// ─── TableRow ─────────────────────────────────────────────────────────────────

interface RowData {
  id: string;
  name: string;
  level: RowLevel;
  budget: number;
  forecast: number;
  /** Planejado para o mês vigente inteiro */
  plannedMonth: number;
  /** Planejado pelo engenheiro para o período De→Até */
  plannedPeriod: number;
  /** Realizado no período De→Até */
  realized: number;
  /**
   * Projeção restante do engenheiro para o mês:
   * = plannedMonth - realized (se positivo), i.e. o que ainda falta executar
   */
  projected: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle?: () => void;
}

const TableRow: React.FC<RowData> = ({
  name, level,
  budget, forecast, plannedMonth,
  plannedPeriod, realized, projected,
  hasChildren, isExpanded, onToggle,
}) => {

  // ── Grupo 2 – Período programado ──────────────────────────────────────────
  // Diferença = Realizado − Planejado período
  const diffPeriod = realized - plannedPeriod;
  const pctPeriod  = plannedPeriod > 0 ? (diffPeriod / plannedPeriod) * 100 : 0;

  // ── Grupo 3 – Projeção do mês ─────────────────────────────────────────────
  // Col 1: Projetado = projeções do engenheiro (o que ainda falta no mês)
  // Col 2: Realizado + Projetado = realized + projected
  // Col 3: Diferença = (Realizado + Projetado) − Planejado Mês
  const realizadoMaisProjetado = realized + projected;
  const diffMes  = realizadoMaisProjetado - plannedMonth;
  const pctMes   = plannedMonth > 0 ? (diffMes / plannedMonth) * 100 : 0;

  return (
    <tr
      className={`border-b border-white/5 transition-all duration-150 ${levelStyle[level]} ${onToggle ? 'cursor-pointer hover:brightness-110' : ''}`}
      onClick={onToggle}
    >
      {/* ── Identificador ── */}
      <td className={`py-2.5 pr-3 whitespace-nowrap text-xs ${levelIndent[level]}`}>
        <span className="flex items-center gap-1.5">
          {hasChildren && (
            isExpanded
              ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
              : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
          )}
          {name}
        </span>
      </td>

      {/* ── Grupo 1: Mês Vigente ── */}
      <td className="py-2.5 px-3 text-xs text-right font-mono text-slate-300 whitespace-nowrap">
        {fmt(budget)}
      </td>
      <td className="py-2.5 px-3 text-xs text-right font-mono text-slate-300 whitespace-nowrap">
        {fmt(forecast)}
      </td>
      <td className={`py-2.5 px-3 text-xs text-right font-mono whitespace-nowrap border-r border-white/5 ${plannedMonth > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
        {fmt(plannedMonth)}
      </td>

      {/* ── Grupo 2: Período programado (De → Até) ── */}
      <td className="py-2.5 px-3 text-xs text-right font-mono text-slate-300 whitespace-nowrap bg-blue-950/20">
        {fmt(plannedPeriod)}
      </td>
      <td className="py-2.5 px-3 text-xs text-right font-mono text-slate-200 whitespace-nowrap bg-blue-950/20">
        {fmt(realized)}
      </td>
      <td className={`py-2.5 px-3 text-xs text-right font-mono whitespace-nowrap bg-blue-950/20 ${diffClass(diffPeriod)} ${diffBg(diffPeriod)}`}>
        {fmt(diffPeriod)}
      </td>
      <td className={`py-2.5 px-3 text-xs text-right whitespace-nowrap bg-blue-950/20 border-r border-white/5 rounded-sm ${pctBadge(pctPeriod)}`}>
        {fmtPct(pctPeriod)}
      </td>

      {/* ── Grupo 3: Projeção do mês ── */}
      {/* Col 1: Projeções restantes do engenheiro */}
      <td className="py-2.5 px-3 text-xs text-right font-mono text-slate-300 whitespace-nowrap">
        {fmt(projected)}
      </td>
      {/* Col 2: Realizado + Projetado */}
      <td className="py-2.5 px-3 text-xs text-right font-mono text-slate-200 whitespace-nowrap">
        {fmt(realizadoMaisProjetado)}
      </td>
      {/* Col 3: Diferença vs Planejado Mês */}
      <td className={`py-2.5 px-3 text-xs text-right font-mono whitespace-nowrap ${diffClass(diffMes)} ${diffBg(diffMes)}`}>
        {fmt(diffMes)}
      </td>
      {/* % vs Planejado Mês */}
      <td className={`py-2.5 px-3 text-xs text-right whitespace-nowrap rounded-sm ${pctBadge(pctMes)}`}>
        {fmtPct(pctMes)}
      </td>
    </tr>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const isoToShortFn = isoToShort;

export const FinancialTable: React.FC<FinancialTableProps> = ({
  filteredRdos, projects, teams, dailyPlans = [],
  filterStartDate = '', filterEndDate = '', filterMesName = 'all', contractDataMap = {},
}) => {

  const [expandedRegionals, setExpandedRegionals] = useState<Set<string>>(new Set(['all']));
  const [expandedProjects,  setExpandedProjects]  = useState<Set<string>>(new Set());

  // ─── Cabeçalhos dinâmicos ─────────────────────────────────────────────────
  const hasDates = Boolean(filterStartDate && filterEndDate);

  const startShort = hasDates ? isoToShortFn(filterStartDate) : '';
  const endShort   = hasDates ? isoToShortFn(filterEndDate)   : '';
  const startFull  = hasDates ? isoToDisplay(filterStartDate)  : '';
  const endFull    = hasDates ? isoToDisplay(filterEndDate)    : '';

  // Grupo 2 – cabeçalho azul do período
  const periodGroupLabel  = hasDates ? `${startShort} → ${endShort}` : 'Período programado';
  // Sub-col "Planejado período" do grupo 2
  const plannedPeriodLabel = hasDates ? `${startFull} a ${endFull}` : 'Planejado';
  // Grupo 3 – cabeçalho da projeção
  const projGroupLabel    = hasDates ? `Projeção após ${endShort}` : 'Projeção do mês';
  // Sub-col "Projetado" do grupo 3
  const projColLabel      = hasDates ? `Após ${endShort}` : 'Projetado restante';

  // ─── Toggle helper ────────────────────────────────────────────────────────
  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  };

  // ─── Resolve reference month ─────────────────────────────────────────────
  // "Mês vigente" = mês do filterEndDate quando existe, senão mês atual
  const refDate = useMemo(() => {
    if (filterEndDate) {
      const [y, m] = filterEndDate.split('-').map(Number);
      return { year: y, month: m - 1 }; // month 0-indexed
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [filterEndDate]);

  // Last day of the reference month as ISO string (for "projected" upper bound)
  const lastDayISO = useMemo(() => {
    const last = new Date(refDate.year, refDate.month + 1, 0);
    const m = String(last.getMonth() + 1).padStart(2, '0');
    const d = String(last.getDate()).padStart(2, '0');
    return `${last.getFullYear()}-${m}-${d}`;
  }, [refDate]);

  // ─── Build hierarchy ──────────────────────────────────────────────────────
  const root = useMemo<RootNode | null>(() => {
    if (projects.length === 0) return null;

    const regMap = new Map<string, RegionalNode>();

    // Seed with projects (even those with zero RDOs)
    projects.forEach(p => {
      const reg = p.regional || 'Sem Regional';
      if (!regMap.has(reg)) {
        regMap.set(reg, {
          name: reg, budget: 0, forecast: 0,
          plannedMonth: 0, plannedPeriod: 0, realized: 0, projected: 0,
          projects: [],
        });
      }

      regMap.get(reg)!.projects.push({
        id: p.id,
        name: p.name,
        budget:        0, // calculado abaixo
        forecast:      0, // calculado abaixo
        plannedMonth:  0,  // calculado abaixo a partir dos dailyPlans
        plannedPeriod: 0,
        realized:      0,
        projected:     0,
        teams: [],
      });
    });

    // Accumulate realized from RDOs
    filteredRdos.forEach(rdo => {
      const team = teams.find(t => t.id === rdo.teamId);
      if (!team) return;
      const project = projects.find(p => p.id === team.projectId);
      if (!project) return;

      const rdoValue = calculateRDOTotal(rdo, project);
      const reg      = project.regional || 'Sem Regional';
      const regNode  = regMap.get(reg);
      if (!regNode) return;
      const projNode = regNode.projects.find(p => p.id === project.id);
      if (!projNode) return;

      let teamNode = projNode.teams.find(t => t.id === team.id);
      if (!teamNode) {
        teamNode = {
          id: team.id,
          name: team.name,
          budget: 0, forecast: 0,
          plannedMonth:  0,
          plannedPeriod: 0,
          realized:  0,
          projected: 0,
        };
        projNode.teams.push(teamNode);
      }

      teamNode.realized += rdoValue;
      projNode.realized += rdoValue;
      regNode.realized  += rdoValue;
    });

    // ── Acumular valores de planejamento dos dailyPlans ──────────────────────
    regMap.forEach(reg => {
      reg.projects.forEach(proj => {
        // Buscar budget e forecast do ContractData para este projeto primeiro
        const cData = contractDataMap[proj.id];
        let pBudget = 0;
        let pForecast = 0;
        let activePeriodStart = '';
        let activePeriodEnd = '';

        let targetPeriods: any[] = [];
        if (cData && cData.monthlyEntries && cData.monthlyEntries.length > 0) {
          if (filterMesName !== 'all') {
             targetPeriods = cData.monthlyEntries.filter(pe => pe.name === filterMesName);
          } else if (filterStartDate && filterEndDate) {
            targetPeriods = cData.monthlyEntries.filter(pe => 
              pe.startDate <= filterEndDate && pe.endDate >= filterStartDate
            );
          } else {
            targetPeriods = cData.monthlyEntries;
          }
          pBudget = targetPeriods.reduce((sum, pe) => sum + (pe.budget || 0), 0);
          pForecast = targetPeriods.reduce((sum, pe) => sum + (pe.forecast || 0), 0);
          
          if (targetPeriods.length > 0) {
            activePeriodStart = targetPeriods.map(p => p.startDate).sort()[0];
            activePeriodEnd = targetPeriods.map(p => p.endDate).sort().reverse()[0];
          }
        } else {
          // Fallback para valores do projeto caso não haja períodos cadastrados
          pBudget = 0;
          pForecast = 0;
        }

        proj.budget = pBudget;
        proj.forecast = pForecast;

        // Limites para o "Projetado" (dia seguinte ao fim do filtro até o fim do período vigente)
        const effectiveEnd = activePeriodEnd || lastDayISO;
        const projectedStart = filterEndDate ? (() => {
          const dt = new Date(filterEndDate + 'T00:00:00');
          dt.setDate(dt.getDate() + 1);
          return dt.toISOString().slice(0, 10);
        })() : '';

        // Acumular por equipe
        proj.teams.forEach(t => {
          t.budget = targetPeriods.reduce((sum, pe) => {
            const alloc = pe.teamAllocations?.find(a => a.teamId === t.id);
            return sum + (alloc?.budgetValue || 0);
          }, 0);
          
          t.forecast = targetPeriods.reduce((sum, pe) => {
            const alloc = pe.teamAllocations?.find(a => a.teamId === t.id);
            return sum + (alloc?.forecastValue || 0);
          }, 0);

          // Planejado mês = soma dentro do activePeriodStart/activePeriodEnd do projeto, se existir
          if (activePeriodStart && activePeriodEnd) {
             t.plannedMonth = sumPlansForTeamPeriod(dailyPlans, t.id, activePeriodStart, activePeriodEnd);
          } else {
             t.plannedMonth = sumPlansForTeamMonth(dailyPlans, t.id, refDate.year, refDate.month);
          }

          // Planejado período = soma dentro do filtro De→Até
          t.plannedPeriod = (filterStartDate && filterEndDate)
            ? sumPlansForTeamPeriod(dailyPlans, t.id, filterStartDate, filterEndDate)
            : t.plannedMonth;

          // Projetado = soma APÓS o filterEndDate até o fim do activePeriod
          t.projected = (projectedStart && projectedStart <= effectiveEnd)
            ? sumPlansForTeamPeriod(dailyPlans, t.id, projectedStart, effectiveEnd)
            : 0;
        });

        // Agregar equipes → projeto
        proj.plannedMonth  = proj.teams.reduce((s, t) => s + t.plannedMonth,  0);
        proj.plannedPeriod = proj.teams.reduce((s, t) => s + t.plannedPeriod, 0);
        proj.projected     = proj.teams.reduce((s, t) => s + t.projected,     0);

        // Agregar projeto → regional
        reg.budget        += proj.budget;
        reg.forecast      += proj.forecast;
        reg.plannedMonth  += proj.plannedMonth;
        reg.plannedPeriod += proj.plannedPeriod;
        reg.projected     += proj.projected;
      });
    });

    const regionals = Array.from(regMap.values())
      .filter(r => r.projects.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    const rootNode: RootNode = {
      name: 'DR',
      budget:        regionals.reduce((s, r) => s + r.budget,        0),
      forecast:      regionals.reduce((s, r) => s + r.forecast,      0),
      plannedMonth:  regionals.reduce((s, r) => s + r.plannedMonth,  0),
      plannedPeriod: regionals.reduce((s, r) => s + r.plannedPeriod, 0),
      realized:      regionals.reduce((s, r) => s + r.realized,      0),
      projected:     regionals.reduce((s, r) => s + r.projected,     0),
      regionals,
    };

    return rootNode;
  }, [filteredRdos, projects, teams]);

  if (!root || root.regionals.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-3xl border border-white/5 mt-8 text-center bg-white/[0.02] border-dashed">
        <p className="text-slate-500 font-medium">
          Nenhum dado financeiro encontrado para os parâmetros selecionados.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 w-full">
      <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden shadow-2xl shadow-black/30">

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse text-left" style={{ minWidth: 1180 }}>
            <thead>
              {/* ── Linha de grupos ── */}
              <tr className="border-b border-white/10">

                {/* Coluna CC — sem grupo */}
                <th rowSpan={2} className="py-3 pl-3 pr-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900/80 whitespace-nowrap border-r border-white/5">
                  CC
                </th>

                {/* Grupo 1 – Mês vigente (3 colunas) */}
                <th colSpan={3} className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-300 bg-slate-800/70 text-center whitespace-nowrap border-r border-white/10">
                  Mês vigente
                </th>

                {/* Grupo 2 – Período programado (4 colunas) */}
                <th colSpan={4} className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-white bg-blue-600/70 text-center whitespace-nowrap border-r border-white/10">
                  {periodGroupLabel}
                </th>

                {/* Grupo 3 – Projeção do mês (4 colunas) */}
                <th colSpan={4} className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-300 bg-slate-700/60 text-center whitespace-nowrap">
                  {projGroupLabel}
                </th>
              </tr>

              {/* ── Sub-cabeçalhos ── */}
              <tr className="border-b border-white/10">
                {/* Grupo 1 */}
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800/50 text-right whitespace-nowrap">Budget</th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-800/50 text-right whitespace-nowrap">Forecast</th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-amber-400/80 bg-slate-800/50 text-right whitespace-nowrap border-r border-white/10">Planejado mês</th>

                {/* Grupo 2 */}
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-blue-300 bg-blue-900/30 text-right whitespace-nowrap">{plannedPeriodLabel}</th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-blue-300 bg-blue-900/30 text-right whitespace-nowrap">Realizado</th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-blue-300 bg-blue-900/30 text-right whitespace-nowrap">Diferença</th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-blue-300 bg-blue-900/30 text-right whitespace-nowrap border-r border-white/10">%</th>

                {/* Grupo 3 */}
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900/50 text-right whitespace-nowrap">{projColLabel}</th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900/50 text-right whitespace-nowrap">Realizado + Projetado</th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900/50 text-right whitespace-nowrap">Dif. vs Mês</th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-900/50 text-right whitespace-nowrap">%</th>
              </tr>
            </thead>

            <tbody>
              {/* ── Root (DR) ── */}
              <TableRow
                id="root" name={root.name} level="root"
                budget={root.budget} forecast={root.forecast}
                plannedMonth={root.plannedMonth} plannedPeriod={root.plannedPeriod}
                realized={root.realized} projected={root.projected}
                hasChildren isExpanded={true} onToggle={undefined}
              />

              {/* ── Regionais ── */}
              {root.regionals.map(reg => {
                const regExp = expandedRegionals.has(reg.name);
                return (
                  <React.Fragment key={reg.name}>
                    <TableRow
                      id={reg.name} name={reg.name} level="regional"
                      budget={reg.budget} forecast={reg.forecast}
                      plannedMonth={reg.plannedMonth} plannedPeriod={reg.plannedPeriod}
                      realized={reg.realized} projected={reg.projected}
                      hasChildren={reg.projects.length > 0}
                      isExpanded={regExp}
                      onToggle={() => toggle(expandedRegionals, reg.name, setExpandedRegionals)}
                    />

                    {/* ── Projetos ── */}
                    {regExp && reg.projects.map(proj => {
                      const projExp = expandedProjects.has(proj.id);
                      return (
                        <React.Fragment key={proj.id}>
                          <TableRow
                            id={proj.id} name={proj.name} level="project"
                            budget={proj.budget} forecast={proj.forecast}
                            plannedMonth={proj.plannedMonth} plannedPeriod={proj.plannedPeriod}
                            realized={proj.realized} projected={proj.projected}
                            hasChildren={proj.teams.length > 0}
                            isExpanded={projExp}
                            onToggle={proj.teams.length > 0
                              ? () => toggle(expandedProjects, proj.id, setExpandedProjects)
                              : undefined}
                          />

                          {/* ── Equipes ── */}
                          {projExp && proj.teams.map(team => (
                            <TableRow
                              key={team.id} id={team.id} name={team.name} level="team"
                              budget={team.budget} forecast={team.forecast}
                              plannedMonth={team.plannedMonth} plannedPeriod={team.plannedPeriod}
                              realized={team.realized} projected={team.projected}
                              hasChildren={false} isExpanded={false}
                            />
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Legenda ── */}
        <div className="px-6 py-3 border-t border-white/5 bg-slate-900/40 flex flex-wrap gap-6 items-center text-[10px] text-slate-500 uppercase tracking-widest">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-emerald-600/80 inline-block" />
            Acima do planejado
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-red-600/80 inline-block" />
            Abaixo do planejado
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-amber-400/60 inline-block" />
            Planejado mês em andamento
          </span>
          <span className="ml-auto normal-case text-slate-600 text-[10px]">
            Clique nas linhas para expandir / colapsar
          </span>
        </div>
      </div>
    </div>
  );
};

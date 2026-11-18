/**
 * Resumos exibidos nas listas da aba "Minhas Obras" (obras, turmas e RDOs).
 * Funções puras: a tela só formata o que sai daqui.
 */
import { Project, RDOData, Team } from '../types';
import { calculateRDOTotal, parseDate } from '../utils';

/** Dias sem RDO a partir dos quais a obra/turma é destacada como desatualizada. */
export const STALE_AFTER_DAYS = 7;

/** "3044.02 - CW64111" → { code: "3044.02", detail: "CW64111" }. Sem " - ", tudo vai em code. */
export const splitProjectName = (name: string): { code: string; detail: string } => {
  const idx = name.indexOf(' - ');
  if (idx < 0) return { code: name.trim(), detail: '' };
  return { code: name.slice(0, idx).trim(), detail: name.slice(idx + 3).trim() };
};

const validTime = (rdo: RDOData): number => {
  const t = parseDate(rdo.date ?? '').getTime();
  return Number.isFinite(t) ? t : NaN;
};

/** Data (DD/MM/AAAA) do RDO mais recente e quantos dias se passaram até `today`. */
export const lastRdoInfo = (rdos: RDOData[], today: Date = new Date()) => {
  let last: RDOData | undefined;
  let lastTime = -Infinity;
  for (const rdo of rdos) {
    const t = validTime(rdo);
    if (t > lastTime) {
      lastTime = t;
      last = rdo;
    }
  }
  if (!last) return { lastDate: null as string | null, daysSince: null as number | null };
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return { lastDate: last.date, daysSince: Math.max(0, Math.round((startOfToday - lastTime) / 86_400_000)) };
};

export interface ProjectSummary {
  project: Project;
  code: string;
  detail: string;
  teamCount: number;
  rdoCount: number;
  serviceCount: number;
  lastDate: string | null;
  daysSince: number | null;
}

export const summarizeProjects = (
  projects: Project[],
  teams: Team[],
  rdos: RDOData[],
  today: Date = new Date()
): ProjectSummary[] => {
  const projectByTeam = new Map(teams.map((t) => [t.id, t.projectId]));
  const rdosByProject = new Map<string, RDOData[]>();
  for (const rdo of rdos) {
    const projectId = projectByTeam.get(rdo.teamId) ?? rdo.projectId;
    if (!projectId) continue;
    const list = rdosByProject.get(projectId) ?? [];
    list.push(rdo);
    rdosByProject.set(projectId, list);
  }

  return projects
    .map((project) => {
      const projectRdos = rdosByProject.get(project.id) ?? [];
      return {
        project,
        ...splitProjectName(project.name),
        teamCount: teams.filter((t) => t.projectId === project.id).length,
        rdoCount: projectRdos.length,
        serviceCount: project.services?.length ?? 0,
        ...lastRdoInfo(projectRdos, today),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));
};

export interface TeamSummary {
  team: Team;
  rdoCount: number;
  firstDate: string | null;
  lastDate: string | null;
  daysSince: number | null;
  production: number;
}

export const summarizeTeams = (
  project: Project | null,
  teams: Team[],
  rdos: RDOData[],
  today: Date = new Date()
): TeamSummary[] => {
  if (!project) return [];
  return teams
    .filter((t) => t.projectId === project.id)
    .map((team) => {
      const teamRdos = rdos.filter((r) => r.teamId === team.id);
      const times = teamRdos.map(validTime).filter(Number.isFinite);
      const first = times.length ? teamRdos[times.indexOf(Math.min(...times))] : undefined;
      return {
        team,
        rdoCount: teamRdos.length,
        firstDate: first?.date ?? null,
        ...lastRdoInfo(teamRdos, today),
        production: teamRdos.reduce((sum, r) => sum + calculateRDOTotal(r, project), 0),
      };
    })
    .sort((a, b) => a.team.name.localeCompare(b.team.name, 'pt-BR', { numeric: true }));
};

/** Atividades que a leitura por IA deixou para conferir (status "Revisar"). */
export const pendingReviewCount = (rdo: RDOData): number =>
  rdo.activities?.filter((a) => a.status === 'Revisar').length ?? 0;

/** Efetivo do dia: soma das pessoas na mão de obra. */
export const headcount = (rdo: RDOData): number =>
  rdo.workforce?.reduce((sum, w) => sum + (w.count || 0), 0) ?? 0;

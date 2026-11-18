import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Project, Team, RDOData } from '../types';
import { splitProjectName } from '../utils/projectSummary';

interface BreadcrumbsProps {
  activeMenu: string;
  currentView: string;
  selectedProject: Project | null;
  selectedTeam: Team | null;
  currentRDO: RDOData | null;
  onNavigateToProjects: () => void;
  onNavigateToTeams: () => void;
  onNavigateToRDOs: () => void;
}

interface Crumb {
  label: string;
  onClick?: () => void;
}

/** Caminho da navegação: Obras / obra / turma / RDO. O último item é a página atual. */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  activeMenu, currentView, selectedProject, selectedTeam, currentRDO,
  onNavigateToProjects, onNavigateToTeams, onNavigateToRDOs
}) => {
  if (activeMenu === 'DASHBOARD') return null;

  const crumbs: Crumb[] = [{ label: 'Obras', onClick: onNavigateToProjects }];
  if (selectedProject) crumbs.push({ label: splitProjectName(selectedProject.name).code, onClick: onNavigateToTeams });
  if (selectedTeam) crumbs.push({ label: selectedTeam.name, onClick: onNavigateToRDOs });
  if (currentRDO) crumbs.push({ label: `RDO nº ${currentRDO.reportNumber ?? ''}` });
  if (currentView === 'UPLOAD_ANALYSIS' && !currentRDO) crumbs.push({ label: 'Importar RDOs' });

  // Na lista de obras não há para onde voltar: o caminho só aparece dentro de uma obra.
  if (crumbs.length === 1) return null;

  return (
    <nav aria-label="Caminho" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={`${crumb.label}_${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />}
              {isLast || !crumb.onClick ? (
                <span aria-current={isLast ? 'page' : undefined} className="font-medium text-slate-900">{crumb.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={crumb.onClick}
                  className="rounded text-slate-500 transition hover:text-[#0b1d4f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1d4f]/30"
                >
                  {crumb.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

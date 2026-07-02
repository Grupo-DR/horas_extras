import React from 'react';
import { ChevronRight, Building2, Users, Home } from 'lucide-react';
import { Project, Team, RDOData } from '../types';

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

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ 
  activeMenu, 
  currentView, 
  selectedProject, 
  selectedTeam, 
  currentRDO,
  onNavigateToProjects,
  onNavigateToTeams,
  onNavigateToRDOs
}) => {
  if (activeMenu === 'DASHBOARD') return null;

  return (
    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-8 overflow-x-auto whitespace-nowrap py-2 px-1 relative z-20">
      <button 
        onClick={onNavigateToProjects}
        className={`hover:text-blue-400 flex items-center gap-2 transition-all group ${currentView === 'PROJECT_LIST' ? 'text-blue-400' : ''}`}
      >
        <Building2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
        OBRAS
      </button>
      
      {selectedProject && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-700" />
          <button 
            onClick={onNavigateToTeams}
            className={`hover:text-blue-400 transition-all ${currentView === 'TEAMS_LIST' ? 'text-blue-400' : ''}`}
          >
            {selectedProject.name}
          </button>
        </>
      )}

      {selectedTeam && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-700" />
          <button 
             onClick={onNavigateToRDOs}
             className={`flex items-center gap-2 hover:text-blue-400 transition-all ${currentView === 'RDO_LIST' && !currentRDO ? 'text-blue-400' : ''}`}
          >
            <Users className="w-3.5 h-3.5" />
            {selectedTeam.name}
          </button>
        </>
      )}

      {currentRDO && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-700" />
          <span className="text-white font-black tracking-tighter">RDO #{currentRDO.reportNumber}</span>
        </>
      )}
    </div>
  );
};

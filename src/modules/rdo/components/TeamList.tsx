import React from 'react';
import { Users, Plus, Edit, Trash2, ArrowRight } from 'lucide-react';
import { Team, RDOData, Project } from '../types';

interface TeamListProps {
  teams: Team[];
  rdos: RDOData[];
  selectedProject: Project | null;
  onSelectTeam: (team: Team) => void;
  onEditTeam: (team: Team) => void;
  onDeleteTeam: (id: string, e: React.MouseEvent) => void;
  onCreateTeam: () => void;
}

export const TeamList: React.FC<TeamListProps> = ({ 
  teams, 
  rdos, 
  selectedProject, 
  onSelectTeam, 
  onEditTeam, 
  onDeleteTeam, 
  onCreateTeam 
}) => {
  const projectTeams = teams.filter(t => t.projectId === selectedProject?.id);

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Turmas e Equipes</h2>
          <p className="text-slate-400 text-sm mt-1">
            Gerencie as frentes de trabalho para a obra <span className="text-emerald-400 font-semibold">{selectedProject?.name}</span>
          </p>
        </div>
        <button 
          onClick={onCreateTeam}
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-emerald-500 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-900/20 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          <span className="font-semibold text-sm">Nova Turma</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projectTeams.map(team => {
          const teamRdos = rdos.filter(r => r.teamId === team.id);

          return (
            <div 
              key={team.id}
              onClick={() => onSelectTeam(team)}
              className="glass-card p-8 rounded-[32px] border border-white/5 hover:border-emerald-500/30 cursor-pointer transition-all duration-500 group relative overflow-hidden flex flex-col"
            >
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-40 h-40 bg-emerald-600/10 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              
              <div className="flex justify-between items-start relative z-10">
                <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all duration-500 shadow-inner">
                  <Users className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEditTeam(team); }}
                    className="p-2.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                  >
                    <Edit className="w-4.5 h-4.5" />
                  </button>
                  <button 
                     onClick={(e) => onDeleteTeam(team.id, e)}
                     className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              <div className="mt-8 relative z-10">
                <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{team.name}</h3>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">
                    <span className="text-slate-300 font-bold">{teamRdos.length}</span> RDOs registrados
                  </p>
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                    ACESSAR <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Progress indicator (just aesthetic) */}
              <div className="mt-8 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[60%] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
            </div>
          );
        })}

        {projectTeams.length === 0 && (
          <div className="col-span-full py-20 glass-panel rounded-[40px] border border-dashed border-white/10 flex flex-col items-center justify-center text-center px-6">
             <div className="bg-white/5 p-6 rounded-full mb-6">
                <Users className="w-12 h-12 text-slate-600 opacity-30" />
             </div>
             <h4 className="text-xl font-bold text-white mb-2">Nenhuma Turma</h4>
             <p className="text-slate-500 max-w-xs">Não há turmas ou equipes cadastradas para esta obra ainda.</p>
             <button 
                onClick={onCreateTeam}
                className="mt-8 text-emerald-400 font-bold flex items-center gap-2 hover:gap-3 transition-all underline decoration-emerald-500/30 underline-offset-8"
              >
                Cadastrar primeira turma
                <Plus className="w-4 h-4" />
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

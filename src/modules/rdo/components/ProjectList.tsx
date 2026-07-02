import React from 'react';
import { Building2, Plus, Edit, Trash2, FolderOpen } from 'lucide-react';
import { Project, Team } from '../types';

interface ProjectListProps {
  projects: Project[];
  teams: Team[];
  onSelectProject: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
  onCreateProject: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ 
  projects, 
  teams, 
  onSelectProject, 
  onEditProject, 
  onDeleteProject, 
  onCreateProject 
}) => {
  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Gerenciamento de Obras</h2>
          <p className="text-slate-400 text-sm mt-1">Visualize e gerencie todos os projetos ativos da transportadora.</p>
        </div>
        <button 
          onClick={onCreateProject}
          className="bg-gradient-premium text-white px-6 py-3 rounded-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-600/20 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          <span className="font-semibold text-sm">Nova Obra</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(proj => {
          const teamCount = teams.filter(t => t.projectId === proj.id).length;
          const serviceCount = proj.services?.length || 0;

          return (
            <div 
              key={proj.id}
              onClick={() => onSelectProject(proj)}
              className="glass-card p-8 rounded-[32px] border border-white/5 hover:border-blue-500/30 cursor-pointer transition-all duration-500 group relative overflow-hidden flex flex-col h-full"
            >
              {/* Background Glow */}
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-40 h-40 bg-blue-600/10 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              
              <div className="flex justify-between items-start relative z-10">
                <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 group-hover:bg-blue-500/20 group-hover:scale-110 transition-all duration-500 shadow-inner">
                  <Building2 className="w-7 h-7 text-blue-400" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEditProject(proj); }}
                    className="p-2.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                    title="Editar"
                  >
                    <Edit className="w-4.5 h-4.5" />
                  </button>
                  <button 
                     onClick={(e) => onDeleteProject(proj.id, e)}
                     className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                     title="Excluir"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              <div className="mt-8 flex-1 relative z-10">
                <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">{proj.name}</h3>
                
                <div className="mt-6 flex flex-col gap-3">
                   <div className="flex items-center gap-3 text-slate-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                      <span className="text-sm font-medium">{teamCount} Turmas Operativas</span>
                   </div>
                   <div className="flex items-center gap-3 text-slate-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                      <span className="text-sm font-medium">{serviceCount} Serviços Mapeados</span>
                   </div>
                </div>

                {proj.regional && (
                  <div className="mt-8 flex items-center justify-between">
                    <span className="px-3 py-1.5 bg-white/5 text-blue-400 text-[10px] font-extrabold uppercase tracking-widest rounded-full border border-white/5 backdrop-blur-md">
                      {proj.regional}
                    </span>
                    <FolderOpen className="w-4 h-4 text-slate-600 group-hover:text-blue-500/50 transition-colors" />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="col-span-full py-20 glass-panel rounded-[40px] border border-dashed border-white/10 flex flex-col items-center justify-center text-center px-6">
             <div className="bg-white/5 p-6 rounded-full mb-6">
                <Building2 className="w-12 h-12 text-slate-600 opacity-30" />
             </div>
             <h4 className="text-xl font-bold text-white mb-2">Início de Atividades</h4>
             <p className="text-slate-500 max-w-xs">Ainda não existem obras configuradas. Comece criando seu primeiro projeto.</p>
             <button 
                onClick={onCreateProject}
                className="mt-8 text-blue-400 font-bold flex items-center gap-2 hover:gap-3 transition-all underline decoration-blue-500/30 underline-offset-8"
              >
                Adicionar minha primeira obra
                <Plus className="w-4 h-4" />
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

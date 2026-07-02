import React from 'react';
import { Loader2, Layers, AlertTriangle } from 'lucide-react';
import { useProjectStore, useProjectActions, useSelectedProject } from '../../../stores/projectStore';
import { useTeamStore, useTeamActions, useSelectedTeam } from '../../../stores/teamStore';
import { useRdoStore, useRdoActions, useCurrentRdo, useUploadProgress } from '../../../stores/rdoStore';
import { useUiStore, useUiActions } from '../../../stores/uiStore';

import { Breadcrumbs } from '../../../../components/Breadcrumbs';
import { RDODetail } from '../../../../components/RDODetail';
import { ProjectList } from '../../../../components/ProjectList';
import { ProjectServices } from '../../../../components/ProjectServices';
import { TeamList } from '../../../../components/TeamList';
import { RDOList } from '../../../../components/RDOList';

export const ProjectsPage: React.FC = () => {
  const projects = useProjectStore((state) => state.projects);
  const selectedProject = useSelectedProject();
  const teams = useTeamStore((state) => state.teams);
  const selectedTeam = useSelectedTeam();
  const rdos = useRdoStore((state) => state.rdos);
  const currentRDO = useCurrentRdo();
  const uploadProgress = useUploadProgress();

  const {
    activeMenu,
    currentView,
    projectTab,
    loading,
    error
  } = useUiState();

  const {
    setCurrentView,
    setProjectTab,
    openCreateModal,
    openEditModal,
    setLoading,
    setError
  } = useUiActions();

  const { setSelectedProject, deleteProject, handleServicesUpload } = useProjectActions();
  const { setSelectedTeam, deleteTeam } = useTeamActions();
  const { setCurrentRDO, deleteRdo, saveRdo, handleFileUpload, exportToCSV } = useRdoActions();

  // Navigation handlers
  const handleSelectProject = (project: any) => {
    setSelectedProject(project);
    setProjectTab('TEAMS');
    setCurrentView('TEAMS_LIST');
    setCurrentRDO(null);
  };

  const handleSelectTeam = (team: any) => {
    setSelectedTeam(team);
    setCurrentView('RDO_LIST');
    setCurrentRDO(null);
  };

  const handleServicesUploadWrapper = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await handleServicesUpload(file);
      alert('Serviços importados com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao importar serviços. Verifique o formato.');
    }
  };

  const handleFileUploadWrapper = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedTeam) return;

    setLoading(true);
    setError(null);
    try {
      const newRdos = await handleFileUpload(files, selectedTeam.id);
      if (newRdos && newRdos.length === 1) {
        setCurrentRDO(newRdos[0]);
      } else if (newRdos && newRdos.length > 1) {
        alert(`${newRdos.length} relatórios processados com sucesso!`);
        setCurrentView('RDO_LIST');
      }
    } catch (err) {
      console.error(err);
      setError("Falha ao processar um ou mais RDOs. Verifique se as imagens estão nítidas.");
    } finally {
      setLoading(false);
    }
  };

  const deleteRDOWrapper = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir este relatório?")) return;
    try {
      await deleteRdo(id);
    } catch (err) {
      alert("Erro ao excluir RDO.");
    }
  };

  const handleDeleteProjectWrapper = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza? Isso apagará todas as turmas e RDOs associados.")) return;
    try {
      // Cascading deletion
      const relatedTeams = teams.filter(t => t.projectId === id);
      for (const team of relatedTeams) {
        await deleteTeam(team.id);
      }
      await deleteProject(id);
    } catch (err) {
      alert("Erro ao excluir projeto.");
    }
  };

  const handleDeleteTeamWrapper = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza? Isso apagará todos os RDOs desta turma.")) return;
    try {
      await deleteTeam(id);
    } catch (err) {
      alert("Erro ao excluir equipe.");
    }
  };

  return (
    <>
      <Breadcrumbs 
        activeMenu={activeMenu}
        currentView={currentView}
        selectedProject={selectedProject}
        selectedTeam={selectedTeam}
        currentRDO={currentRDO}
        onNavigateToProjects={() => { setCurrentView('PROJECT_LIST'); setSelectedProject(null); setSelectedTeam(null); setCurrentRDO(null); }}
        onNavigateToTeams={() => { setCurrentView('TEAMS_LIST'); setSelectedTeam(null); setCurrentRDO(null); }}
        onNavigateToRDOs={() => { setCurrentView('RDO_LIST'); setCurrentRDO(null); }}
      />

      {currentRDO ? (
        <RDODetail 
          currentRDO={currentRDO}
          selectedProject={selectedProject}
          selectedTeam={selectedTeam}
          onClose={() => setCurrentRDO(null)}
          onExportCSV={(data) => exportToCSV(data, selectedProject?.name || '', selectedTeam?.name || '')}
          onDeleteRDO={deleteRDOWrapper}
          onSaveUpdatedRdo={saveRdo}
        />
      ) : (
        <>
          {currentView === 'PROJECT_LIST' && (
            <ProjectList 
              projects={projects}
              teams={teams}
              onSelectProject={handleSelectProject}
              onEditProject={(p) => openEditModal(p, 'PROJECT')}
              onDeleteProject={handleDeleteProjectWrapper}
              onCreateProject={openCreateModal}
            />
          )}

          {currentView === 'TEAMS_LIST' && (
            <>
              <ProjectServices 
                selectedProject={selectedProject}
                projectTab={projectTab}
                onSetTab={setProjectTab}
                onServicesUpload={handleServicesUploadWrapper}
              />
              {projectTab === 'TEAMS' && (
                <TeamList 
                  teams={teams}
                  rdos={rdos}
                  selectedProject={selectedProject}
                  onSelectTeam={handleSelectTeam}
                  onEditTeam={(t) => openEditModal(t, 'TEAM')}
                  onDeleteTeam={handleDeleteTeamWrapper}
                  onCreateTeam={openCreateModal}
                />
              )}
            </>
          )}

          {currentView === 'RDO_LIST' && (
            <RDOList 
              rdos={rdos}
              selectedTeam={selectedTeam}
              selectedProject={selectedProject}
              onSelectRDO={setCurrentRDO}
              onExportCSV={(data) => exportToCSV(data, selectedProject?.name || '', selectedTeam?.name || '')}
              onDeleteRDO={deleteRDOWrapper}
              onUploadNew={() => setCurrentView('UPLOAD_ANALYSIS')}
            />
          )}

          {currentView === 'UPLOAD_ANALYSIS' && (
            <div className="max-w-2xl mx-auto mt-8 animate-fade-in text-center">
              <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Análise Inteligente</h2>
              <p className="text-slate-400 mb-8 font-medium">
                Importando novos RDOs para <span className="text-blue-400">{selectedTeam?.name}</span>
              </p>

              <div className="relative group">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUploadWrapper}
                  disabled={loading}
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                <div className={`glass-panel border-2 border-dashed rounded-[40px] p-16 transition-all duration-500 ${loading ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 hover:border-blue-500/50 hover:bg-white/5 shadow-2xl'}`}>
                  <div className="flex flex-col items-center justify-center gap-6">
                    {loading ? (
                      <>
                        <div className="relative">
                          <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-pulse" />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-center">
                          <div className="text-white font-black text-xl tracking-tight">Extraindo Dados...</div>
                          <div className="text-blue-400 font-bold text-sm tracking-widest uppercase">{uploadProgress.current} DE {uploadProgress.total} COMPLETOS</div>
                          <div className="w-64 h-2 bg-white/5 rounded-full mt-4 overflow-hidden border border-white/5 shadow-inner">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]" 
                              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-8 bg-blue-500/10 rounded-full border border-blue-500/20 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-500 shadow-2xl">
                          <Layers className="w-12 h-12 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-white tracking-tight">Arraste seus relatórios aqui</p>
                          <p className="text-slate-500 font-medium mt-2">Suporta PDF e imagens em alta resolução</p>
                          <div className="mt-8 px-6 py-2 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] rounded-full border border-blue-500/10 inline-block">
                            Processamento Seguro via Gemini AI
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {error && (
                <div className="mt-8 p-6 bg-red-500/10 border border-red-500/25 text-red-400 rounded-3xl text-sm font-bold flex items-center gap-4 animate-shake">
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
};

// UI helper
import { useUiState } from '../../../stores/uiStore';

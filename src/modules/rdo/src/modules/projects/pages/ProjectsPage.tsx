import React from 'react';
import { Loader2, Upload, AlertTriangle } from 'lucide-react';
import { useProjectStore, useProjectActions, useSelectedProject } from '../../../stores/projectStore';
import { useTeamStore, useTeamActions, useSelectedTeam } from '../../../stores/teamStore';
import { useRdoStore, useRdoActions, useCurrentRdo, useUploadProgress } from '../../../stores/rdoStore';
import { useUiActions, useUiState } from '../../../stores/uiStore';
import { rdoModelLabel } from '../../../../services/rdoModels';
import { Button, PageHeader } from '../../../../components/ui';

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
      const result = await handleFileUpload(files, selectedTeam.id, selectedProject);
      const newRdos = result?.saved ?? [];
      if (result?.skipped.length) {
        alert(`Já existiam e não foram gravados de novo:\n${result.skipped.join('\n')}`);
      }
      const toReview = newRdos.reduce((n, r) => n + (r.vale?.atividades.filter(a => a.revisar).length ?? 0), 0);
      if (toReview > 0) {
        alert(`${toReview} atividade(s) ficaram com código de serviço ou quantidade a conferir. Abra o RDO e use "Editar" para corrigir.`);
      }
      if (newRdos.length === 1) {
        setCurrentRDO(newRdos[0]);
      } else if (newRdos.length > 1) {
        alert(`${newRdos.length} relatórios processados com sucesso!`);
        setCurrentView('RDO_LIST');
      }
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : '';
      setError(`Falha ao processar um ou mais RDOs. ${detail || 'Verifique se as imagens estão nítidas.'}`);
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
              rdos={rdos}
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
                teamCount={teams.filter(t => t.projectId === selectedProject?.id).length}
                onSetTab={setProjectTab}
                onServicesUpload={handleServicesUploadWrapper}
                onEditProject={(p) => openEditModal(p, 'PROJECT')}
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
            <div className="mx-auto max-w-2xl">
              <PageHeader
                title="Importar RDOs"
                subtitle={<>Turma {selectedTeam?.name} · modelo {rdoModelLabel(selectedProject?.rdoModel)}</>}
                actions={<Button onClick={() => setCurrentView('RDO_LIST')} disabled={loading}>Voltar</Button>}
              />

              <label
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white px-6 py-12 text-center transition ${
                  loading ? 'cursor-wait border-[#0b1d4f]/40' : 'cursor-pointer border-slate-300 hover:border-[#0b1d4f] hover:bg-slate-50'
                }`}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUploadWrapper}
                  disabled={loading}
                  multiple
                  className="sr-only"
                />
                {loading ? (
                  <div className="w-full max-w-xs" role="status" aria-live="polite">
                    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#0b1d4f]" />
                    <p className="text-sm font-semibold text-slate-900">
                      Lendo RDO {uploadProgress.current} de {uploadProgress.total}…
                    </p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#0b1d4f] transition-all duration-500"
                        style={{ width: `${uploadProgress.total ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Cada arquivo leva de 20 a 60 segundos. Não feche a página.</p>
                  </div>
                ) : (
                  <>
                    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-[#0b1d4f]">
                      <Upload className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <p className="text-sm font-semibold text-slate-900">Clique para selecionar ou arraste os arquivos</p>
                    <p className="mt-1 text-xs text-slate-500">PDF ou imagem, até 7 MB cada. Vários arquivos de uma vez.</p>
                  </>
                )}
              </label>

              <p className="mt-3 text-xs text-slate-500">
                A IA lê cada documento e grava o RDO na turma. RDOs já existentes (mesma data e número) são ignorados,
                e atividades com código ou quantidade incertos ficam marcadas para revisão.
              </p>

              {error && (
                <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
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


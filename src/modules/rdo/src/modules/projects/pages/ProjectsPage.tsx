import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, AlertTriangle } from 'lucide-react';
import { useProjectStore, useProjectActions, useSelectedProject } from '../../../stores/projectStore';
import { useTeamStore, useTeamActions, useSelectedTeam } from '../../../stores/teamStore';
import { useRdoStore, useRdoActions, useCurrentRdo, useUploadProgress, UploadResult } from '../../../stores/rdoStore';
import { useUiActions, useUiState } from '../../../stores/uiStore';
import { rdoModelLabel } from '../../../../services/rdoModels';
import { Badge, Button, PageHeader } from '../../../../components/ui';

import { Breadcrumbs } from '../../../../components/Breadcrumbs';
import { RDODetail } from '../../../../components/RDODetail';
import { ProjectList } from '../../../../components/ProjectList';
import { ProjectServices } from '../../../../components/ProjectServices';
import { TeamList } from '../../../../components/TeamList';
import { ProjectCalendar } from '../../../../components/ProjectCalendar';
import { AccommodationsTab } from '../../../../components/AccommodationsTab';
import { EquipmentTab } from '../../../../components/EquipmentTab';
import { CostItemsTab } from '../../../../components/CostItemsTab';
import { RDOList } from '../../../../components/RDOList';

export const ProjectsPage: React.FC = () => {
  const projects = useProjectStore((state) => state.projects);
  const selectedProject = useSelectedProject();
  const teams = useTeamStore((state) => state.teams);
  const selectedTeam = useSelectedTeam();
  const rdos = useRdoStore((state) => state.rdos);
  const currentRDO = useCurrentRdo();
  const uploadProgress = useUploadProgress();
  const [uploadReport, setUploadReport] = useState<UploadResult | null>(null);

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

  const { setSelectedProject, deleteProject, handleServicesUpload, saveAccommodations, saveEquipmentAssets, saveCostItems } = useProjectActions();
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
      toast.success('Tabela de preços importada.');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? `Erro ao importar a tabela: ${e.message}` : 'Erro ao importar a tabela. Verifique o formato.');
    }
  };

  const handleFileUploadWrapper = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedTeam) return;

    setLoading(true);
    setError(null);
    setUploadReport(null);
    try {
      const result = await handleFileUpload(files, selectedTeam.id, selectedProject);
      if (!result) return;
      const { saved, skipped, failed } = result;
      if (failed.length > 0 || skipped.length > 0) {
        // Algo precisa de atenção: fica nesta tela mostrando o resumo do lote.
        setUploadReport(result);
      } else if (saved.length === 1) {
        setCurrentRDO(saved[0]);
      } else {
        toast.success(`${saved.length} RDOs importados.`);
        setCurrentView('RDO_LIST');
      }
      const toReview = saved.reduce((n, r) => n + (r.vale?.atividades.filter(a => a.revisar).length ?? 0), 0);
      if (toReview > 0) toast.warning(`${toReview} atividade(s) a revisar: abra o RDO e use "Editar" para conferir.`);
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
              {projectTab === 'LODGING' && selectedProject && (
                <AccommodationsTab project={selectedProject} onSave={saveAccommodations} />
              )}
              {projectTab === 'EQUIPMENT' && selectedProject && (
                <EquipmentTab project={selectedProject} teams={teams} rdos={rdos} onSave={saveEquipmentAssets} />
              )}
              {(projectTab === 'ADM_LOCAL' || projectTab === 'CANTEIRO' || projectTab === 'FRENTE_AVANCADA') && selectedProject && (
                <CostItemsTab key={projectTab} project={selectedProject} category={projectTab} onSave={saveCostItems} />
              )}
              {projectTab === 'TEAMS' && (
                teams.some(t => t.projectId === selectedProject?.id) ? (
                  <div className="grid items-start gap-5 xl:grid-cols-[minmax(420px,1fr)_minmax(0,1.35fr)]">
                    <div className="min-w-0">
                      <TeamList
                        compact
                        teams={teams}
                        rdos={rdos}
                        selectedProject={selectedProject}
                        onSelectTeam={handleSelectTeam}
                        onEditTeam={(t) => openEditModal(t, 'TEAM')}
                        onDeleteTeam={handleDeleteTeamWrapper}
                        onCreateTeam={openCreateModal}
                      />
                    </div>
                    <ProjectCalendar
                      project={selectedProject}
                      teams={teams}
                      rdos={rdos}
                      onOpenRdo={(rdo, team) => { setSelectedTeam(team); setCurrentView('RDO_LIST'); setCurrentRDO(rdo); }}
                    />
                  </div>
                ) : (
                  <TeamList
                    teams={teams}
                    rdos={rdos}
                    selectedProject={selectedProject}
                    onSelectTeam={handleSelectTeam}
                    onEditTeam={(t) => openEditModal(t, 'TEAM')}
                    onDeleteTeam={handleDeleteTeamWrapper}
                    onCreateTeam={openCreateModal}
                  />
                )
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

              {uploadReport && (
                <UploadReportPanel report={uploadReport} onOpenList={() => { setUploadReport(null); setCurrentView('RDO_LIST'); }} />
              )}

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

/** Resumo do envio em lote: gravados, já existentes e falhas (com o motivo de cada arquivo). */
const UploadReportPanel: React.FC<{ report: UploadResult; onOpenList: () => void }> = ({ report, onOpenList }) => (
  <div className="mt-4 rounded-xl border border-slate-200 bg-white" role="status">
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
      <span className="text-sm font-semibold text-slate-900">Resultado do envio</span>
      <Badge tone="success">{report.saved.length} importado(s)</Badge>
      {report.skipped.length > 0 && <Badge>{report.skipped.length} já existia(m)</Badge>}
      {report.failed.length > 0 && <Badge tone="danger">{report.failed.length} com falha</Badge>}
      {report.saved.length > 0 && (
        <Button className="ml-auto" onClick={onOpenList}>Ver RDOs da turma</Button>
      )}
    </div>
    <ul className="divide-y divide-slate-100 text-sm">
      {report.failed.map(f => (
        <li key={`f_${f.file}`} className="px-4 py-2.5">
          <span className="font-medium text-rose-700">{f.file}</span>
          <span className="block text-xs text-slate-500">{f.message}</span>
        </li>
      ))}
      {report.skipped.map(name => (
        <li key={`s_${name}`} className="px-4 py-2.5 text-slate-600">
          {name} <span className="text-xs text-slate-400">· já estava gravado</span>
        </li>
      ))}
    </ul>
    {report.failed.length > 0 && (
      <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
        Envie de novo só os arquivos com falha; os já importados são reconhecidos e ignorados.
      </p>
    )}
  </div>
);

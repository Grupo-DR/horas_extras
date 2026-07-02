import React from 'react';
import { useProjectStore, useProjectActions, useSelectedProject } from '../../../stores/projectStore';
import { useTeamStore, useTeamActions } from '../../../stores/teamStore';
import { useRdoStore, useRdoActions } from '../../../stores/rdoStore';
import { useUiActions } from '../../../stores/uiStore';
import CoreContractIntelligencePage from '../../../../components/ContractIntelligence/ContractIntelligencePage';

export const ContractIntelligencePage: React.FC = () => {
  const projects = useProjectStore((state) => state.projects);
  const selectedProject = useSelectedProject();
  const teams = useTeamStore((state) => state.teams);
  const rdos = useRdoStore((state) => state.rdos);
  const { setSelectedProject } = useProjectActions();

  const { setActiveMenu, setCurrentView } = useUiActions();
  const { setSelectedTeam } = useTeamActions();
  const { setCurrentRDO } = useRdoActions();

  const handleNavigateToRDO = (rdoId: string, teamId: string) => {
    const rdo = rdos.find((r) => r.id === rdoId);
    const team = teams.find((t) => t.id === teamId);
    
    if (rdo && team) {
      setSelectedTeam(team);
      setCurrentRDO(rdo);
      setCurrentView('RDO_LIST');
      setActiveMenu('PROJECTS');
    }
  };

  return (
    <CoreContractIntelligencePage
      projects={projects}
      teams={teams}
      rdos={rdos}
      selectedProject={selectedProject}
      onSelectProject={setSelectedProject}
      onNavigateToRDO={handleNavigateToRDO}
    />
  );
};

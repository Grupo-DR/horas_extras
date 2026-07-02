import React from 'react';
import { useProjectStore } from '../../../stores/projectStore';
import { useTeamStore, useTeamActions } from '../../../stores/teamStore';
import { useDailyPlans, useContractDataMap, usePlanningActions } from '../../../stores/planningStore';
import { PlanningTab } from '../../../../components/PlanningTab';

export const PlanningPage: React.FC = () => {
  const projects = useProjectStore((state) => state.projects);
  const teams = useTeamStore((state) => state.teams);
  const dailyPlans = useDailyPlans();
  const contractDataMap = useContractDataMap();
  
  const { updateTeam } = useTeamActions();
  const { saveDailyPlans, saveContractData } = usePlanningActions();

  return (
    <PlanningTab
      projects={projects}
      teams={teams}
      dailyPlans={dailyPlans}
      onSave={saveDailyPlans}
      contractDataMap={contractDataMap}
      onSaveContractData={saveContractData}
      onUpdateTeam={updateTeam}
    />
  );
};

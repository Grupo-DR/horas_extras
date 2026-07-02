import { create } from 'zustand';
import { Team } from '../../types';
import { FirestoreTeamRepository } from '../repositories/FirestoreTeamRepository';
import { generateUUID } from '../../utils';

const teamRepo = new FirestoreTeamRepository();

interface TeamState {
  teams: Team[];
  selectedTeam: Team | null;
  actions: {
    setTeams: (teams: Team[]) => void;
    setSelectedTeam: (team: Team | null) => void;
    loadTeams: () => Promise<Team[]>;
    saveTeam: (name: string, selectedProjectId: string | undefined, isEditMode: boolean, editingItemId: string | null) => Promise<void>;
    updateTeam: (updatedTeam: Team) => Promise<void>;
    deleteTeam: (id: string) => Promise<void>;
  };
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  selectedTeam: null,
  actions: {
    setTeams: (teams) => set({ teams }),
    setSelectedTeam: (selectedTeam) => set({ selectedTeam }),
    loadTeams: async () => {
      const teamsList = await teamRepo.getAll();
      set({ teams: teamsList });
      return teamsList;
    },
    saveTeam: async (name, selectedProjectId, isEditMode, editingItemId) => {
      const { teams } = get();
      if (!name.trim() || !selectedProjectId) return;

      if (isEditMode && editingItemId) {
        const updatedTeams = teams.map(t =>
          t.id === editingItemId ? {
            ...t,
            name
          } : t
        );
        const teamToUpdate = updatedTeams.find(t => t.id === editingItemId);
        if (teamToUpdate) await teamRepo.update(teamToUpdate);
        set({ teams: updatedTeams });

        const currentSelected = get().selectedTeam;
        if (currentSelected && currentSelected.id === editingItemId && teamToUpdate) {
          set({ selectedTeam: teamToUpdate });
        }
      } else {
        const newTeam: Team = {
          id: generateUUID(),
          projectId: selectedProjectId,
          name,
          createdAt: new Date().toISOString()
        };
        await teamRepo.save(newTeam);
        set({ teams: [newTeam, ...teams] });
      }
    },
    updateTeam: async (updatedTeam) => {
      await teamRepo.update(updatedTeam);
      set({ teams: get().teams.map(t => t.id === updatedTeam.id ? updatedTeam : t) });
      if (get().selectedTeam?.id === updatedTeam.id) {
        set({ selectedTeam: updatedTeam });
      }
    },
    deleteTeam: async (id) => {
      await teamRepo.delete(id);
      set({ teams: get().teams.filter(t => t.id !== id) });
      if (get().selectedTeam?.id === id) {
        set({ selectedTeam: null });
      }
    }
  }
}));

// Selectors
export const useTeamsList = () => useTeamStore((state) => state.teams);
export const useSelectedTeam = () => useTeamStore((state) => state.selectedTeam);
export const useTeamActions = () => useTeamStore((state) => state.actions);

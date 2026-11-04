import { create } from 'zustand';
import { DailyPlan, ContractData } from '../../types';
import { applyDailyPlanChanges, diffDailyPlans, getDailyPlans } from '../../services/dailyPlanService';
import { FirestoreContractRepository } from '../repositories/FirestoreContractRepository';

const contractRepo = new FirestoreContractRepository();

interface PlanningState {
  dailyPlans: DailyPlan[];
  contractDataMap: Record<string, ContractData>;
  actions: {
    setDailyPlans: (plans: DailyPlan[]) => void;
    setContractDataMap: (map: Record<string, ContractData>) => void;
    loadPlanningData: (projects: { id: string }[]) => Promise<void>;
    saveDailyPlans: (updated: DailyPlan[]) => Promise<void>;
    saveContractData: (data: ContractData) => Promise<void>;
  };
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  dailyPlans: [],
  contractDataMap: {},
  actions: {
    setDailyPlans: (dailyPlans) => set({ dailyPlans }),
    setContractDataMap: (contractDataMap) => set({ contractDataMap }),
    loadPlanningData: async (projects) => {
      const [dailyPlansList, contracts] = await Promise.all([getDailyPlans(), contractRepo.getAll()]);
      const projectIds = new Set(projects.map((p) => p.id));
      const cdMap: Record<string, ContractData> = {};
      for (const cd of contracts) {
        if (projectIds.has(cd.projectId)) cdMap[cd.projectId] = cd;
      }
      set({
        dailyPlans: dailyPlansList,
        contractDataMap: cdMap
      });
    },
    /** Grava no banco só o que mudou; o estado só muda se a gravação der certo. */
    saveDailyPlans: async (updated) => {
      await applyDailyPlanChanges(diffDailyPlans(get().dailyPlans, updated));
      set({ dailyPlans: updated });
    },
    saveContractData: async (data) => {
      await contractRepo.save(data);
      set((state) => ({
        contractDataMap: {
          ...state.contractDataMap,
          [data.projectId]: data
        }
      }));
    }
  }
}));

// Selectors
export const useDailyPlans = () => usePlanningStore((state) => state.dailyPlans);
export const useContractDataMap = () => usePlanningStore((state) => state.contractDataMap);
export const usePlanningActions = () => usePlanningStore((state) => state.actions);

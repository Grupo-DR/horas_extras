import { create } from 'zustand';
import { DailyPlan, ContractData } from '../../types';
import { getDailyPlans, saveDailyPlans as dbSaveDailyPlans } from '../../services/dailyPlanService';
import { FirestoreContractRepository } from '../repositories/FirestoreContractRepository';

const contractRepo = new FirestoreContractRepository();

interface PlanningState {
  dailyPlans: DailyPlan[];
  contractDataMap: Record<string, ContractData>;
  actions: {
    setDailyPlans: (plans: DailyPlan[]) => void;
    setContractDataMap: (map: Record<string, ContractData>) => void;
    loadPlanningData: (projects: { id: string }[]) => Promise<void>;
    saveDailyPlans: (updated: DailyPlan[]) => void;
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
      const dailyPlansList = getDailyPlans();
      const cdMap: Record<string, ContractData> = {};
      for (const p of projects) {
        const cd = await contractRepo.getById(p.id);
        if (cd) cdMap[p.id] = cd;
      }
      set({
        dailyPlans: dailyPlansList,
        contractDataMap: cdMap
      });
    },
    saveDailyPlans: (updated) => {
      dbSaveDailyPlans(updated);
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

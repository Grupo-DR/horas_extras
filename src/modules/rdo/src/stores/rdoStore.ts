import { create } from 'zustand';
import { RDOData } from '../../types';
import { FirestoreRDORepository } from '../repositories/FirestoreRDORepository';
import { extractRDOData, fileToBase64 } from '../../services/geminiService';

const rdoRepo = new FirestoreRDORepository();

interface RdoState {
  rdos: RDOData[];
  currentRDO: RDOData | null;
  uploadProgress: { current: number; total: number };
  actions: {
    setRdos: (rdos: RDOData[]) => void;
    setCurrentRDO: (rdo: RDOData | null) => void;
    setUploadProgress: (progress: { current: number; total: number }) => void;
    loadRdos: () => Promise<RDOData[]>;
    saveRdo: (rdo: RDOData) => Promise<void>;
    deleteRdo: (id: string) => Promise<void>;
    handleFileUpload: (files: FileList | null, selectedTeamId: string | undefined) => Promise<RDOData[] | undefined>;
    exportToCSV: (data: RDOData, projectName: string, teamName: string) => void;
  };
}

export const useRdoStore = create<RdoState>((set, get) => ({
  rdos: [],
  currentRDO: null,
  uploadProgress: { current: 0, total: 0 },
  actions: {
    setRdos: (rdos) => set({ rdos }),
    setCurrentRDO: (currentRDO) => set({ currentRDO }),
    setUploadProgress: (uploadProgress) => set({ uploadProgress }),
    loadRdos: async () => {
      const rdosList = await rdoRepo.getAll();
      set({ rdos: rdosList });
      return rdosList;
    },
    saveRdo: async (updatedRdo) => {
      await rdoRepo.update(updatedRdo);
      const updatedRdos = get().rdos.map(r => r.id === updatedRdo.id ? updatedRdo : r);
      set({ rdos: updatedRdos });
      if (get().currentRDO?.id === updatedRdo.id) {
        set({ currentRDO: updatedRdo });
      }
    },
    deleteRdo: async (id) => {
      await rdoRepo.delete(id);
      set({ rdos: get().rdos.filter(r => r.id !== id) });
      if (get().currentRDO?.id === id) {
        set({ currentRDO: null });
      }
    },
    handleFileUpload: async (files, selectedTeamId) => {
      if (!files || files.length === 0 || !selectedTeamId) return;

      set({ uploadProgress: { current: 0, total: files.length } });

      const newRdos: RDOData[] = [];

      try {
        for (let i = 0; i < files.length; i++) {
          set({ uploadProgress: { current: i + 1, total: files.length } });
          const file = files[i];

          const base64 = await fileToBase64(file);
          const data = await extractRDOData(base64, file.type);

          data.teamId = selectedTeamId;
          await rdoRepo.save(data);
          newRdos.push(data);
        }

        const updatedRdos = [...newRdos, ...get().rdos];
        set({ rdos: updatedRdos });
        set({ uploadProgress: { current: 0, total: 0 } });
        return newRdos;
      } catch (err) {
        set({ uploadProgress: { current: 0, total: 0 } });
        throw err;
      }
    },
    exportToCSV: (data, projectName, teamName) => {
      const headers = ["Categoria", "Item", "Valor/Qtd", "Detalhe"];
      const rows = [
        ["Meta", "Obra", projectName, ""],
        ["Meta", "Turma", teamName, ""],
        ["Meta", "Relatório", data.reportNumber, ""],
        ["Meta", "Data", data.date, ""],
        ...data.workforce.map(w => ["Mão de Obra", w.role, w.count, `${w.totalHours}h`]),
        ...data.equipment.map(e => ["Equipamento", e.name, e.count, `${e.hoursOperated}h`]),
        ...data.activities.map(a => ["Atividade", a.description, `${a.progress}%`, a.status]),
      ];

      const csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `RDO_${data.reportNumber}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}));

// Selectors
export const useRdosList = () => useRdoStore((state) => state.rdos);
export const useCurrentRdo = () => useRdoStore((state) => state.currentRDO);
export const useUploadProgress = () => useRdoStore((state) => state.uploadProgress);
export const useRdoActions = () => useRdoStore((state) => state.actions);

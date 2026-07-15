import { create } from 'zustand';
import { SSMAChecklistItem } from '../types';
import { ssmaChecklistService } from '../services/ssmaChecklistService';

interface SSMAStore {
    checklistItems: SSMAChecklistItem[];
    checklistLoaded: boolean;
    loadingChecklist: boolean;
    error: string | null;

    fetchChecklist: () => Promise<void>;
    inspectionTypes: () => string[];
    getItemsByType: (type: string) => SSMAChecklistItem[];
}

export const useSSMAStore = create<SSMAStore>((set, get) => ({
    checklistItems: [],
    checklistLoaded: false,
    loadingChecklist: false,
    error: null,

    fetchChecklist: async () => {
        if (get().checklistLoaded || get().loadingChecklist) return;
        set({ loadingChecklist: true, error: null });
        try {
            const items = await ssmaChecklistService.fetchAllItems();
            set({ checklistItems: items, checklistLoaded: true, loadingChecklist: false });
        } catch (err: any) {
            set({ error: err.message, loadingChecklist: false });
        }
    },

    inspectionTypes: () => {
        const items = get().checklistItems;
        const types = new Set(items.map(item => item.inspectionType));
        return Array.from(types).sort();
    },

    getItemsByType: (type: string) => {
        return get().checklistItems.filter(item => item.inspectionType === type);
    }
}));

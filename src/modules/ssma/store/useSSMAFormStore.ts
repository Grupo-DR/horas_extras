import { create } from 'zustand';
import { SSMAInspectionItemStatus } from '../types';

export interface FormItemState {
    status: SSMAInspectionItemStatus | null;
    comment: string;
    files: File[];
}

interface SSMAFormStore {
    date: string;
    costCenterId: string;
    inspectionType: string;
    executorUid: string;
    comments: string;
    
    items: Record<string, FormItemState>;

    setDate: (date: string) => void;
    setCostCenterId: (costCenterId: string) => void;
    setInspectionType: (type: string) => void;
    setExecutorUid: (uid: string) => void;
    setComments: (comments: string) => void;

    setItemStatus: (itemId: string, status: SSMAInspectionItemStatus | null) => void;
    setItemComment: (itemId: string, comment: string) => void;
    setItemFiles: (itemId: string, files: File[]) => void;
    
    resetForm: () => void;
    initializeForType: (itemIds: string[]) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const useSSMAFormStore = create<SSMAFormStore>((set) => ({
    date: today(),
    costCenterId: '',
    inspectionType: '',
    executorUid: '',
    comments: '',
    items: {},

    setDate: (date) => set({ date }),
    setCostCenterId: (costCenterId) => set({ costCenterId }),
    setInspectionType: (inspectionType) => set({ inspectionType }),
    setExecutorUid: (executorUid) => set({ executorUid }),
    setComments: (comments) => set({ comments }),

    setItemStatus: (itemId, status) => set((state) => ({
        items: {
            ...state.items,
            [itemId]: { ...(state.items[itemId] || { comment: '', files: [] }), status }
        }
    })),
    
    setItemComment: (itemId, comment) => set((state) => ({
        items: {
            ...state.items,
            [itemId]: { ...(state.items[itemId] || { status: null, files: [] }), comment }
        }
    })),

    setItemFiles: (itemId, files) => set((state) => ({
        items: {
            ...state.items,
            [itemId]: { ...(state.items[itemId] || { status: null, comment: '' }), files }
        }
    })),

    resetForm: () => set({
        date: today(),
        costCenterId: '',
        inspectionType: '',
        executorUid: '',
        comments: '',
        items: {}
    }),

    initializeForType: (itemIds) => {
        const initialItems: Record<string, FormItemState> = {};
        itemIds.forEach(id => {
            initialItems[id] = { status: null, comment: '', files: [] };
        });
        set({ items: initialItems });
    }
}));

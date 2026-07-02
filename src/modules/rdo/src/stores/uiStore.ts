import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { Project, Team } from '../../types';

export type MainMenu = 'DASHBOARD' | 'PROJECTS' | 'CONTRACT_INTELLIGENCE' | 'PLANNING';
export type ViewState = 'PROJECT_LIST' | 'TEAMS_LIST' | 'RDO_LIST' | 'UPLOAD_ANALYSIS';
export type ProjectTab = 'TEAMS' | 'SERVICES';

interface UiState {
  activeMenu: MainMenu;
  currentView: ViewState;
  projectTab: ProjectTab;
  isMobileMenuOpen: boolean;
  loading: boolean;
  error: string | null;

  // Form states
  isModalOpen: boolean;
  isEditMode: boolean;
  editingItemId: string | null;
  newItemName: string;
  newItemRegional: string;

  // Filter states
  filterMes: string;
  filterStartDate: string;
  filterEndDate: string;
  filterRegional: string;
  filterProject: string;
  filterTeam: string;

  actions: {
    setActiveMenu: (menu: MainMenu) => void;
    setCurrentView: (view: ViewState) => void;
    setProjectTab: (tab: ProjectTab) => void;
    setIsMobileMenuOpen: (isOpen: boolean) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    
    // Modal actions
    setIsModalOpen: (isOpen: boolean) => void;
    setIsEditMode: (isEdit: boolean) => void;
    setEditingItemId: (id: string | null) => void;
    setNewItemName: (name: string) => void;
    setNewItemRegional: (regional: string) => void;
    openCreateModal: () => void;
    openEditModal: (item: Project | Team, type: 'PROJECT' | 'TEAM') => void;

    // Filter actions
    setFilterMes: (mes: string) => void;
    setFilterStartDate: (date: string) => void;
    setFilterEndDate: (date: string) => void;
    setFilterRegional: (regional: string) => void;
    setFilterProject: (project: string) => void;
    setFilterTeam: (team: string) => void;
    clearFilters: () => void;
  };
}

export const useUiStore = create<UiState>((set) => ({
  activeMenu: 'DASHBOARD',
  currentView: 'PROJECT_LIST',
  projectTab: 'TEAMS',
  isMobileMenuOpen: false,
  loading: false,
  error: null,

  isModalOpen: false,
  isEditMode: false,
  editingItemId: null,
  newItemName: '',
  newItemRegional: '',

  filterMes: 'all',
  filterStartDate: '',
  filterEndDate: '',
  filterRegional: 'all',
  filterProject: 'all',
  filterTeam: 'all',

  actions: {
    setActiveMenu: (activeMenu) => set({ activeMenu }),
    setCurrentView: (currentView) => set({ currentView }),
    setProjectTab: (projectTab) => set({ projectTab }),
    setIsMobileMenuOpen: (isMobileMenuOpen) => set({ isMobileMenuOpen }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),

    setIsModalOpen: (isModalOpen) => set({ isModalOpen }),
    setIsEditMode: (isEditMode) => set({ isEditMode }),
    setEditingItemId: (editingItemId) => set({ editingItemId }),
    setNewItemName: (newItemName) => set({ newItemName }),
    setNewItemRegional: (newItemRegional) => set({ newItemRegional }),

    openCreateModal: () => set({
      isEditMode: false,
      newItemName: '',
      newItemRegional: '',
      isModalOpen: true
    }),

    openEditModal: (item, type) => set({
      isEditMode: true,
      editingItemId: item.id,
      newItemName: item.name,
      newItemRegional: type === 'PROJECT' ? (item as Project).regional || '' : '',
      isModalOpen: true
    }),

    setFilterMes: (filterMes) => set({ filterMes }),
    setFilterStartDate: (filterStartDate) => set({ filterStartDate }),
    setFilterEndDate: (filterEndDate) => set({ filterEndDate }),
    setFilterRegional: (filterRegional) => set({ filterRegional }),
    setFilterProject: (filterProject) => set({ filterProject }),
    setFilterTeam: (filterTeam) => set({ filterTeam }),
    
    clearFilters: () => set({
      filterStartDate: '',
      filterEndDate: '',
      filterRegional: 'all',
      filterProject: 'all',
      filterTeam: 'all'
    })
  }
}));

// Selectors
export const useUiState = () => useUiStore(useShallow((state) => ({
  activeMenu: state.activeMenu,
  currentView: state.currentView,
  projectTab: state.projectTab,
  isMobileMenuOpen: state.isMobileMenuOpen,
  loading: state.loading,
  error: state.error,
  isModalOpen: state.isModalOpen,
  isEditMode: state.isEditMode,
  editingItemId: state.editingItemId,
  newItemName: state.newItemName,
  newItemRegional: state.newItemRegional
})));

export const useUiFilters = () => useUiStore(useShallow((state) => ({
  filterMes: state.filterMes,
  filterStartDate: state.filterStartDate,
  filterEndDate: state.filterEndDate,
  filterRegional: state.filterRegional,
  filterProject: state.filterProject,
  filterTeam: state.filterTeam
})));

export const useUiActions = () => useUiStore((state) => state.actions);

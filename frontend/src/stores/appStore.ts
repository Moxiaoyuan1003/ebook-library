import { create } from 'zustand';

interface AppState {
  currentPage: string;
  sidebarCollapsed: boolean;
  importProgress: { current: number; total: number; file: string } | null;
  setCurrentPage: (page: string) => void;
  toggleSidebar: () => void;
  setImportProgress: (progress: { current: number; total: number; file: string } | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'library',
  sidebarCollapsed: false,
  importProgress: null,
  setCurrentPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setImportProgress: (progress) => set({ importProgress: progress }),
}));

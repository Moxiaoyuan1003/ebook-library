import { create } from 'zustand';
import { aiApi, AiStatus } from '../services/aiApi';

interface AppState {
  currentPage: string;
  sidebarCollapsed: boolean;
  importProgress: { current: number; total: number; file: string } | null;
  aiStatus: AiStatus | null;
  setCurrentPage: (page: string) => void;
  toggleSidebar: () => void;
  setImportProgress: (progress: { current: number; total: number; file: string } | null) => void;
  setAiStatus: (status: AiStatus | null) => void;
  fetchAiStatus: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'library',
  sidebarCollapsed: false,
  importProgress: null,
  aiStatus: null,
  setCurrentPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setImportProgress: (progress) => set({ importProgress: progress }),
  setAiStatus: (status) => set({ aiStatus: status }),
  fetchAiStatus: async () => {
    try {
      const response = await aiApi.getStatus();
      set({ aiStatus: response.data });
    } catch {
      set({ aiStatus: { provider: 'none', online: false, available: false } });
    }
  },
}));

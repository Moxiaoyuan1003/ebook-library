import { create } from 'zustand';
import { aiApi, AiConfig } from '../services/aiApi';

interface AiState {
  config: AiConfig | null;
  loading: boolean;
  fetchConfig: () => Promise<void>;
}

export const useAiStore = create<AiState>((set) => ({
  config: null,
  loading: false,
  fetchConfig: async () => {
    set({ loading: true });
    try {
      const response = await aiApi.getConfig();
      set({ config: response.data, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },
}));

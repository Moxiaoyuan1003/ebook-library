import { create } from 'zustand';
import { knowledgeCardApi, KnowledgeCard } from '../services/knowledgeCardApi';

interface KnowledgeCardState {
  cards: KnowledgeCard[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  searchQuery: string;
  cardTypeFilter: string | null;
  fetchCards: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setCardTypeFilter: (cardType: string | null) => void;
  setPage: (page: number) => void;
}

export const useKnowledgeCardStore = create<KnowledgeCardState>((set, get) => ({
  cards: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  searchQuery: '',
  cardTypeFilter: null,
  fetchCards: async () => {
    set({ loading: true });
    try {
      const { page, pageSize, searchQuery, cardTypeFilter } = get();
      const response = await knowledgeCardApi.list({
        page,
        page_size: pageSize,
        search: searchQuery || undefined,
        card_type: cardTypeFilter || undefined,
      });
      set({ cards: response.data.items, total: response.data.total, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCardTypeFilter: (cardType) => set({ cardTypeFilter: cardType }),
  setPage: (page) => set({ page }),
}));

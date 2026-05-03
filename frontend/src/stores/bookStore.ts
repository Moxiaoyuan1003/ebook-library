import { create } from 'zustand';
import { bookApi, Book } from '../services/bookApi';

interface BookState {
  books: Book[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  fetchBooks: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setPage: (page: number) => void;
}

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  searchQuery: '',
  viewMode: 'grid',
  fetchBooks: async () => {
    set({ loading: true });
    try {
      const { page, pageSize, searchQuery } = get();
      const response = await bookApi.list({ page, page_size: pageSize, search: searchQuery || undefined });
      set({ books: response.data.items, total: response.data.total, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },
  setSearchQuery: (query) => set({ searchQuery: query }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setPage: (page) => set({ page }),
}));

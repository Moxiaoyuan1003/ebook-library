import { create } from 'zustand';
import { bookApi, Book } from '../services/bookApi';

interface BookState {
  books: Book[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  searchQuery: string;
  viewMode: 'grid' | 'list' | 'gallery';
  filterStatus: string | null;
  filterFavorite: boolean;
  filterShelfId: string | null;
  filterShelfName: string | null;
  fetchBooks: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'grid' | 'list' | 'gallery') => void;
  setPage: (page: number) => void;
  setFilterStatus: (status: string | null) => void;
  setFilterFavorite: (fav: boolean) => void;
  setFilterShelf: (shelfId: string | null, shelfName: string | null) => void;
  toggleFavorite: (book: Book) => Promise<void>;
  updateRating: (bookId: string, rating: number) => Promise<void>;
  deleteBook: (bookId: string) => Promise<void>;
}

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  searchQuery: '',
  viewMode: 'grid',
  filterStatus: null,
  filterFavorite: false,
  filterShelfId: null,
  filterShelfName: null,
  fetchBooks: async () => {
    set({ loading: true });
    try {
      const { page, pageSize, searchQuery, filterStatus, filterFavorite, filterShelfId } = get();
      const response = await bookApi.list({
        page,
        page_size: pageSize,
        search: searchQuery || undefined,
        reading_status: filterStatus || undefined,
        is_favorite: filterFavorite || undefined,
        bookshelf_id: filterShelfId || undefined,
      });
      set({ books: response.data.items, total: response.data.total, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  setSearchQuery: (query) => set({ searchQuery: query, page: 1 }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setPage: (page) => set({ page }),
  setFilterStatus: (status) => set({ filterStatus: status, filterFavorite: false, filterShelfId: null, filterShelfName: null, page: 1 }),
  setFilterFavorite: (fav) => set({ filterFavorite: fav, filterStatus: null, filterShelfId: null, filterShelfName: null, page: 1 }),
  setFilterShelf: (shelfId, shelfName) => set({ filterShelfId: shelfId, filterShelfName: shelfName, filterStatus: null, filterFavorite: false, page: 1 }),
  toggleFavorite: async (book) => {
    try {
      await bookApi.update(book.id, { is_favorite: !book.is_favorite });
      set((state) => ({
        books: state.books.map((b) => (b.id === book.id ? { ...b, is_favorite: !book.is_favorite } : b)),
      }));
    } catch { /* ignore */ }
  },
  updateRating: async (bookId, rating) => {
    try {
      await bookApi.update(bookId, { rating });
      set((state) => ({
        books: state.books.map((b) => (b.id === bookId ? { ...b, rating } : b)),
      }));
    } catch { /* ignore */ }
  },
  deleteBook: async (bookId) => {
    try {
      await bookApi.delete(bookId);
      get().fetchBooks();
    } catch { /* ignore */ }
  },
}));

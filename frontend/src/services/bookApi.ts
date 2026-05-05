import axios from 'axios';
import API_BASE from './apiConfig';

const api = axios.create({ baseURL: `${API_BASE}/api` });

export interface Book {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  cover_url: string | null;
  file_path: string;
  file_format: string;
  reading_status: string;
  rating: number | null;
  is_favorite: boolean;
  summary: string | null;
  series_name: string | null;
  series_number: number | null;
  created_at: string;
}

export interface BookListResponse {
  items: Book[];
  total: number;
  page: number;
  page_size: number;
}

export const bookApi = {
  list: (params?: { page?: number; page_size?: number; search?: string; reading_status?: string; is_favorite?: boolean; bookshelf_id?: string }) =>
    api.get<BookListResponse>('/books/', { params }),
  get: (id: string) => api.get<Book>(`/books/${id}`),
  create: (data: FormData) => api.post<Book>('/books/', data),
  update: (id: string, data: Partial<Book>) => api.put<Book>(`/books/${id}`, data),
  delete: (id: string) => api.delete(`/books/${id}`),
  importFile: (filePath: string) =>
    api.post<Book>('/books/import/file', { file_path: filePath }),
  importDirectory: (directory: string) =>
    api.post('/books/import/directory', { directory }),
  getProgress: (id: string) => api.get(`/books/${id}/progress`),
  updateProgress: (
    id: string,
    data: { current_page?: number; current_cfi?: string; progress_percent?: number },
  ) => api.put(`/books/${id}/progress`, data),
  getBookmarks: (bookId: string) =>
    api.get<{ id: string; page_number: number; created_at: string }[]>(`/books/${bookId}/bookmarks`),
  addBookmark: (bookId: string, pageNumber: number) =>
    api.post<{ id: string; page_number: number }>(`/books/${bookId}/bookmarks`, { page_number: pageNumber }),
  deleteBookmark: (bookId: string, pageNumber: number) =>
    api.delete(`/books/${bookId}/bookmarks/${pageNumber}`),
  getTags: (bookId: string) =>
    api.get<{ tags: { id: string; name: string; color: string }[] }>(`/books/${bookId}/tags`),
  addTag: (bookId: string, tag: string) =>
    api.post<{ id: string; name: string; color: string }>(`/books/${bookId}/tags`, { tag }),
  removeTag: (bookId: string, tagName: string) =>
    api.delete(`/books/${bookId}/tags/${tagName}`),
  getShelfBooks: (shelfId: string) =>
    api.get<{ id: string; title: string; author: string | null; cover_url: string | null; file_format: string; reading_status: string; rating: number | null; is_favorite: boolean }[]>(`/bookshelves/${shelfId}/books`),
  getSeriesList: () =>
    api.get<{ name: string; count: number }[]>('/books/series/list'),
};

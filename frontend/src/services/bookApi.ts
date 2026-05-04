import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

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
  created_at: string;
}

export interface BookListResponse {
  items: Book[];
  total: number;
  page: number;
  page_size: number;
}

export const bookApi = {
  list: (params?: { page?: number; page_size?: number; search?: string }) =>
    api.get<BookListResponse>('/books/', { params }),
  get: (id: string) => api.get<Book>(`/books/${id}`),
  create: (data: FormData) => api.post<Book>('/books/', data),
  update: (id: string, data: Partial<Book>) => api.put<Book>(`/books/${id}`, data),
  delete: (id: string) => api.delete(`/books/${id}`),
  importFile: (filePath: string) =>
    api.post<Book>('/books/import/file', null, { params: { file_path: filePath } }),
  importDirectory: (directory: string) =>
    api.post('/books/import/directory', null, { params: { directory } }),
  getProgress: (id: string) => api.get(`/books/${id}/progress`),
  updateProgress: (
    id: string,
    data: { current_page?: number; current_cfi?: string; progress_percent?: number },
  ) => api.put(`/books/${id}/progress`, data),
};

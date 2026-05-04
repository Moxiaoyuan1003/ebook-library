import axios from 'axios';

const api = axios.create({ baseURL: '/api/annotations' });

export interface Annotation {
  id: string;
  book_id: string;
  type: string;
  page_number?: number;
  selected_text?: string;
  note_content?: string;
  color?: string;
  highlight_color?: string;
  start_cfi?: string;
  end_cfi?: string;
  rect_data?: string;
  created_at: string;
}

export const annotationApi = {
  list: (bookId: string) => api.get<Annotation[]>('/', { params: { book_id: bookId } }),
  create: (data: Partial<Annotation>) => api.post<Annotation>('/', data),
  update: (id: string, data: Partial<Annotation>) => api.put<Annotation>(`/${id}`, data),
  delete: (id: string) => api.delete(`/${id}`),
};

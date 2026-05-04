import axios from 'axios';
import API_BASE from './apiConfig';

const api = axios.create({ baseURL: `${API_BASE}/api/export` });

export interface ExportRequest {
  data_type: 'cards' | 'annotations' | 'books';
  format: 'markdown' | 'pdf' | 'csv';
  filters?: {
    book_id?: string;
    date_from?: string;
    date_to?: string;
    tags?: string[];
  };
}

export const exportApi = {
  export: (data: ExportRequest) => api.post('/', data, { responseType: 'blob' }),
};

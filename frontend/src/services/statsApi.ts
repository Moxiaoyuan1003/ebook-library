import axios from 'axios';
import API_BASE from './apiConfig';

const api = axios.create({ baseURL: `${API_BASE}/api` });

export interface Stats {
  total_books: number;
  finished: number;
  reading: number;
  favorites: number;
  formats: Record<string, number>;
  avg_progress: number;
}

export const statsApi = {
  getStats: () => api.get<Stats>('/stats'),
};

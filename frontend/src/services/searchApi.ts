import axios from 'axios';
import API_BASE from './apiConfig';

const api = axios.create({ baseURL: `${API_BASE}/api` });

export interface SearchPassage {
  book_id: string;
  book_title: string;
  chapter: string | null;
  page_number: number | null;
  content: string;
  score: number;
}

export interface SearchResult {
  results: SearchPassage[];
  total: number;
  query: string;
  search_type: string;
}

export const searchApi = {
  search: (q: string, searchType: 'keyword' | 'semantic' = 'keyword') =>
    api.post<SearchResult>('/search', { query: q, search_type: searchType, top_k: 20 }),
};

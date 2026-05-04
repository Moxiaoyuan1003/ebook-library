import axios from 'axios';

const api = axios.create({ baseURL: '/api/ai' });
const searchApi = axios.create({ baseURL: '/api/search' });

export interface AiConfig {
  provider: string;
  has_openai_key: boolean;
  has_claude_key: boolean;
  ollama_url: string;
}

export interface AiStatus {
  provider: string;
  online: boolean;
  available: boolean;
}

export interface CrossBookPassage {
  page_number: number | null;
  content: string;
  score: number;
}

export interface CrossBookSource {
  book_id: string;
  book_title: string;
  passages: CrossBookPassage[];
}

export interface CrossBookResponse {
  answer: string;
  sources: CrossBookSource[];
  query: string;
}

export const aiApi = {
  getConfig: () => api.get<AiConfig>('/config'),
  getStatus: () => api.get<AiStatus>('/status'),
  generateSummary: (bookId: string, forceRegenerate = false) =>
    api.post('/summary', { book_id: bookId, force_regenerate: forceRegenerate }),
  chat: (messages: { role: string; content: string }[], bookId?: string) =>
    api.post('/chat', { messages, book_id: bookId }),
  crossBookQuery: (query: string, topK = 20) =>
    searchApi.post<CrossBookResponse>('/cross-book', { query, top_k: topK }),
};

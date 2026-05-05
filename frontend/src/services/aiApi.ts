import axios from 'axios';
import API_BASE from './apiConfig';

const api = axios.create({ baseURL: `${API_BASE}/api/ai` });
const searchApi = axios.create({ baseURL: `${API_BASE}/api/search` });

export interface AiConfig {
  provider: string;
  has_openai_key: boolean;
  has_claude_key: boolean;
  ollama_url: string;
  openai_model: string;
  openai_base_url: string;
  claude_model: string;
  ollama_model: string;
  has_custom_key: boolean;
  custom_base_url: string;
  custom_model: string;
}

export interface AiTestResult {
  success: boolean;
  provider: string | null;
  response?: string;
  error?: string;
}

export interface AiModels {
  openai: { id: string; name: string }[];
  claude: { id: string; name: string }[];
  ollama: { id: string; name: string }[];
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
  saveConfig: (data: Record<string, string>) =>
    api.post('/config', data),
  getStatus: () => api.get<AiStatus>('/status'),
  testConnection: () => api.post<AiTestResult>('/test'),
  getModels: () => api.get<AiModels>('/models'),
  generateSummary: (bookId: string, forceRegenerate = false) =>
    api.post('/summary', { book_id: bookId, force_regenerate: forceRegenerate }),
  chat: (messages: { role: string; content: string }[], bookId?: string) =>
    api.post('/chat', { messages, book_id: bookId }),
  crossBookQuery: (query: string, topK = 20) =>
    searchApi.post<CrossBookResponse>('/cross-book', { query, top_k: topK }),
  getRecommendations: () =>
    api.post<{ recommendations: { title: string; author: string; reason: string }[] }>('/recommendations'),
};

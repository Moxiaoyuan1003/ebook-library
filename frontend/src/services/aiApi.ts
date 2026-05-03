import axios from 'axios';

const api = axios.create({ baseURL: '/api/ai' });

export interface AiConfig {
  provider: string;
  has_openai_key: boolean;
  has_claude_key: boolean;
  ollama_url: string;
}

export const aiApi = {
  getConfig: () => api.get<AiConfig>('/config'),
  generateSummary: (bookId: string, forceRegenerate = false) =>
    api.post('/summary', { book_id: bookId, force_regenerate: forceRegenerate }),
  chat: (messages: { role: string; content: string }[], bookId?: string) =>
    api.post('/chat', { messages, book_id: bookId }),
};

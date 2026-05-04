import axios from 'axios';
import API_BASE from './apiConfig';

const api = axios.create({ baseURL: `${API_BASE}/api/ai` });

export interface ReadingMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ReadingSession {
  id: string;
  book_id: string;
  messages: ReadingMessage[];
  context_passages: any[];
  created_at: string;
  updated_at: string;
}

export interface ReadingChatResponse {
  reply: string;
  session_id: string;
}

export const readingSessionApi = {
  chat: (data: {
    book_id: string;
    message: string;
    context_passages?: any[];
    session_id?: string;
  }) => api.post<ReadingChatResponse>('/reading-chat', data),
  listSessions: (bookId: string) => api.get<ReadingSession[]>(`/reading-sessions/${bookId}`),
  deleteSession: (sessionId: string) => api.delete(`/reading-sessions/${sessionId}`),
};

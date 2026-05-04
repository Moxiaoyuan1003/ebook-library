import axios from 'axios';
import API_BASE from './apiConfig';

const api = axios.create({ baseURL: `${API_BASE}/api/knowledge-cards` });

export interface KnowledgeCard {
  id: string;
  title: string;
  content: string;
  source_book_id: string | null;
  source_passage: string | null;
  annotation: string | null;
  card_type: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CardLink {
  id: string;
  source_card_id: string;
  target_card_id: string;
  link_type: string;
  created_at: string;
  target_card?: KnowledgeCard;
}

export interface KnowledgeCardListResponse {
  items: KnowledgeCard[];
  total: number;
  page: number;
  page_size: number;
}

export interface KnowledgeCardCreateData {
  title: string;
  content: string;
  source_book_id?: string | null;
  source_passage?: string | null;
  annotation?: string | null;
  card_type?: string;
  tags?: string[] | null;
}

export interface KnowledgeCardUpdateData {
  title?: string;
  content?: string;
  source_passage?: string | null;
  annotation?: string | null;
  card_type?: string;
  tags?: string[] | null;
}

export interface CardLinkCreateData {
  target_card_id: string;
  link_type?: string;
}

export const knowledgeCardApi = {
  list: (params?: { page?: number; page_size?: number; search?: string; card_type?: string }) =>
    api.get<KnowledgeCardListResponse>('/', { params }),
  get: (id: string) => api.get<KnowledgeCard>(`/${id}`),
  create: (data: KnowledgeCardCreateData) => api.post<KnowledgeCard>('/', data),
  update: (id: string, data: KnowledgeCardUpdateData) => api.put<KnowledgeCard>(`/${id}`, data),
  delete: (id: string) => api.delete(`/${id}`),
  createLink: (cardId: string, data: CardLinkCreateData) =>
    api.post<CardLink>(`/${cardId}/links`, data),
  listLinks: (cardId: string) => api.get<CardLink[]>(`/${cardId}/links`),
  deleteLink: (linkId: string) => api.delete(`/links/${linkId}`),
};

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { readingSessionApi } from './readingSessionApi';

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn().mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
    }),
  },
}));

describe('readingSessionApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('chat sends POST to /reading-chat with data', async () => {
    const data = { book_id: 'book-123', message: 'What is this book about?' };
    const response = { data: { reply: 'It is about...', session_id: 'sess-1' } };
    mockPost.mockResolvedValue(response);

    const result = await readingSessionApi.chat(data);

    expect(mockPost).toHaveBeenCalledWith('/reading-chat', data);
    expect(result).toEqual(response);
  });

  it('chat sends POST with optional context_passages and session_id', async () => {
    const data = {
      book_id: 'book-123',
      message: 'Explain this passage',
      context_passages: [{ text: 'Some passage' }],
      session_id: 'sess-1',
    };
    mockPost.mockResolvedValue({ data: { reply: 'Sure', session_id: 'sess-1' } });

    await readingSessionApi.chat(data);

    expect(mockPost).toHaveBeenCalledWith('/reading-chat', data);
  });

  it('listSessions sends GET to /reading-sessions/:bookId', async () => {
    const sessions = [{ id: 'sess-1', book_id: 'book-123', messages: [], context_passages: [], created_at: '', updated_at: '' }];
    mockGet.mockResolvedValue({ data: sessions });

    const result = await readingSessionApi.listSessions('book-123');

    expect(mockGet).toHaveBeenCalledWith('/reading-sessions/book-123');
    expect(result).toEqual({ data: sessions });
  });

  it('deleteSession sends DELETE to /reading-sessions/:sessionId', async () => {
    mockDelete.mockResolvedValue({ data: undefined });

    await readingSessionApi.deleteSession('sess-1');

    expect(mockDelete).toHaveBeenCalledWith('/reading-sessions/sess-1');
  });
});

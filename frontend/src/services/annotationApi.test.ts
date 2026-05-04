import { describe, it, expect, vi, beforeEach } from 'vitest';
import { annotationApi } from './annotationApi';

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

describe('annotationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list sends GET with book_id param', async () => {
    mockGet.mockResolvedValue({ data: [] });

    await annotationApi.list('book-123');

    expect(mockGet).toHaveBeenCalledWith('/', { params: { book_id: 'book-123' } });
  });

  it('create sends POST with annotation data', async () => {
    const data = { book_id: 'book-123', type: 'highlight', selected_text: 'hello' };
    const response = { data: { id: 'ann-1', ...data, created_at: '2024-01-01' } };
    mockPost.mockResolvedValue(response);

    const result = await annotationApi.create(data);

    expect(mockPost).toHaveBeenCalledWith('/', data);
    expect(result).toEqual(response);
  });

  it('update sends PUT with id and data', async () => {
    const data = { note_content: 'updated note' };
    const response = {
      data: { id: 'ann-1', book_id: 'book-123', type: 'note', ...data, created_at: '2024-01-01' },
    };
    mockPut.mockResolvedValue(response);

    const result = await annotationApi.update('ann-1', data);

    expect(mockPut).toHaveBeenCalledWith('/ann-1', data);
    expect(result).toEqual(response);
  });

  it('delete sends DELETE with id', async () => {
    mockDelete.mockResolvedValue({ data: undefined });

    await annotationApi.delete('ann-1');

    expect(mockDelete).toHaveBeenCalledWith('/ann-1');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { exportApi } from './exportApi';
import type { ExportRequest } from './exportApi';

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

describe('exportApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('export sends POST with correct body and responseType blob', async () => {
    const data: ExportRequest = {
      data_type: 'annotations',
      format: 'markdown',
      filters: { book_id: 'book-123' },
    };
    const blob = new Blob(['test'], { type: 'text/markdown' });
    mockPost.mockResolvedValue({ data: blob });

    const result = await exportApi.export(data);

    expect(mockPost).toHaveBeenCalledWith('/', data, { responseType: 'blob' });
    expect(result).toEqual({ data: blob });
  });

  it('export works with csv format and date filters', async () => {
    const data: ExportRequest = {
      data_type: 'books',
      format: 'csv',
      filters: {
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        tags: ['fiction'],
      },
    };
    mockPost.mockResolvedValue({ data: new Blob() });

    await exportApi.export(data);

    expect(mockPost).toHaveBeenCalledWith('/', data, { responseType: 'blob' });
  });

  it('export works without optional filters', async () => {
    const data: ExportRequest = {
      data_type: 'cards',
      format: 'pdf',
    };
    mockPost.mockResolvedValue({ data: new Blob() });

    await exportApi.export(data);

    expect(mockPost).toHaveBeenCalledWith('/', data, { responseType: 'blob' });
  });
});

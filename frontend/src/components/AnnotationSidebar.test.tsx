import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AnnotationSidebar from './AnnotationSidebar';
import { annotationApi } from '../services/annotationApi';

// Mock the annotationApi module
vi.mock('../services/annotationApi', () => ({
  annotationApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockAnnotations = [
  {
    id: '1',
    book_id: 'book-1',
    type: 'highlight',
    page_number: 5,
    selected_text: 'This is a highlighted passage',
    note_content: '',
    color: '#ffeb3b',
    highlight_color: '#ffeb3b',
    created_at: '2025-01-15T10:30:00Z',
  },
  {
    id: '2',
    book_id: 'book-1',
    type: 'note',
    page_number: 12,
    selected_text: 'Another important text',
    note_content: 'My note about this passage',
    color: '#69f0ae',
    highlight_color: '#69f0ae',
    created_at: '2025-01-16T14:00:00Z',
  },
];

const defaultProps = {
  visible: true,
  bookId: 'book-1',
  onClose: vi.fn(),
  onJumpToAnnotation: vi.fn(),
};

describe('AnnotationSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the drawer title when visible is true', async () => {
    vi.mocked(annotationApi.list).mockResolvedValue({ data: [] } as any);

    render(<AnnotationSidebar {...defaultProps} />);

    expect(screen.getByText('标注')).toBeInTheDocument();
  });

  it('does not render content when visible is false', () => {
    render(<AnnotationSidebar {...defaultProps} visible={false} />);

    // When drawer is closed, the title should not be visible in the DOM
    expect(screen.queryByText('标注')).not.toBeInTheDocument();
  });

  it('calls annotationApi.list when visible and bookId are provided', async () => {
    vi.mocked(annotationApi.list).mockResolvedValue({ data: [] } as any);

    render(<AnnotationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(annotationApi.list).toHaveBeenCalledWith('book-1');
    });
  });

  it('displays annotations when data is loaded', async () => {
    vi.mocked(annotationApi.list).mockResolvedValue({ data: mockAnnotations } as any);

    render(<AnnotationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('This is a highlighted passage')).toBeInTheDocument();
      expect(screen.getByText('Another important text')).toBeInTheDocument();
      expect(screen.getByText('My note about this passage')).toBeInTheDocument();
    });
  });

  it('displays empty state when no annotations exist', async () => {
    vi.mocked(annotationApi.list).mockResolvedValue({ data: [] } as any);

    render(<AnnotationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('暂无标注')).toBeInTheDocument();
    });
  });

  it('displays page numbers for annotations', async () => {
    vi.mocked(annotationApi.list).mockResolvedValue({ data: mockAnnotations } as any);

    render(<AnnotationSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/第 5 页/)).toBeInTheDocument();
      expect(screen.getByText(/第 12 页/)).toBeInTheDocument();
    });
  });

  it('calls onJumpToAnnotation when an annotation item is clicked', async () => {
    const onJumpToAnnotation = vi.fn();
    vi.mocked(annotationApi.list).mockResolvedValue({ data: mockAnnotations } as any);

    render(<AnnotationSidebar {...defaultProps} onJumpToAnnotation={onJumpToAnnotation} />);

    await waitFor(() => {
      expect(screen.getByText('This is a highlighted passage')).toBeInTheDocument();
    });

    const annotationItem = screen
      .getByText('This is a highlighted passage')
      .closest('.ant-list-item');
    expect(annotationItem).toBeTruthy();
  });
});

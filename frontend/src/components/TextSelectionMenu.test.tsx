import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextSelectionMenu from './TextSelectionMenu';

const defaultProps = {
  visible: true,
  position: { x: 200, y: 100 },
  selectedText: 'some selected text',
  onAskAI: vi.fn(),
  onHighlight: vi.fn(),
  onCopy: vi.fn(),
  onClose: vi.fn(),
};

describe('TextSelectionMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders buttons when visible is true', () => {
    render(<TextSelectionMenu {...defaultProps} />);

    expect(screen.getByText('问 AI')).toBeInTheDocument();
    expect(screen.getByText('高亮')).toBeInTheDocument();
    expect(screen.getByText('复制')).toBeInTheDocument();
  });

  it('does not render when visible is false', () => {
    render(<TextSelectionMenu {...defaultProps} visible={false} />);

    expect(screen.queryByText('问 AI')).not.toBeInTheDocument();
    expect(screen.queryByText('高亮')).not.toBeInTheDocument();
    expect(screen.queryByText('复制')).not.toBeInTheDocument();
  });

  it('does not render when selectedText is empty', () => {
    render(<TextSelectionMenu {...defaultProps} selectedText="" />);

    expect(screen.queryByText('问 AI')).not.toBeInTheDocument();
  });

  it('calls onAskAI when "问 AI" button is clicked', () => {
    const onAskAI = vi.fn();
    render(<TextSelectionMenu {...defaultProps} onAskAI={onAskAI} />);

    fireEvent.click(screen.getByText('问 AI'));

    expect(onAskAI).toHaveBeenCalledTimes(1);
  });

  it('calls onCopy when "复制" button is clicked', () => {
    const onCopy = vi.fn();
    render(<TextSelectionMenu {...defaultProps} onCopy={onCopy} />);

    fireEvent.click(screen.getByText('复制'));

    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('shows color picker when "高亮" button is clicked', () => {
    render(<TextSelectionMenu {...defaultProps} />);

    fireEvent.click(screen.getByText('高亮'));

    // Color dots should appear with title attributes
    expect(screen.getByTitle('黄色')).toBeInTheDocument();
    expect(screen.getByTitle('绿色')).toBeInTheDocument();
    expect(screen.getByTitle('蓝色')).toBeInTheDocument();
    expect(screen.getByTitle('粉色')).toBeInTheDocument();
    expect(screen.getByTitle('紫色')).toBeInTheDocument();
  });

  it('calls onHighlight with the correct color when a color dot is clicked', () => {
    const onHighlight = vi.fn();
    render(<TextSelectionMenu {...defaultProps} onHighlight={onHighlight} />);

    // Open color picker
    fireEvent.click(screen.getByText('高亮'));

    // Click the yellow color dot
    fireEvent.click(screen.getByTitle('黄色'));

    expect(onHighlight).toHaveBeenCalledWith('#ffeb3b');
    expect(onHighlight).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<TextSelectionMenu {...defaultProps} onClose={onClose} />);

    // The backdrop is a fixed div covering the whole screen
    const backdrop = document.querySelector('div[style*="position: fixed"][style*="z-index: 999"]');
    expect(backdrop).toBeTruthy();

    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

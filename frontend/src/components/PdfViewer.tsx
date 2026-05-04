// frontend/src/components/PdfViewer.tsx
import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import type { TocItem } from '../types/reader';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface PdfViewerRef {
  goToPage: (page: number) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleFitWidth: () => void;
  getScale: () => number;
  getCurrentPage: () => number;
  getNumPages: () => number;
}

interface PdfViewerProps {
  filePath: string;
  onPageChange?: (page: number, total: number) => void;
  onTocLoad?: (toc: TocItem[]) => void;
  onTextSelect?: (text: string, rect: DOMRect) => void;
  onZoomChange?: (scale: number) => void;
  initialPage?: number;
}

const PdfViewer = forwardRef<PdfViewerRef, PdfViewerProps>(({ filePath, onPageChange, onTocLoad, onTextSelect, onZoomChange, initialPage = 1 }, ref) => {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [scale, setScale] = useState(1.0);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(async (pdf: any) => {
    setNumPages(pdf.numPages);
    onPageChange?.(currentPage, pdf.numPages);

    // Extract outline (TOC)
    try {
      const outline = await pdf.getOutline();
      if (outline && outline.length > 0 && onTocLoad) {
        const toc = await resolveOutline(pdf, outline);
        onTocLoad(toc);
      }
    } catch {
      // No outline available
    }
  }, [onPageChange, onTocLoad, currentPage]);

  const resolveOutline = async (pdf: any, outline: any[]): Promise<TocItem[]> => {
    const items: TocItem[] = [];
    for (const item of outline) {
      let pageNumber = 0;
      try {
        if (item.dest) {
          const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
          if (dest) {
            const pageIndex = await pdf.getPageIndex(dest[0]);
            pageNumber = pageIndex + 1;
          }
        }
      } catch {}
      items.push({
        title: item.title,
        pageNumber,
        items: item.items?.length ? await resolveOutline(pdf, item.items) : undefined,
      });
    }
    return items;
  };

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
      onPageChange?.(page, numPages);
    }
  }, [numPages, onPageChange]);

  const handleZoomIn = useCallback(() => {
    setScale((s) => {
      const newScale = Math.min(s + 0.2, 2.0);
      onZoomChange?.(newScale);
      return newScale;
    });
  }, [onZoomChange]);

  const handleZoomOut = useCallback(() => {
    setScale((s) => {
      const newScale = Math.max(s - 0.2, 0.5);
      onZoomChange?.(newScale);
      return newScale;
    });
  }, [onZoomChange]);
  const handleFitWidth = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48;
      const newScale = containerWidth / 612;
      setScale(newScale);
      onZoomChange?.(newScale);
    }
  }, [onZoomChange]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    goToPage,
    handleZoomIn,
    handleZoomOut,
    handleFitWidth,
    getScale: () => scale,
    getCurrentPage: () => currentPage,
    getNumPages: () => numPages,
  }), [goToPage, handleZoomIn, handleZoomOut, handleFitWidth, scale, currentPage, numPages]);

  // Keyboard navigation — scoped to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.ctrlKey && e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      }
    };
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, goToPage, handleZoomIn, handleZoomOut]);

  // Text selection handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onTextSelect) return;

    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        onTextSelect(text, rect);
      }
    };

    container.addEventListener('mouseup', handleMouseUp);
    return () => container.removeEventListener('mouseup', handleMouseUp);
  }, [onTextSelect]);

  const fileUrl = filePath.startsWith('http') ? filePath : `/api/books/file?file_path=${encodeURIComponent(filePath)}`;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto', height: '100%', padding: 24, outline: 'none' }}
    >
      <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={() => console.error('PDF load error')}>
        <Page
          pageNumber={currentPage}
          scale={scale}
          renderTextLayer={true}
          renderAnnotationLayer={true}
        />
      </Document>
    </div>
  );
});

PdfViewer.displayName = 'PdfViewer';

export default PdfViewer;

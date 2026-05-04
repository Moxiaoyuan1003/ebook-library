// frontend/src/components/PdfViewer.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TocItem {
  title: string;
  pageNumber: number;
  items?: TocItem[];
}

interface PdfViewerProps {
  filePath: string;
  onPageChange?: (page: number, total: number) => void;
  onTocLoad?: (toc: TocItem[]) => void;
  onTextSelect?: (text: string, rect: DOMRect) => void;
  initialPage?: number;
}

export default function PdfViewer({ filePath, onPageChange, onTocLoad, onTextSelect, initialPage = 1 }: PdfViewerProps) {
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

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
      onPageChange?.(page, numPages);
    }
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 2.0));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
  const handleFitWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48;
      setScale(containerWidth / 612); // 612 = standard PDF width in points
    }
  };

  // Keyboard navigation
  useEffect(() => {
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages]);

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

  // Expose navigation methods via ref-like approach
  useEffect(() => {
    (window as any).__pdfViewer = { goToPage, handleZoomIn, handleZoomOut, handleFitWidth, getScale: () => scale, getCurrentPage: () => currentPage, getNumPages: () => numPages };
  }, [currentPage, numPages, scale]);

  const fileUrl = filePath.startsWith('http') ? filePath : `/api/books/file?file_path=${encodeURIComponent(filePath)}`;

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto', height: '100%', padding: 24 }}>
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
}

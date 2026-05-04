// frontend/src/components/EpubViewer.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';

interface TocItem {
  title: string;
  href: string;
  pageNumber: number;
}

interface EpubViewerProps {
  filePath: string;
  onLocationChange?: (cfi: string, progress: number) => void;
  onTocLoad?: (toc: TocItem[]) => void;
  onTextSelect?: (text: string, cfiRange: string) => void;
  initialCfi?: string;
  fontSize?: number;
  darkMode?: boolean;
}

export default function EpubViewer({ filePath, onLocationChange, onTocLoad, onTextSelect, initialCfi, fontSize = 16, darkMode = true }: EpubViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const [, setReady] = useState(false);

  const fileUrl = filePath.startsWith('http') ? filePath : `/api/books/file?file_path=${encodeURIComponent(filePath)}`;

  useEffect(() => {
    if (!viewerRef.current) return;

    const book = ePub(fileUrl);
    bookRef.current = book;

    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
    });
    renditionRef.current = rendition;

    // Apply theme
    rendition.themes.default({
      body: {
        color: darkMode ? '#e0e0e0' : '#333',
        background: darkMode ? '#0a0a0a' : '#fff',
        'font-size': `${fontSize}px`,
        'line-height': '1.6',
      },
    });

    // Display initial position
    if (initialCfi) {
      rendition.display(initialCfi);
    } else {
      rendition.display();
    }

    // Track location changes
    rendition.on('relocated', (location: any) => {
      if (location?.start) {
        const progress = book.locations?.percentageFromCfi(location.start.cfi) || 0;
        onLocationChange?.(location.start.cfi, Math.round(progress * 100));
      }
    });

    // Track text selection
    if (onTextSelect) {
      rendition.on('selected', (cfiRange: string, contents: any) => {
        const text = contents.window.getSelection().toString();
        if (text) {
          onTextSelect(text, cfiRange);
        }
      });
    }

    // Load TOC
    book.ready.then(() => {
      const navigation = book.navigation;
      if (navigation?.toc) {
        const toc = navigation.toc.map((item: any, i: number) => ({
          title: item.label?.trim() || `Chapter ${i + 1}`,
          href: item.href,
          pageNumber: i + 1,
        }));
        onTocLoad?.(toc);
      }
      // Generate locations for progress tracking
      book.locations.generate(1024).then(() => setReady(true)).catch((err: unknown) => {
        console.warn('Failed to generate EPUB locations:', err);
      });
    }).catch((err: unknown) => {
      console.warn('Failed to load EPUB book:', err);
    });

    return () => {
      book.destroy();
    };
  }, [fileUrl]);

  // Update theme when props change
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.default({
        body: {
          color: darkMode ? '#e0e0e0' : '#333',
          background: darkMode ? '#0a0a0a' : '#fff',
          'font-size': `${fontSize}px`,
          'line-height': '1.6',
        },
      });
    }
  }, [fontSize, darkMode]);

  // Navigation methods
  const goNext = useCallback(() => renditionRef.current?.next(), []);
  const goPrev = useCallback(() => renditionRef.current?.prev(), []);
  const goToHref = useCallback((href: string) => renditionRef.current?.display(href), []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  // Expose navigation
  useEffect(() => {
    (window as any).__epubViewer = { goNext, goPrev, goToHref };
  }, [goNext, goPrev, goToHref]);

  return (
    <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />
  );
}

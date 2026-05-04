// frontend/src/components/EpubViewer.tsx
import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import ePub from 'epubjs';
import type { TocItem } from '../types/reader';
import API_BASE from '../services/apiConfig';

export interface EpubViewerRef {
  goNext: () => void;
  goPrev: () => void;
  goToHref: (href: string) => void;
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

const EpubViewer = forwardRef<EpubViewerRef, EpubViewerProps>(
  (
    {
      filePath,
      onLocationChange,
      onTocLoad,
      onTextSelect,
      initialCfi,
      fontSize = 16,
      darkMode = true,
    },
    ref,
  ) => {
    const viewerRef = useRef<HTMLDivElement>(null);
    const bookRef = useRef<any>(null);
    const renditionRef = useRef<any>(null);
    const [, setReady] = useState(false);

    // Ref-wrap callbacks to avoid stale closures in rendition event handlers
    const onLocationChangeRef = useRef(onLocationChange);
    onLocationChangeRef.current = onLocationChange;
    const onTocLoadRef = useRef(onTocLoad);
    onTocLoadRef.current = onTocLoad;
    const onTextSelectRef = useRef(onTextSelect);
    onTextSelectRef.current = onTextSelect;

    const fileUrl = filePath.startsWith('http')
      ? filePath
      : `${API_BASE}/api/books/file?file_path=${encodeURIComponent(filePath)}`;

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
          onLocationChangeRef.current?.(location.start.cfi, Math.round(progress * 100));
        }
      });

      // Track text selection
      rendition.on('selected', (cfiRange: string, contents: any) => {
        const text = contents.window.getSelection().toString();
        if (text) {
          onTextSelectRef.current?.(text, cfiRange);
        }
      });

      // Load TOC
      let cancelled = false;

      book.ready
        .then(() => {
          if (cancelled) return;
          const navigation = book.navigation;
          if (navigation?.toc) {
            const toc = navigation.toc.map((item: any, i: number) => ({
              title: item.label?.trim() || `Chapter ${i + 1}`,
              href: item.href,
              pageNumber: i + 1,
            }));
            onTocLoadRef.current?.(toc);
          }
          // Generate locations for progress tracking
          book.locations
            .generate(1024)
            .then(() => {
              if (!cancelled) setReady(true);
            })
            .catch((err: unknown) => {
              console.warn('Failed to generate EPUB locations:', err);
            });
        })
        .catch((err: unknown) => {
          console.warn('Failed to load EPUB book:', err);
        });

      return () => {
        cancelled = true;
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

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        goNext,
        goPrev,
        goToHref,
      }),
      [goNext, goPrev, goToHref],
    );

    // Keyboard navigation
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Only handle when viewer is focused
        if (!viewerRef.current?.contains(document.activeElement)) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goPrev();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goNext();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goNext, goPrev]);

    return (
      <div
        ref={viewerRef}
        tabIndex={0}
        style={{ width: '100%', height: '100%', outline: 'none' }}
      />
    );
  },
);

EpubViewer.displayName = 'EpubViewer';

export default EpubViewer;

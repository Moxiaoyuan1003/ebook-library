// frontend/src/pages/Reader/ReaderPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Drawer, List, Spin, message, Space, InputNumber, Tag } from 'antd';
import { ArrowLeftOutlined, BookOutlined, LeftOutlined, RightOutlined, ZoomInOutlined, ZoomOutOutlined, HighlightOutlined, MessageOutlined } from '@ant-design/icons';
import { bookApi, Book } from '../../services/bookApi';
import { annotationApi } from '../../services/annotationApi';
import type { Annotation } from '../../services/annotationApi';
import type { TocItem } from '../../types/reader';
import PdfViewer from '../../components/PdfViewer';
import type { PdfViewerRef } from '../../components/PdfViewer';
import EpubViewer from '../../components/EpubViewer';
import type { EpubViewerRef } from '../../components/EpubViewer';
import TextSelectionMenu from '../../components/TextSelectionMenu';
import AnnotationSidebar from '../../components/AnnotationSidebar';
import ReadingChatPanel from '../../components/ReadingChatPanel';

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState<{ visible: boolean; x: number; y: number; text: string }>({ visible: false, x: 0, y: 0, text: '' });
  const [showChat, setShowChat] = useState(false);
  const [chatContext, setChatContext] = useState('');

  const pdfRef = useRef<PdfViewerRef>(null);
  const epubRef = useRef<EpubViewerRef>(null);

  useEffect(() => {
    if (bookId) {
      loadBook(bookId);
      loadProgress(bookId);
    }
  }, [bookId]);

  const loadBook = async (id: string) => {
    try {
      const response = await bookApi.get(id);
      setBook(response.data);
    } catch (error) {
      message.error('加载图书失败');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async (id: string) => {
    try {
      const response = await bookApi.getProgress(id);
      if (response.data.current_page > 0) {
        setCurrentPage(response.data.current_page);
      }
    } catch {}
  };

  const saveProgress = async (page: number) => {
    if (!bookId) return;
    try {
      const percent = totalPages > 0 ? Math.round((page / totalPages) * 100) : 0;
      await bookApi.updateProgress(bookId, { current_page: page, progress_percent: percent });
    } catch {}
  };

  const handlePageChange = (page: number, total: number) => {
    setCurrentPage(page);
    setTotalPages(total);
    saveProgress(page);
  };

  const goToPage = (page: number) => {
    pdfRef.current?.goToPage(page);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 20, 200);
    setZoom(newZoom);
    pdfRef.current?.handleZoomIn();
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 20, 50);
    setZoom(newZoom);
    pdfRef.current?.handleZoomOut();
  };

  const handleTextSelect = (text: string, rectOrCfi: any) => {
    if (rectOrCfi instanceof DOMRect) {
      setSelectionMenu({ visible: true, x: rectOrCfi.left + rectOrCfi.width / 2, y: rectOrCfi.top - 10, text });
    } else {
      // EPUB — position near center of screen
      setSelectionMenu({ visible: true, x: window.innerWidth / 2, y: 100, text });
    }
  };

  const handleHighlight = async (color: string) => {
    if (!bookId) return;
    try {
      await annotationApi.create({
        book_id: bookId,
        type: 'highlight',
        selected_text: selectionMenu.text,
        highlight_color: color,
        page_number: currentPage,
      });
      message.success('已高亮');
    } catch {
      message.error('高亮失败');
    }
    setSelectionMenu({ ...selectionMenu, visible: false });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(selectionMenu.text).then(() => {
      message.success('已复制');
    }).catch(() => {
      message.error('复制失败');
    });
    setSelectionMenu({ ...selectionMenu, visible: false });
  };

  const handleAskAI = () => {
    setChatContext(selectionMenu.text);
    setShowChat(true);
    setSelectionMenu({ ...selectionMenu, visible: false });
  };

  const handleJumpToAnnotation = (annotation: Annotation) => {
    if (annotation.page_number) {
      goToPage(annotation.page_number);
    }
    setShowAnnotations(false);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin size="large" /></div>;
  }

  if (!book) {
    return <div>图书未找到</div>;
  }

  const isPdf = book.file_format === 'pdf';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#141414', borderBottom: '1px solid #303030', gap: 8 }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/')} />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14 }}>{book.title}</span>
        <Space>
          {isPdf ? (
            <>
              <Button icon={<LeftOutlined />} type="text" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} />
              <InputNumber
                min={1}
                max={totalPages || 1}
                value={currentPage}
                onChange={(v) => v && goToPage(v)}
                size="small"
                style={{ width: 60 }}
              />
              <span style={{ color: '#888', fontSize: 12 }}>/ {totalPages}</span>
              <Button icon={<RightOutlined />} type="text" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} />
              <span style={{ width: 1, height: 16, background: '#303030' }} />
              <Button icon={<ZoomOutOutlined />} type="text" onClick={handleZoomOut} />
              <Tag style={{ fontSize: 11 }}>{zoom}%</Tag>
              <Button icon={<ZoomInOutlined />} type="text" onClick={handleZoomIn} />
            </>
          ) : (
            <Tag style={{ fontSize: 11 }}>阅读中</Tag>
          )}
          <span style={{ width: 1, height: 16, background: '#303030' }} />
          <Button icon={<BookOutlined />} type="text" onClick={() => setShowToc(true)} />
          <Button icon={<HighlightOutlined />} type="text" onClick={() => setShowAnnotations(true)} />
          <Button icon={<MessageOutlined />} type="text" onClick={() => setShowChat(!showChat)} />
        </Space>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#0a0a0a' }}>
        {isPdf ? (
          <PdfViewer
            ref={pdfRef}
            filePath={book.file_path}
            onPageChange={handlePageChange}
            onTocLoad={setToc}
            onTextSelect={handleTextSelect}
            onZoomChange={(scale) => setZoom(Math.round(scale * 100))}
            initialPage={currentPage}
          />
        ) : book.file_format === 'epub' ? (
          <EpubViewer
            ref={epubRef}
            filePath={book.file_path}
            onLocationChange={(cfi, progress) => {
              if (bookId) {
                bookApi.updateProgress(bookId, { current_cfi: cfi, progress_percent: progress }).catch(() => {});
              }
            }}
            onTocLoad={setToc}
            onTextSelect={handleTextSelect}
            initialCfi={undefined}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#888', padding: 48 }}>
            <p>暂不支持此格式的阅读</p>
          </div>
        )}
      </div>

      {/* TOC Drawer */}
      <Drawer title="目录" placement="right" onClose={() => setShowToc(false)} open={showToc} width={300}>
        <List
          dataSource={toc}
          renderItem={(item: TocItem) => (
            <List.Item
              style={{ cursor: 'pointer', padding: '8px 0' }}
              onClick={() => {
                if (!isPdf && item.href) {
                  epubRef.current?.goToHref(item.href);
                } else {
                  goToPage(item.pageNumber);
                }
                setShowToc(false);
              }}
            >
              <span style={{ fontSize: 13 }}>{item.title}</span>
              <span style={{ color: '#888', fontSize: 11, marginLeft: 'auto' }}>P.{item.pageNumber}</span>
            </List.Item>
          )}
        />
      </Drawer>

      {/* Text Selection Menu */}
      <TextSelectionMenu
        visible={selectionMenu.visible}
        position={{ x: selectionMenu.x, y: selectionMenu.y }}
        selectedText={selectionMenu.text}
        onAskAI={handleAskAI}
        onHighlight={handleHighlight}
        onCopy={handleCopy}
        onClose={() => setSelectionMenu({ ...selectionMenu, visible: false })}
      />

      {/* Annotation Sidebar */}
      {bookId && (
        <AnnotationSidebar
          visible={showAnnotations}
          bookId={bookId}
          onClose={() => setShowAnnotations(false)}
          onJumpToAnnotation={handleJumpToAnnotation}
        />
      )}

      {/* Reading Chat Panel */}
      {bookId && (
        <ReadingChatPanel
          visible={showChat}
          bookId={bookId}
          selectedText={chatContext}
          onClose={() => { setShowChat(false); setChatContext(''); }}
        />
      )}
    </div>
  );
}

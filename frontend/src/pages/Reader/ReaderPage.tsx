import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Drawer, List, Spin, message, Space, InputNumber, Tag, Modal, Input, Form, Popover, Select, Slider } from 'antd';
import {
  ArrowLeftOutlined,
  BookOutlined,
  LeftOutlined,
  RightOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  HighlightOutlined,
  MessageOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  StarOutlined,
  StarFilled,
  SettingOutlined,
} from '@ant-design/icons';
import { bookApi, Book } from '../../services/bookApi';
import { annotationApi } from '../../services/annotationApi';
import type { Annotation } from '../../services/annotationApi';
import { knowledgeCardApi } from '../../services/knowledgeCardApi';
import type { TocItem } from '../../types/reader';
import PdfViewer from '../../components/PdfViewer';
import type { PdfViewerRef } from '../../components/PdfViewer';
import EpubViewer from '../../components/EpubViewer';
import type { EpubViewerRef } from '../../components/EpubViewer';
import TextSelectionMenu from '../../components/TextSelectionMenu';
import AnnotationSidebar from '../../components/AnnotationSidebar';
import ReadingChatPanel from '../../components/ReadingChatPanel';
import { useThemeStore } from '../../stores/themeStore';
import { useReaderSettingsStore, FONT_OPTIONS, MARGIN_OPTIONS } from '../../stores/readerSettingsStore';

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const tokens = useThemeStore((s) => s.tokens);
  const getReaderBg = useThemeStore((s) => s.getReaderBg);
  const readerSettings = useReaderSettingsStore();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState<{
    visible: boolean; x: number; y: number; text: string;
  }>({ visible: false, x: 0, y: 0, text: '' });
  const [showChat, setShowChat] = useState(false);
  const [chatContext, setChatContext] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout>();

  // Bookmarks
  const [bookmarkedPages, setBookmarkedPages] = useState<Set<number>>(new Set());

  // Reading session timer
  const sessionStartRef = useRef<Date>(new Date());
  const lastActivityRef = useRef<Date>(new Date());

  // Note modal
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // Knowledge card modal
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardTitle, setCardTitle] = useState('');
  const [cardContent, setCardContent] = useState('');
  const [cardSaving, setCardSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PdfViewerRef>(null);
  const epubRef = useRef<EpubViewerRef>(null);

  // ── Fullscreen ──
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      setToolbarVisible(true);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const anyPanelOpen = showToc || showAnnotations || showChat || noteModalOpen || cardModalOpen;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < 60) {
      setToolbarVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        if (!anyPanelOpen) setToolbarVisible(false);
      }, 3000);
    }
  }, [anyPanelOpen]);

  // ── Navigation helpers ──
  const goPrev = useCallback(() => {
    const isPdf = book?.file_format === 'pdf';
    if (isPdf) pdfRef.current?.goToPage(currentPage - 1);
    else epubRef.current?.goPrev();
  }, [book, currentPage]);

  const goNext = useCallback(() => {
    const isPdf = book?.file_format === 'pdf';
    if (isPdf) pdfRef.current?.goToPage(currentPage + 1);
    else epubRef.current?.goNext();
  }, [book, currentPage, totalPages]);

  // ── Keyboard: A/Left = prev, D/Right = next, F = fullscreen ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && isFullscreen) {
        document.exitFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, toggleFullscreen, isFullscreen]);

  // ── Click zones: left 30% = prev, right 30% = next ──
  const handleClickZone = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    if (ratio < 0.3) goPrev();
    else if (ratio > 0.7) goNext();
  }, [goPrev, goNext]);

  // ── Load book ──
  useEffect(() => {
    if (!bookId) return;
    const load = async () => {
      try {
        const response = await bookApi.get(bookId);
        setBook(response.data);
        if (response.data.reading_status === 'unread') {
          bookApi.update(bookId, { reading_status: 'reading' }).catch(() => {});
        }
      } catch {
        message.error('加载图书失败');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    const loadProg = async () => {
      try {
        const response = await bookApi.getProgress(bookId);
        if (response.data.current_page > 0) setCurrentPage(response.data.current_page);
      } catch { /* ignore */ }
    };
    load();
    loadProg();
  }, [bookId, navigate]);

  // ── Load bookmarks ──
  useEffect(() => {
    if (!bookId) return;
    bookApi.getBookmarks(bookId).then((r) => {
      setBookmarkedPages(new Set(r.data.map((b) => b.page_number)));
    }).catch(() => {});
  }, [bookId]);

  // ── Save reading session on unmount ──
  useEffect(() => {
    return () => {
      const duration = Date.now() - sessionStartRef.current.getTime();
      if (duration > 30000 && bookId) {
        // Session longer than 30s, mark as reading
        bookApi.update(bookId, { reading_status: 'reading' }).catch(() => {});
      }
    };
  }, [bookId]);

  const saveProgress = async (page: number) => {
    if (!bookId) return;
    try {
      const percent = totalPages > 0 ? Math.round((page / totalPages) * 100) : 0;
      await bookApi.updateProgress(bookId, { current_page: page, progress_percent: percent });
    } catch { /* ignore */ }
  };

  const toggleBookmark = async () => {
    if (!bookId) return;
    if (bookmarkedPages.has(currentPage)) {
      await bookApi.deleteBookmark(bookId, currentPage);
      setBookmarkedPages((prev) => {
        const s = new Set(prev);
        s.delete(currentPage);
        return s;
      });
    } else {
      await bookApi.addBookmark(bookId, currentPage);
      setBookmarkedPages((prev) => new Set(prev).add(currentPage));
    }
  };

  const handlePageChange = (page: number, total: number) => {
    setCurrentPage(page);
    setTotalPages(total);
    saveProgress(page);
    lastActivityRef.current = new Date();
  };

  const goToPage = (page: number) => pdfRef.current?.goToPage(page);

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z + 20, 200));
    pdfRef.current?.handleZoomIn();
  };
  const handleZoomOut = () => {
    setZoom((z) => Math.max(z - 20, 50));
    pdfRef.current?.handleZoomOut();
  };

  // ── Text selection ──
  const handleTextSelect = (text: string, rectOrCfi: DOMRect | string) => {
    if (rectOrCfi instanceof DOMRect) {
      setSelectionMenu({ visible: true, x: rectOrCfi.left + rectOrCfi.width / 2, y: rectOrCfi.top - 10, text });
    } else {
      setSelectionMenu({ visible: true, x: window.innerWidth / 2, y: 100, text });
    }
  };

  const handleHighlight = async (color: string) => {
    if (!bookId) return;
    try {
      await annotationApi.create({ book_id: bookId, type: 'highlight', selected_text: selectionMenu.text, highlight_color: color, page_number: currentPage });
      message.success('已高亮');
    } catch { message.error('高亮失败'); }
    setSelectionMenu({ ...selectionMenu, visible: false });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(selectionMenu.text).then(() => message.success('已复制')).catch(() => message.error('复制失败'));
    setSelectionMenu({ ...selectionMenu, visible: false });
  };

  const handleAskAI = () => {
    setChatContext(selectionMenu.text);
    setShowChat(true);
    setSelectionMenu({ ...selectionMenu, visible: false });
  };

  // ── Add note ──
  const handleAddNote = () => {
    setNoteText('');
    setNoteModalOpen(true);
    setSelectionMenu({ ...selectionMenu, visible: false });
  };

  const handleSaveNote = async () => {
    if (!bookId || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      await annotationApi.create({
        book_id: bookId,
        type: 'note',
        selected_text: selectionMenu.text,
        note_content: noteText.trim(),
        page_number: currentPage,
      });
      message.success('批注已保存');
      setNoteModalOpen(false);
    } catch { message.error('保存失败'); }
    finally { setNoteSaving(false); }
  };

  // ── Add knowledge card ──
  const handleAddCard = () => {
    setCardTitle(selectionMenu.text.slice(0, 50));
    setCardContent(selectionMenu.text);
    setCardModalOpen(true);
    setSelectionMenu({ ...selectionMenu, visible: false });
  };

  const handleSaveCard = async () => {
    if (!cardTitle.trim() || !cardContent.trim()) return;
    setCardSaving(true);
    try {
      await knowledgeCardApi.create({
        title: cardTitle.trim(),
        content: cardContent.trim(),
        source_passage: selectionMenu.text,
        source_book_id: bookId || null,
        card_type: 'manual',
      });
      message.success('知识卡片已创建');
      setCardModalOpen(false);
    } catch { message.error('创建失败'); }
    finally { setCardSaving(false); }
  };

  const handleJumpToAnnotation = (annotation: Annotation) => {
    if (annotation.page_number) goToPage(annotation.page_number);
    setShowAnnotations(false);
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin size="large" /></div>;
  if (!book) return <div>图书未找到</div>;

  const isPdf = book.file_format === 'pdf';

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 16px',
        background: tokens.header, borderBottom: `1px solid ${tokens.border}`, gap: 8,
        position: 'relative', zIndex: 50,
        opacity: (toolbarVisible || anyPanelOpen) ? 1 : 0,
        transform: (toolbarVisible || anyPanelOpen) ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'opacity 0.3s, transform 0.3s',
        pointerEvents: (toolbarVisible || anyPanelOpen) ? 'auto' : 'none',
      }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/')} title="返回书库" />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14, color: tokens.text }}>{book.title}</span>
        <Space>
          {isPdf ? (
            <>
              <Button icon={<LeftOutlined />} type="text" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} title="上一页" />
              <InputNumber min={1} max={totalPages || 1} value={currentPage} onChange={(v) => v && goToPage(v)} size="small" style={{ width: 60 }} />
              <span style={{ color: tokens.textMuted, fontSize: 12 }}>/ {totalPages}</span>
              <Button icon={<RightOutlined />} type="text" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} title="下一页" />
              <span style={{ width: 1, height: 16, background: tokens.border }} />
              <Button icon={<ZoomOutOutlined />} type="text" onClick={handleZoomOut} title="缩小" />
              <Tag style={{ fontSize: 11 }}>{zoom}%</Tag>
              <Button icon={<ZoomInOutlined />} type="text" onClick={handleZoomIn} title="放大" />
            </>
          ) : book.file_format === 'epub' ? (
            <>
              <Button icon={<LeftOutlined />} type="text" onClick={() => epubRef.current?.goPrev()} title="上一页" />
              <Tag style={{ fontSize: 11 }}>EPUB</Tag>
              <Button icon={<RightOutlined />} type="text" onClick={() => epubRef.current?.goNext()} title="下一页" />
            </>
          ) : (
            <Tag style={{ fontSize: 11 }}>阅读中</Tag>
          )}
          <span style={{ width: 1, height: 16, background: tokens.border }} />
          <Button
            icon={bookmarkedPages.has(currentPage) ? <StarFilled style={{ color: tokens.primary }} /> : <StarOutlined />}
            type="text"
            onClick={toggleBookmark}
            title={bookmarkedPages.has(currentPage) ? '取消书签' : '添加书签'}
          />
          <Button icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} type="text" onClick={toggleFullscreen} title={isFullscreen ? '退出全屏' : '全屏'} />
          <Button icon={<BookOutlined />} type="text" onClick={() => setShowToc(true)} title="目录" />
          <Button icon={<HighlightOutlined />} type="text" onClick={() => setShowAnnotations(true)} title="笔记" />
          <Button icon={<MessageOutlined />} type="text" onClick={() => setShowChat(!showChat)} title="AI 对话" />
          <Popover
            content={
              <div style={{ width: 240 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 4 }}>字体</div>
                  <Select
                    value={readerSettings.fontFamily}
                    onChange={readerSettings.setFontFamily}
                    options={FONT_OPTIONS}
                    style={{ width: '100%' }}
                    size="small"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 4 }}>
                    字号: {readerSettings.fontSize}px
                  </div>
                  <Slider
                    min={12}
                    max={24}
                    value={readerSettings.fontSize}
                    onChange={readerSettings.setFontSize}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 4 }}>
                    行高: {readerSettings.lineHeight}
                  </div>
                  <Slider
                    min={1.2}
                    max={2.0}
                    step={0.1}
                    value={readerSettings.lineHeight}
                    onChange={readerSettings.setLineHeight}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 4 }}>边距</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {MARGIN_OPTIONS.map((m) => (
                      <Button
                        key={m.key}
                        size="small"
                        type={readerSettings.marginMode === m.key ? 'primary' : 'default'}
                        onClick={() => readerSettings.setMarginMode(m.key)}
                        style={{ flex: 1 }}
                      >
                        {m.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            }
            trigger="click"
            placement="bottomRight"
          >
            <Button icon={<SettingOutlined />} type="text" title="阅读设置" />
          </Popover>
        </Space>
      </div>

      {/* Content area with click zones */}
      <div
        style={{ flex: 1, overflow: 'hidden', background: getReaderBg() || tokens.readerBg, position: 'relative', cursor: 'pointer' }}
        onClick={handleClickZone}
      >
        {/* Left click zone indicator */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%', zIndex: 10, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', opacity: 0, transition: 'opacity 0.2s' }} className="zone-hint">
            <LeftOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
        </div>
        {/* Right click zone indicator */}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '30%', zIndex: 10, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', opacity: 0, transition: 'opacity 0.2s' }} className="zone-hint">
            <RightOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
        </div>

        <div
          style={{ width: '100%', height: '100%', pointerEvents: 'auto', padding: `0 ${MARGIN_OPTIONS.find((m) => m.key === readerSettings.marginMode)?.value || 48}px` }}
        >
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
                if (bookId) bookApi.updateProgress(bookId, { current_cfi: cfi, progress_percent: progress }).catch(() => {});
              }}
              onTocLoad={setToc}
              onTextSelect={handleTextSelect}
              initialCfi={undefined}
              fontSize={readerSettings.fontSize}
              fontFamily={readerSettings.fontFamily}
              lineHeight={readerSettings.lineHeight}
            />
          ) : (
            <div style={{ textAlign: 'center', color: tokens.textMuted, padding: 48 }}>
              <p>暂不支持此格式的阅读</p>
            </div>
          )}
        </div>
      </div>

      {/* TOC Drawer */}
      <Drawer title="目录" placement="right" onClose={() => setShowToc(false)} open={showToc} width={300}>
        <List
          dataSource={toc}
          renderItem={(item: TocItem) => (
            <List.Item
              style={{ cursor: 'pointer', padding: '8px 0' }}
              onClick={() => {
                if (!isPdf && item.href) epubRef.current?.goToHref(item.href);
                else goToPage(item.pageNumber);
                setShowToc(false);
              }}
            >
              <span style={{ fontSize: 13 }}>{item.title}</span>
              {isPdf && <span style={{ color: tokens.textMuted, fontSize: 11, marginLeft: 'auto' }}>P.{item.pageNumber}</span>}
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
        onAddNote={handleAddNote}
        onAddCard={handleAddCard}
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

      {/* Note Modal */}
      <Modal
        title="添加批注"
        open={noteModalOpen}
        onOk={handleSaveNote}
        onCancel={() => setNoteModalOpen(false)}
        confirmLoading={noteSaving}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ marginBottom: 12, padding: '8px 12px', background: tokens.cardBg, borderRadius: 6, borderLeft: `3px solid ${tokens.primary}`, color: tokens.textSecondary, fontSize: 13 }}>
          {selectionMenu.text.length > 100 ? selectionMenu.text.slice(0, 100) + '...' : selectionMenu.text}
        </div>
        <Input.TextArea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="输入你的批注..."
          rows={4}
          autoFocus
        />
      </Modal>

      {/* Knowledge Card Modal */}
      <Modal
        title="创建知识卡片"
        open={cardModalOpen}
        onOk={handleSaveCard}
        onCancel={() => setCardModalOpen(false)}
        confirmLoading={cardSaving}
        okText="创建"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="标题" required>
            <Input value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} placeholder="卡片标题" />
          </Form.Item>
          <Form.Item label="内容" required>
            <Input.TextArea value={cardContent} onChange={(e) => setCardContent(e.target.value)} placeholder="卡片内容" rows={4} />
          </Form.Item>
          <Form.Item label="原文引用">
            <div style={{ padding: '8px 12px', background: tokens.cardBg, borderRadius: 6, color: tokens.textSecondary, fontSize: 13, fontStyle: 'italic' }}>
              {selectionMenu.text.length > 150 ? selectionMenu.text.slice(0, 150) + '...' : selectionMenu.text}
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Bottom progress bar */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: 3, background: tokens.border, zIndex: 100,
        }}
      >
        <div
          style={{
            width: totalPages > 0 ? `${(currentPage / totalPages) * 100}%` : '0%',
            height: '100%',
            background: tokens.primaryGradient
              ? `linear-gradient(90deg, ${tokens.primaryGradient.join(', ')})`
              : tokens.primary,
            transition: 'width 0.3s',
          }}
        />
      </div>

      <style>{`
        div:hover > .zone-hint { opacity: 0.3 !important; }
      `}</style>
    </div>
  );
}

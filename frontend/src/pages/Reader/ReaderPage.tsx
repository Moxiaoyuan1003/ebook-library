// frontend/src/pages/Reader/ReaderPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Drawer, List, Spin, message, Space, InputNumber, Tag } from 'antd';
import { ArrowLeftOutlined, BookOutlined, StarOutlined, LeftOutlined, RightOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { bookApi, Book } from '../../services/bookApi';
import PdfViewer from '../../components/PdfViewer';

interface TocItem {
  title: string;
  pageNumber: number;
  items?: TocItem[];
}

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
    (window as any).__pdfViewer?.goToPage(page);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 20, 200);
    setZoom(newZoom);
    (window as any).__pdfViewer?.handleZoomIn();
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 20, 50);
    setZoom(newZoom);
    (window as any).__pdfViewer?.handleZoomOut();
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin size="large" /></div>;
  }

  if (!book) {
    return <div>图书未找到</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#141414', borderBottom: '1px solid #303030', gap: 8 }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/')} />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14 }}>{book.title}</span>
        <Space>
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
          <span style={{ width: 1, height: 16, background: '#303030' }} />
          <Button icon={<BookOutlined />} type="text" onClick={() => setShowToc(true)} />
          <Button icon={<StarOutlined />} type="text" />
        </Space>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#0a0a0a' }}>
        {book.file_format === 'pdf' ? (
          <PdfViewer
            filePath={book.file_path}
            onPageChange={handlePageChange}
            onTocLoad={setToc}
            initialPage={currentPage}
          />
        ) : book.file_format === 'epub' ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 48 }}>
            <p>EPUB 阅读器将在后续任务中实现</p>
            <p>文件路径: {book.file_path}</p>
          </div>
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
              onClick={() => { goToPage(item.pageNumber); setShowToc(false); }}
            >
              <span style={{ fontSize: 13 }}>{item.title}</span>
              <span style={{ color: '#888', fontSize: 11, marginLeft: 'auto' }}>P.{item.pageNumber}</span>
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  );
}

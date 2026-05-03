import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Drawer, List, Spin, message } from 'antd';
import { ArrowLeftOutlined, BookOutlined, StarOutlined } from '@ant-design/icons';
import { bookApi, Book } from '../../services/bookApi';

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [showToc, setShowToc] = useState(false);

  useEffect(() => {
    if (bookId) {
      loadBook(bookId);
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

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin size="large" /></div>;
  }

  if (!book) {
    return <div>图书未找到</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#141414', borderBottom: '1px solid #303030' }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/')} />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14 }}>{book.title}</span>
        <Button icon={<BookOutlined />} type="text" onClick={() => setShowToc(true)} />
        <Button icon={<StarOutlined />} type="text" />
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#0a0a0a' }}>
        {book.file_format === 'pdf' ? (
          <div style={{ textAlign: 'center', color: '#888' }}>
            <p>PDF 阅读器</p>
            <p>文件路径: {book.file_path}</p>
          </div>
        ) : book.file_format === 'epub' ? (
          <div style={{ textAlign: 'center', color: '#888' }}>
            <p>EPUB 阅读器</p>
            <p>文件路径: {book.file_path}</p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#888' }}>
            <p>暂不支持此格式的阅读</p>
          </div>
        )}
      </div>

      {/* Table of Contents Drawer */}
      <Drawer
        title="目录"
        placement="right"
        onClose={() => setShowToc(false)}
        open={showToc}
        width={300}
      >
        <List
          dataSource={[]}
          renderItem={(item: any) => (
            <List.Item style={{ cursor: 'pointer' }}>{item.title}</List.Item>
          )}
        />
      </Drawer>
    </div>
  );
}

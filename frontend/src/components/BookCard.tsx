import { useState } from 'react';
import { Dropdown, message, Modal, Rate, Select } from 'antd';
import { HeartOutlined, HeartFilled, MoreOutlined, ReadOutlined, StarOutlined, DeleteOutlined, FolderOutlined } from '@ant-design/icons';
import { useThemeStore } from '../stores/themeStore';
import { useBookStore } from '../stores/bookStore';
import { Book } from '../services/bookApi';
import axios from 'axios';
import API_BASE from '../services/apiConfig';

interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
}

function generateGradient(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1},60%,40%), hsl(${h2},60%,30%))`;
}

export default function BookCard({ book, onClick }: BookCardProps) {
  const tokens = useThemeStore((s) => s.tokens);
  const toggleFavorite = useBookStore((s) => s.toggleFavorite);
  const updateRating = useBookStore((s) => s.updateRating);
  const deleteBook = useBookStore((s) => s.deleteBook);
  const [shelves, setShelves] = useState<{ id: string; name: string }[]>([]);
  const [shelfModalOpen, setShelfModalOpen] = useState(false);
  const [selectedShelfId, setSelectedShelfId] = useState<string>('');
  const [hovered, setHovered] = useState(false);

  const fetchShelves = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/bookshelves/`);
      setShelves(res.data);
    } catch { /* ignore */ }
  };

  const handleAddToShelf = async () => {
    if (!selectedShelfId) return;
    try {
      await axios.post(`${API_BASE}/api/bookshelves/${selectedShelfId}/books/${book.id}`);
      message.success('已加入书架');
      setShelfModalOpen(false);
    } catch { message.error('操作失败'); }
  };

  const coverUrl = book.cover_url ? `${API_BASE}/covers/${book.cover_url}` : null;

  const menuItems = [
    { key: 'read', icon: <ReadOutlined />, label: '阅读', onClick: () => onClick(book) },
    { key: 'fav', icon: book.is_favorite ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />, label: book.is_favorite ? '取消收藏' : '收藏', onClick: () => toggleFavorite(book) },
    { key: 'shelf', icon: <FolderOutlined />, label: '加入书架', onClick: () => { fetchShelves(); setShelfModalOpen(true); } },
    { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => { Modal.confirm({ title: '确认删除?', onOk: () => deleteBook(book.id) }); } },
  ];

  return (
    <>
    <div
      onClick={() => onClick(book)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: tokens.cardBg,
        border: tokens.cardBorder,
        borderRadius: tokens.radius,
        padding: 14,
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? tokens.cardShadow : 'none',
      }}
    >
      {/* Cover */}
      <div
        style={{
          width: '100%',
          height: 180,
          borderRadius: 8,
          background: coverUrl ? `url(${coverUrl}) center/cover` : generateGradient(book.title),
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          color: '#fff',
          textAlign: 'center',
          padding: 8,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {!coverUrl && book.title.slice(0, 10)}
        <div
          style={{ position: 'absolute', top: 4, right: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <MoreOutlined style={{ fontSize: 16, color: '#fff', cursor: 'pointer', background: 'rgba(0,0,0,0.4)', borderRadius: 4, padding: '2px 4px' }} />
          </Dropdown>
        </div>
      </div>

      {/* Title + Author */}
      <div style={{ fontSize: 13, fontWeight: 600, color: tokens.text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {book.title}
      </div>
      <div style={{ fontSize: 11, color: tokens.textSecondary, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {book.author || '未知作者'}
      </div>

      {/* Rating + Favorite */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span onClick={(e) => e.stopPropagation()}>
          <Rate
            value={book.rating || 0}
            onChange={(v) => updateRating(book.id, v)}
            count={5}
            style={{ fontSize: 12 }}
            character={<StarOutlined />}
          />
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); toggleFavorite(book); }}
          style={{ cursor: 'pointer', color: book.is_favorite ? '#ff4d4f' : tokens.textMuted, fontSize: 14, marginLeft: 'auto' }}
        >
          {book.is_favorite ? <HeartFilled /> : <HeartOutlined />}
        </span>
      </div>
    </div>

    {/* Add to shelf modal */}
    <Modal
      title="加入书架"
      open={shelfModalOpen}
      onOk={handleAddToShelf}
      onCancel={() => setShelfModalOpen(false)}
      okText="添加"
      cancelText="取消"
    >
      {shelves.length === 0 ? (
        <div style={{ color: tokens.textMuted }}>暂无书架，请先在侧边栏创建书架</div>
      ) : (
        <Select
          placeholder="选择书架"
          style={{ width: '100%' }}
          value={selectedShelfId || undefined}
          onChange={setSelectedShelfId}
          options={shelves.map((s) => ({ value: s.id, label: s.name }))}
        />
      )}
    </Modal>
    </>
  );
}

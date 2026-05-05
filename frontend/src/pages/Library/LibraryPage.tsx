import { useEffect, useState } from 'react';
import { Input, Segmented, Button, Pagination } from 'antd';
import { AppstoreOutlined, UnorderedListOutlined, ImportOutlined, BookOutlined } from '@ant-design/icons';
import { useBookStore } from '../../stores/bookStore';
import { useThemeStore } from '../../stores/themeStore';
import BookCard from '../../components/BookCard';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import DragImportZone from '../../components/DragImportZone';
import ImportDialog from '../../components/ImportDialog';
import { Book } from '../../services/bookApi';
import { useNavigate } from 'react-router-dom';

export default function LibraryPage() {
  const [importOpen, setImportOpen] = useState(false);
  const tokens = useThemeStore((s) => s.tokens);
  const {
    books, total, page, pageSize, loading,
    searchQuery, viewMode, filterStatus, filterFavorite, filterShelfId, filterShelfName,
    fetchBooks, setSearchQuery, setViewMode, setPage, setFilterStatus, setFilterFavorite, setFilterShelf,
  } = useBookStore();
  const navigate = useNavigate();

  useEffect(() => { fetchBooks(); }, [page, searchQuery, filterStatus, filterFavorite, filterShelfId]);

  const handleBookClick = (book: Book) => { navigate(`/reader/${book.id}`); };

  const filters = [
    { key: 'all', label: '全部', active: !filterStatus && !filterFavorite && !filterShelfId },
    { key: 'recent', label: '最近阅读', active: filterStatus === 'reading' },
    { key: 'favorites', label: '已收藏', active: !!filterFavorite },
  ];

  const handleFilterClick = (key: string) => {
    if (key === 'all') { setFilterStatus(null); setFilterFavorite(false); setFilterShelf(null, null); }
    else if (key === 'recent') { setFilterStatus('reading'); }
    else if (key === 'favorites') { setFilterFavorite(true); }
  };

  return (
    <DragImportZone onImportComplete={fetchBooks}>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0, color: tokens.text }}>
              {filterShelfName ? `书架: ${filterShelfName}` : '全部书籍'}
            </h2>
            <span style={{ color: tokens.textMuted, fontSize: 13 }}>{total} 本</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button type="primary" icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
              导入
            </Button>
            <Input.Search
              placeholder="搜索书名或作者"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={fetchBooks}
              style={{ width: 200 }}
            />
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as 'grid' | 'list')}
              options={[
                { value: 'grid', icon: <AppstoreOutlined /> },
                { value: 'list', icon: <UnorderedListOutlined /> },
              ]}
            />
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {filters.map((f) => (
            <div
              key={f.key}
              onClick={() => handleFilterClick(f.key)}
              style={{
                padding: '4px 14px',
                borderRadius: 20,
                fontSize: 13,
                cursor: 'pointer',
                background: f.active ? tokens.primary : 'transparent',
                color: f.active ? '#fff' : tokens.textSecondary,
                border: `1px solid ${f.active ? tokens.primary : tokens.border}`,
                transition: 'all 0.2s',
              }}
            >
              {f.label}
            </div>
          ))}
          {filterShelfId && (
            <div
              onClick={() => { setFilterShelf(null, null); }}
              style={{
                padding: '4px 14px',
                borderRadius: 20,
                fontSize: 13,
                background: tokens.primary,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {filterShelfName} ✕
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            icon={<BookOutlined />}
            title="你的书库还是空的"
            description="导入你的第一本电子书开始阅读"
            action={{ label: '导入图书', onClick: () => setImportOpen(true) }}
          />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
              {books.map((book) => <BookCard key={book.id} book={book} onClick={handleBookClick} />)}
            </div>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Pagination current={page} total={total} pageSize={pageSize} onChange={setPage} showSizeChanger={false} />
            </div>
          </>
        )}

        <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      </div>
    </DragImportZone>
  );
}

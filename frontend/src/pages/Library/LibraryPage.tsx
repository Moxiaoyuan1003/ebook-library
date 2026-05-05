import { useEffect, useState } from 'react';
import { Input, Segmented, Button, Pagination, Collapse, message } from 'antd';
import { AppstoreOutlined, UnorderedListOutlined, PictureOutlined, ImportOutlined, BookOutlined, ThunderboltOutlined, SyncOutlined } from '@ant-design/icons';
import { bookApi } from '../../services/bookApi';
import { useBookStore } from '../../stores/bookStore';
import { useThemeStore } from '../../stores/themeStore';
import BookCard from '../../components/BookCard';
import SkeletonCard from '../../components/SkeletonCard';
import EmptyState from '../../components/EmptyState';
import DragImportZone from '../../components/DragImportZone';
import ImportDialog from '../../components/ImportDialog';
import { Book } from '../../services/bookApi';
import { aiApi } from '../../services/aiApi';
import API_BASE from '../../services/apiConfig';
import { useNavigate } from 'react-router-dom';

export default function LibraryPage() {
  const [importOpen, setImportOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<{ title: string; author: string; reason: string }[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const tokens = useThemeStore((s) => s.tokens);
  const {
    books, total, page, pageSize, loading,
    searchQuery, viewMode, filterStatus, filterFavorite, filterShelfId, filterShelfName,
    fetchBooks, setSearchQuery, setViewMode, setPage, setFilterStatus, setFilterFavorite, setFilterShelf,
  } = useBookStore();
  const navigate = useNavigate();

  useEffect(() => { fetchBooks(); }, [page, searchQuery, filterStatus, filterFavorite, filterShelfId]);

  const fetchRecommendations = async () => {
    setRecsLoading(true);
    try {
      const res = await aiApi.getRecommendations();
      setRecommendations(res.data.recommendations);
    } catch { /* ignore */ }
    setRecsLoading(false);
  };

  const handleBookClick = (book: Book) => { navigate(`/reader/${book.id}`); };

  const handleEnrichAll = async () => {
    message.loading('正在获取封面...', 0);
    try {
      const res = await bookApi.enrichAll();
      message.destroy();
      message.success(`封面获取完成: ${res.data.updated}/${res.data.total} 本更新`);
      fetchBooks();
    } catch {
      message.destroy();
      message.error('获取封面失败');
    }
  };

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
            <Button icon={<SyncOutlined />} onClick={handleEnrichAll}>
              获取封面
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
              onChange={(v) => setViewMode(v as 'grid' | 'list' | 'gallery')}
              options={[
                { value: 'grid', icon: <AppstoreOutlined /> },
                { value: 'list', icon: <UnorderedListOutlined /> },
                { value: 'gallery', icon: <PictureOutlined /> },
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
          <div
            onClick={fetchRecommendations}
            style={{
              padding: '4px 14px',
              borderRadius: 20,
              fontSize: 13,
              cursor: 'pointer',
              background: 'transparent',
              color: tokens.primary,
              border: `1px solid ${tokens.primary}`,
              transition: 'all 0.2s',
            }}
          >
            <ThunderboltOutlined /> AI 推荐
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <Collapse
            defaultActiveKey={['recs']}
            style={{ marginBottom: 20, background: tokens.cardBg, border: tokens.cardBorder }}
            items={[{
              key: 'recs',
              label: <span style={{ color: tokens.text, fontWeight: 600 }}>AI 为你推荐</span>,
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {recommendations.map((rec, i) => (
                    <div key={i} style={{ padding: 12, background: tokens.bg, borderRadius: tokens.radius, border: tokens.cardBorder }}>
                      <div style={{ fontWeight: 600, color: tokens.text, marginBottom: 4 }}>{rec.title}</div>
                      <div style={{ fontSize: 12, color: tokens.textSecondary, marginBottom: 8 }}>{rec.author}</div>
                      <div style={{ fontSize: 13, color: tokens.textMuted }}>{rec.reason}</div>
                    </div>
                  ))}
                </div>
              ),
            }]}
          />
        )}
        {recsLoading && (
          <div style={{ textAlign: 'center', padding: 16, marginBottom: 20, color: tokens.textMuted }}>
            正在生成 AI 推荐...
          </div>
        )}

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
        ) : viewMode === 'gallery' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {books.map((book) => {
                const coverUrl = book.cover_url
                  ? (book.cover_url.startsWith('http') ? book.cover_url : `${API_BASE}${book.cover_url}`)
                  : null;
                return (
                  <div
                    key={book.id}
                    onClick={() => handleBookClick(book)}
                    style={{
                      position: 'relative',
                      borderRadius: tokens.radius,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      aspectRatio: '3 / 4',
                      background: tokens.cardBg,
                      border: tokens.cardBorder,
                      transition: 'transform 0.25s, box-shadow 0.25s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={book.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        background: `linear-gradient(135deg, ${tokens.primary}44, ${tokens.primary}22)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <BookOutlined style={{ fontSize: 48, color: tokens.primary }} />
                      </div>
                    )}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      padding: '40px 16px 16px',
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                      color: '#fff',
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{book.title}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{book.author || '未知作者'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Pagination current={page} total={total} pageSize={pageSize} onChange={setPage} showSizeChanger={false} />
            </div>
          </>
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

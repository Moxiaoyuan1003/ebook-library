import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Rate, Tag, Input, Tabs, List, message, Spin, Modal } from 'antd';
import {
  ArrowLeftOutlined,
  ReadOutlined,
  HeartOutlined,
  HeartFilled,
  DeleteOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { useThemeStore } from '../../stores/themeStore';
import { bookApi, Book } from '../../services/bookApi';
import { annotationApi, Annotation } from '../../services/annotationApi';
import API_BASE from '../../services/apiConfig';

export default function BookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const tokens = useThemeStore((s) => s.tokens);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [newTag, setNewTag] = useState('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    if (!bookId) return;
    Promise.all([
      bookApi.get(bookId).then((r) => setBook(r.data)),
      bookApi.getTags(bookId).then((r) => setTags(r.data.tags)).catch(() => {}),
      annotationApi.list(bookId).then((r) => setAnnotations(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [bookId]);

  const handleAddTag = async () => {
    if (!bookId || !newTag.trim()) return;
    try {
      const r = await bookApi.addTag(bookId, newTag.trim());
      setTags((prev) => [...prev, r.data]);
      setNewTag('');
    } catch {
      message.error('添加标签失败');
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    if (!bookId) return;
    try {
      await bookApi.removeTag(bookId, tagName);
      setTags((prev) => prev.filter((t) => t.name !== tagName));
    } catch {
      message.error('删除标签失败');
    }
  };

  const handleDelete = () => {
    if (!bookId) return;
    Modal.confirm({
      title: '确认删除此书？',
      content: '删除后无法恢复',
      onOk: async () => {
        await bookApi.delete(bookId);
        navigate('/');
      },
    });
  };

  const handleToggleFavorite = async () => {
    if (!bookId || !book) return;
    await bookApi.update(bookId, { is_favorite: !book.is_favorite });
    setBook({ ...book, is_favorite: !book.is_favorite });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!book) {
    return <div style={{ padding: 48, color: tokens.text }}>书籍未找到</div>;
  }

  const coverUrl = book.cover_url ? `${API_BASE}/covers/${book.cover_url}` : null;

  const cardStyle: React.CSSProperties = {
    background: tokens.cardBg,
    border: tokens.cardBorder,
    borderRadius: tokens.radius,
    padding: 24,
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/')}
        style={{ color: tokens.textSecondary, marginBottom: 16 }}
      >
        返回书库
      </Button>

      {/* Book info card */}
      <div style={{ display: 'flex', gap: 24, ...cardStyle, marginBottom: 24 }}>
        {/* Cover */}
        <div
          style={{
            width: 160,
            height: 220,
            borderRadius: 12,
            flexShrink: 0,
            background: coverUrl
              ? `url(${coverUrl}) center/cover`
              : `linear-gradient(135deg, hsl(${book.title.length * 30},60%,40%), hsl(${book.title.length * 30 + 40},60%,30%))`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 14,
            textAlign: 'center',
            padding: 12,
          }}
        >
          {!coverUrl && book.title.slice(0, 10)}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <h1 style={{ color: tokens.text, margin: '0 0 8px', fontSize: 22 }}>{book.title}</h1>
          <div style={{ color: tokens.textSecondary, marginBottom: 4 }}>
            {book.author || '未知作者'}
            {book.publisher ? ` · ${book.publisher}` : ''}
          </div>
          {book.isbn && (
            <div style={{ color: tokens.textMuted, fontSize: 13, marginBottom: 12 }}>
              ISBN: {book.isbn}
            </div>
          )}

          <Rate
            value={book.rating || 0}
            onChange={(v) => bookId && bookApi.update(bookId, { rating: v })}
          />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            <Tag color={book.file_format === 'pdf' ? 'red' : 'green'}>
              {book.file_format?.toUpperCase()}
            </Tag>
            {tags.map((tag) => (
              <Tag key={tag.id} closable onClose={() => handleDeleteTag(tag.name)}>
                {tag.name}
              </Tag>
            ))}
            <Input
              size="small"
              placeholder="+ 标签"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onPressEnter={handleAddTag}
              onBlur={handleAddTag}
              style={{ width: 80 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <Button
              type="primary"
              icon={<ReadOutlined />}
              onClick={() => navigate(`/reader/${bookId}`)}
            >
              {book.reading_status === 'reading' ? '继续阅读' : '开始阅读'}
            </Button>
            <Button
              icon={
                book.is_favorite ? (
                  <HeartFilled style={{ color: '#ff4d4f' }} />
                ) : (
                  <HeartOutlined />
                )
              }
              onClick={handleToggleFavorite}
            >
              {book.is_favorite ? '已收藏' : '收藏'}
            </Button>
            {book.summary && (
              <Button
                icon={<ExportOutlined />}
                onClick={() => {
                  const blob = new Blob([book.summary || ''], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${book.title}_summary.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                导出摘要
              </Button>
            )}
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              删除
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs: Notes / Summary */}
      <div style={cardStyle}>
        <Tabs
          items={[
            {
              key: 'notes',
              label: `笔记 (${annotations.length})`,
              children: (
                <List
                  dataSource={annotations}
                  locale={{ emptyText: '暂无笔记' }}
                  renderItem={(a) => (
                    <List.Item style={{ color: tokens.text }}>
                      <div style={{ width: '100%' }}>
                        <div style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 4 }}>
                          P.{a.page_number} · {a.type === 'highlight' ? '高亮' : '批注'}
                        </div>
                        {a.type === 'highlight' && (
                          <div
                            style={{
                              borderLeft: `3px solid ${a.highlight_color || tokens.primary}`,
                              paddingLeft: 8,
                              color: tokens.textSecondary,
                            }}
                          >
                            {a.selected_text}
                          </div>
                        )}
                        {a.type === 'note' && (
                          <div>
                            <div style={{ color: tokens.textSecondary }}>{a.selected_text}</div>
                            <div style={{ marginTop: 4, color: tokens.text }}>{a.note_content}</div>
                          </div>
                        )}
                      </div>
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'summary',
              label: '摘要',
              children: book.summary ? (
                <div style={{ color: tokens.textSecondary, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                  {book.summary}
                </div>
              ) : (
                <div style={{ color: tokens.textMuted, textAlign: 'center', padding: 24 }}>
                  暂无摘要，可在阅读时使用 AI 生成
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

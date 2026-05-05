import { useState, useEffect } from 'react';
import { Spin, Tag } from 'antd';
import { EditOutlined, HighlightOutlined, BookOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../stores/themeStore';
import { annotationApi, Annotation } from '../../services/annotationApi';
import { bookApi, Book } from '../../services/bookApi';

export default function TimelinePage() {
  const tokens = useThemeStore((s) => s.tokens);
  const navigate = useNavigate();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [bookMap, setBookMap] = useState<Record<string, Book>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Load all annotations by fetching for each book is inefficient,
        // but the API requires book_id. We'll load recent annotations from all books.
        // For now, we'll get all books first, then fetch annotations for each.
        const booksRes = await bookApi.list({ page_size: 100 });
        const books = booksRes.data.items;
        const map: Record<string, Book> = {};
        books.forEach((b) => (map[b.id] = b));

        const allAnnotations: Annotation[] = [];
        await Promise.all(
          books.map(async (b) => {
            try {
              const res = await annotationApi.list(b.id);
              allAnnotations.push(...res.data);
            } catch {
              // skip
            }
          }),
        );

        // Sort by created_at descending
        allAnnotations.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        setAnnotations(allAnnotations.slice(0, 100));
        setBookMap(map);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const cardStyle: React.CSSProperties = {
    background: tokens.cardBg,
    border: tokens.cardBorder,
    borderRadius: tokens.radius,
    padding: 16,
    marginBottom: 12,
  };

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h2 style={{ color: tokens.text, marginBottom: 24 }}>批注时间线</h2>

      {annotations.length === 0 ? (
        <div style={{ textAlign: 'center', color: tokens.textMuted, padding: 48 }}>
          暂无批注记录
        </div>
      ) : (
        <div>
          {annotations.map((a) => {
            const book = bookMap[a.book_id];
            return (
              <div
                key={a.id}
                style={cardStyle}
                onClick={() => navigate(`/reader/${a.book_id}`)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  {a.type === 'highlight' ? (
                    <HighlightOutlined style={{ color: a.highlight_color || tokens.primary }} />
                  ) : (
                    <EditOutlined style={{ color: tokens.primary }} />
                  )}
                  <Tag color={a.type === 'highlight' ? 'blue' : 'green'}>
                    {a.type === 'highlight' ? '高亮' : '批注'}
                  </Tag>
                  {book && (
                    <span
                      style={{ color: tokens.textSecondary, fontSize: 12, cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/book/${a.book_id}`);
                      }}
                    >
                      <BookOutlined style={{ marginRight: 4 }} />
                      {book.title}
                    </span>
                  )}
                  <span style={{ color: tokens.textMuted, fontSize: 11, marginLeft: 'auto' }}>
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                {a.page_number != null && (
                  <div style={{ fontSize: 12, color: tokens.textMuted, marginBottom: 4 }}>
                    P.{a.page_number}
                  </div>
                )}
                {a.selected_text && (
                  <div
                    style={{
                      color: tokens.textSecondary,
                      borderLeft: `3px solid ${a.highlight_color || tokens.border}`,
                      paddingLeft: 8,
                      marginBottom: a.note_content ? 8 : 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {a.selected_text.length > 150
                      ? a.selected_text.slice(0, 150) + '...'
                      : a.selected_text}
                  </div>
                )}
                {a.note_content && (
                  <div style={{ color: tokens.text, fontSize: 13, lineHeight: 1.6 }}>
                    {a.note_content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

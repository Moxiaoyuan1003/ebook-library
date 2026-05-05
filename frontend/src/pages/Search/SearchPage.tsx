import { useState, useCallback } from 'react';
import { Input, Spin, Tag } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../stores/themeStore';
import { searchApi, SearchPassage } from '../../services/searchApi';

export default function SearchPage() {
  const tokens = useThemeStore((s) => s.tokens);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchPassage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const r = await searchApi.search(q.trim());
      setResults(r.data.results);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const highlight = (text: string, q: string) => {
    if (!q || !text) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((p, i) =>
      p.toLowerCase() === q.toLowerCase() ? (
        <span
          key={i}
          style={{
            background: tokens.primary,
            color: '#fff',
            padding: '0 2px',
            borderRadius: 2,
          }}
        >
          {p}
        </span>
      ) : (
        p
      ),
    );
  };

  // Group results by book
  const grouped = results.reduce(
    (acc, r) => {
      const key = r.book_id;
      if (!acc[key]) acc[key] = { book_id: r.book_id, book_title: r.book_title, passages: [] };
      acc[key].passages.push(r);
      return acc;
    },
    {} as Record<string, { book_id: string; book_title: string; passages: SearchPassage[] }>,
  );

  const groups = Object.values(grouped);

  const cardStyle: React.CSSProperties = {
    background: tokens.cardBg,
    border: tokens.cardBorder,
    borderRadius: tokens.radius,
    padding: 14,
    marginBottom: 8,
    cursor: 'pointer',
    transition: 'background 0.2s',
  };

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h2 style={{ color: tokens.text, marginBottom: 16 }}>全文搜索</h2>
      <Input.Search
        placeholder="搜索书籍内容、批注、笔记..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onSearch={doSearch}
        size="large"
        style={{ marginBottom: 24 }}
        loading={loading}
      />

      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && !searched && (
        <div style={{ textAlign: 'center', color: tokens.textMuted, padding: 48 }}>
          输入关键词搜索书籍内容、批注和笔记
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div style={{ textAlign: 'center', color: tokens.textMuted, padding: 48 }}>
          未找到匹配结果
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div>
          <div style={{ color: tokens.textSecondary, marginBottom: 12, fontSize: 13 }}>
            找到 {results.length} 条结果，来自 {groups.length} 本书
          </div>
          {groups.map((group) => (
            <div key={group.book_id} style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/book/${group.book_id}`)}
              >
                <BookOutlined style={{ color: tokens.primary }} />
                <span style={{ color: tokens.text, fontWeight: 600, fontSize: 15 }}>
                  {group.book_title}
                </span>
                <Tag style={{ marginLeft: 'auto' }}>{group.passages.length} 条</Tag>
              </div>
              {group.passages.map((passage, idx) => (
                <div
                  key={idx}
                  style={cardStyle}
                  onClick={() => navigate(`/reader/${group.book_id}`)}
                >
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    {passage.page_number != null && (
                      <span style={{ color: tokens.textMuted, fontSize: 12 }}>
                        P.{passage.page_number}
                      </span>
                    )}
                    {passage.chapter && (
                      <span style={{ color: tokens.textMuted, fontSize: 12 }}>
                        {passage.chapter}
                      </span>
                    )}
                    <span style={{ color: tokens.textMuted, fontSize: 12, marginLeft: 'auto' }}>
                      相关度: {(passage.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ color: tokens.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
                    {highlight(passage.content.slice(0, 200), query)}
                    {passage.content.length > 200 && '...'}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

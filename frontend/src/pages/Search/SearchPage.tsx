import { useEffect, useState } from 'react';
import { Tabs, Input, Card, Empty, Spin, Pagination, Tag, Typography } from 'antd';
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useBookStore } from '../../stores/bookStore';
import { Book } from '../../services/bookApi';
import BookCard from '../../components/BookCard';
import { aiApi, CrossBookSource } from '../../services/aiApi';

const { Text, Paragraph } = Typography;

export default function SearchPage() {
  const navigate = useNavigate();
  const { books, total, page, pageSize, loading, searchQuery, fetchBooks, setSearchQuery, setPage } = useBookStore();

  const [crossQuery, setCrossQuery] = useState('');
  const [crossLoading, setCrossLoading] = useState(false);
  const [crossAnswer, setCrossAnswer] = useState('');
  const [crossSources, setCrossSources] = useState<CrossBookSource[]>([]);

  useEffect(() => {
    fetchBooks();
  }, [page, searchQuery]);

  const handleBookClick = (book: Book) => {
    navigate(`/reader/${book.id}`);
  };

  const handleCrossSearch = async (value: string) => {
    if (!value.trim()) return;
    setCrossLoading(true);
    setCrossAnswer('');
    setCrossSources([]);
    try {
      const response = await aiApi.crossBookQuery(value);
      setCrossAnswer(response.data.answer);
      setCrossSources(response.data.sources);
    } catch {
      setCrossAnswer('查询失败，请稍后重试。');
      setCrossSources([]);
    } finally {
      setCrossLoading(false);
    }
  };

  const searchTab = (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Input.Search
          placeholder="搜索书名或作者"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onSearch={fetchBooks}
          enterButton={<><SearchOutlined /> 搜索</>}
          size="large"
          style={{ maxWidth: 500 }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : books.length === 0 ? (
        <Empty description="暂无搜索结果" />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {books.map((book) => (
              <BookCard key={book.id} book={book} onClick={handleBookClick} />
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Pagination current={page} total={total} pageSize={pageSize} onChange={setPage} showSizeChanger={false} />
          </div>
        </>
      )}
    </div>
  );

  const crossBookTab = (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Input.Search
          placeholder="输入自然语言问题，跨书籍检索"
          value={crossQuery}
          onChange={(e) => setCrossQuery(e.target.value)}
          onSearch={handleCrossSearch}
          enterButton={<><SearchOutlined /> 跨书查询</>}
          size="large"
          loading={crossLoading}
          style={{ maxWidth: 600 }}
        />
      </div>

      {crossLoading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#888' }}>正在跨书检索并生成回答...</div>
        </div>
      )}

      {!crossLoading && crossAnswer && (
        <div>
          <Card
            title="AI 回答"
            style={{ marginBottom: 24, background: '#141414', borderColor: '#303030' }}
            headStyle={{ borderColor: '#303030' }}
          >
            <Paragraph style={{ whiteSpace: 'pre-wrap', color: '#d9d9d9', margin: 0 }}>
              {crossAnswer}
            </Paragraph>
          </Card>

          {crossSources.length > 0 && (
            <>
              <h3 style={{ color: '#d9d9d9', marginBottom: 16 }}>来源 ({crossSources.length} 本书)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {crossSources.map((source) => (
                  <Card
                    key={source.book_id}
                    size="small"
                    style={{ background: '#1a1a1a', borderColor: '#303030' }}
                    headStyle={{ borderColor: '#303030' }}
                    title={
                      <span
                        style={{ cursor: 'pointer', color: '#1677ff' }}
                        onClick={() => navigate(`/reader/${source.book_id}`)}
                      >
                        <FileTextOutlined style={{ marginRight: 8 }} />
                        {source.book_title}
                      </span>
                    }
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {source.passages.map((passage, idx) => (
                        <div key={idx} style={{ padding: '8px 12px', background: '#111', borderRadius: 6, border: '1px solid #262626' }}>
                          <div style={{ marginBottom: 4 }}>
                            {passage.page_number !== null && (
                              <Tag style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
                                第 {passage.page_number} 页
                              </Tag>
                            )}
                            <Text style={{ fontSize: 10, color: '#666' }}>
                              相关度: {(passage.score * 100).toFixed(1)}%
                            </Text>
                          </div>
                          <Paragraph
                            ellipsis={{ rows: 3, expandable: true }}
                            style={{ margin: 0, fontSize: 13, color: '#aaa' }}
                          >
                            {passage.content}
                          </Paragraph>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!crossLoading && !crossAnswer && (
        <Empty description="输入问题开始跨书查询" style={{ padding: 48 }} />
      )}
    </div>
  );

  const tabItems = [
    { key: 'search', label: '搜索', children: searchTab },
    { key: 'cross-book', label: '跨书查询', children: crossBookTab },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: '0 0 16px' }}>搜索</h2>
      <Tabs defaultActiveKey="search" items={tabItems} />
    </div>
  );
}

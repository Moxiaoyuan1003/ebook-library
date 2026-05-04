import { useEffect } from 'react';
import { Input, Segmented, Empty, Spin, Pagination } from 'antd';
import { AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useBookStore } from '../../stores/bookStore';
import BookCard from '../../components/BookCard';
import { Book } from '../../services/bookApi';
import { useNavigate } from 'react-router-dom';

export default function LibraryPage() {
  const {
    books,
    total,
    page,
    pageSize,
    loading,
    searchQuery,
    viewMode,
    fetchBooks,
    setSearchQuery,
    setViewMode,
    setPage,
  } = useBookStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchBooks();
  }, [page, searchQuery]);

  const handleBookClick = (book: Book) => {
    navigate(`/reader/${book.id}`);
  };

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: 0 }}>全部书籍</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Input.Search
            placeholder="搜索书名或作者"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={fetchBooks}
            style={{ width: 240 }}
          />
          <Segmented
            value={viewMode}
            onChange={(value) => setViewMode(value as 'grid' | 'list')}
            options={[
              { value: 'grid', icon: <AppstoreOutlined /> },
              { value: 'list', icon: <UnorderedListOutlined /> },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : books.length === 0 ? (
        <Empty description="暂无书籍" />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 16,
            }}
          >
            {books.map((book) => (
              <BookCard key={book.id} book={book} onClick={handleBookClick} />
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Pagination
              current={page}
              total={total}
              pageSize={pageSize}
              onChange={setPage}
              showSizeChanger={false}
            />
          </div>
        </>
      )}
    </div>
  );
}

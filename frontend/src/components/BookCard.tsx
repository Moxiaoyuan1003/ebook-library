import { Card, Tag, Rate } from 'antd';
import { BookOutlined, StarFilled } from '@ant-design/icons';
import { Book } from '../services/bookApi';

interface BookCardProps {
  book: Book;
  onClick: (book: Book) => void;
}

export default function BookCard({ book, onClick }: BookCardProps) {
  const formatColors: Record<string, string> = {
    pdf: '#ff4d4f',
    epub: '#52c41a',
    txt: '#1677ff',
    mobi: '#faad14',
    docx: '#722ed1',
  };

  return (
    <Card
      hoverable
      onClick={() => onClick(book)}
      style={{ width: '100%' }}
      cover={
        <div
          style={{
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1a1a2e',
          }}
        >
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
            />
          ) : (
            <BookOutlined style={{ fontSize: 48, color: '#444' }} />
          )}
        </div>
      }
    >
      <Card.Meta
        title={<span style={{ fontSize: 13 }}>{book.title}</span>}
        description={
          <div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
              {book.author || '未知作者'}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Tag
                color={formatColors[book.file_format] || '#888'}
                style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}
              >
                {book.file_format.toUpperCase()}
              </Tag>
              {book.rating && <Rate disabled value={book.rating} style={{ fontSize: 10 }} />}
              {book.is_favorite && <StarFilled style={{ fontSize: 12, color: '#faad14' }} />}
            </div>
          </div>
        }
      />
    </Card>
  );
}

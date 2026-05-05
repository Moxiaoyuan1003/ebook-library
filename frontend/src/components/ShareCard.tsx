import { useRef, useState } from 'react';
import { Button, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import html2canvas from 'html2canvas';
import { Book } from '../services/bookApi';
import { useThemeStore } from '../stores/themeStore';
import API_BASE from '../services/apiConfig';

interface ShareCardProps {
  book: Book;
}

export default function ShareCard({ book }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const tokens = useThemeStore((s) => s.tokens);

  const coverUrl = book.cover_url
    ? (book.cover_url.startsWith('http') ? book.cover_url : `${API_BASE}${book.cover_url}`)
    : null;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `${book.title}_share.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      message.success('分享卡片已保存');
    } catch {
      message.error('生成失败');
    }
    setGenerating(false);
  };

  return (
    <>
      <div
        ref={cardRef}
        style={{
          width: 360,
          padding: 24,
          borderRadius: 16,
          background: `linear-gradient(135deg, ${tokens.primary}22, ${tokens.primary}08)`,
          border: `1px solid ${tokens.border}`,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div
            style={{
              width: 80,
              height: 110,
              borderRadius: 8,
              flexShrink: 0,
              background: coverUrl
                ? `url(${coverUrl}) center/cover`
                : `linear-gradient(135deg, ${tokens.primary}44, ${tokens.primary}22)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            {!coverUrl && book.title.slice(0, 6)}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: tokens.text, marginBottom: 4 }}>
              {book.title}
            </div>
            <div style={{ fontSize: 13, color: tokens.textSecondary, marginBottom: 8 }}>
              {book.author || '未知作者'}
            </div>
            {book.rating && (
              <div style={{ color: '#f59e0b', fontSize: 14 }}>
                {'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}
              </div>
            )}
          </div>
        </div>
        {book.summary && (
          <div
            style={{
              fontSize: 12,
              color: tokens.textMuted,
              lineHeight: 1.6,
              maxHeight: 60,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: 12,
            }}
          >
            {book.summary.slice(0, 100)}...
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: `1px solid ${tokens.border}`,
            paddingTop: 12,
          }}
        >
          <span style={{ fontSize: 11, color: tokens.textMuted }}>个人图书管理系统</span>
          <span style={{ fontSize: 11, color: tokens.textMuted }}>
            {book.file_format?.toUpperCase()} · {book.reading_status === 'finished' ? '已读完' : '阅读中'}
          </span>
        </div>
      </div>
      <Button
        icon={<DownloadOutlined />}
        loading={generating}
        onClick={handleDownload}
        style={{ marginTop: 12 }}
      >
        保存分享卡片
      </Button>
    </>
  );
}

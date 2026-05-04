// frontend/src/components/AnnotationSidebar.tsx
import { useState, useEffect } from 'react';
import { Drawer, List, Button, Empty, Spin, Popconfirm, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { annotationApi, Annotation } from '../services/annotationApi';

interface AnnotationSidebarProps {
  visible: boolean;
  bookId: string;
  onClose: () => void;
  onJumpToAnnotation: (annotation: Annotation) => void;
}

export default function AnnotationSidebar({
  visible,
  bookId,
  onClose,
  onJumpToAnnotation,
}: AnnotationSidebarProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && bookId) {
      loadAnnotations();
    }
  }, [visible, bookId]);

  const loadAnnotations = async () => {
    setLoading(true);
    try {
      const response = await annotationApi.list(bookId);
      setAnnotations(response.data);
    } catch {
      message.error('加载标注失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await annotationApi.delete(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      message.success('已删除');
    } catch {
      message.error('删除失败');
    }
  };

  return (
    <Drawer
      title="标注"
      placement="right"
      onClose={onClose}
      open={visible}
      width={320}
      styles={{ body: { padding: 0 } }}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : annotations.length === 0 ? (
        <Empty description="暂无标注" style={{ padding: 48 }} />
      ) : (
        <List
          dataSource={annotations}
          renderItem={(annotation) => (
            <List.Item
              style={{
                cursor: 'pointer',
                padding: '12px 16px',
                borderBottom: '1px solid #303030',
              }}
              onClick={() => onJumpToAnnotation(annotation)}
              actions={[
                <Popconfirm
                  key="delete"
                  title="确认删除此标注？"
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    handleDelete(annotation.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>,
              ]}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%' }}>
                {/* Color dot */}
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: annotation.highlight_color || annotation.color || '#ffeb3b',
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {annotation.selected_text && (
                    <div
                      style={{
                        fontSize: 13,
                        color: '#e0e0e0',
                        marginBottom: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {annotation.selected_text}
                    </div>
                  )}
                  {annotation.note_content && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#999',
                        marginTop: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {annotation.note_content}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    {annotation.page_number ? `第 ${annotation.page_number} 页` : ''}
                    {annotation.page_number && annotation.created_at ? ' · ' : ''}
                    {annotation.created_at
                      ? new Date(annotation.created_at).toLocaleDateString('zh-CN')
                      : ''}
                  </div>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </Drawer>
  );
}

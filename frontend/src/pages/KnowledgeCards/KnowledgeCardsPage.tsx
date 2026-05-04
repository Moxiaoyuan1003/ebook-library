import { useEffect, useState } from 'react';
import {
  Card,
  Tag,
  Input,
  Select,
  Button,
  Empty,
  Spin,
  Pagination,
  Drawer,
  Modal,
  Form,
  Popconfirm,
  Space,
  message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, FileTextOutlined, LinkOutlined } from '@ant-design/icons';
import { useKnowledgeCardStore } from '../../stores/knowledgeCardStore';
import {
  knowledgeCardApi,
  KnowledgeCard,
  KnowledgeCardCreateData,
} from '../../services/knowledgeCardApi';

const CARD_TYPE_COLORS: Record<string, string> = {
  search_result: 'blue',
  ai_chat: 'purple',
  manual: 'green',
};

const CARD_TYPE_LABELS: Record<string, string> = {
  search_result: '搜索结果',
  ai_chat: 'AI对话',
  manual: '手动创建',
};

const cardTypeOptions = [
  { value: '', label: '全部类型' },
  { value: 'search_result', label: '搜索结果' },
  { value: 'ai_chat', label: 'AI对话' },
  { value: 'manual', label: '手动创建' },
];

export default function KnowledgeCardsPage() {
  const {
    cards,
    total,
    page,
    pageSize,
    loading,
    searchQuery,
    cardTypeFilter,
    fetchCards,
    setSearchQuery,
    setCardTypeFilter,
    setPage,
  } = useKnowledgeCardStore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<KnowledgeCard | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm] = Form.useForm<KnowledgeCardCreateData>();

  useEffect(() => {
    fetchCards();
  }, [page, cardTypeFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchCards();
  };

  const handleCardClick = async (card: KnowledgeCard) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const response = await knowledgeCardApi.get(card.id);
      setSelectedCard(response.data);
    } catch {
      message.error('加载卡片详情失败');
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleDelete = async (cardId: string) => {
    try {
      await knowledgeCardApi.delete(cardId);
      message.success('卡片已删除');
      fetchCards();
      if (selectedCard?.id === cardId) {
        setDrawerOpen(false);
        setSelectedCard(null);
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      await knowledgeCardApi.create(values);
      message.success('卡片已创建');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchCards();
    } catch {
      // validation error or API error
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateCancel = () => {
    setCreateModalOpen(false);
    createForm.resetFields();
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedCard(null);
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: 0, color: '#fff' }}>知识卡片</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Input.Search
            placeholder="搜索标题或内容"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 240 }}
          />
          <Select
            value={cardTypeFilter ?? ''}
            onChange={(value) => {
              setCardTypeFilter(value || null);
              setPage(1);
            }}
            options={cardTypeOptions}
            style={{ width: 130 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建卡片
          </Button>
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : cards.length === 0 ? (
        <Empty description="暂无知识卡片" />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            {cards.map((card) => (
              <Card
                key={card.id}
                hoverable
                onClick={() => handleCardClick(card)}
                style={{ background: '#1a1a2e', borderColor: '#303030' }}
                actions={[
                  <Popconfirm
                    key="delete"
                    title="确定删除该卡片?"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDelete(card.id);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="删除"
                    cancelText="取消"
                  >
                    <DeleteOutlined
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: '#ff4d4f' }}
                    />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  avatar={<FileTextOutlined style={{ fontSize: 24, color: '#444' }} />}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, color: '#fff' }}>{card.title}</span>
                      <Tag color={CARD_TYPE_COLORS[card.card_type] || 'default'}>
                        {CARD_TYPE_LABELS[card.card_type] || card.card_type}
                      </Tag>
                    </div>
                  }
                  description={
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#888',
                          marginBottom: 8,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {card.content}
                      </div>
                      {card.tags && card.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {card.tags.map((tag) => (
                            <Tag
                              key={tag}
                              style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}
                            >
                              {tag}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  }
                />
              </Card>
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

      {/* Detail Drawer */}
      <Drawer
        title={selectedCard?.title || '卡片详情'}
        open={drawerOpen}
        onClose={handleDrawerClose}
        width={500}
        styles={{ body: { background: '#0a0a0a' }, header: { background: '#1a1a1a' } }}
      >
        {drawerLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : selectedCard ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Tag color={CARD_TYPE_COLORS[selectedCard.card_type] || 'default'}>
                {CARD_TYPE_LABELS[selectedCard.card_type] || selectedCard.card_type}
              </Tag>
            </div>

            <h4 style={{ color: '#fff', marginBottom: 8 }}>内容</h4>
            <div
              style={{ color: '#ccc', marginBottom: 24, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}
            >
              {selectedCard.content}
            </div>

            {selectedCard.annotation && (
              <>
                <h4 style={{ color: '#fff', marginBottom: 8 }}>批注</h4>
                <div
                  style={{
                    color: '#ccc',
                    marginBottom: 24,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.8,
                    padding: '8px 12px',
                    borderLeft: '3px solid #1677ff',
                    background: '#1a1a2e',
                  }}
                >
                  {selectedCard.annotation}
                </div>
              </>
            )}

            {selectedCard.source_passage && (
              <>
                <h4 style={{ color: '#fff', marginBottom: 8 }}>原文引用</h4>
                <div
                  style={{
                    color: '#999',
                    marginBottom: 24,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.8,
                    fontStyle: 'italic',
                    padding: '8px 12px',
                    borderLeft: '3px solid #303030',
                    background: '#111',
                  }}
                >
                  {selectedCard.source_passage}
                </div>
              </>
            )}

            {selectedCard.tags && selectedCard.tags.length > 0 && (
              <>
                <h4 style={{ color: '#fff', marginBottom: 8 }}>标签</h4>
                <Space style={{ marginBottom: 24 }}>
                  {selectedCard.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>
              </>
            )}

            <div style={{ color: '#666', fontSize: 12, marginTop: 16 }}>
              <div>创建时间: {new Date(selectedCard.created_at).toLocaleString()}</div>
              <div>更新时间: {new Date(selectedCard.updated_at).toLocaleString()}</div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
              <Button icon={<LinkOutlined />} disabled>
                关联卡片
              </Button>
              <Popconfirm
                title="确定删除该卡片?"
                onConfirm={() => handleDelete(selectedCard.id)}
                okText="删除"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* Create Modal */}
      <Modal
        title="新建知识卡片"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={handleCreateCancel}
        confirmLoading={createLoading}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical" initialValues={{ card_type: 'manual' }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="输入卡片标题" />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <Input.TextArea rows={4} placeholder="输入卡片内容" />
          </Form.Item>
          <Form.Item name="annotation" label="批注">
            <Input.TextArea rows={2} placeholder="添加批注 (可选)" />
          </Form.Item>
          <Form.Item name="source_passage" label="原文引用">
            <Input.TextArea rows={2} placeholder="添加原文引用 (可选)" />
          </Form.Item>
          <Form.Item name="card_type" label="类型">
            <Select
              options={[
                { value: 'manual', label: '手动创建' },
                { value: 'search_result', label: '搜索结果' },
                { value: 'ai_chat', label: 'AI对话' },
              ]}
            />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

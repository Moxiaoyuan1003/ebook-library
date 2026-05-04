// frontend/src/components/ReadingChatPanel.tsx
import { useState, useRef, useEffect } from 'react';
import { Drawer, Input, Button, List, Spin, Typography, message } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import { readingSessionApi, ReadingMessage } from '../services/readingSessionApi';

interface ReadingChatPanelProps {
  visible: boolean;
  bookId: string;
  selectedText?: string;
  onClose: () => void;
}

export default function ReadingChatPanel({ visible, bookId, selectedText, onClose }: ReadingChatPanelProps) {
  const [messages, setMessages] = useState<ReadingMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || loading) return;

    const userMessage: ReadingMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const contextPassages = selectedText ? [{ text: selectedText }] : undefined;
      const response = await readingSessionApi.chat({
        book_id: bookId,
        message: text,
        context_passages: contextPassages,
        session_id: sessionId,
      });

      const assistantMessage: ReadingMessage = {
        role: 'assistant',
        content: response.data.reply,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSessionId(response.data.session_id);
    } catch (error) {
      message.error('AI 回复失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Drawer
      title="AI 对话"
      placement="right"
      onClose={onClose}
      open={visible}
      width={380}
      styles={{
        header: { background: '#1a1a1a', borderBottom: '1px solid #303030' },
        body: { background: '#141414', padding: 0, display: 'flex', flexDirection: 'column' },
      }}
    >
      {/* Message list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 12px' }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: '#666', padding: '40px 0' }}>
            <Typography.Text style={{ color: '#666' }}>
              开始与 AI 对话，探讨书中内容
            </Typography.Text>
          </div>
        )}
        <List
          dataSource={messages}
          renderItem={(msg: ReadingMessage) => (
            <List.Item
              style={{
                border: 'none',
                padding: '8px 0',
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: msg.role === 'user' ? '#177ddc' : '#333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {msg.role === 'user' ? (
                    <UserOutlined style={{ fontSize: 14, color: '#fff' }} />
                  ) : (
                    <RobotOutlined style={{ fontSize: 14, color: '#aaa' }} />
                  )}
                </div>
                <div
                  style={{
                    background: msg.role === 'user' ? '#177ddc' : '#1f1f1f',
                    borderRadius: 12,
                    padding: '8px 12px',
                    color: '#e0e0e0',
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            </List.Item>
          )}
        />
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
            <Spin size="small" />
            <Typography.Text style={{ color: '#888', fontSize: 12 }}>AI 正在思考...</Typography.Text>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Context indicator */}
      {selectedText && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #303030',
            background: '#1a1a1a',
          }}
        >
          <Typography.Text style={{ color: '#888', fontSize: 11 }} ellipsis={{ tooltip: selectedText }}>
            上下文: {selectedText.length > 60 ? selectedText.slice(0, 60) + '...' : selectedText}
          </Typography.Text>
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid #303030',
          background: '#1a1a1a',
          display: 'flex',
          gap: 8,
        }}
      >
        <Input.TextArea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你的问题..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{
            background: '#262626',
            border: '1px solid #303030',
            color: '#e0e0e0',
            borderRadius: 8,
            resize: 'none',
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={loading}
          disabled={!inputValue.trim()}
          style={{ borderRadius: 8, height: 'auto' }}
        >
          发送
        </Button>
      </div>
    </Drawer>
  );
}

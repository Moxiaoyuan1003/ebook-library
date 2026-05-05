import { useState, useRef, useEffect } from 'react';
import { Input, Button, Spin, Typography, message } from 'antd';
import { SendOutlined, RobotOutlined, ClearOutlined } from '@ant-design/icons';
import { aiApi } from '../../services/aiApi';
import { useThemeStore } from '../../stores/themeStore';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiAssistantPage() {
  const tokens = useThemeStore((s) => s.tokens);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInputValue('');
    setLoading(true);

    try {
      const chatMessages = [...messages, { role: 'user', content: text }].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const response = await aiApi.chat(chatMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.data.reply }]);
    } catch {
      message.error('AI 回复失败，请检查 AI 配置');
    } finally {
      setLoading(false);
    }
  };

  const userBubbleBg = tokens.primaryGradient
    ? `linear-gradient(135deg, ${tokens.primaryGradient.join(', ')})`
    : tokens.primary;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: tokens.text }}>AI 助手</h2>
        <Button icon={<ClearOutlined />} onClick={() => setMessages([])} disabled={messages.length === 0}>
          清空对话
        </Button>
      </div>

      <div
        style={{
          flex: 1,
          background: tokens.cardBg,
          border: tokens.cardBorder,
          borderRadius: tokens.radius,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: tokens.textMuted, padding: '60px 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <RobotOutlined style={{ fontSize: 48, marginBottom: 16, color: tokens.textMuted }} />
              <Typography.Text style={{ color: tokens.textSecondary, fontSize: 16 }}>AI 助手</Typography.Text>
              <Typography.Text style={{ color: tokens.textMuted, marginTop: 8 }}>
                向 AI 提问关于你的图书库的任何问题
              </Typography.Text>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} style={{ padding: '8px 0', display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '70%', display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: msg.role === 'user' ? tokens.primary : tokens.sidebar,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {msg.role === 'user' ? (
                    <span style={{ fontSize: 14, color: '#fff' }}>U</span>
                  ) : (
                    <RobotOutlined style={{ fontSize: 14, color: tokens.textSecondary }} />
                  )}
                </div>
                <div style={{
                  background: msg.role === 'user' ? userBubbleBg : tokens.cardBg,
                  border: msg.role === 'user' ? 'none' : tokens.cardBorder,
                  borderRadius: msg.role === 'user'
                    ? `${tokens.radius}px ${tokens.radius}px 4px ${tokens.radius}px`
                    : `${tokens.radius}px ${tokens.radius}px ${tokens.radius}px 4px`,
                  padding: '10px 14px',
                  color: msg.role === 'user' ? '#fff' : tokens.text,
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
              <Spin size="small" />
              <Typography.Text style={{ color: tokens.textMuted, fontSize: 12 }}>AI 正在思考...</Typography.Text>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Input.TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="输入你的问题... (Enter 发送, Shift+Enter 换行)"
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{
            background: tokens.content,
            border: `1px solid ${tokens.border}`,
            color: tokens.text,
            borderRadius: tokens.radius,
            resize: 'none',
          }}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={loading} disabled={!inputValue.trim()} style={{ borderRadius: tokens.radius, height: 'auto' }}>
          发送
        </Button>
      </div>
    </div>
  );
}

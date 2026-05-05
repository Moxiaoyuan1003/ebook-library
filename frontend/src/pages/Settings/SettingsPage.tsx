import { Tabs, Card, Typography, List, Button, Popconfirm, message, Empty, Switch, TimePicker } from 'antd';
import { useState, useEffect } from 'react';
import {
  SettingOutlined,
  ImportOutlined,
  FolderOutlined,
  BgColorsOutlined,
  SyncOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  CloudDownloadOutlined,
  BellOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AiConfig from './AiConfig';
import BackupSettings from './BackupSettings';
import UpdateChecker from '../../components/UpdateChecker';
import { useThemeStore } from '../../stores/themeStore';
import { useReminderStore } from '../../stores/reminderStore';
import axios from 'axios';
import API_BASE from '../../services/apiConfig';

const { Title, Text, Paragraph } = Typography;

function ShelfManager() {
  const [shelves, setShelves] = useState<any[]>([]);

  const fetchShelves = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/bookshelves/`);
      setShelves(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchShelves(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/api/bookshelves/${id}`);
      message.success('已删除');
      fetchShelves();
    } catch {
      message.error('删除失败');
    }
  };

  return (
    <Card title="书架管理">
      {shelves.length === 0 ? (
        <Empty description="暂无书架，可在侧边栏创建" />
      ) : (
        <List
          dataSource={shelves}
          renderItem={(shelf: any) => (
            <List.Item actions={[
              <Popconfirm key="del" title="确认删除此书架？" onConfirm={() => handleDelete(shelf.id)}>
                <Button danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]}>
              <List.Item.Meta title={shelf.name} description={shelf.description || '无描述'} />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

function AboutPage() {
  return (
    <Card title="关于">
      <Title level={4}>个人图书管理</Title>
      <Paragraph>版本: 0.1.0</Paragraph>
      <Paragraph>
        <Text type="secondary">支持 PDF、EPUB、TXT、MOBI、DOCX 格式的桌面图书管理应用。</Text>
      </Paragraph>
      <Paragraph>
        <Text type="secondary">基于 Electron + React + FastAPI 构建。</Text>
      </Paragraph>
    </Card>
  );
}

function ImportSettings() {
  return (
    <Card title="导入管理">
      <Paragraph>支持的文件格式:</Paragraph>
      <List
        size="small"
        dataSource={[
          { format: 'PDF', desc: '便携式文档格式' },
          { format: 'EPUB', desc: '电子出版物格式' },
          { format: 'TXT', desc: '纯文本格式' },
          { format: 'MOBI', desc: 'Kindle 电子书格式' },
          { format: 'DOCX', desc: 'Microsoft Word 文档' },
        ]}
        renderItem={(item) => (
          <List.Item>
            <Text strong>{item.format}</Text> - <Text type="secondary">{item.desc}</Text>
          </List.Item>
        )}
      />
    </Card>
  );
}

function AppearanceSettings() {
  const themeName = useThemeStore((s) => s.themeName);
  const setTheme = useThemeStore((s) => s.setTheme);
  const readerBgMode = useThemeStore((s) => s.readerBgMode);
  const setReaderBgMode = useThemeStore((s) => s.setReaderBgMode);

  const themeCards = [
    { name: 'glass' as const, label: '毛玻璃', colors: ['#0f0c29', '#302b63', '#667eea', '#764ba2'] },
    { name: 'clean' as const, label: '简洁', colors: ['#0f1117', '#1a1d27', '#3b82f6', '#2a2d37'] },
    { name: 'vibrant' as const, label: '炫彩', colors: ['#0a0a0a', '#111111', '#8b5cf6', '#ec4899'] },
  ];

  const eyecareModes = [
    { key: 'theme' as const, label: '跟随主题', color: null },
    { key: 'eyecare-warm' as const, label: '护眼暖色', color: '#f5f0e8' },
    { key: 'eyecare-green' as const, label: '护眼绿色', color: '#e8f5e9' },
  ];

  return (
    <Card title="外观设置">
      <Title level={5}>主题风格</Title>
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {themeCards.map((tc) => (
          <div
            key={tc.name}
            onClick={() => setTheme(tc.name)}
            style={{
              cursor: 'pointer',
              padding: 4,
              borderRadius: 12,
              border: themeName === tc.name ? `2px solid ${tc.colors[2]}` : '2px solid transparent',
              transition: 'border-color 0.2s',
            }}
          >
            <div
              style={{
                width: 120,
                height: 80,
                borderRadius: 8,
                overflow: 'hidden',
                background: tc.colors[0],
                display: 'grid',
                gridTemplateColumns: '1fr 3fr',
                gridTemplateRows: '1fr 1fr',
                gap: 1,
              }}
            >
              <div style={{ background: tc.colors[1], gridRow: '1 / 3' }} />
              <div style={{ background: tc.colors[1], opacity: 0.8 }} />
              <div style={{ background: tc.colors[0] }} />
            </div>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: themeName === tc.name ? tc.colors[2] : '#888' }}>
              {tc.label}
            </div>
          </div>
        ))}
      </div>

      <Title level={5}>阅读器背景</Title>
      <div style={{ display: 'flex', gap: 8 }}>
        {eyecareModes.map((m) => (
          <div
            key={m.key}
            onClick={() => setReaderBgMode(m.key)}
            style={{
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: 8,
              border: readerBgMode === m.key ? '2px solid #3b82f6' : '2px solid #333',
              background: m.color || '#1a1a1a',
              color: m.color ? '#333' : '#ccc',
              fontSize: 13,
              transition: 'border-color 0.2s',
            }}
          >
            {m.label}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReminderSettings() {
  const { enabled, time, setEnabled, setTime } = useReminderStore();
  const electronAPI = (window as any).electronAPI;

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (checked) {
      electronAPI?.scheduleReminder?.(time);
      message.success('阅读提醒已开启');
    } else {
      electronAPI?.cancelReminder?.();
      message.info('阅读提醒已关闭');
    }
  };

  const handleTimeChange = (t: dayjs.Dayjs | null) => {
    if (t) {
      const timeStr = t.format('HH:mm');
      setTime(timeStr);
      if (enabled) {
        electronAPI?.scheduleReminder?.(timeStr);
      }
    }
  };

  return (
    <Card title="阅读提醒">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <Switch checked={enabled} onChange={handleToggle} />
        <Text>{enabled ? '提醒已开启' : '提醒已关闭'}</Text>
      </div>
      {enabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text>提醒时间：</Text>
          <TimePicker
            value={dayjs(time, 'HH:mm')}
            format="HH:mm"
            onChange={handleTimeChange}
            allowClear={false}
          />
        </div>
      )}
      <Paragraph type="secondary" style={{ marginTop: 16 }}>
        开启后将在设定时间通过系统通知提醒你阅读。
      </Paragraph>
    </Card>
  );
}

export default function SettingsPage() {
  const items = [
    { key: 'ai', label: 'AI 配置', icon: <SettingOutlined />, children: <AiConfig /> },
    { key: 'import', label: '导入管理', icon: <ImportOutlined />, children: <ImportSettings /> },
    { key: 'shelves', label: '书架管理', icon: <FolderOutlined />, children: <ShelfManager /> },
    { key: 'appearance', label: '外观', icon: <BgColorsOutlined />, children: <AppearanceSettings /> },
    { key: 'reminder', label: '阅读提醒', icon: <BellOutlined />, children: <ReminderSettings /> },
    { key: 'backup', label: '数据管理', icon: <CloudDownloadOutlined />, children: <BackupSettings /> },
    { key: 'update', label: '更新', icon: <SyncOutlined />, children: <UpdateChecker /> },
    { key: 'about', label: '关于', icon: <InfoCircleOutlined />, children: <AboutPage /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>设置</h2>
      <Tabs tabPosition="left" items={items} />
    </div>
  );
}

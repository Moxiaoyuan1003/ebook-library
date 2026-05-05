import { useState, useEffect } from 'react';
import { Menu, Modal, Input, message } from 'antd';
import {
  BookOutlined,
  StarOutlined,
  HistoryOutlined,
  FolderOutlined,
  PlusOutlined,
  FileTextOutlined,
  ExportOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useBookStore } from '../../stores/bookStore';
import { useThemeStore } from '../../stores/themeStore';
import axios from 'axios';
import API_BASE from '../../services/apiConfig';

interface Shelf {
  id: string;
  name: string;
  rules?: Record<string, unknown> | null;
}

export default function Sidebar() {
  const navigate = useNavigate();
  const setFilterStatus = useBookStore((s) => s.setFilterStatus);
  const setFilterFavorite = useBookStore((s) => s.setFilterFavorite);
  const setFilterShelf = useBookStore((s) => s.setFilterShelf);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [addShelfOpen, setAddShelfOpen] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');

  const fetchShelves = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/bookshelves/`);
      setShelves(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchShelves(); }, []);

  const handleAddShelf = async () => {
    if (!newShelfName.trim()) return;
    try {
      await axios.post(`${API_BASE}/api/bookshelves/`, { name: newShelfName.trim() });
      message.success('书架已创建');
      setNewShelfName('');
      setAddShelfOpen(false);
      fetchShelves();
    } catch {
      message.error('创建失败');
    }
  };

  const tokens = useThemeStore((s) => s.tokens);

  const sidebarItems = [
    { key: 'all', icon: <BookOutlined />, label: '全部书籍' },
    { key: 'recent', icon: <HistoryOutlined />, label: '最近阅读' },
    { key: 'favorites', icon: <StarOutlined />, label: '已收藏' },
    { type: 'divider' as const },
    {
      key: 'shelves-header',
      label: '书架',
      type: 'group' as const,
      children: [
        ...shelves.map((s) => ({
          key: `shelf-${s.id}`,
          icon: s.rules ? <ThunderboltOutlined style={{ color: '#8b5cf6' }} /> : <FolderOutlined />,
          label: s.rules ? `${s.name} ⚡` : s.name,
        })),
        { key: 'add-shelf', icon: <PlusOutlined />, label: '新建书架' },
      ],
    },
    { type: 'divider' as const },
    { key: 'stats', icon: <BarChartOutlined />, label: '阅读统计' },
    { key: 'knowledge-cards', icon: <FileTextOutlined />, label: '知识卡片' },
    { key: 'timeline', icon: <ClockCircleOutlined />, label: '批注时间线' },
    { key: 'export', icon: <ExportOutlined />, label: '数据导出' },
  ];

  const handleClick = ({ key }: { key: string }) => {
    if (key === 'all') {
      setFilterStatus(null);
      setFilterFavorite(false);
      navigate('/');
    } else if (key === 'recent') {
      setFilterStatus('reading');
      navigate('/');
    } else if (key === 'favorites') {
      setFilterFavorite(true);
      navigate('/');
    } else if (key === 'add-shelf') {
      setAddShelfOpen(true);
    } else if (key === 'stats') {
      navigate('/stats');
    } else if (key === 'knowledge-cards') {
      navigate('/knowledge-cards');
    } else if (key === 'timeline') {
      navigate('/timeline');
    } else if (key === 'export') {
      navigate('/export');
    } else if (key.startsWith('shelf-')) {
      const shelfId = key.replace('shelf-', '');
      const shelf = shelves.find((s) => s.id === shelfId);
      setFilterShelf(shelfId, shelf?.name || '书架');
      navigate('/');
    }
  };

  return (
    <>
      <div
        style={{
          width: 200,
          background: tokens.sidebar,
          backdropFilter: tokens.blur ? `blur(${tokens.blur}px)` : undefined,
          borderRight: `1px solid ${tokens.border}`,
          height: '100%',
          overflow: 'auto',
        }}
      >
        <Menu
          mode="inline"
          defaultSelectedKeys={['all']}
          items={sidebarItems}
          onClick={handleClick}
          style={{ borderRight: 'none', background: 'transparent' }}
        />
      </div>
      <Modal
        title="新建书架"
        open={addShelfOpen}
        onOk={handleAddShelf}
        onCancel={() => { setAddShelfOpen(false); setNewShelfName(''); }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="书架名称"
          value={newShelfName}
          onChange={(e) => setNewShelfName(e.target.value)}
          onPressEnter={handleAddShelf}
        />
      </Modal>
    </>
  );
}

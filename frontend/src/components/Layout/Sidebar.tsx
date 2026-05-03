import { Menu } from 'antd';
import { BookOutlined, StarOutlined, HistoryOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons';

const sidebarItems = [
  { key: 'all', icon: <BookOutlined />, label: '全部书籍' },
  { key: 'recent', icon: <HistoryOutlined />, label: '最近阅读' },
  { key: 'favorites', icon: <StarOutlined />, label: '已收藏' },
  { type: 'divider' as const },
  { key: 'shelves-header', label: '书架', type: 'group' as const, children: [
    { key: 'shelf-tech', icon: <FolderOutlined />, label: '技术书籍' },
    { key: 'shelf-novel', icon: <FolderOutlined />, label: '小说' },
    { key: 'add-shelf', icon: <PlusOutlined />, label: '新建书架' },
  ]},
];

export default function Sidebar() {
  return (
    <div style={{ width: 200, background: '#1a1a1a', borderRight: '1px solid #303030', height: '100%', overflow: 'auto' }}>
      <Menu
        mode="inline"
        defaultSelectedKeys={['all']}
        items={sidebarItems}
        style={{ borderRight: 'none', background: 'transparent' }}
      />
    </div>
  );
}

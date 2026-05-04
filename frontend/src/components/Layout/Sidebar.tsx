import { Menu } from 'antd';
import {
  BookOutlined,
  StarOutlined,
  HistoryOutlined,
  FolderOutlined,
  PlusOutlined,
  FileTextOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

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
      { key: 'shelf-tech', icon: <FolderOutlined />, label: '技术书籍' },
      { key: 'shelf-novel', icon: <FolderOutlined />, label: '小说' },
      { key: 'add-shelf', icon: <PlusOutlined />, label: '新建书架' },
    ],
  },
  { type: 'divider' as const },
  { key: 'knowledge-cards', icon: <FileTextOutlined />, label: '知识卡片' },
  { key: 'export', icon: <ExportOutlined />, label: '数据导出' },
];

const navigateMap: Record<string, string> = {
  'knowledge-cards': '/knowledge-cards',
  export: '/export',
};

export default function Sidebar() {
  const navigate = useNavigate();

  const handleClick = ({ key }: { key: string }) => {
    const path = navigateMap[key];
    if (path) {
      navigate(path);
    }
  };

  return (
    <div
      style={{
        width: 200,
        background: '#1a1a1a',
        borderRight: '1px solid #303030',
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
  );
}

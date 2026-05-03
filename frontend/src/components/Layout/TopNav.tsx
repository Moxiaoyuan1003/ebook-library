import { Menu } from 'antd';
import { BookOutlined, SearchOutlined, RobotOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { key: '/', icon: <BookOutlined />, label: '书库' },
  { key: '/search', icon: <SearchOutlined />, label: '搜索' },
  { key: '/ai', icon: <RobotOutlined />, label: 'AI 助手' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 48, padding: '0 24px', background: '#141414', borderBottom: '1px solid #303030' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginRight: 48, color: '#1677ff' }}>
        📚 个人图书管理器
      </div>
      <Menu
        mode="horizontal"
        selectedKeys={[location.pathname]}
        items={navItems}
        onClick={({ key }) => navigate(key)}
        style={{ flex: 1, background: 'transparent', borderBottom: 'none' }}
      />
    </div>
  );
}

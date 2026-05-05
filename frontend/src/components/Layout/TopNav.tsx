import { Menu, Dropdown } from 'antd';
import {
  BookOutlined,
  SearchOutlined,
  RobotOutlined,
  SettingOutlined,
  BarChartOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeStore } from '../../stores/themeStore';
import { THEMES, type ThemeName } from '../../theme/tokens';

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const tokens = useThemeStore((s) => s.tokens);
  const themeName = useThemeStore((s) => s.themeName);
  const setTheme = useThemeStore((s) => s.setTheme);

  const themeItems = Object.entries(THEMES).map(([key, t]) => ({
    key,
    label: t.label,
    onClick: () => setTheme(key as ThemeName),
  }));

  const navItems = [
    { key: '/', icon: <BookOutlined />, label: '书库' },
    { key: '/search', icon: <SearchOutlined />, label: '搜索' },
    { key: '/stats', icon: <BarChartOutlined />, label: '阅读统计' },
    { key: '/ai', icon: <RobotOutlined />, label: 'AI 助手' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' },
  ];

  const primaryGradientStyle = tokens.primaryGradient
    ? {
        background: `linear-gradient(135deg, ${tokens.primaryGradient.join(', ')})`,
        WebkitBackgroundClip: 'text' as const,
        WebkitTextFillColor: 'transparent',
      }
    : { color: tokens.primary };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 48,
        padding: '0 24px',
        background: tokens.header,
        color: tokens.text,
        borderBottom: `1px solid ${tokens.border}`,
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 'bold', marginRight: 48, ...primaryGradientStyle }}>
        📚 个人图书管理器
      </div>
      <Menu
        mode="horizontal"
        selectedKeys={[location.pathname]}
        items={navItems}
        onClick={({ key }) => navigate(key)}
        style={{ flex: 1, background: 'transparent', borderBottom: 'none' }}
      />
      <Dropdown menu={{ items: themeItems, selectedKeys: [themeName] }} trigger={['click']}>
        <span style={{ cursor: 'pointer', color: tokens.textSecondary, fontSize: 13 }}>
          {THEMES[themeName]?.label ?? themeName} <DownOutlined />
        </span>
      </Dropdown>
    </div>
  );
}

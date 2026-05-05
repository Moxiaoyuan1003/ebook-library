import { useState } from 'react';
import { Menu, Dropdown } from 'antd';
import {
  BookOutlined,
  SearchOutlined,
  RobotOutlined,
  SettingOutlined,
  BarChartOutlined,
  DownOutlined,
  MinusOutlined,
  CloseOutlined,
  BorderOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeStore } from '../../stores/themeStore';
import { THEMES, type ThemeName } from '../../theme/tokens';

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      resize: (bounds: { x?: number; y?: number; width?: number; height?: number }) => void;
      getBounds: () => Promise<{ x: number; y: number; width: number; height: number }>;
    };
  }
}

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const tokens = useThemeStore((s) => s.tokens);
  const themeName = useThemeStore((s) => s.themeName);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [isMaximized, setIsMaximized] = useState(false);

  const isElectron = !!window.electronAPI;

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

  const titleStyle = { color: tokens.primary };

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => {
    window.electronAPI?.maximize();
    setIsMaximized((v) => !v);
  };
  const handleClose = () => window.electronAPI?.close();

  return (
    <div
      className="titlebar-drag"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 48,
        padding: '0 8px 0 16px',
        background: tokens.header,
        color: tokens.text,
        borderBottom: `1px solid ${tokens.border}`,
        position: 'relative',
        zIndex: 10,
        userSelect: 'none',
      }}
    >
      {/* App title */}
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          marginRight: 24,
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          ...titleStyle,
        }}
      >
        <span style={{ fontSize: 18 }}>📚</span>
        <span>个人图书管理器</span>
      </div>

      {/* Navigation */}
      <Menu
        mode="horizontal"
        selectedKeys={[location.pathname]}
        items={navItems}
        onClick={({ key }) => navigate(key)}
        className="titlebar-no-drag"
        style={{
          flex: 1,
          background: 'transparent',
          borderBottom: 'none',
          minWidth: 0,
        }}
      />

      {/* Theme switcher */}
      <Dropdown menu={{ items: themeItems, selectedKeys: [themeName] }} trigger={['click']}>
        <span
          className="titlebar-no-drag"
          style={{
            cursor: 'pointer',
            color: tokens.textSecondary,
            fontSize: 13,
            marginRight: 8,
            whiteSpace: 'nowrap',
            padding: '4px 8px',
            borderRadius: 6,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {THEMES[themeName]?.label ?? themeName} <DownOutlined style={{ fontSize: 10 }} />
        </span>
      </Dropdown>

      {/* Window controls (Electron only) */}
      {isElectron && (
        <div className="titlebar-no-drag" style={{ display: 'flex', alignItems: 'center', marginLeft: 4 }}>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 28,
              border: 'none',
              background: 'transparent',
              color: tokens.textSecondary,
              cursor: 'pointer',
              fontSize: 12,
              transition: 'background 0.15s, color 0.15s',
            }}
            onClick={handleMinimize}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = tokens.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = tokens.textSecondary;
            }}
            title="最小化"
          >
            <MinusOutlined />
          </button>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 28,
              border: 'none',
              background: 'transparent',
              color: tokens.textSecondary,
              cursor: 'pointer',
              fontSize: 12,
              transition: 'background 0.15s, color 0.15s',
            }}
            onClick={handleMaximize}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = tokens.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = tokens.textSecondary;
            }}
            title={isMaximized ? '还原' : '最大化'}
          >
            <BorderOutlined />
          </button>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 28,
              border: 'none',
              background: 'transparent',
              color: tokens.textSecondary,
              cursor: 'pointer',
              fontSize: 12,
              transition: 'background 0.15s, color 0.15s',
            }}
            onClick={handleClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e81123';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = tokens.textSecondary;
            }}
            title="关闭"
          >
            <CloseOutlined />
          </button>
        </div>
      )}
    </div>
  );
}

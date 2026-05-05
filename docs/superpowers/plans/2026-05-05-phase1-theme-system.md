# Phase 1: Theme System + Global Shortcuts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-color theme store with a full token-based theme system supporting 3 switchable themes (Glass/Clean/Vibrant), CSS variable injection, and global keyboard shortcuts.

**Architecture:** `themeStore.ts` holds the current theme name and derived `ThemeTokens` object. A `useThemeVars` hook injects CSS custom properties into `:root` so all components (including Ant Design overrides) can consume theme tokens. Each layout component reads tokens from the store instead of hardcoding colors.

**Tech Stack:** Zustand (persist), React hooks, CSS custom properties

---

## File Structure

```
frontend/src/
├── theme/
│   ├── tokens.ts          # ThemeTokens interface + 3 theme definitions
│   └── useThemeVars.ts    # Hook: sync tokens → CSS variables
├── hooks/
│   └── useGlobalShortcuts.ts  # Global keyboard shortcuts
├── stores/
│   └── themeStore.ts      # REWRITE: theme name + tokens + actions
├── components/Layout/
│   ├── AppLayout.tsx       # MODIFY: use theme tokens
│   ├── Sidebar.tsx         # MODIFY: use theme tokens + theme switcher
│   ├── TopNav.tsx          # MODIFY: use theme tokens + search shortcut
│   └── StatusBar.tsx       # MODIFY: use theme tokens
└── pages/Settings/
    └── SettingsPage.tsx    # MODIFY: new AppearanceSettings with 3 theme cards
```

---

### Task 1: Define ThemeTokens and 3 theme definitions

**Files:**
- Create: `frontend/src/theme/tokens.ts`

- [ ] **Step 1: Create the ThemeTokens interface and 3 theme constants**

```typescript
// frontend/src/theme/tokens.ts

export interface ThemeTokens {
  name: string;
  label: string;
  // Backgrounds
  bg: string;
  bgGradient?: string[];
  sidebar: string;
  header: string;
  content: string;
  // Cards
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  // Primary color
  primary: string;
  primaryGradient?: string[];
  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  // Borders & radius
  border: string;
  radius: number;
  // Effects
  blur?: number;
  glow?: string;
  // Reader
  readerBg: string;
  readerText: string;
}

export const glassTheme: ThemeTokens = {
  name: 'glass',
  label: '毛玻璃',
  bg: '#0f0c29',
  bgGradient: ['#0f0c29', '#302b63', '#24243e'],
  sidebar: 'rgba(255,255,255,0.04)',
  header: 'rgba(255,255,255,0.06)',
  content: 'rgba(255,255,255,0.02)',
  cardBg: 'rgba(255,255,255,0.08)',
  cardBorder: '1px solid rgba(255,255,255,0.12)',
  cardShadow: '0 8px 32px rgba(0,0,0,0.2)',
  primary: '#667eea',
  primaryGradient: ['#667eea', '#764ba2'],
  text: '#eeeeee',
  textSecondary: 'rgba(255,255,255,0.5)',
  textMuted: 'rgba(255,255,255,0.3)',
  border: 'rgba(255,255,255,0.06)',
  radius: 16,
  blur: 12,
  glow: '0 8px 32px rgba(102,126,234,0.15)',
  readerBg: '#0f0c29',
  readerText: '#eeeeee',
};

export const cleanTheme: ThemeTokens = {
  name: 'clean',
  label: '简洁',
  bg: '#0f1117',
  sidebar: '#1a1d27',
  header: '#161822',
  content: '#0f1117',
  cardBg: '#1a1d27',
  cardBorder: '1px solid #2a2d37',
  cardShadow: 'none',
  primary: '#3b82f6',
  text: '#e5e7eb',
  textSecondary: '#6b7280',
  textMuted: '#4b5563',
  border: '#2a2d37',
  radius: 12,
  readerBg: '#0f1117',
  readerText: '#e5e7eb',
};

export const vibrantTheme: ThemeTokens = {
  name: 'vibrant',
  label: '炫彩',
  bg: '#0a0a0a',
  sidebar: '#111111',
  header: '#0d0d0d',
  content: '#0a0a0a',
  cardBg: '#111111',
  cardBorder: '1px solid #1a1a1a',
  cardShadow: '0 4px 16px rgba(139,92,246,0.15)',
  primary: '#8b5cf6',
  primaryGradient: ['#8b5cf6', '#ec4899'],
  text: '#eeeeee',
  textSecondary: '#666666',
  textMuted: '#444444',
  border: '#1a1a1a',
  radius: 16,
  glow: '0 4px 16px rgba(139,92,246,0.2)',
  readerBg: '#0a0a0a',
  readerText: '#eeeeee',
};

export const THEMES: Record<string, ThemeTokens> = {
  glass: glassTheme,
  clean: cleanTheme,
  vibrant: vibrantTheme,
};

export type ThemeName = keyof typeof THEMES;

export const EYECARE_MODES = {
  theme: { label: '跟随主题', bg: '' },
  'eyecare-warm': { label: '护眼暖色', bg: '#f5f0e8' },
  'eyecare-green': { label: '护眼绿色', bg: '#e8f5e9' },
} as const;

export type EyecareMode = keyof typeof EYECARE_MODES;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "theme/tokens"`
Expected: no errors

---

### Task 2: Rewrite themeStore with token system

**Files:**
- Rewrite: `frontend/src/stores/themeStore.ts`

- [ ] **Step 1: Replace themeStore contents**

```typescript
// frontend/src/stores/themeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { THEMES, type ThemeName, type ThemeTokens, type EyecareMode } from '../theme/tokens';

interface ThemeState {
  themeName: ThemeName;
  tokens: ThemeTokens;
  readerBgMode: EyecareMode;
  setTheme: (name: ThemeName) => void;
  setReaderBgMode: (mode: EyecareMode) => void;
  getReaderBg: () => string;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeName: 'glass',
      tokens: THEMES.glass,
      readerBgMode: 'theme',

      setTheme: (name: ThemeName) =>
        set({ themeName: name, tokens: THEMES[name] }),

      setReaderBgMode: (mode: EyecareMode) =>
        set({ readerBgMode: mode }),

      getReaderBg: () => {
        const { readerBgMode, tokens } = get();
        if (readerBgMode === 'theme') return tokens.readerBg;
        if (readerBgMode === 'eyecare-warm') return '#f5f0e8';
        return '#e8f5e9';
      },
    }),
    {
      name: 'ebook-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.tokens = THEMES[state.themeName] || THEMES.glass;
        }
      },
    },
  ),
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "themeStore"`
Expected: no errors (there will be errors in files that import the old API — that's expected, we fix them in later tasks)

---

### Task 3: Create CSS variable injection hook

**Files:**
- Create: `frontend/src/theme/useThemeVars.ts`

- [ ] **Step 1: Create the hook**

```typescript
// frontend/src/theme/useThemeVars.ts
import { useEffect } from 'react';
import { useThemeStore } from '../stores/themeStore';

export function useThemeVars() {
  const tokens = useThemeStore((s) => s.tokens);

  useEffect(() => {
    const root = document.documentElement;
    const set = (key: string, value: string) => root.style.setProperty(key, value);

    set('--bg', tokens.bg);
    set('--sidebar', tokens.sidebar);
    set('--header', tokens.header);
    set('--content', tokens.content);
    set('--card-bg', tokens.cardBg);
    set('--card-border', tokens.cardBorder);
    set('--card-shadow', tokens.cardShadow);
    set('--primary', tokens.primary);
    set('--text', tokens.text);
    set('--text-secondary', tokens.textSecondary);
    set('--text-muted', tokens.textMuted);
    set('--border', tokens.border);
    set('--radius', `${tokens.radius}px`);

    if (tokens.bgGradient) {
      set('--bg-gradient', `linear-gradient(135deg, ${tokens.bgGradient.join(', ')})`);
    } else {
      set('--bg-gradient', tokens.bg);
    }

    if (tokens.primaryGradient) {
      set('--primary-gradient', `linear-gradient(135deg, ${tokens.primaryGradient.join(', ')})`);
    } else {
      set('--primary-gradient', tokens.primary);
    }

    if (tokens.blur) {
      set('--blur', `${tokens.blur}px`);
      set('--backdrop-blur', `blur(${tokens.blur}px)`);
    }

    if (tokens.glow) {
      set('--glow', tokens.glow);
    }
  }, [tokens]);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "useThemeVars"`
Expected: no errors

---

### Task 4: Update AppLayout to use theme tokens + CSS vars

**Files:**
- Modify: `frontend/src/components/Layout/AppLayout.tsx`

- [ ] **Step 1: Rewrite AppLayout**

```typescript
// frontend/src/components/Layout/AppLayout.tsx
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import { useThemeStore } from '../../stores/themeStore';
import { useThemeVars } from '../../theme/useThemeVars';

export default function AppLayout() {
  useThemeVars();
  const tokens = useThemeStore((s) => s.tokens);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopNav />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            background: tokens.bgGradient
              ? `linear-gradient(135deg, ${tokens.bgGradient.join(', ')})`
              : tokens.bg,
            color: tokens.text,
          }}
        >
          <Outlet />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "AppLayout"`
Expected: no errors

---

### Task 5: Update TopNav to use theme tokens

**Files:**
- Modify: `frontend/src/components/Layout/TopNav.tsx`

- [ ] **Step 1: Read current TopNav**

Read `frontend/src/components/Layout/TopNav.tsx` to understand current structure.

- [ ] **Step 2: Update TopNav to use theme tokens**

Replace all hardcoded colors with token values. Key changes:
- Background: `tokens.header` + optional `backdrop-filter` when `tokens.blur` exists
- Text color: `tokens.text`
- Menu items: use `tokens.primary` for selected state
- Search bar: styled with `tokens.cardBg` and `tokens.border`

```typescript
// frontend/src/components/Layout/TopNav.tsx
import { Menu, Input, Button, Dropdown } from 'antd';
import {
  BookOutlined,
  SearchOutlined,
  SettingOutlined,
  RobotOutlined,
  ImportOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeStore } from '../../stores/themeStore';
import type { ThemeName } from '../../theme/tokens';
import { THEMES } from '../../theme/tokens';

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const tokens = useThemeStore((s) => s.tokens);
  const themeName = useThemeStore((s) => s.themeName);
  const setTheme = useThemeStore((s) => s.setTheme);

  const navItems = [
    { key: '/', icon: <BookOutlined />, label: '书库' },
    { key: '/stats', icon: <BarChartOutlined />, label: '统计' },
    { key: '/search', icon: <SearchOutlined />, label: '搜索' },
    { key: '/ai', icon: <RobotOutlined />, label: 'AI 助手' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' },
  ];

  const themeMenuItems = Object.entries(THEMES).map(([key, theme]) => ({
    key,
    label: theme.label,
    onClick: () => setTheme(key as ThemeName),
  }));

  return (
    <div
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        background: tokens.header,
        backdrop: tokens.blur ? `blur(${tokens.blur}px)` : undefined,
        borderBottom: `1px solid ${tokens.border}`,
        color: tokens.text,
        gap: 12,
      }}
    >
      <span
        style={{
          fontWeight: 700,
          fontSize: 15,
          background: tokens.primaryGradient
            ? `linear-gradient(135deg, ${tokens.primaryGradient.join(', ')})`
            : tokens.primary,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          cursor: 'pointer',
          marginRight: 12,
        }}
        onClick={() => navigate('/')}
      >
        个人图书管理
      </span>

      <Menu
        mode="horizontal"
        selectedKeys={[location.pathname]}
        items={navItems}
        onClick={({ key }) => navigate(key)}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          color: tokens.text,
        }}
        theme="dark"
      />

      <Dropdown menu={{ items: themeMenuItems }} trigger={['click']}>
        <Button type="text" size="small" style={{ color: tokens.textSecondary }}>
          {tokens.label}
        </Button>
      </Dropdown>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "TopNav"`
Expected: no errors

---

### Task 6: Update Sidebar to use theme tokens

**Files:**
- Modify: `frontend/src/components/Layout/Sidebar.tsx`

- [ ] **Step 1: Read current Sidebar**

Read `frontend/src/components/Layout/Sidebar.tsx` to understand current structure.

- [ ] **Step 2: Update Sidebar to use theme tokens**

Replace `useThemeStore` color selectors with token-based approach. Key changes:
- Background: `tokens.sidebar` + optional `backdrop-filter`
- Menu items: use `tokens.primary` for selected, `tokens.text` for normal
- Add "阅读统计" menu item

```typescript
// frontend/src/components/Layout/Sidebar.tsx
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
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useBookStore } from '../../stores/bookStore';
import { useThemeStore } from '../../stores/themeStore';
import axios from 'axios';
import API_BASE from '../../services/apiConfig';

interface Shelf {
  id: string;
  name: string;
}

export default function Sidebar() {
  const navigate = useNavigate();
  const tokens = useThemeStore((s) => s.tokens);
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
        ...shelves.map((s) => ({ key: `shelf-${s.id}`, icon: <FolderOutlined />, label: s.name })),
        { key: 'add-shelf', icon: <PlusOutlined />, label: '新建书架' },
      ],
    },
    { type: 'divider' as const },
    { key: 'stats', icon: <BarChartOutlined />, label: '阅读统计' },
    { key: 'knowledge-cards', icon: <FileTextOutlined />, label: '知识卡片' },
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
          style={{ borderRight: 'none', background: 'transparent', color: tokens.text }}
          theme="dark"
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
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "Sidebar"`
Expected: no errors

---

### Task 7: Update StatusBar to use theme tokens

**Files:**
- Modify: `frontend/src/components/Layout/StatusBar.tsx`

- [ ] **Step 1: Update StatusBar**

Replace hardcoded colors with token values.

```typescript
// frontend/src/components/Layout/StatusBar.tsx
import { useEffect } from 'react';
import { Tag } from 'antd';
import { useAppStore } from '../../stores/appStore';
import { useThemeStore } from '../../stores/themeStore';

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  ollama: 'Ollama',
  none: '不可用',
};

export default function StatusBar() {
  const importProgress = useAppStore((state) => state.importProgress);
  const aiStatus = useAppStore((state) => state.aiStatus);
  const fetchAiStatus = useAppStore((state) => state.fetchAiStatus);
  const tokens = useThemeStore((s) => s.tokens);

  useEffect(() => {
    fetchAiStatus();
    const timer = setInterval(fetchAiStatus, 30000);
    return () => clearInterval(timer);
  }, [fetchAiStatus]);

  const provider = aiStatus?.provider ?? 'none';
  const available = aiStatus?.available ?? false;
  const online = aiStatus?.online ?? false;

  return (
    <div
      style={{
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: tokens.header,
        borderTop: `1px solid ${tokens.border}`,
        fontSize: 12,
        color: tokens.textMuted,
      }}
    >
      <span>
        {importProgress
          ? `导入中: ${importProgress.current}/${importProgress.total} - ${importProgress.file}`
          : '就绪'}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>AI: {providerLabels[provider] ?? provider}</span>
        <Tag
          color={available ? 'green' : 'red'}
          style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0 }}
        >
          {online ? '在线' : '离线'}
        </Tag>
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "StatusBar"`
Expected: no errors

---

### Task 8: Update SettingsPage AppearanceSettings with theme cards

**Files:**
- Modify: `frontend/src/pages/Settings/SettingsPage.tsx`

- [ ] **Step 1: Read current SettingsPage**

Read `frontend/src/pages/Settings/SettingsPage.tsx` to understand current structure.

- [ ] **Step 2: Rewrite AppearanceSettings**

Replace the old 5-preset + 4-color-picker UI with 3 theme preview cards + eyecare mode selector.

```typescript
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
```

Also update the imports at the top of SettingsPage.tsx — add `useThemeStore` and `THEMES`, remove unused imports.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "SettingsPage"`
Expected: no errors

---

### Task 9: Add global keyboard shortcuts

**Files:**
- Create: `frontend/src/hooks/useGlobalShortcuts.ts`

- [ ] **Step 1: Create the hook**

```typescript
// frontend/src/hooks/useGlobalShortcuts.ts
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useGlobalShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      if (e.key === '/') {
        e.preventDefault();
        navigate('/search');
      } else if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        navigate('/settings');
      } else if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        navigate('/stats');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}
```

- [ ] **Step 2: Wire the hook into AppLayout**

Add `useGlobalShortcuts()` call inside the `AppLayout` component body, after `useThemeVars()`.

```typescript
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';

export default function AppLayout() {
  useThemeVars();
  useGlobalShortcuts();
  // ... rest
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1 | grep "useGlobalShortcuts"`
Expected: no errors

---

### Task 10: Run full TypeScript check and fix remaining issues

- [ ] **Step 1: Run full type check**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1`
Expected: Possible errors in pages that still import old `useThemeStore` API (e.g., `bgColor`, `setBgColor`). List all errors.

- [ ] **Step 2: Fix any broken imports**

For each file that references old `useThemeStore` properties (`bgColor`, `sidebarColor`, `headerColor`, `contentColor`, `setBgColor`, etc.), update to use `tokens` instead. Common pattern:

```typescript
// OLD
const bgColor = useThemeStore((s) => s.bgColor);
// NEW
const tokens = useThemeStore((s) => s.tokens);
// Use tokens.bg instead of bgColor
```

Likely affected files:
- `frontend/src/pages/Reader/ReaderPage.tsx` — may use `bgColor` for reader background
- `frontend/src/pages/Library/LibraryPage.tsx` — may use theme colors
- Any other page with `useThemeStore` imports

- [ ] **Step 3: Final TypeScript check**

Run: `cd f:/Code/ebook-library/frontend && npx tsc --noEmit 2>&1`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/theme/ frontend/src/hooks/ frontend/src/stores/themeStore.ts frontend/src/components/Layout/ frontend/src/pages/Settings/SettingsPage.tsx
git commit -m "feat: implement token-based theme system with 3 switchable themes

- Add ThemeTokens interface and glass/clean/vibrant theme definitions
- Rewrite themeStore with themeName + tokens + eyecare mode
- Add useThemeVars hook for CSS variable injection
- Update AppLayout, TopNav, Sidebar, StatusBar to use theme tokens
- Add theme switcher cards and eyecare mode to Settings > Appearance
- Add global keyboard shortcuts (/ for search, Ctrl+, for settings, Ctrl+Shift+S for stats)"
```

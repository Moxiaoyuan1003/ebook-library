import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import ResizeHandles from './ResizeHandles';
import { useThemeStore } from '../../stores/themeStore';
import { useThemeVars } from '../../theme/useThemeVars';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';

export default function AppLayout() {
  useThemeVars();
  useGlobalShortcuts();
  const tokens = useThemeStore((s) => s.tokens);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: tokens.bg }}>
      <TopNav />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main style={{
          flex: 1,
          overflow: 'auto',
          background: tokens.bgGradient ? `linear-gradient(135deg, ${tokens.bgGradient.join(', ')})` : tokens.bg,
          color: tokens.text,
        }}>
          <Outlet />
        </main>
      </div>
      <StatusBar />
      <ResizeHandles />
    </div>
  );
}

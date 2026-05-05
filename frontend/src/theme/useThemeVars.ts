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

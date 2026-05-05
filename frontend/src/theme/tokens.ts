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

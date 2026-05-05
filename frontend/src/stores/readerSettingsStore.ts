import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReaderSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  marginMode: 'narrow' | 'medium' | 'wide';
  setFontFamily: (f: string) => void;
  setFontSize: (s: number) => void;
  setLineHeight: (h: number) => void;
  setMarginMode: (m: 'narrow' | 'medium' | 'wide') => void;
}

export const useReaderSettingsStore = create<ReaderSettings>()(
  persist(
    (set) => ({
      fontFamily: 'system-ui',
      fontSize: 16,
      lineHeight: 1.6,
      marginMode: 'medium',
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setMarginMode: (marginMode) => set({ marginMode }),
    }),
    { name: 'ebook-reader-settings' },
  ),
);

export const FONT_OPTIONS = [
  { value: 'system-ui', label: '系统默认' },
  { value: '"SimSun", serif', label: '宋体' },
  { value: '"SimHei", sans-serif', label: '黑体' },
  { value: '"KaiTi", serif', label: '楷体' },
  { value: '"Georgia", serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
];

export const MARGIN_OPTIONS = [
  { key: 'narrow' as const, label: '窄', value: 24 },
  { key: 'medium' as const, label: '中', value: 48 },
  { key: 'wide' as const, label: '宽', value: 80 },
];

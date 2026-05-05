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

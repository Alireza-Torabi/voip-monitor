import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
type ThemeState = {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (value: ThemeMode) => void;
};
const ThemeModeContext = createContext<ThemeState>({
  mode: 'dark',
  resolved: 'dark',
  setMode: () => undefined,
});
const STORAGE_KEY = 'voip-monitor.theme-mode';

const lightTokens: Record<string, string> = {
  canvas: '#f2f6fc',
  sidebar: '#eaf0f8',
  surface: '#ffffff',
  surface2: '#f6f9fe',
  surface3: '#eef4fd',
  border: '#d3dfed',
  borderStrong: '#9ab0c8',
  text: '#152539',
  textMuted: '#415870',
  textSubtle: '#536983',
  accent: '#155ab7',
  accentStrong: '#164c94',
  healthy: '#126c49',
  warning: '#895300',
  critical: '#bc293b',
  info: '#136da6',
  unknown: '#566a80',
};
const darkTokens: Record<string, string> = {
  canvas: '#07111f',
  sidebar: '#091526',
  surface: '#0e1b2d',
  surface2: '#122237',
  surface3: '#162940',
  border: '#1d2d42',
  borderStrong: '#29415f',
  text: '#e7eef8',
  textMuted: '#8da2bd',
  textSubtle: '#748ca9',
  accent: '#2d8cff',
  accentStrong: '#1568d6',
  healthy: '#22c77a',
  warning: '#f6b73c',
  critical: '#ff5c6c',
  info: '#38bdf8',
  unknown: '#71839b',
};

function loadMode(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Private browsing may disable storage; System remains the safe default.
  }
  return 'system';
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(loadMode);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true,
  );
  const resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener?.('change', update);
    update();
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const colors = resolved === 'light' ? lightTokens : darkTokens;
    const root = document.documentElement;
    for (const [name, color] of Object.entries(colors)) {
      root.style.setProperty(`--chakra-colors-noc-${name}`, color);
    }
    root.dataset.colorMode = resolved;
    root.style.colorScheme = resolved;
    root.style.backgroundColor = colors.canvas!;
    document.body.style.backgroundColor = colors.canvas!;
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Theme still works if persistent browser storage is unavailable.
    }
  }, [mode, resolved]);

  return (
    <ThemeModeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeState {
  return useContext(ThemeModeContext);
}

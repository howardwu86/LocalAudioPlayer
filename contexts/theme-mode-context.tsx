import * as FileSystem from 'expo-file-system/legacy';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ColorSchemeName } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeModeContextValue = {
  mode: ThemeMode;
  colorScheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
};

const THEME_MODE_FILE_NAME = 'theme-mode.json';
const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

function joinUri(base: string, name: string): string {
  return `${base.replace(/\/+$/, '')}/${name}`;
}

function getThemeModeUri(): string | null {
  if (!FileSystem.documentDirectory) {
    return null;
  }
  return joinUri(FileSystem.documentDirectory, THEME_MODE_FILE_NAME);
}

async function readThemeMode(): Promise<ThemeMode | null> {
  const uri = getThemeModeUri();
  if (!uri) {
    return null;
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    return null;
  }
  try {
    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw) as { mode?: ThemeMode };
    if (parsed.mode === 'light' || parsed.mode === 'dark' || parsed.mode === 'system') {
      return parsed.mode;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeThemeMode(mode: ThemeMode): Promise<void> {
  const uri = getThemeModeUri();
  if (!uri) {
    return;
  }
  await FileSystem.writeAsStringAsync(uri, JSON.stringify({ mode }));
}

export function ThemeModeProvider({
  children,
  systemColorScheme,
}: {
  children: React.ReactNode;
  systemColorScheme: ColorSchemeName;
}) {
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const persisted = await readThemeMode();
      if (mounted && persisted) {
        setModeState(persisted);
      }
    };
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void writeThemeMode(nextMode);
  }, []);

  const colorScheme: 'light' | 'dark' = useMemo(() => {
    if (mode === 'light' || mode === 'dark') {
      return mode;
    }
    return systemColorScheme === 'dark' ? 'dark' : 'light';
  }, [mode, systemColorScheme]);

  const value = useMemo(
    () => ({
      mode,
      colorScheme,
      setMode,
    }),
    [mode, colorScheme, setMode]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used inside ThemeModeProvider');
  }
  return context;
}

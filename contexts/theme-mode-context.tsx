import * as FileSystem from 'expo-file-system/legacy';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ColorSchemeName } from 'react-native';

import { BackgroundId, DEFAULT_BACKGROUND_ID } from '@/constants/backgrounds';

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeModeContextValue = {
  mode: ThemeMode;
  colorScheme: 'light' | 'dark';
  backgroundId: BackgroundId;
  setMode: (mode: ThemeMode) => void;
  setBackgroundId: (backgroundId: BackgroundId) => void;
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

async function readThemeSettings(): Promise<{ mode: ThemeMode | null; backgroundId: BackgroundId }> {
  const uri = getThemeModeUri();
  if (!uri) {
    return { mode: null, backgroundId: DEFAULT_BACKGROUND_ID };
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    return { mode: null, backgroundId: DEFAULT_BACKGROUND_ID };
  }
  try {
    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw) as { mode?: ThemeMode; backgroundId?: BackgroundId };
    const mode =
      parsed.mode === 'light' || parsed.mode === 'dark' || parsed.mode === 'system' ? parsed.mode : null;
    const backgroundId =
      parsed.backgroundId === 'sea_glass' ||
      parsed.backgroundId === 'mist_mint' ||
      parsed.backgroundId === 'sunrise_frost' ||
      parsed.backgroundId === 'aqua_dusk'
        ? parsed.backgroundId
        : DEFAULT_BACKGROUND_ID;
    return { mode, backgroundId };
  } catch {
    return { mode: null, backgroundId: DEFAULT_BACKGROUND_ID };
  }
}

async function writeThemeSettings(mode: ThemeMode, backgroundId: BackgroundId): Promise<void> {
  const uri = getThemeModeUri();
  if (!uri) {
    return;
  }
  await FileSystem.writeAsStringAsync(uri, JSON.stringify({ mode, backgroundId }));
}

export function ThemeModeProvider({
  children,
  systemColorScheme,
}: {
  children: React.ReactNode;
  systemColorScheme: ColorSchemeName;
}) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [backgroundId, setBackgroundIdState] = useState<BackgroundId>(DEFAULT_BACKGROUND_ID);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const persisted = await readThemeSettings();
      if (!mounted) {
        return;
      }
      if (persisted.mode) {
        setModeState(persisted.mode);
      }
      setBackgroundIdState(persisted.backgroundId);
    };
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void writeThemeSettings(nextMode, backgroundId);
  }, [backgroundId]);

  const setBackgroundId = useCallback(
    (nextBackgroundId: BackgroundId) => {
      setBackgroundIdState(nextBackgroundId);
      void writeThemeSettings(mode, nextBackgroundId);
    },
    [mode]
  );

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
      backgroundId,
      setMode,
      setBackgroundId,
    }),
    [mode, colorScheme, backgroundId, setMode, setBackgroundId]
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

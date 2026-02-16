import { useThemeMode } from '@/contexts/theme-mode-context';

export function useColorScheme() {
  const { colorScheme } = useThemeMode();
  return colorScheme;
}

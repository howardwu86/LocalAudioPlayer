import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BACKGROUND_PRESETS, getBackgroundTone } from '@/constants/backgrounds';
import { ThemeMode, useThemeMode } from '@/contexts/theme-mode-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { mode, setMode, backgroundId, setBackgroundId } = useThemeMode();
  const backgroundTone = getBackgroundTone(backgroundId, isDark);

  const palette = isDark
    ? {
        pageBg: '#0b1114',
        title: '#e3edf0',
        cardBg: 'rgba(21,34,40,0.55)',
        cardBorder: 'rgba(88,116,122,0.55)',
        sectionTitle: '#d8e7ea',
        outlineButtonBg: 'rgba(34,55,61,0.7)',
        outlineButtonBorder: 'rgba(132,165,171,0.52)',
        outlineText: '#d9e6e9',
        itemActiveBg: 'rgba(22,97,92,0.55)',
        itemActiveBorder: '#2ebeb1',
      }
    : {
        pageBg: '#eef5f6',
        title: '#0f172a',
        cardBg: '#ffffff',
        cardBorder: '#dce8ea',
        sectionTitle: '#111827',
        outlineButtonBg: '#f7fbfb',
        outlineButtonBorder: '#90afb0',
        outlineText: '#15424b',
        itemActiveBg: '#ddf7f3',
        itemActiveBorder: '#0f766e',
      };

  const glassTint = isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: backgroundTone.pageBg }]}>
      <View
        pointerEvents="none"
        style={[styles.liquidBlob, styles.liquidBlobTop, { backgroundColor: backgroundTone.blobTop }]}
      />
      <View
        pointerEvents="none"
        style={[styles.liquidBlob, styles.liquidBlobBottom, { backgroundColor: backgroundTone.blobBottom }]}
      />
      <View
        pointerEvents="none"
        style={[styles.liquidBlob, styles.liquidBlobAccent, { backgroundColor: backgroundTone.blobAccent }]}
      />

      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.title }]}>Settings</Text>
      </View>

      <View style={styles.cardShell}>
        <View style={styles.cardMask}>
          <BlurView
            intensity={62}
            tint={glassTint}
            style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: palette.sectionTitle }]}>Theme</Text>
            <View style={styles.optionsRow}>
              {(['system', 'light', 'dark'] as ThemeMode[]).map((option) => {
                const active = mode === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setMode(option)}
                    style={[
                      styles.optionButton,
                      {
                        borderColor: active ? palette.itemActiveBorder : palette.outlineButtonBorder,
                        backgroundColor: active ? palette.itemActiveBg : palette.outlineButtonBg,
                      },
                    ]}>
                    <Text style={[styles.optionButtonText, { color: palette.outlineText }]}>
                      {option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </BlurView>
        </View>
      </View>

      <View style={[styles.cardShell, styles.secondCardShell]}>
        <View style={styles.cardMask}>
          <BlurView
            intensity={62}
            tint={glassTint}
            style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: palette.sectionTitle }]}>Background Picture</Text>
            <View style={styles.backgroundGrid}>
              {BACKGROUND_PRESETS.map((preset) => {
                const active = backgroundId === preset.id;
                const previewTone = isDark ? preset.dark : preset.light;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => setBackgroundId(preset.id)}
                    style={[
                      styles.backgroundOption,
                      {
                        borderColor: active ? palette.itemActiveBorder : palette.outlineButtonBorder,
                        backgroundColor: active ? palette.itemActiveBg : palette.outlineButtonBg,
                      },
                    ]}>
                    <View style={[styles.backgroundPreview, { backgroundColor: previewTone.pageBg }]}>
                      <View style={[styles.previewBlob, styles.previewBlobTop, { backgroundColor: previewTone.blobTop }]} />
                      <View
                        style={[styles.previewBlob, styles.previewBlobBottom, { backgroundColor: previewTone.blobBottom }]}
                      />
                      <View
                        style={[styles.previewBlob, styles.previewBlobAccent, { backgroundColor: previewTone.blobAccent }]}
                      />
                    </View>
                    <Text style={[styles.backgroundOptionText, { color: palette.outlineText }]}>{preset.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </BlurView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  liquidBlob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.82,
  },
  liquidBlobTop: {
    width: 260,
    height: 260,
    top: -90,
    right: -60,
  },
  liquidBlobBottom: {
    width: 320,
    height: 320,
    bottom: 90,
    left: -140,
  },
  liquidBlobAccent: {
    width: 240,
    height: 240,
    top: 260,
    right: -80,
    opacity: 0.62,
  },
  headerRow: {
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  card: {
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  cardShell: {
    borderRadius: 18,
  },
  secondCardShell: {
    marginTop: 12,
  },
  cardMask: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  optionButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  backgroundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  backgroundOption: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
    gap: 7,
  },
  backgroundPreview: {
    height: 58,
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewBlob: {
    position: 'absolute',
    borderRadius: 999,
  },
  previewBlobTop: {
    width: 62,
    height: 62,
    top: -18,
    right: -6,
  },
  previewBlobBottom: {
    width: 74,
    height: 74,
    left: -14,
    bottom: -28,
  },
  previewBlobAccent: {
    width: 56,
    height: 56,
    right: 18,
    bottom: -24,
  },
  backgroundOptionText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

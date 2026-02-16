import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';

import { usePlayer } from '@/contexts/player-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function FilesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { tracks, loadingTracks, activeTrackId, playTrack, importFromFiles, importFromFolder, loadTracks, message } =
    usePlayer();

  const palette = isDark
    ? {
        pageBg: '#0b1114',
        title: '#e3edf0',
        outlineButtonBg: 'rgba(34,55,61,0.7)',
        outlineButtonBorder: 'rgba(132,165,171,0.52)',
        outlineText: '#d9e6e9',
        cardBg: 'rgba(21,34,40,0.55)',
        cardBorder: 'rgba(88,116,122,0.55)',
        sectionTitle: '#d8e7ea',
        subtle: '#a4b6bc',
        itemBg: 'rgba(30,49,56,0.7)',
        itemBorder: 'rgba(90,120,126,0.5)',
        itemActiveBg: 'rgba(22,97,92,0.55)',
        itemActiveBorder: '#2ebeb1',
        itemText: '#e3edf0',
        message: '#56d7ca',
      }
    : {
        pageBg: '#eef5f6',
        title: '#0f172a',
        outlineButtonBg: '#f7fbfb',
        outlineButtonBorder: '#90afb0',
        outlineText: '#15424b',
        cardBg: '#ffffff',
        cardBorder: '#dce8ea',
        sectionTitle: '#111827',
        subtle: '#5b6b72',
        itemBg: '#f3f8f9',
        itemBorder: '#e0eaec',
        itemActiveBg: '#ddf7f3',
        itemActiveBorder: '#0f766e',
        itemText: '#0f172a',
        message: '#0f766e',
      };
  const glassTint = isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.pageBg }]}>
      <View
        pointerEvents="none"
        style={[styles.liquidBlob, styles.liquidBlobTop, { backgroundColor: isDark ? 'rgba(77,143,158,0.2)' : 'rgba(204,233,240,0.65)' }]}
      />
      <View
        pointerEvents="none"
        style={[styles.liquidBlob, styles.liquidBlobBottom, { backgroundColor: isDark ? 'rgba(52,111,123,0.22)' : 'rgba(205,244,235,0.68)' }]}
      />

      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.title }]}>Files</Text>
      </View>

      <View style={styles.actionsRow}>
        <View style={styles.glassButtonShell}>
          <BlurView
            intensity={58}
            tint={glassTint}
            style={[styles.actionButton, { borderColor: palette.outlineButtonBorder, backgroundColor: palette.outlineButtonBg }]}>
            <Pressable onPress={() => void importFromFiles()} style={styles.actionButtonTap}>
              <Text style={[styles.actionButtonText, { color: palette.outlineText }]}>Import Files</Text>
            </Pressable>
          </BlurView>
        </View>
        <View style={styles.glassButtonShell}>
          <BlurView
            intensity={58}
            tint={glassTint}
            style={[styles.actionButtonPrimary, { borderColor: palette.outlineButtonBorder, backgroundColor: palette.outlineButtonBg }]}>
            <Pressable onPress={() => void importFromFolder()} style={styles.actionButtonTap}>
              <Text style={[styles.actionButtonPrimaryText, { color: palette.outlineText }]}>Import Folder</Text>
            </Pressable>
          </BlurView>
        </View>
      </View>

      {message ? <Text style={[styles.messageText, { color: palette.message }]}>{message}</Text> : null}

      <BlurView
        intensity={62}
        tint={glassTint}
        style={[styles.playlistCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
        <Text style={[styles.sectionLabel, { color: palette.sectionTitle }]}>Playlist ({tracks.length})</Text>

        {loadingTracks ? (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.message} />
            <Text style={[styles.helperText, { color: palette.subtle }]}>Scanning tracks...</Text>
          </View>
        ) : null}

        {!loadingTracks && tracks.length === 0 ? (
          <Text style={[styles.helperText, { color: palette.subtle }]}>No tracks found yet.</Text>
        ) : null}

        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator
          refreshing={loadingTracks}
          onRefresh={() => void loadTracks()}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                void playTrack(item);
                router.navigate('/(tabs)');
              }}
              style={[
                styles.trackItem,
                { backgroundColor: palette.itemBg, borderColor: palette.itemBorder },
                item.id === activeTrackId
                  ? { borderColor: palette.itemActiveBorder, backgroundColor: palette.itemActiveBg }
                  : undefined,
              ]}>
              <Text style={[styles.trackTitle, { color: palette.itemText }]} numberOfLines={1}>
                {item.title}
              </Text>
            </Pressable>
          )}
        />
      </BlurView>
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
    opacity: 0.8,
  },
  liquidBlobTop: {
    width: 240,
    height: 240,
    top: -80,
    right: -70,
  },
  liquidBlobBottom: {
    width: 290,
    height: 290,
    bottom: 110,
    left: -130,
  },
  headerRow: {
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  actionButton: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionButtonPrimary: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  glassButtonShell: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonTap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  actionButtonText: {
    fontWeight: '700',
  },
  actionButtonPrimaryText: {
    fontWeight: '700',
  },
  messageText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  playlistCard: {
    flex: 1,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  centered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helperText: {
    color: '#5b6b72',
  },
  trackItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  trackTitle: {
    fontWeight: '600',
  },
});

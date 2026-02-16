import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { usePlayer } from '@/contexts/player-context';

export default function FilesScreen() {
  const { tracks, loadingTracks, activeTrackId, playTrack, importFromFiles, loadTracks, message } = usePlayer();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Files</Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable onPress={() => void loadTracks()} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Rescan</Text>
        </Pressable>
        <Pressable onPress={() => void importFromFiles()} style={styles.actionButtonPrimary}>
          <Text style={styles.actionButtonPrimaryText}>Import</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.messageText}>{message}</Text> : null}

      <View style={styles.playlistCard}>
        <Text style={styles.sectionLabel}>Playlist ({tracks.length})</Text>

        {loadingTracks ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#0f766e" />
            <Text style={styles.helperText}>Scanning tracks...</Text>
          </View>
        ) : null}

        {!loadingTracks && tracks.length === 0 ? <Text style={styles.helperText}>No tracks found yet.</Text> : null}

        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void playTrack(item)}
              style={[styles.trackItem, item.id === activeTrackId ? styles.trackItemActive : undefined]}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef5f6',
    paddingHorizontal: 16,
  },
  headerRow: {
    marginTop: 8,
    marginBottom: 10,
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
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#90afb0',
    backgroundColor: '#f7fbfb',
    paddingVertical: 10,
  },
  actionButtonPrimary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#0f766e',
    paddingVertical: 10,
  },
  actionButtonText: {
    color: '#15424b',
    fontWeight: '700',
  },
  actionButtonPrimaryText: {
    color: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce8ea',
    padding: 14,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
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
    backgroundColor: '#f3f8f9',
    borderWidth: 1,
    borderColor: '#e0eaec',
    marginBottom: 8,
  },
  trackItemActive: {
    borderColor: '#0f766e',
    backgroundColor: '#ddf7f3',
  },
  trackTitle: {
    color: '#0f172a',
    fontWeight: '600',
  },
});

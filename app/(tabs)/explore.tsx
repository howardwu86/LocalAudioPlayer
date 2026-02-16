import { ActivityIndicator, Alert, FlatList, PanResponder, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useCallback, useMemo, useRef, useState } from 'react';

import { usePlayer } from '@/contexts/player-context';
import { ThemeMode, useThemeMode } from '@/contexts/theme-mode-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

const TRACK_ROW_HEIGHT = 58;

export default function FilesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { mode, setMode } = useThemeMode();
  const router = useRouter();
  const { tracks, loadingTracks, activeTrackId, playTrack, importFromFiles, importFromFolder, deleteTracks, loadTracks, message } =
    usePlayer();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragAnchorIndex, setDragAnchorIndex] = useState<number | null>(null);
  const [dragBaseIds, setDragBaseIds] = useState<Set<string>>(new Set());
  const [scrollOffset, setScrollOffset] = useState(0);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const selectedCount = selectedIds.size;

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

  const getIndexFromY = useCallback(
    (localY: number) => {
      if (!tracks.length) {
        return null;
      }
      const adjusted = Math.max(0, localY + scrollOffset);
      const idx = Math.floor(adjusted / TRACK_ROW_HEIGHT);
      if (idx < 0 || idx >= tracks.length) {
        return null;
      }
      return idx;
    },
    [scrollOffset, tracks]
  );

  const updateRangeSelection = useCallback(
    (currentIndex: number) => {
      if (dragAnchorIndex === null) {
        return;
      }
      const start = Math.min(dragAnchorIndex, currentIndex);
      const end = Math.max(dragAnchorIndex, currentIndex);
      const next = new Set(dragBaseIds);
      for (let i = start; i <= end; i += 1) {
        const track = tracks[i];
        if (track) {
          next.add(track.id);
        }
      }
      setSelectedIds(next);
    },
    [dragAnchorIndex, dragBaseIds, tracks]
  );

  const selectionPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => selectionMode,
        onMoveShouldSetPanResponder: (_, gesture) => selectionMode && Math.abs(gesture.dy) > 3,
        onPanResponderGrant: (evt) => {
          const idx = getIndexFromY(evt.nativeEvent.locationY);
          if (idx === null) {
            return;
          }
          setDragAnchorIndex(idx);
          setDragBaseIds(new Set(selectedIdsRef.current));
          updateRangeSelection(idx);
        },
        onPanResponderMove: (evt) => {
          const idx = getIndexFromY(evt.nativeEvent.locationY);
          if (idx === null) {
            return;
          }
          updateRangeSelection(idx);
        },
        onPanResponderRelease: () => {
          setDragAnchorIndex(null);
          setDragBaseIds(new Set(selectedIdsRef.current));
        },
        onPanResponderTerminate: () => {
          setDragAnchorIndex(null);
          setDragBaseIds(new Set(selectedIdsRef.current));
        },
      }),
    [getIndexFromY, selectionMode, updateRangeSelection]
  );

  const beginSelectionAtIndex = useCallback(
    (index: number) => {
      const track = tracks[index];
      if (!track) {
        return;
      }
      const next = new Set<string>([track.id]);
      setSelectionMode(true);
      setSelectedIds(next);
      setDragBaseIds(next);
      setDragAnchorIndex(index);
    },
    [tracks]
  );

  const toggleSelection = useCallback((trackId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setDragAnchorIndex(null);
    setDragBaseIds(new Set());
  }, []);

  const confirmDeleteSelection = useCallback(() => {
    if (!selectedCount) {
      return;
    }
    const ids = Array.from(selectedIds);
    Alert.alert(
      'Delete Selected Files',
      `Delete ${selectedCount} selected file${selectedCount > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteTracks(ids).then(() => {
              exitSelectionMode();
            });
          },
        },
      ]
    );
  }, [deleteTracks, exitSelectionMode, selectedCount, selectedIds]);

  const handleSelectPress = useCallback(() => {
    if (selectionMode) {
      exitSelectionMode();
      return;
    }
    setSelectionMode(true);
    setSelectedIds(new Set());
  }, [exitSelectionMode, selectionMode]);

  const handleSelectAllPress = useCallback(() => {
    if (!tracks.length) {
      return;
    }
    setSelectionMode(true);
    setSelectedIds(new Set(tracks.map((track) => track.id)));
  }, [tracks]);

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

      <View style={styles.themeModeRow}>
        <Text style={[styles.themeModeLabel, { color: palette.sectionTitle }]}>Theme</Text>
        <View style={styles.themeModeOptions}>
          {(['system', 'light', 'dark'] as ThemeMode[]).map((option) => {
            const active = mode === option;
            return (
              <Pressable
                key={option}
                onPress={() => setMode(option)}
                style={[
                  styles.themeModeButton,
                  {
                    borderColor: active ? palette.itemActiveBorder : palette.outlineButtonBorder,
                    backgroundColor: active ? palette.itemActiveBg : palette.outlineButtonBg,
                  },
                ]}>
                <Text style={[styles.themeModeButtonText, { color: palette.outlineText }]}>
                  {option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
                </Text>
              </Pressable>
            );
          })}
        </View>
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

      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Text style={[styles.selectionText, { color: palette.sectionTitle }]}>
            Selected {selectedCount}
          </Text>
          <View style={styles.selectionActionRow}>
            <Pressable onPress={exitSelectionMode} style={styles.selectionActionButton}>
              <Text style={[styles.selectionActionText, { color: palette.outlineText }]}>Done</Text>
            </Pressable>
            <Pressable onPress={confirmDeleteSelection} style={styles.selectionActionButton}>
              <Text style={[styles.selectionActionText, styles.deleteText]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {message ? <Text style={[styles.messageText, { color: palette.message }]}>{message}</Text> : null}

      <BlurView
        intensity={62}
        tint={glassTint}
        style={[styles.playlistCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: palette.sectionTitle }]}>Playlist ({tracks.length})</Text>
          <View style={styles.sectionHeaderActions}>
            <Pressable onPress={handleSelectPress} style={styles.sectionHeaderButton}>
              <Text style={[styles.sectionHeaderButtonText, { color: palette.outlineText }]}>
                {selectionMode ? 'Done' : 'Select'}
              </Text>
            </Pressable>
            <Pressable onPress={handleSelectAllPress} style={styles.sectionHeaderButton}>
              <Text style={[styles.sectionHeaderButtonText, { color: palette.outlineText }]}>Select All</Text>
            </Pressable>
          </View>
        </View>

        {loadingTracks ? (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.message} />
            <Text style={[styles.helperText, { color: palette.subtle }]}>Scanning tracks...</Text>
          </View>
        ) : null}

        {!loadingTracks && tracks.length === 0 ? (
          <Text style={[styles.helperText, { color: palette.subtle }]}>No tracks found yet.</Text>
        ) : null}

        <View style={styles.playlistTouchArea} {...selectionPanResponder.panHandlers}>
          <FlatList
            data={tracks}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator
            refreshing={loadingTracks}
            onRefresh={() => void loadTracks()}
            getItemLayout={(_, index) => ({
              length: TRACK_ROW_HEIGHT,
              offset: TRACK_ROW_HEIGHT * index,
              index,
            })}
            onScroll={(event) => {
              setScrollOffset(event.nativeEvent.contentOffset.y);
            }}
            scrollEventThrottle={16}
            renderItem={({ item, index }) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <Pressable
                  onLongPress={() => beginSelectionAtIndex(index)}
                  onPress={() => {
                    if (selectionMode) {
                      toggleSelection(item.id);
                      return;
                    }
                    void playTrack(item);
                    router.navigate('/(tabs)');
                  }}
                  style={[
                    styles.trackItem,
                    { backgroundColor: palette.itemBg, borderColor: palette.itemBorder },
                    item.id === activeTrackId
                      ? { borderColor: palette.itemActiveBorder, backgroundColor: palette.itemActiveBg }
                      : undefined,
                    isSelected ? styles.trackItemSelected : undefined,
                  ]}>
                  <Text style={[styles.trackTitle, { color: palette.itemText }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
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
  themeModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 6,
    gap: 8,
  },
  themeModeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  themeModeOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeModeButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  themeModeButtonText: {
    fontSize: 12,
    fontWeight: '700',
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
  playlistTouchArea: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(132,165,171,0.52)',
    backgroundColor: 'rgba(255,255,255,0.28)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  sectionHeaderButtonText: {
    fontSize: 12,
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
    minHeight: TRACK_ROW_HEIGHT - 8,
    justifyContent: 'center',
  },
  trackItemSelected: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
  },
  trackTitle: {
    fontWeight: '600',
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  selectionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectionActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectionActionButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  selectionActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  deleteText: {
    color: '#ef4444',
  },
});

import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import { FlatList, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef, useState } from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { usePlayer } from '@/contexts/player-context';

const SPEED_PRESETS = [80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130] as const;
const SLEEP_PRESETS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60] as const;

function formatMillis(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    activeTrack,
    activeTrackId,
    isPlaying,
    positionMillis,
    durationMillis,
    playbackPercent,
    playbackRate,
    sleepTimerMinutes,
    sleepSecondsLeft,
    sleepPreferenceMinutes,
    tracks,
    isSeeking,
    seekMillis,
    togglePlayPause,
    playTrack,
    playPrevious,
    playNext,
    changePlaybackRate,
    setSleepTimer,
    clearSleepTimer,
    onSeekStart,
    onSeekChange,
    onSeekComplete,
  } = usePlayer();

  const speedPercent = Math.round(playbackRate * 100);
  const sleepTimerOn = sleepSecondsLeft !== null;
  const [sheet, setSheet] = useState<'speed' | 'sleep' | null>(null);
  const backgroundListRef = useRef<FlatList<{ id: string; title: string; uri: string }> | null>(null);

  const activeTrackIndex = useMemo(
    () => tracks.findIndex((track) => track.id === activeTrackId),
    [tracks, activeTrackId]
  );

  useEffect(() => {
    if (activeTrackIndex < 0) {
      return;
    }
    const timer = setTimeout(() => {
      backgroundListRef.current?.scrollToIndex({
        index: activeTrackIndex,
        animated: true,
        viewPosition: 0.5,
      });
    }, 120);

    return () => clearTimeout(timer);
  }, [activeTrackIndex]);

  const showSpeedSheet = () => {
    setSheet('speed');
  };

  const showSleepSheet = () => {
    setSheet('sleep');
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={backgroundListRef}
        data={tracks}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        scrollIndicatorInsets={{ bottom: 420 }}
        contentContainerStyle={styles.backgroundListContent}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          backgroundListRef.current?.scrollToOffset({
            offset: Math.max(0, index * averageItemLength - 140),
            animated: true,
          });
        }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void playTrack(item)}
            style={[styles.bgTrackItem, item.id === activeTrackId ? styles.bgTrackItemActive : undefined]}>
            <Text style={styles.bgTrackTitle} numberOfLines={1}>
              {item.title}
            </Text>
          </Pressable>
        )}
      />

      <View pointerEvents="none" style={styles.backgroundTint} />

      <View style={[styles.headerBlock, { top: insets.top + 6 }]}> 
        <Text style={styles.headerTitle}>Local Audio Player</Text>
      </View>

      <View style={styles.floatingWrap}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.floatingShell}>
            <View style={styles.floatingMask}>
              <BlurView intensity={60} tint="systemThinMaterialLight" style={styles.floatingGlass}>
                <View style={styles.floatingAccent} />
                <Text style={styles.nowPlayingLabel}>Now Playing</Text>
                <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                  {activeTrack ? activeTrack.title : 'Pick a track from playlist'}
                </Text>

                <Slider
                  disabled={!activeTrack || durationMillis <= 0}
                  minimumValue={0}
                  maximumValue={Math.max(durationMillis, 1)}
                  value={isSeeking ? seekMillis : positionMillis}
                  minimumTrackTintColor="#0f766e"
                  maximumTrackTintColor="#c7d5d9"
                  thumbTintColor="#0f766e"
                  onSlidingStart={onSeekStart}
                  onValueChange={onSeekChange}
                  onSlidingComplete={(value) => void onSeekComplete(value)}
                />

                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>{formatMillis(positionMillis)}</Text>
                  <Text style={styles.percentText}>{playbackPercent.toFixed(0)}%</Text>
                  <Text style={styles.progressText}>{formatMillis(durationMillis)}</Text>
                </View>

                <View style={styles.transportRow}>
                  <Pressable
                    onPress={() => void playPrevious()}
                    disabled={!tracks.length}
                    style={[styles.transportButton, !tracks.length && styles.buttonDisabled]}>
                    <IconSymbol name="backward.fill" size={18} color="#15424b" />
                  </Pressable>
                  <View style={styles.playOrb}>
                    <Pressable
                      onPress={() => void togglePlayPause()}
                      disabled={!activeTrack}
                      style={[styles.playButton, !activeTrack && styles.buttonDisabled]}>
                      <IconSymbol name={isPlaying ? 'pause.fill' : 'play.fill'} size={24} color="#ffffff" />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => void playNext()}
                    disabled={!tracks.length}
                    style={[styles.transportButton, !tracks.length && styles.buttonDisabled]}>
                    <IconSymbol name="forward.fill" size={18} color="#15424b" />
                  </Pressable>
                </View>

                <View style={styles.modeButtonRow}>
                  <Pressable onPress={showSpeedSheet} style={styles.modeButton}>
                    <Text style={styles.modeButtonText}>Speed {speedPercent}%</Text>
                  </Pressable>
                  <Pressable onPress={showSleepSheet} style={styles.modeButton}>
                    <Text style={styles.modeButtonText}>
                      Sleep Timer {sleepSecondsLeft !== null ? formatCountdown(sleepSecondsLeft) : `${sleepPreferenceMinutes}m`}
                    </Text>
                  </Pressable>
                </View>
              </BlurView>
            </View>
          </View>
        </ScrollView>
      </View>

      <Modal transparent visible={sheet !== null} animationType="fade" onRequestClose={() => setSheet(null)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setSheet(null)} />
          <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={styles.sheetGroup}>
              {sheet === 'speed' ? (
                <>
                  <Text style={styles.sheetTitle}>Playback Speed</Text>
                  <View style={styles.sheetOptionsGrid}>
                    {SPEED_PRESETS.map((preset) => {
                      const active = preset === speedPercent;
                      return (
                        <Pressable
                          key={preset}
                          onPress={() => {
                            void changePlaybackRate(preset / 100);
                            setSheet(null);
                          }}
                          style={[styles.sheetPill, active && styles.sheetPillActive]}>
                          <Text style={[styles.sheetPillText, active && styles.sheetPillTextActive]}>{preset}%</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.sheetTitle}>
                    Sleep Timer {sleepTimerOn ? `(${formatCountdown(sleepSecondsLeft ?? 0)})` : ''}
                  </Text>
                  <View style={styles.toggleRow}>
                    <Pressable
                      onPress={() => setSleepTimer(sleepPreferenceMinutes)}
                      style={[styles.toggleButton, sleepTimerOn && styles.toggleButtonActive]}>
                      <Text style={[styles.toggleText, sleepTimerOn && styles.toggleTextActive]}>Timer On</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => clearSleepTimer()}
                      style={[styles.toggleButton, !sleepTimerOn && styles.toggleButtonActive]}>
                      <Text style={[styles.toggleText, !sleepTimerOn && styles.toggleTextActive]}>Timer Off</Text>
                    </Pressable>
                  </View>
                  <View style={styles.sheetOptionsGrid}>
                    {SLEEP_PRESETS.map((preset) => {
                      const active = sleepTimerOn && preset === sleepTimerMinutes;
                      return (
                        <Pressable
                          key={preset}
                          onPress={() => {
                            setSleepTimer(preset);
                            setSheet(null);
                          }}
                          style={[styles.sheetPill, active && styles.sheetPillActive]}>
                          <Text style={[styles.sheetPillText, active && styles.sheetPillTextActive]}>{preset}m</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
            <Pressable style={styles.cancelButton} onPress={() => setSheet(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e9f0f2',
  },
  backgroundListContent: {
    paddingTop: 86,
    paddingHorizontal: 14,
    paddingBottom: 420,
    gap: 8,
  },
  bgTrackItem: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  bgTrackItemActive: {
    backgroundColor: 'rgba(207,250,244,0.9)',
    borderColor: 'rgba(15,118,110,0.5)',
  },
  bgTrackTitle: {
    color: '#274047',
    fontWeight: '600',
  },
  backgroundTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(233,241,243,0.25)',
  },
  headerBlock: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  floatingWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    maxHeight: '68%',
  },
  floatingShell: {
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  floatingMask: {
    borderRadius: 36,
    overflow: 'hidden',
  },
  floatingGlass: {
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  floatingAccent: {
    height: 4,
    width: 58,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,118,110,0.42)',
  },
  nowPlayingLabel: {
    fontSize: 14,
    color: '#4a5e65',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nowPlayingTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#0f172a',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '500',
  },
  percentText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '700',
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 2,
  },
  playOrb: {
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  playButton: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0e7f76',
    borderRadius: 37,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  transportButton: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108,138,142,0.45)',
    backgroundColor: 'rgba(255,255,255,0.48)',
    borderRadius: 27,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  modeButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(163,184,189,0.65)',
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modeButtonText: {
    color: '#14363c',
    fontWeight: '700',
    fontSize: 13,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 12, 16, 0.25)',
  },
  sheetWrap: {
    paddingHorizontal: 10,
  },
  sheetGroup: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(248, 251, 253, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(180, 193, 197, 0.7)',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5b6b72',
    textAlign: 'center',
  },
  sheetOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  sheetPill: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(163,184,189,0.7)',
    backgroundColor: 'rgba(255,255,255,0.65)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 58,
    alignItems: 'center',
  },
  sheetPillActive: {
    backgroundColor: '#d7f3ee',
    borderColor: '#0f766e',
  },
  sheetPillText: {
    color: '#14363c',
    fontWeight: '700',
    fontSize: 13,
  },
  sheetPillTextActive: {
    color: '#0f766e',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(163,184,189,0.7)',
    backgroundColor: 'rgba(255,255,255,0.65)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#d7f3ee',
    borderColor: '#0f766e',
  },
  toggleText: {
    color: '#14363c',
    fontWeight: '700',
    fontSize: 13,
  },
  toggleTextActive: {
    color: '#0f766e',
  },
  cancelButton: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(248, 251, 253, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(180, 193, 197, 0.7)',
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: {
    color: '#0f766e',
    fontWeight: '800',
    fontSize: 17,
  },
});

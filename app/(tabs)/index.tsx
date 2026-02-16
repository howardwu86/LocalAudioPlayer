import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import { FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { usePlayer } from '@/contexts/player-context';

const SPEED_MIN = 80;
const SPEED_MAX = 130;
const SPEED_STEP = 5;
const SLEEP_MIN = 5;
const SLEEP_MAX = 60;
const SLEEP_STEP = 5;

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

function roundToStep(n: number, step: number): number {
  return Math.round(n / step) * step;
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
  const speedSliderValue =
    speedPercent >= SPEED_MIN && speedPercent <= SPEED_MAX
      ? roundToStep(speedPercent, SPEED_STEP)
      : 100;
  const sleepSliderValue =
    sleepPreferenceMinutes >= SLEEP_MIN && sleepPreferenceMinutes <= SLEEP_MAX
      ? roundToStep(sleepPreferenceMinutes, SLEEP_STEP)
      : 15;
  const [speedPreview, setSpeedPreview] = useState(speedSliderValue);
  const [sleepPreview, setSleepPreview] = useState(sleepSliderValue);
  const [openSelector, setOpenSelector] = useState<'speed' | 'sleep' | null>(null);

  const sleepTimerOn = sleepSecondsLeft !== null;

  useEffect(() => {
    setSpeedPreview(speedSliderValue);
  }, [speedSliderValue]);

  useEffect(() => {
    setSleepPreview(sleepSliderValue);
  }, [sleepSliderValue]);

  const openSpeedPopup = () => {
    setSpeedPreview(speedSliderValue);
    setOpenSelector('speed');
  };

  const openSleepPopup = () => {
    setSleepPreview(sleepSliderValue);
    setOpenSelector('sleep');
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.backgroundListContent}
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
                  <Pressable
                    onPress={() => void togglePlayPause()}
                    disabled={!activeTrack}
                    style={[styles.playButton, !activeTrack && styles.buttonDisabled]}>
                    <IconSymbol name={isPlaying ? 'pause.fill' : 'play.fill'} size={24} color="#ffffff" />
                  </Pressable>
                  <Pressable
                    onPress={() => void playNext()}
                    disabled={!tracks.length}
                    style={[styles.transportButton, !tracks.length && styles.buttonDisabled]}>
                    <IconSymbol name="forward.fill" size={18} color="#15424b" />
                  </Pressable>
                </View>

                <View style={styles.modeButtonRow}>
                  <Pressable
                    onPress={openSpeedPopup}
                    style={[styles.modeButton, openSelector === 'speed' ? styles.modeButtonActive : undefined]}>
                    <Text style={styles.modeButtonText}>Speed {speedPercent}%</Text>
                  </Pressable>
                  <Pressable
                    onPress={openSleepPopup}
                    style={[styles.modeButton, openSelector === 'sleep' ? styles.modeButtonActive : undefined]}>
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

      {openSelector ? (
        <View style={styles.selectorOverlay}>
          <Pressable style={styles.selectorBackdrop} onPress={() => setOpenSelector(null)} />
          <View style={styles.selectorWrap}>
            <View style={styles.selectorShell}>
              <View style={styles.selectorMask}>
                <BlurView intensity={72} tint="systemThinMaterialLight" style={styles.selectorGlass}>
                  {openSelector === 'speed' ? (
                    <>
                      <Text style={styles.sectionLabel}>Speed • {speedPreview}%</Text>
                      <Slider
                        minimumValue={SPEED_MIN}
                        maximumValue={SPEED_MAX}
                        step={SPEED_STEP}
                        value={speedPreview}
                        minimumTrackTintColor="#0f766e"
                        maximumTrackTintColor="#c7d5d9"
                        thumbTintColor="#0f766e"
                        onValueChange={(value) => setSpeedPreview(value)}
                      />
                      <View style={styles.sliderLabelsRow}>
                        <Text style={styles.metaText}>80%</Text>
                        <Text style={styles.metaText}>90%</Text>
                        <Text style={styles.metaText}>100%</Text>
                        <Text style={styles.metaText}>110%</Text>
                        <Text style={styles.metaText}>120%</Text>
                        <Text style={styles.metaText}>130%</Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          void changePlaybackRate(speedPreview / 100);
                          setOpenSelector(null);
                        }}
                        style={styles.doneButton}>
                        <Text style={styles.doneButtonText}>Done</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={styles.sectionLabel}>
                        Sleep Timer • {sleepPreview}m
                        {sleepSecondsLeft !== null ? ` (running ${formatCountdown(sleepSecondsLeft)})` : ''}
                      </Text>
                      <Slider
                        minimumValue={SLEEP_MIN}
                        maximumValue={SLEEP_MAX}
                        step={SLEEP_STEP}
                        value={sleepPreview}
                        minimumTrackTintColor="#0f766e"
                        maximumTrackTintColor="#c7d5d9"
                        thumbTintColor="#0f766e"
                        onValueChange={(value) => setSleepPreview(value)}
                      />
                      <View style={styles.sliderLabelsRow}>
                        <Text style={styles.metaText}>5m</Text>
                        <Text style={styles.metaText}>15m</Text>
                        <Text style={styles.metaText}>30m</Text>
                        <Text style={styles.metaText}>45m</Text>
                        <Text style={styles.metaText}>60m</Text>
                      </View>
                      <View style={styles.inlineButtonRow}>
                        <Pressable
                          onPress={() => {
                            if (sleepTimerOn) {
                              clearSleepTimer();
                            } else {
                              setSleepTimer(sleepPreferenceMinutes);
                            }
                            setOpenSelector(null);
                          }}
                          style={styles.chip}>
                          <Text style={styles.chipText}>{sleepTimerOn ? 'On' : 'Off'}</Text>
                        </Pressable>
                      </View>
                      <Pressable
                        onPress={() => {
                          setSleepTimer(sleepPreview);
                          setOpenSelector(null);
                        }}
                        style={styles.doneButton}>
                        <Text style={styles.doneButtonText}>Done</Text>
                      </Pressable>
                    </>
                  )}
                </BlurView>
              </View>
            </View>
          </View>
        </View>
      ) : null}
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
    borderRadius: 32,
    backgroundColor: 'transparent',
  },
  floatingMask: {
    borderRadius: 32,
    overflow: 'hidden',
  },
  floatingGlass: {
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  nowPlayingLabel: {
    fontSize: 13,
    color: '#5b6b72',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nowPlayingTitle: {
    fontSize: 20,
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
    justifyContent: 'center',
    gap: 22,
  },
  playButton: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  transportButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(121,149,153,0.45)',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 26,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  sectionBlock: {
    marginTop: 2,
    gap: 4,
  },
  selectorOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(9,20,24,0.22)',
  },
  selectorWrap: {
    width: '88%',
    maxWidth: 430,
  },
  selectorShell: {
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  selectorMask: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  selectorGlass: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 16,
    gap: 6,
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
  modeButtonActive: {
    borderColor: 'rgba(15,118,110,0.5)',
    backgroundColor: 'rgba(214,244,240,0.72)',
  },
  modeButtonText: {
    color: '#14363c',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#111827',
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  metaText: {
    color: '#567077',
    fontSize: 11,
    fontWeight: '600',
  },
  inlineButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#9eb5b8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  chipText: {
    color: '#14363c',
    fontWeight: '600',
  },
  doneButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#0f766e',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  doneButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

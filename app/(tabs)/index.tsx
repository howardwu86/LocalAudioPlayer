import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import { Animated, FlatList, Modal, PanResponder, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { usePlayer } from '@/contexts/player-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
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
  const [isMiniControl, setIsMiniControl] = useState(false);
  const backgroundListRef = useRef<FlatList<{ id: string; title: string; uri: string }> | null>(null);
  const miniAnim = useRef(new Animated.Value(0)).current;
  const wasPlayingRef = useRef(isPlaying);
  const ignoreMiniExpandRef = useRef(false);

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

  useEffect(() => {
    const wasPlaying = wasPlayingRef.current;
    wasPlayingRef.current = isPlaying;
    if (wasPlaying || !isPlaying || activeTrackIndex < 0) {
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
  }, [isPlaying, activeTrackIndex]);

  useEffect(() => {
    Animated.spring(miniAnim, {
      toValue: isMiniControl ? 1 : 0,
      useNativeDriver: true,
      damping: 16,
      stiffness: 180,
      mass: 0.8,
    }).start();
  }, [isMiniControl, miniAnim]);

  const showSpeedSheet = () => {
    setSheet('speed');
  };

  const showSleepSheet = () => {
    setSheet('sleep');
  };

  const palette = useMemo(
    () =>
      isDark
        ? {
            pageBg: '#0b1114',
            listTint: 'rgba(9,17,20,0.35)',
            cardBg: 'rgba(21,34,40,0.55)',
            cardBorder: 'rgba(88,116,122,0.55)',
            cardActiveBg: 'rgba(17,70,75,0.78)',
            cardActiveBorder: 'rgba(39,160,156,0.75)',
            textPrimary: '#e3edf0',
            textSecondary: '#a4b6bc',
            accent: '#3fd3c7',
            glassOuterBorder: 'rgba(121,152,160,0.5)',
            glassOuterBg: 'rgba(19,33,38,0.5)',
            glassInnerBorder: 'rgba(146,176,184,0.6)',
            glassInnerBg: 'rgba(25,44,50,0.55)',
            buttonBg: 'rgba(34,55,61,0.7)',
            buttonBorder: 'rgba(132,165,171,0.52)',
            modeBg: 'rgba(33,54,61,0.68)',
            modeBorder: 'rgba(124,154,161,0.52)',
            sheetBg: 'rgba(22,35,40,0.96)',
            sheetBorder: 'rgba(116,145,151,0.7)',
            sheetText: '#d9e6e9',
            sheetSubtle: '#93a7ad',
            sheetActiveBg: 'rgba(22,97,92,0.55)',
            sheetActiveBorder: '#2ebeb1',
            transportIcon: '#d8e7ea',
          }
        : {
            pageBg: '#e9f0f2',
            listTint: 'rgba(233,241,243,0.25)',
            cardBg: 'rgba(255,255,255,0.38)',
            cardBorder: 'rgba(255,255,255,0.55)',
            cardActiveBg: 'rgba(207,250,244,0.9)',
            cardActiveBorder: 'rgba(15,118,110,0.5)',
            textPrimary: '#0f172a',
            textSecondary: '#4b5563',
            accent: '#0f766e',
            glassOuterBorder: 'rgba(255,255,255,0.72)',
            glassOuterBg: 'rgba(255,255,255,0.16)',
            glassInnerBorder: 'rgba(255,255,255,0.9)',
            glassInnerBg: 'rgba(255,255,255,0.28)',
            buttonBg: 'rgba(255,255,255,0.48)',
            buttonBorder: 'rgba(108,138,142,0.45)',
            modeBg: 'rgba(255,255,255,0.42)',
            modeBorder: 'rgba(163,184,189,0.65)',
            sheetBg: 'rgba(248, 251, 253, 0.95)',
            sheetBorder: 'rgba(180, 193, 197, 0.7)',
            sheetText: '#14363c',
            sheetSubtle: '#5b6b72',
            sheetActiveBg: '#d7f3ee',
            sheetActiveBorder: '#0f766e',
            transportIcon: '#15424b',
          },
    [isDark]
  );
  const glassTint = isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight';
  const sheetGlassTint = isDark ? 'systemThickMaterialDark' : 'systemThickMaterialLight';

  const markMiniButtonTouch = () => {
    ignoreMiniExpandRef.current = true;
  };
  const floatingBottom = Math.max(insets.bottom + 78, 92);

  const onControlDragRelease = useCallback(
    (dy: number) => {
      if (dy > 28 && !isMiniControl) {
        setIsMiniControl(true);
        return;
      }
      if (dy < -28 && isMiniControl) {
        setIsMiniControl(false);
      }
    },
    [isMiniControl]
  );

  const controlDragResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > Math.abs(gesture.dx) && Math.abs(gesture.dy) > 6,
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, gesture) => {
          onControlDragRelease(gesture.dy);
        },
      }),
    [onControlDragRelease]
  );

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
            style={[
              styles.bgTrackItem,
              { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
              item.id === activeTrackId
                ? { backgroundColor: palette.cardActiveBg, borderColor: palette.cardActiveBorder }
                : undefined,
            ]}>
            <Text style={[styles.bgTrackTitle, { color: palette.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
          </Pressable>
        )}
      />

      <View pointerEvents="none" style={[styles.backgroundTint, { backgroundColor: palette.listTint }]} />

      <View style={[styles.headerBlock, { top: insets.top + 6 }]}> 
        <View style={[styles.headerGlassShell, { borderColor: palette.glassOuterBorder, backgroundColor: palette.glassOuterBg }]}>
          <View style={styles.headerGlassMask}>
            <BlurView intensity={52} tint={glassTint} style={[styles.headerGlass, { borderColor: palette.glassInnerBorder }]}>
              <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>Local Audio Player</Text>
            </BlurView>
          </View>
        </View>
      </View>

      <Animated.View
        style={[
          styles.floatingWrap,
          isMiniControl ? styles.floatingWrapMini : undefined,
          { bottom: floatingBottom },
          {
            transform: [
              {
                translateY: miniAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 8],
                }),
              },
              {
                scale: miniAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.985],
                }),
              },
            ],
          },
        ]}>
        <View
          style={[
            styles.floatingShell,
            isMiniControl ? styles.floatingShellMini : undefined,
            { borderColor: palette.glassOuterBorder, backgroundColor: palette.glassOuterBg },
          ]}>
          <View
            style={[styles.floatingMask, isMiniControl ? styles.floatingMaskMini : undefined]}
            onTouchEnd={
              isMiniControl
                ? () => {
                    if (ignoreMiniExpandRef.current) {
                      ignoreMiniExpandRef.current = false;
                      return;
                    }
                    setIsMiniControl(false);
                  }
                : undefined
            }>
            <BlurView
              intensity={60}
              tint={glassTint}
              style={[
                styles.floatingGlass,
                isMiniControl ? styles.floatingGlassMini : undefined,
                { borderColor: palette.glassInnerBorder, backgroundColor: palette.glassInnerBg },
              ]}>
              <View style={styles.dragHandleArea} {...controlDragResponder.panHandlers}>
                <View
                  style={[
                    styles.floatingAccent,
                    isMiniControl ? styles.floatingAccentMini : undefined,
                    { backgroundColor: `${palette.accent}88` },
                  ]}
                />
              </View>

              {isMiniControl ? (
                <View style={styles.transportRowMini}>
                  <Pressable
                    onPressIn={markMiniButtonTouch}
                    onPress={() => void playPrevious()}
                    disabled={!tracks.length}
                    style={[
                      styles.transportButton,
                      styles.transportButtonMini,
                      { backgroundColor: palette.buttonBg, borderColor: palette.buttonBorder },
                      !tracks.length && styles.buttonDisabled,
                    ]}>
                    <IconSymbol name="backward.fill" size={18} color={palette.transportIcon} />
                  </Pressable>
                  <View style={[styles.playOrb, styles.playOrbMini]}>
                    <Pressable
                      onPressIn={markMiniButtonTouch}
                      onPress={() => void togglePlayPause()}
                      disabled={!activeTrack}
                      style={[styles.playButton, styles.playButtonMini, !activeTrack && styles.buttonDisabled]}>
                      <IconSymbol name={isPlaying ? 'pause.fill' : 'play.fill'} size={22} color="#ffffff" />
                    </Pressable>
                  </View>
                  <Pressable
                    onPressIn={markMiniButtonTouch}
                    onPress={() => void playNext()}
                    disabled={!tracks.length}
                    style={[
                      styles.transportButton,
                      styles.transportButtonMini,
                      { backgroundColor: palette.buttonBg, borderColor: palette.buttonBorder },
                      !tracks.length && styles.buttonDisabled,
                    ]}>
                    <IconSymbol name="forward.fill" size={18} color={palette.transportIcon} />
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={[styles.nowPlayingLabel, { color: palette.textSecondary }]}>Now Playing</Text>
                  <Text style={[styles.nowPlayingTitle, { color: palette.textPrimary }]} numberOfLines={1}>
                    {activeTrack ? activeTrack.title : 'Pick a track from playlist'}
                  </Text>

                  <Slider
                    disabled={!activeTrack || durationMillis <= 0}
                    minimumValue={0}
                    maximumValue={Math.max(durationMillis, 1)}
                    value={isSeeking ? seekMillis : positionMillis}
                    minimumTrackTintColor={palette.accent}
                    maximumTrackTintColor={isDark ? '#5f747b' : '#c7d5d9'}
                    thumbTintColor={palette.accent}
                    onSlidingStart={onSeekStart}
                    onValueChange={onSeekChange}
                    onSlidingComplete={(value) => void onSeekComplete(value)}
                  />

                  <View style={styles.progressRow}>
                      <Text style={[styles.progressText, { color: palette.textSecondary }]}>{formatMillis(positionMillis)}</Text>
                      <Text style={[styles.percentText, { color: palette.accent }]}>{playbackPercent.toFixed(0)}%</Text>
                      <Text style={[styles.progressText, { color: palette.textSecondary }]}>{formatMillis(durationMillis)}</Text>
                    </View>

                  <View style={styles.transportRow}>
                    <Pressable
                        onPress={() => void playPrevious()}
                        disabled={!tracks.length}
                        style={[
                          styles.transportButton,
                          { backgroundColor: palette.buttonBg, borderColor: palette.buttonBorder },
                          !tracks.length && styles.buttonDisabled,
                        ]}>
                        <IconSymbol name="backward.fill" size={18} color={palette.transportIcon} />
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
                        style={[
                          styles.transportButton,
                          { backgroundColor: palette.buttonBg, borderColor: palette.buttonBorder },
                          !tracks.length && styles.buttonDisabled,
                        ]}>
                        <IconSymbol name="forward.fill" size={18} color={palette.transportIcon} />
                      </Pressable>
                    </View>

                    <View style={styles.modeButtonRow}>
                      <Pressable
                        onPress={showSpeedSheet}
                        style={[styles.modeButton, { borderColor: palette.modeBorder, backgroundColor: palette.modeBg }]}>
                        <Text style={[styles.modeButtonText, { color: palette.sheetText }]}>Speed {speedPercent}%</Text>
                      </Pressable>
                      <Pressable
                        onPress={showSleepSheet}
                        style={[styles.modeButton, { borderColor: palette.modeBorder, backgroundColor: palette.modeBg }]}>
                        <Text style={[styles.modeButtonText, { color: palette.sheetText }]}>
                          Sleep Timer {sleepSecondsLeft !== null ? formatCountdown(sleepSecondsLeft) : `${sleepPreferenceMinutes}m`}
                        </Text>
                      </Pressable>
                  </View>
                </>
              )}
            </BlurView>
          </View>
        </View>
      </Animated.View>

      <Modal transparent visible={sheet !== null} animationType="fade" onRequestClose={() => setSheet(null)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setSheet(null)} />
          <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={[styles.sheetShell, { borderColor: palette.sheetBorder }]}>
              <BlurView
                intensity={72}
                tint={sheetGlassTint}
                style={[styles.sheetGroup, { backgroundColor: palette.sheetBg, borderColor: palette.sheetBorder }]}>
                {sheet === 'speed' ? (
                  <>
                    <Text style={[styles.sheetTitle, { color: palette.sheetSubtle }]}>Playback Speed</Text>
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
                            style={[
                              styles.sheetPill,
                              { borderColor: palette.sheetBorder, backgroundColor: isDark ? 'rgba(30,49,56,0.7)' : 'rgba(255,255,255,0.65)' },
                              active && { borderColor: palette.sheetActiveBorder, backgroundColor: palette.sheetActiveBg },
                            ]}>
                            <Text style={[styles.sheetPillText, { color: palette.sheetText }, active && { color: palette.sheetActiveBorder }]}>
                              {preset}%
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.sheetTitle, { color: palette.sheetSubtle }]}>
                      Sleep Timer {sleepTimerOn ? `(${formatCountdown(sleepSecondsLeft ?? 0)})` : ''}
                    </Text>
                    <View style={styles.toggleRow}>
                      <Pressable
                        onPress={() => setSleepTimer(sleepPreferenceMinutes)}
                        style={[
                          styles.toggleButton,
                          { borderColor: palette.sheetBorder, backgroundColor: isDark ? 'rgba(30,49,56,0.7)' : 'rgba(255,255,255,0.65)' },
                          sleepTimerOn && { borderColor: palette.sheetActiveBorder, backgroundColor: palette.sheetActiveBg },
                        ]}>
                        <Text style={[styles.toggleText, { color: palette.sheetText }, sleepTimerOn && { color: palette.sheetActiveBorder }]}>
                          Timer On
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => clearSleepTimer()}
                        style={[
                          styles.toggleButton,
                          { borderColor: palette.sheetBorder, backgroundColor: isDark ? 'rgba(30,49,56,0.7)' : 'rgba(255,255,255,0.65)' },
                          !sleepTimerOn && { borderColor: palette.sheetActiveBorder, backgroundColor: palette.sheetActiveBg },
                        ]}>
                        <Text style={[styles.toggleText, { color: palette.sheetText }, !sleepTimerOn && { color: palette.sheetActiveBorder }]}>
                          Timer Off
                        </Text>
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
                            style={[
                              styles.sheetPill,
                              { borderColor: palette.sheetBorder, backgroundColor: isDark ? 'rgba(30,49,56,0.7)' : 'rgba(255,255,255,0.65)' },
                              active && { borderColor: palette.sheetActiveBorder, backgroundColor: palette.sheetActiveBg },
                            ]}>
                            <Text style={[styles.sheetPillText, { color: palette.sheetText }, active && { color: palette.sheetActiveBorder }]}>
                              {preset}m
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}
              </BlurView>
            </View>
            <Pressable
              style={[styles.cancelButton, { backgroundColor: palette.sheetBg, borderColor: palette.sheetBorder }]}
              onPress={() => setSheet(null)}>
              <Text style={[styles.cancelText, { color: palette.accent }]}>Cancel</Text>
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
  liquidBlob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.8,
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
    borderWidth: 1,
  },
  bgTrackItemActive: {
    borderColor: 'rgba(15,118,110,0.5)',
  },
  bgTrackTitle: {
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
    alignItems: 'flex-start',
  },
  headerGlassShell: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerGlassMask: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  headerGlass: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  floatingWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    maxHeight: '68%',
  },
  floatingWrapMini: {
    maxHeight: 160,
  },
  floatingShell: {
    borderRadius: 36,
    borderWidth: 1,
  },
  floatingShellMini: {
    borderRadius: 28,
  },
  floatingMask: {
    borderRadius: 36,
    overflow: 'hidden',
  },
  floatingMaskMini: {
    borderRadius: 28,
  },
  floatingGlass: {
    padding: 18,
    gap: 12,
    borderWidth: 1,
  },
  floatingGlassMini: {
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  dragHandleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 10,
    marginBottom: 2,
  },
  floatingAccent: {
    height: 4,
    width: 58,
    borderRadius: 999,
    alignSelf: 'center',
  },
  floatingAccentMini: {
    width: 44,
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
  transportRowMini: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  playOrb: {
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  playOrbMini: {
    padding: 2,
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
  playButtonMini: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  transportButton: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 27,
  },
  transportButtonMini: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modeButtonText: {
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
  sheetShell: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
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

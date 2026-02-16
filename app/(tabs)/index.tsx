import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { usePlayer } from '@/contexts/player-context';

const PLAYBACK_RATES = [0.9, 0.95, 1.0] as const;
const TIMER_OPTIONS_MINUTES = [10, 15, 20] as const;

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

  const [customRateInput, setCustomRateInput] = useState('');
  const [customTimerInput, setCustomTimerInput] = useState('');
  const isPresetRate = PLAYBACK_RATES.some((rate) => Math.abs(playbackRate - rate) < 0.001);

  const applyCustomRate = () => {
    const parsed = Number(customRateInput);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const normalized = parsed > 3 ? parsed / 100 : parsed;
    void changePlaybackRate(normalized);
    setCustomRateInput('');
    Keyboard.dismiss();
  };

  const applyCustomTimer = () => {
    const parsed = Number(customTimerInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    setSleepTimer(parsed);
    setCustomTimerInput('');
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>
                    Speed {isPresetRate ? '' : `• ${Math.round(playbackRate * 100)}% Custom`}
                  </Text>
                  <View style={styles.inlineButtonRow}>
                    {PLAYBACK_RATES.map((rate) => (
                      <Pressable
                        key={rate}
                        onPress={() => void changePlaybackRate(rate)}
                        style={[styles.chip, Math.abs(playbackRate - rate) < 0.001 ? styles.chipSelected : undefined]}>
                        <Text
                          style={[
                            styles.chipText,
                            Math.abs(playbackRate - rate) < 0.001 ? styles.chipTextSelected : undefined,
                          ]}>
                        {Math.round(rate * 100)}%
                      </Text>
                    </Pressable>
                  ))}
                    {!isPresetRate ? (
                      <View style={[styles.chip, styles.chipSelected]}>
                        <Text style={[styles.chipText, styles.chipTextSelected]}>
                          {Math.round(playbackRate * 100)}%
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.customRow}>
                    <TextInput
                      value={customRateInput}
                      onChangeText={setCustomRateInput}
                      placeholder="Custom: 87 or 0.87"
                      placeholderTextColor="#6d8489"
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      onSubmitEditing={applyCustomRate}
                      style={styles.input}
                    />
                    <Pressable onPress={applyCustomRate} style={styles.applyButton}>
                      <Text style={styles.applyButtonText}>Apply</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>
                    Sleep Timer {sleepSecondsLeft !== null ? `• ${formatCountdown(sleepSecondsLeft)} left` : '• Off'}
                  </Text>
                  <View style={styles.inlineButtonRow}>
                    {TIMER_OPTIONS_MINUTES.map((minutes) => (
                      <Pressable
                        key={minutes}
                        onPress={() => setSleepTimer(minutes)}
                        style={[styles.chip, sleepTimerMinutes === minutes ? styles.chipSelected : undefined]}>
                        <Text
                          style={[styles.chipText, sleepTimerMinutes === minutes ? styles.chipTextSelected : undefined]}>
                          {minutes}m
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable onPress={clearSleepTimer} style={styles.chip}>
                      <Text style={styles.chipText}>Off</Text>
                    </Pressable>
                  </View>
                  <View style={styles.customRow}>
                    <TextInput
                      value={customTimerInput}
                      onChangeText={setCustomTimerInput}
                      placeholder="Custom minutes"
                      placeholderTextColor="#6d8489"
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onSubmitEditing={applyCustomTimer}
                      style={styles.input}
                    />
                    <Pressable onPress={applyCustomTimer} style={styles.applyButton}>
                      <Text style={styles.applyButtonText}>Apply</Text>
                    </Pressable>
                  </View>
                </View>
                </BlurView>
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
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
    gap: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  inlineButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#9eb5b8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.55)',
    color: '#0f172a',
    fontWeight: '500',
  },
  applyButton: {
    borderRadius: 10,
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  applyButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#9eb5b8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  chipSelected: {
    borderColor: '#0f766e',
    backgroundColor: '#d6f4f0',
  },
  chipText: {
    color: '#14363c',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#0f766e',
    fontWeight: '800',
  },
});

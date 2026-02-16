import {
  AVPlaybackStatus,
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  PitchCorrectionQuality,
} from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type Track = {
  id: string;
  title: string;
  uri: string;
};

type PlayerContextValue = {
  tracks: Track[];
  loadingTracks: boolean;
  activeTrackId: string | null;
  activeTrack: Track | null;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  playbackPercent: number;
  playbackRate: number;
  sleepTimerMinutes: number | null;
  sleepSecondsLeft: number | null;
  sleepPreferenceMinutes: number;
  message: string | null;
  isSeeking: boolean;
  seekMillis: number;
  loadTracks: () => Promise<void>;
  importFromFiles: () => Promise<void>;
  playTrack: (track: Track) => Promise<void>;
  playPrevious: () => Promise<void>;
  playNext: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  changePlaybackRate: (rate: number) => Promise<void>;
  setSleepTimer: (minutes: number) => void;
  clearSleepTimer: () => void;
  onSeekStart: () => void;
  onSeekChange: (value: number) => void;
  onSeekComplete: (value: number) => Promise<void>;
};

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'wav', 'aac', 'caf', 'aiff', 'flac']);
const APP_AUDIO_FOLDER_NAME = 'audio';
const PLAYER_STATE_FILE_NAME = 'player-state.json';
const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2.0;
const MIN_SLEEP_MINUTES = 1;
const MAX_SLEEP_MINUTES = 720;
const DEFAULT_PLAYBACK_RATE = 1;
const DEFAULT_SLEEP_PREFERENCE_MINUTES = 15;

type PersistedPlayerState = {
  version: 3;
  activeTrackId: string | null;
  positionMillis: number;
  durationMillis: number;
  playbackRate: number;
  sleepPreferenceMinutes: number;
};

function getExtension(uri: string): string {
  const cleanUri = uri.split('?')[0];
  const parts = cleanUri.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function getTitleFromUri(uri: string): string {
  const fileName = uri.split('/').pop() ?? uri;
  return decodeURIComponent(fileName).replace(/\.[^/.]+$/, '');
}

function joinUri(base: string, name: string): string {
  return `${base.replace(/\/+$/, '')}/${name}`;
}

function splitBaseAndExt(fileName: string): { base: string; ext: string } {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) {
    return { base: fileName, ext: '' };
  }
  return {
    base: fileName.slice(0, dot),
    ext: fileName.slice(dot),
  };
}

async function scanAudioInDirectory(rootUri: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await FileSystem.readDirectoryAsync(rootUri);

  for (const entry of entries) {
    const fullUri = joinUri(rootUri, entry);
    const info = await FileSystem.getInfoAsync(fullUri);
    if (!info.exists) {
      continue;
    }
    if (info.isDirectory) {
      results.push(...(await scanAudioInDirectory(fullUri)));
      continue;
    }

    const extension = getExtension(fullUri);
    if (AUDIO_EXTENSIONS.has(extension)) {
      results.push(fullUri);
    }
  }

  return results;
}

async function copyBundledAudioIfNeeded(targetFolderUri: string): Promise<void> {
  const existing = await scanAudioInDirectory(targetFolderUri).catch(() => []);
  if (existing.length > 0 || !FileSystem.bundleDirectory) {
    return;
  }

  const bundledAudio = (await scanAudioInDirectory(FileSystem.bundleDirectory).catch(() => [])).filter((uri) =>
    uri.includes('/assets/audio/')
  );

  for (const sourceUri of bundledAudio) {
    const originalName = sourceUri.split('/').pop() ?? `audio_${Date.now()}`;
    const { base, ext } = splitBaseAndExt(originalName);
    let candidateName = `${base}${ext}`;
    let candidateUri = joinUri(targetFolderUri, candidateName);
    let index = 1;

    while ((await FileSystem.getInfoAsync(candidateUri)).exists) {
      candidateName = `${base}_${index}${ext}`;
      candidateUri = joinUri(targetFolderUri, candidateName);
      index += 1;
    }

    await FileSystem.copyAsync({
      from: sourceUri,
      to: candidateUri,
    });
  }
}

async function copyFileIntoAudioFolder(sourceUri: string, targetFolderUri: string, preferredName: string) {
  const { base, ext } = splitBaseAndExt(preferredName);
  let candidateName = `${base}${ext}`;
  let candidateUri = joinUri(targetFolderUri, candidateName);
  let index = 1;

  while ((await FileSystem.getInfoAsync(candidateUri)).exists) {
    candidateName = `${base}_${index}${ext}`;
    candidateUri = joinUri(targetFolderUri, candidateName);
    index += 1;
  }

  await FileSystem.copyAsync({
    from: sourceUri,
    to: candidateUri,
  });
}

function getPlayerStateUri(): string | null {
  if (!FileSystem.documentDirectory) {
    return null;
  }
  return joinUri(FileSystem.documentDirectory, PLAYER_STATE_FILE_NAME);
}

function clampPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    return DEFAULT_PLAYBACK_RATE;
  }
  return Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, Number(rate.toFixed(2))));
}

function clampSleepMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return DEFAULT_SLEEP_PREFERENCE_MINUTES;
  }
  return Math.min(MAX_SLEEP_MINUTES, Math.max(MIN_SLEEP_MINUTES, Math.round(minutes)));
}

async function readPersistedState(): Promise<PersistedPlayerState | null> {
  const stateUri = getPlayerStateUri();
  if (!stateUri) {
    return null;
  }

  const info = await FileSystem.getInfoAsync(stateUri);
  if (!info.exists) {
    return null;
  }

  try {
    const raw = await FileSystem.readAsStringAsync(stateUri);
    const parsed = JSON.parse(raw) as Partial<PersistedPlayerState> & { version?: number };
    const hasNewPrefs = parsed.version === 3;
    return {
      version: 3,
      activeTrackId: parsed.activeTrackId ?? null,
      positionMillis: Math.max(0, parsed.positionMillis ?? 0),
      durationMillis: Math.max(0, parsed.durationMillis ?? 0),
      playbackRate: clampPlaybackRate(
        hasNewPrefs ? (parsed.playbackRate ?? DEFAULT_PLAYBACK_RATE) : DEFAULT_PLAYBACK_RATE
      ),
      sleepPreferenceMinutes: clampSleepMinutes(
        hasNewPrefs
          ? (parsed.sleepPreferenceMinutes ?? DEFAULT_SLEEP_PREFERENCE_MINUTES)
          : DEFAULT_SLEEP_PREFERENCE_MINUTES
      ),
    };
  } catch {
    return null;
  }
}

async function writePersistedState(state: PersistedPlayerState): Promise<void> {
  const stateUri = getPlayerStateUri();
  if (!stateUri) {
    return;
  }

  await FileSystem.writeAsStringAsync(stateUri, JSON.stringify(state));
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playNextRef = useRef<(() => Promise<void>) | null>(null);
  const hasTriedRestoreRef = useRef(false);
  const persistedStateRef = useRef<PersistedPlayerState | null>(null);
  const lastPersistRef = useRef(0);
  const latestStateRef = useRef<PersistedPlayerState>({
    version: 3,
    activeTrackId: null,
    positionMillis: 0,
    durationMillis: 0,
    playbackRate: DEFAULT_PLAYBACK_RATE,
    sleepPreferenceMinutes: DEFAULT_SLEEP_PREFERENCE_MINUTES,
  });

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_PLAYBACK_RATE);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number | null>(null);
  const [sleepPreferenceMinutes, setSleepPreferenceMinutes] = useState(DEFAULT_SLEEP_PREFERENCE_MINUTES);
  const [audioFolderUri, setAudioFolderUri] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekMillis, setSeekMillis] = useState(0);
  const [persistedReady, setPersistedReady] = useState(false);

  const activeTrack = useMemo(
    () => tracks.find((track) => track.id === activeTrackId) ?? null,
    [tracks, activeTrackId]
  );

  const activeTrackIndex = useMemo(
    () => tracks.findIndex((track) => track.id === activeTrackId),
    [tracks, activeTrackId]
  );

  const playbackPercent = useMemo(() => {
    if (!durationMillis) {
      return 0;
    }
    return Math.max(0, Math.min(100, (positionMillis / durationMillis) * 100));
  }, [positionMillis, durationMillis]);

  const clearSleepTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setSleepTimerMinutes(null);
    setSleepSecondsLeft(null);
  }, []);

  const setSleepTimer = useCallback(
    (minutes: number) => {
      const safeMinutes = clampSleepMinutes(minutes);
      clearSleepTimer();
      setSleepPreferenceMinutes(safeMinutes);

      const durationMs = safeMinutes * 60 * 1000;
      const deadline = Date.now() + durationMs;

      setSleepTimerMinutes(safeMinutes);
      setSleepSecondsLeft(safeMinutes * 60);

      countdownIntervalRef.current = setInterval(() => {
        const remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setSleepSecondsLeft(remainingSeconds);
        if (remainingSeconds <= 0 && countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }, 1000);

      timerRef.current = setTimeout(async () => {
        const currentSound = soundRef.current;
        if (currentSound) {
          await currentSound.pauseAsync();
        }
        clearSleepTimer();
      }, durationMs);
    },
    [clearSleepTimer]
  );

  useEffect(() => {
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadPersisted = async () => {
      const state = await readPersistedState();
      if (mounted) {
        persistedStateRef.current = state;
        if (state) {
          setPlaybackRate(state.playbackRate);
          setSleepPreferenceMinutes(state.sleepPreferenceMinutes);
        }
        setPersistedReady(true);
      }
    };

    void loadPersisted();
    return () => {
      mounted = false;
    };
  }, []);

  const loadTracks = useCallback(async () => {
    setLoadingTracks(true);
    try {
      if (!FileSystem.documentDirectory) {
        setTracks([]);
        setAudioFolderUri(null);
        return;
      }

      const appAudioFolderUri = joinUri(FileSystem.documentDirectory, APP_AUDIO_FOLDER_NAME);
      setAudioFolderUri(appAudioFolderUri);

      await FileSystem.makeDirectoryAsync(appAudioFolderUri, { intermediates: true });
      await copyBundledAudioIfNeeded(appAudioFolderUri);

      const uris = await scanAudioInDirectory(appAudioFolderUri).catch(() => []);
      const nextTracks = uris
        .map((uri) => ({
          id: uri,
          uri,
          title: getTitleFromUri(uri),
        }))
        .sort((a, b) => a.title.localeCompare(b.title));

      setTracks(nextTracks);
      if (activeTrackId && !nextTracks.some((track) => track.id === activeTrackId)) {
        setActiveTrackId(null);
      }

      if (!hasTriedRestoreRef.current && persistedReady) {
        hasTriedRestoreRef.current = true;
        const saved = persistedStateRef.current;
        if (saved?.activeTrackId) {
          const exists = nextTracks.some((track) => track.id === saved.activeTrackId);
          if (exists) {
            setActiveTrackId(saved.activeTrackId);
            setPositionMillis(saved.positionMillis);
            setDurationMillis(saved.durationMillis);
          }
        }
      }
    } finally {
      setLoadingTracks(false);
    }
  }, [activeTrackId, persistedReady]);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  const playTrack = useCallback(
    async (track: Track, startPositionMillis = 0) => {
      const existingSound = soundRef.current;
      if (existingSound) {
        await existingSound.unloadAsync();
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: track.uri },
        {
          shouldPlay: false,
          progressUpdateIntervalMillis: 500,
          positionMillis: Math.max(0, startPositionMillis),
        }
      );

      await sound.setRateAsync(clampPlaybackRate(playbackRate), true, PitchCorrectionQuality.Medium);

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          return;
        }

        setIsPlaying(status.isPlaying);
        if (!isSeeking) {
          setPositionMillis(status.positionMillis ?? 0);
        }
        setDurationMillis(status.durationMillis ?? 0);

        if (status.didJustFinish && !status.isLooping) {
          const triggerNext = playNextRef.current;
          if (triggerNext) {
            void triggerNext();
          }
        }
      });

      soundRef.current = sound;
      setActiveTrackId(track.id);
      setPositionMillis(Math.max(0, startPositionMillis));
      await sound.playAsync();
    },
    [isSeeking, playbackRate]
  );

  const playTrackByIndex = useCallback(
    async (index: number) => {
      if (tracks.length === 0) {
        return;
      }
      const normalizedIndex = ((index % tracks.length) + tracks.length) % tracks.length;
      await playTrack(tracks[normalizedIndex], 0);
    },
    [playTrack, tracks]
  );

  const playPrevious = useCallback(async () => {
    if (!tracks.length) {
      return;
    }
    if (activeTrackIndex < 0) {
      await playTrackByIndex(0);
      return;
    }
    await playTrackByIndex(activeTrackIndex - 1);
  }, [activeTrackIndex, playTrackByIndex, tracks.length]);

  const playNext = useCallback(async () => {
    if (!tracks.length) {
      return;
    }
    if (activeTrackIndex < 0) {
      await playTrackByIndex(0);
      return;
    }
    await playTrackByIndex(activeTrackIndex + 1);
  }, [activeTrackIndex, playTrackByIndex, tracks.length]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  const togglePlayPause = useCallback(async () => {
    const currentSound = soundRef.current;
    if (!currentSound) {
      if (activeTrack) {
        await playTrack(activeTrack, positionMillis);
      }
      return;
    }
    const status = await currentSound.getStatusAsync();
    if (!status.isLoaded) {
      return;
    }
    if (status.isPlaying) {
      await currentSound.pauseAsync();
      return;
    }
    await currentSound.playAsync();
  }, [activeTrack, playTrack, positionMillis]);

  const changePlaybackRate = useCallback(async (rate: number) => {
    const safeRate = clampPlaybackRate(rate);
    setPlaybackRate(safeRate);

    const currentSound = soundRef.current;
    if (!currentSound) {
      return;
    }
    await currentSound.setRateAsync(safeRate, true, PitchCorrectionQuality.Medium);
  }, []);

  const importFromFiles = useCallback(async () => {
    if (!audioFolderUri) {
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return;
    }

    let importedCount = 0;
    for (const asset of result.assets) {
      const extension = getExtension(asset.name || asset.uri);
      if (!AUDIO_EXTENSIONS.has(extension)) {
        continue;
      }
      const fileName = asset.name || `audio_${Date.now()}.${extension}`;
      await copyFileIntoAudioFolder(asset.uri, audioFolderUri, fileName);
      importedCount += 1;
    }

    if (importedCount > 0) {
      setMessage(`Imported ${importedCount} track${importedCount > 1 ? 's' : ''}`);
      setTimeout(() => setMessage(null), 2500);
    }

    await loadTracks();
  }, [audioFolderUri, loadTracks]);

  const onSeekStart = useCallback(() => {
    setIsSeeking(true);
    setSeekMillis(positionMillis);
  }, [positionMillis]);

  const onSeekChange = useCallback((value: number) => {
    setSeekMillis(value);
  }, []);

  const onSeekComplete = useCallback(async (value: number) => {
    const currentSound = soundRef.current;
    if (currentSound) {
      await currentSound.setPositionAsync(value);
    }
    setPositionMillis(value);
    setIsSeeking(false);
  }, []);

  useEffect(() => {
    const now = Date.now();
    if (now - lastPersistRef.current < 1500) {
      return;
    }
    lastPersistRef.current = now;

    void writePersistedState({
      version: 3,
      activeTrackId,
      positionMillis,
      durationMillis,
      playbackRate,
      sleepPreferenceMinutes,
    });
  }, [activeTrackId, positionMillis, durationMillis, playbackRate, sleepPreferenceMinutes]);

  useEffect(() => {
    latestStateRef.current = {
      version: 3,
      activeTrackId,
      positionMillis,
      durationMillis,
      playbackRate,
      sleepPreferenceMinutes,
    };
  }, [activeTrackId, durationMillis, playbackRate, positionMillis, sleepPreferenceMinutes]);

  useEffect(() => {
    return () => {
      const currentSound = soundRef.current;
      if (currentSound) {
        void currentSound.unloadAsync();
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      void writePersistedState(latestStateRef.current);
    };
  }, []);

  const value: PlayerContextValue = {
    tracks,
    loadingTracks,
    activeTrackId,
    activeTrack,
    isPlaying,
    positionMillis,
    durationMillis,
    playbackPercent,
    playbackRate,
    sleepTimerMinutes,
    sleepSecondsLeft,
    sleepPreferenceMinutes,
    message,
    isSeeking,
    seekMillis,
    loadTracks,
    importFromFiles,
    playTrack,
    playPrevious,
    playNext,
    togglePlayPause,
    changePlaybackRate,
    setSleepTimer,
    clearSleepTimer,
    onSeekStart,
    onSeekChange,
    onSeekComplete,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used inside PlayerProvider');
  }
  return ctx;
}

export type { Track };

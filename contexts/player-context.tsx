import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Asset } from 'expo-asset';
import * as DocumentPicker from 'expo-document-picker';
import { Directory } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type Track = {
  id: string;
  title: string;
  uri: string;
};

export type PlayMode = 'loop_all' | 'loop_one' | 'shuffle';

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
  playMode: PlayMode;
  sleepTimerMinutes: number | null;
  sleepSecondsLeft: number | null;
  sleepPreferenceMinutes: number;
  message: string | null;
  isSeeking: boolean;
  seekMillis: number;
  loadTracks: () => Promise<void>;
  importFromFiles: () => Promise<void>;
  importFromFolder: () => Promise<void>;
  deleteTracks: (trackIds: string[]) => Promise<void>;
  playTrack: (track: Track) => Promise<void>;
  playPrevious: () => Promise<void>;
  playNext: () => Promise<void>;
  cyclePlayMode: () => void;
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
const SAMPLE_SEED_FILE_NAME = 'sample-seed-v1.json';
const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2.0;
const MIN_SLEEP_MINUTES = 1;
const MAX_SLEEP_MINUTES = 720;
const DEFAULT_PLAYBACK_RATE = 1;
const DEFAULT_SLEEP_PREFERENCE_MINUTES = 15;
const DEFAULT_PLAY_MODE: PlayMode = 'loop_all';
const BUNDLED_SAMPLE_TRACKS: Array<{ assetModule: number; fileName: string }> = [
  { assetModule: require('../assets/audio/sample-music.wav'), fileName: 'Sample Music.wav' },
  { assetModule: require('../assets/audio/sample-audio.wav'), fileName: 'Sample Audio.wav' },
];

type PersistedPlayerState = {
  version: 6;
  activeTrackId: string | null;
  positionMillis: number;
  durationMillis: number;
  playbackRate: number;
  sleepPreferenceMinutes: number;
  playMode: PlayMode;
};

type PickedDirectory = Awaited<ReturnType<typeof Directory.pickDirectoryAsync>>;
type PickedDirectoryEntry = ReturnType<PickedDirectory['list']>[number];
type LockScreenCapablePlayer = AudioPlayer & {
  setActiveForLockScreen?: (
    active: boolean,
    metadata?: { title?: string; artist?: string; albumTitle?: string; artworkUrl?: string },
    options?: { showSeekForward?: boolean; showSeekBackward?: boolean }
  ) => void;
  clearLockScreenControls?: () => void;
  updateLockScreenMetadata?: (metadata: {
    title?: string;
    artist?: string;
    albumTitle?: string;
    artworkUrl?: string;
  }) => void;
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

function isDirectoryEntry(entry: PickedDirectoryEntry): entry is PickedDirectory {
  return 'list' in entry;
}

async function scanPickedDirectoryForAudio(directory: PickedDirectory): Promise<Array<{ uri: string; name: string }>> {
  const entries = directory.list();
  const collected: Array<{ uri: string; name: string }> = [];

  for (const entry of entries) {
    if (isDirectoryEntry(entry)) {
      collected.push(...(await scanPickedDirectoryForAudio(entry)));
      continue;
    }

    const derivedName = entry.uri.split('/').pop() ?? `audio_${Date.now()}`;
    const extension = getExtension(derivedName || entry.uri);
    if (AUDIO_EXTENSIONS.has(extension)) {
      collected.push({ uri: entry.uri, name: derivedName });
    }
  }

  return collected;
}

function getPlayerStateUri(): string | null {
  if (!FileSystem.documentDirectory) {
    return null;
  }
  return joinUri(FileSystem.documentDirectory, PLAYER_STATE_FILE_NAME);
}

function getSampleSeedUri(): string | null {
  if (!FileSystem.documentDirectory) {
    return null;
  }
  return joinUri(FileSystem.documentDirectory, SAMPLE_SEED_FILE_NAME);
}

async function ensureBundledSamples(audioFolderUri: string): Promise<number> {
  const sampleSeedUri = getSampleSeedUri();
  if (!sampleSeedUri) {
    return 0;
  }

  const seedInfo = await FileSystem.getInfoAsync(sampleSeedUri);
  if (seedInfo.exists) {
    return 0;
  }

  let importedCount = 0;
  for (const sample of BUNDLED_SAMPLE_TRACKS) {
    const targetUri = joinUri(audioFolderUri, sample.fileName);
    const targetInfo = await FileSystem.getInfoAsync(targetUri);
    if (targetInfo.exists) {
      continue;
    }

    try {
      const asset = Asset.fromModule(sample.assetModule);
      if (!asset.localUri) {
        await asset.downloadAsync();
      }
      const sourceUri = asset.localUri ?? asset.uri;
      await FileSystem.copyAsync({
        from: sourceUri,
        to: targetUri,
      });
      importedCount += 1;
    } catch {
      // Best effort: if copy fails, the app can still function without sample media.
    }
  }

  const sampleExistence = await Promise.all(
    BUNDLED_SAMPLE_TRACKS.map((sample) => FileSystem.getInfoAsync(joinUri(audioFolderUri, sample.fileName)))
  );
  const allSamplesPresent = sampleExistence.every((info) => info.exists);
  if (allSamplesPresent) {
    await FileSystem.writeAsStringAsync(
      sampleSeedUri,
      JSON.stringify({
        version: 1,
        seededAt: new Date().toISOString(),
      })
    );
  }

  return importedCount;
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
    const parsed = JSON.parse(raw) as {
      version?: number;
      activeTrackId?: string | null;
      positionMillis?: number;
      durationMillis?: number;
      playbackRate?: number;
      sleepPreferenceMinutes?: number;
      playMode?: PlayMode;
    };
    const hasPrefs = parsed.version === 4 || parsed.version === 5 || parsed.version === 6;
    const hasPlayMode = parsed.version === 5 || parsed.version === 6;
    const parsedPlayMode =
      parsed.playMode === 'loop_all' ||
      parsed.playMode === 'loop_one' ||
      parsed.playMode === 'shuffle'
        ? parsed.playMode
        : DEFAULT_PLAY_MODE;
    return {
      version: 6,
      activeTrackId: parsed.activeTrackId ?? null,
      positionMillis: Math.max(0, parsed.positionMillis ?? 0),
      durationMillis: Math.max(0, parsed.durationMillis ?? 0),
      playbackRate: clampPlaybackRate(
        hasPrefs ? (parsed.playbackRate ?? DEFAULT_PLAYBACK_RATE) : DEFAULT_PLAYBACK_RATE
      ),
      sleepPreferenceMinutes: clampSleepMinutes(
        hasPrefs
          ? (parsed.sleepPreferenceMinutes ?? DEFAULT_SLEEP_PREFERENCE_MINUTES)
          : DEFAULT_SLEEP_PREFERENCE_MINUTES
      ),
      playMode: hasPlayMode ? parsedPlayMode : DEFAULT_PLAY_MODE,
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
  const playerRef = useRef<AudioPlayer | null>(null);
  const playbackSubRef = useRef<{ remove: () => void } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playNextRef = useRef<(() => Promise<void>) | null>(null);
  const playNextAutoRef = useRef<(() => Promise<void>) | null>(null);
  const playRequestIdRef = useRef(0);
  const lockScreenArtworkUrlRef = useRef<string | undefined>(undefined);
  const hasTriedRestoreRef = useRef(false);
  const persistedStateRef = useRef<PersistedPlayerState | null>(null);
  const lastPersistRef = useRef(0);
  const latestStateRef = useRef<PersistedPlayerState>({
    version: 6,
    activeTrackId: null,
    positionMillis: 0,
    durationMillis: 0,
    playbackRate: DEFAULT_PLAYBACK_RATE,
    sleepPreferenceMinutes: DEFAULT_SLEEP_PREFERENCE_MINUTES,
    playMode: DEFAULT_PLAY_MODE,
  });

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_PLAYBACK_RATE);
  const [playMode, setPlayMode] = useState<PlayMode>(DEFAULT_PLAY_MODE);
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
        const currentPlayer = playerRef.current;
        if (currentPlayer) {
          currentPlayer.pause();
        }
        clearSleepTimer();
      }, durationMs);
    },
    [clearSleepTimer]
  );

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadArtwork = async () => {
      try {
        const artwork = Asset.fromModule(require('../assets/images/icon.png'));
        if (!artwork.localUri) {
          await artwork.downloadAsync();
        }
        if (mounted) {
          lockScreenArtworkUrlRef.current = artwork.localUri ?? artwork.uri;
        }
      } catch {
        // No-op: lock screen metadata can still work without artwork.
      }
    };
    void loadArtwork();
    return () => {
      mounted = false;
    };
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
          setPlayMode(state.playMode);
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

      const appRootUri = FileSystem.documentDirectory;
      const appAudioFolderUri = joinUri(appRootUri, APP_AUDIO_FOLDER_NAME);
      setAudioFolderUri(appAudioFolderUri);
      await FileSystem.makeDirectoryAsync(appAudioFolderUri, { intermediates: true });
      const seededCount = await ensureBundledSamples(appRootUri);
      if (seededCount > 0) {
        setMessage(`Added ${seededCount} sample track${seededCount > 1 ? 's' : ''}`);
        setTimeout(() => setMessage(null), 2500);
      }
      const uris = await scanAudioInDirectory(FileSystem.documentDirectory).catch(() => []);
      const nextTracks = uris
        .filter((uri) => !uri.endsWith(`/${PLAYER_STATE_FILE_NAME}`))
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
      const requestId = playRequestIdRef.current + 1;
      playRequestIdRef.current = requestId;

      const existingPlayer = playerRef.current as LockScreenCapablePlayer | null;
      if (existingPlayer) {
        playbackSubRef.current?.remove();
        playbackSubRef.current = null;
        existingPlayer.pause();
        if (typeof existingPlayer.clearLockScreenControls === 'function') {
          existingPlayer.clearLockScreenControls();
        }
        existingPlayer.remove();
        playerRef.current = null;
      }

      const player = createAudioPlayer({ uri: track.uri }, { updateInterval: 500, keepAudioSessionActive: true });
      player.setPlaybackRate(clampPlaybackRate(playbackRate), 'medium');
      const lockScreenPlayer = player as LockScreenCapablePlayer;
      if (typeof lockScreenPlayer.setActiveForLockScreen === 'function') {
        lockScreenPlayer.setActiveForLockScreen(
          true,
          {
            title: track.title,
            artist: 'Local Audio Player',
            albumTitle: 'On My iPhone',
            artworkUrl: lockScreenArtworkUrlRef.current,
          },
          {
            showSeekForward: true,
            showSeekBackward: true,
          }
        );
      }

      if (typeof lockScreenPlayer.updateLockScreenMetadata === 'function') {
        lockScreenPlayer.updateLockScreenMetadata({
          title: track.title,
          artist: 'Local Audio Player',
          albumTitle: 'On My iPhone',
          artworkUrl: lockScreenArtworkUrlRef.current,
        });
      }

      const playbackSub = player.addListener('playbackStatusUpdate', (status) => {
        if (!status.isLoaded) {
          return;
        }

        setIsPlaying(status.playing);
        if (!isSeeking) {
          setPositionMillis(Math.max(0, Math.round((status.currentTime ?? 0) * 1000)));
        }
        setDurationMillis(Math.max(0, Math.round((status.duration ?? 0) * 1000)));

        if (status.didJustFinish && !status.loop) {
          const triggerNext = playNextAutoRef.current;
          if (triggerNext) {
            void triggerNext();
          }
        }
      });

      if (requestId !== playRequestIdRef.current) {
        playbackSub.remove();
        if (typeof lockScreenPlayer.clearLockScreenControls === 'function') {
          lockScreenPlayer.clearLockScreenControls();
        }
        player.remove();
        return;
      }

      playbackSubRef.current = playbackSub;
      playerRef.current = player;
      setActiveTrackId(track.id);
      if (startPositionMillis > 0) {
        await player.seekTo(startPositionMillis / 1000);
      }

      if (requestId !== playRequestIdRef.current) {
        if (playbackSubRef.current === playbackSub) {
          playbackSubRef.current = null;
        }
        playbackSub.remove();
        if (playerRef.current === player) {
          playerRef.current = null;
        }
        if (typeof lockScreenPlayer.clearLockScreenControls === 'function') {
          lockScreenPlayer.clearLockScreenControls();
        }
        player.remove();
        return;
      }

      setPositionMillis(Math.max(0, startPositionMillis));
      player.play();
    },
    [isSeeking, playbackRate]
  );

  const playTrackByIndex = useCallback(
    async (index: number) => {
      if (tracks.length === 0) {
        return;
      }
      if (index < 0 || index >= tracks.length) {
        return;
      }
      await playTrack(tracks[index], 0);
    },
    [playTrack, tracks]
  );

  const pickRandomIndex = useCallback(
    (excludeIndex: number | null = null) => {
      if (!tracks.length) {
        return -1;
      }
      if (tracks.length === 1) {
        return 0;
      }
      let randomIndex = Math.floor(Math.random() * tracks.length);
      while (excludeIndex !== null && randomIndex === excludeIndex) {
        randomIndex = Math.floor(Math.random() * tracks.length);
      }
      return randomIndex;
    },
    [tracks]
  );

  const playPrevious = useCallback(async () => {
    if (!tracks.length) {
      return;
    }
    if (playMode === 'shuffle') {
      const randomIndex = pickRandomIndex(activeTrackIndex >= 0 ? activeTrackIndex : null);
      if (randomIndex >= 0) {
        await playTrackByIndex(randomIndex);
      }
      return;
    }
    if (activeTrackIndex <= 0) {
      await playTrackByIndex(0);
      return;
    }
    await playTrackByIndex(activeTrackIndex - 1);
  }, [activeTrackIndex, pickRandomIndex, playMode, playTrackByIndex, tracks.length]);

  const playNextWithMode = useCallback(
    async (autoAdvance: boolean) => {
      if (!tracks.length) {
        return;
      }

      if (playMode === 'loop_one' && autoAdvance) {
        if (activeTrack) {
          await playTrack(activeTrack, 0);
        } else {
          await playTrackByIndex(0);
        }
        return;
      }

      if (playMode === 'shuffle') {
        const randomIndex = pickRandomIndex(activeTrackIndex >= 0 ? activeTrackIndex : null);
        if (randomIndex >= 0) {
          await playTrackByIndex(randomIndex);
        }
        return;
      }

      if (activeTrackIndex < 0) {
        await playTrackByIndex(0);
        return;
      }

      const nextIndex = activeTrackIndex + 1;
      if (nextIndex >= tracks.length) {
        await playTrackByIndex(0);
        return;
      }

      await playTrackByIndex(nextIndex);
    },
    [activeTrack, activeTrackIndex, pickRandomIndex, playMode, playTrack, playTrackByIndex, tracks.length]
  );

  const playNext = useCallback(async () => {
    await playNextWithMode(false);
  }, [playNextWithMode]);

  const playNextAuto = useCallback(async () => {
    await playNextWithMode(true);
  }, [playNextWithMode]);

  useEffect(() => {
    playNextRef.current = playNext;
    playNextAutoRef.current = playNextAuto;
  }, [playNext, playNextAuto]);

  const cyclePlayMode = useCallback(() => {
    setPlayMode((current) => {
      if (current === 'loop_all') {
        return 'loop_one';
      }
      if (current === 'loop_one') {
        return 'shuffle';
      }
      return 'loop_all';
    });
  }, []);

  const togglePlayPause = useCallback(async () => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) {
      if (activeTrack) {
        await playTrack(activeTrack, positionMillis);
      }
      return;
    }
    if (currentPlayer.playing) {
      currentPlayer.pause();
      return;
    }
    currentPlayer.play();
  }, [activeTrack, playTrack, positionMillis]);

  const changePlaybackRate = useCallback(async (rate: number) => {
    const safeRate = clampPlaybackRate(rate);
    setPlaybackRate(safeRate);

    const currentPlayer = playerRef.current;
    if (!currentPlayer) {
      return;
    }
    currentPlayer.setPlaybackRate(safeRate, 'medium');
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

  const importFromFolder = useCallback(async () => {
    if (!audioFolderUri) {
      return;
    }

    let selectedDirectory: PickedDirectory | null = null;
    try {
      selectedDirectory = await Directory.pickDirectoryAsync();
    } catch {
      setMessage('Folder import is unavailable');
      setTimeout(() => setMessage(null), 2500);
      return;
    }

    if (!selectedDirectory) {
      return;
    }

    const discoveredFiles = await scanPickedDirectoryForAudio(selectedDirectory).catch(() => []);
    if (!discoveredFiles.length) {
      setMessage('No audio files found in folder');
      setTimeout(() => setMessage(null), 2500);
      return;
    }

    let importedCount = 0;
    for (const file of discoveredFiles) {
      await copyFileIntoAudioFolder(file.uri, audioFolderUri, file.name);
      importedCount += 1;
    }

    setMessage(`Imported ${importedCount} track${importedCount > 1 ? 's' : ''} from folder`);
    setTimeout(() => setMessage(null), 2500);

    await loadTracks();
  }, [audioFolderUri, loadTracks]);

  const deleteTracks = useCallback(
    async (trackIds: string[]) => {
      const uniqueIds = Array.from(new Set(trackIds)).filter(Boolean);
      if (!uniqueIds.length) {
        return;
      }

      const deletingActive = activeTrackId ? uniqueIds.includes(activeTrackId) : false;
      if (deletingActive) {
        const currentPlayer = playerRef.current;
        if (currentPlayer) {
          playbackSubRef.current?.remove();
          playbackSubRef.current = null;
          const lockScreenPlayer = currentPlayer as LockScreenCapablePlayer;
          if (typeof lockScreenPlayer.clearLockScreenControls === 'function') {
            lockScreenPlayer.clearLockScreenControls();
          }
          currentPlayer.remove();
          playerRef.current = null;
        }
        setActiveTrackId(null);
        setIsPlaying(false);
        setPositionMillis(0);
        setDurationMillis(0);
      }

      let deletedCount = 0;
      for (const uri of uniqueIds) {
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
          deletedCount += 1;
        } catch {
          // Ignore individual delete failures and continue deleting remaining files.
        }
      }

      if (deletedCount > 0) {
        setMessage(`Deleted ${deletedCount} track${deletedCount > 1 ? 's' : ''}`);
        setTimeout(() => setMessage(null), 2500);
      }

      await loadTracks();
    },
    [activeTrackId, loadTracks]
  );

  const onSeekStart = useCallback(() => {
    setIsSeeking(true);
    setSeekMillis(positionMillis);
  }, [positionMillis]);

  const onSeekChange = useCallback((value: number) => {
    setSeekMillis(value);
  }, []);

  const onSeekComplete = useCallback(async (value: number) => {
    const currentPlayer = playerRef.current;
    if (currentPlayer) {
      await currentPlayer.seekTo(value / 1000);
    }
    setPositionMillis(value);
    setIsSeeking(false);
  }, []);

  useEffect(() => {
    if (!persistedReady) {
      return;
    }
    const now = Date.now();
    if (now - lastPersistRef.current < 1500) {
      return;
    }
    lastPersistRef.current = now;

    void writePersistedState({
      version: 6,
      activeTrackId,
      positionMillis,
      durationMillis,
      playbackRate,
      sleepPreferenceMinutes,
      playMode,
    });
  }, [activeTrackId, positionMillis, durationMillis, playbackRate, sleepPreferenceMinutes, playMode]);

  useEffect(() => {
    latestStateRef.current = {
      version: 6,
      activeTrackId,
      positionMillis,
      durationMillis,
      playbackRate,
      sleepPreferenceMinutes,
      playMode,
    };
  }, [activeTrackId, durationMillis, playbackRate, positionMillis, sleepPreferenceMinutes, playMode]);

  useEffect(() => {
    return () => {
      const currentPlayer = playerRef.current;
      if (currentPlayer) {
        playbackSubRef.current?.remove();
        playbackSubRef.current = null;
        const lockScreenPlayer = currentPlayer as LockScreenCapablePlayer;
        if (typeof lockScreenPlayer.clearLockScreenControls === 'function') {
          lockScreenPlayer.clearLockScreenControls();
        }
        currentPlayer.remove();
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
    playMode,
    sleepTimerMinutes,
    sleepSecondsLeft,
    sleepPreferenceMinutes,
    message,
    isSeeking,
    seekMillis,
    loadTracks,
    importFromFiles,
    importFromFolder,
    deleteTracks,
    playTrack,
    playPrevious,
    playNext,
    cyclePlayMode,
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

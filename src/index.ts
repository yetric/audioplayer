export type PlayerStatus =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export type RepeatMode = "off" | "one" | "all";

export type AudioPlayerEventName =
  | "sourcechange"
  | "queuechange"
  | "play"
  | "pause"
  | "seeking"
  | "seeked"
  | "timeupdate"
  | "ratechange"
  | "volumechange"
  | "ended"
  | "error"
  | "destroy";

export interface AudioSource {
  id: string;
  src: string;
  title?: string;
  artist?: string;
  artwork?: string;
  album?: string;
  durationHint?: number;
}

export interface AudioPlayerErrorState {
  code:
    | "LOAD_ERROR"
    | "PLAY_ERROR"
    | "SEEK_ERROR"
    | "INVALID_VOLUME"
    | "INVALID_RATE"
    | "INVALID_QUEUE_ITEM"
    | "NO_ACTIVE_SOURCE"
    | "UNSUPPORTED_ENVIRONMENT"
    | "UNKNOWN_ERROR";
  message: string;
}

export interface AudioPlayerRuntimeError extends AudioPlayerErrorState {
  cause?: unknown;
}

export interface AudioPlayerProgressState {
  currentTime: number;
  duration: number;
  buffered: number;
  playedFraction: number;
  bufferedFraction: number;
}

export interface AudioPlayerQueuePositionState {
  currentIndex: number;
  currentSourceId: string | null;
  length: number;
  hasNext: boolean;
  hasPrevious: boolean;
  repeatMode: RepeatMode;
}

export interface AudioPlayerQueueState {
  items: AudioSource[];
  itemIds: string[];
  position: AudioPlayerQueuePositionState;
}

export interface AudioPlayerState {
  status: PlayerStatus;
  currentSource: AudioSource | null;
  currentSourceId: string | null;
  currentTime: number;
  duration: number;
  buffered: number;
  progress: AudioPlayerProgressState;
  rate: number;
  volume: number;
  muted: boolean;
  queue: AudioPlayerQueueState;
  error: AudioPlayerErrorState | null;
}

export interface AudioPlayerEventMap {
  sourcechange: { source: AudioSource | null; state: AudioPlayerState };
  queuechange: { queue: AudioPlayerQueueState; state: AudioPlayerState };
  play: { source: AudioSource | null; state: AudioPlayerState };
  pause: { source: AudioSource | null; state: AudioPlayerState };
  seeking: { from: number; to: number; state: AudioPlayerState };
  seeked: { currentTime: number; state: AudioPlayerState };
  timeupdate: { currentTime: number; duration: number; state: AudioPlayerState };
  ratechange: { rate: number; state: AudioPlayerState };
  volumechange: { volume: number; muted: boolean; state: AudioPlayerState };
  ended: { source: AudioSource | null; state: AudioPlayerState };
  error: { error: AudioPlayerRuntimeError; state: AudioPlayerState };
  destroy: { state: AudioPlayerState };
}

export interface CreateAudioPlayerOptions {
  initialVolume?: number;
  initialRate?: number;
  initialMuted?: boolean;
  initialRepeatMode?: RepeatMode;
}

export interface SetQueueOptions {
  startAtId?: string;
  autoplay?: boolean;
}

export interface PreviousOptions {
  restartThresholdSeconds?: number;
}

export interface PersistedPlayerState {
  version: 1;
  savedAt: number;
  currentSource: AudioSource | null;
  currentSourceId: string | null;
  currentTime: number;
  rate: number;
  volume: number;
  muted: boolean;
  queue: {
    items: AudioSource[];
    position: {
      currentIndex: number;
      currentSourceId: string | null;
      repeatMode: RepeatMode;
    };
  };
}

export interface AudioPlayerPersistenceAdapter {
  load(): PersistedPlayerState | null;
  save(state: PersistedPlayerState): void;
  clear(): void;
}

export interface AudioPlayerPersistenceOptions {
  adapter: AudioPlayerPersistenceAdapter;
  autoRestore?: boolean;
  maxAgeMs?: number;
  saveIntervalMs?: number;
}

export interface AudioPlayerPersistenceController {
  restore(): Promise<PersistedPlayerState | null>;
  save(): void;
  clear(): void;
  destroy(): void;
}

export interface AudioPlayerProgressSnapshot {
  source: AudioSource | null;
  sourceId: string | null;
  currentTime: number;
  duration: number;
  playedFraction: number;
  status: PlayerStatus;
  queue: AudioPlayerQueuePositionState;
}

export interface AudioPlayerProgressReporterOptions {
  intervalMs?: number;
  onReport: (snapshot: AudioPlayerProgressSnapshot) => void;
}

export interface AudioPlayerProgressReporterController {
  report(): void;
  destroy(): void;
}

export interface AudioPlayerMediaSessionOptions {
  artworkSizes?: number[];
  seekOffsetSeconds?: number;
}

export interface AudioPlayerMediaSessionController {
  sync(): void;
  destroy(): void;
}

export type AudioPlayerEventListener<K extends AudioPlayerEventName> = (
  event: AudioPlayerEventMap[K],
) => void;

export interface AudioPlayer {
  getState(): AudioPlayerState;
  subscribe(listener: (state: AudioPlayerState) => void): () => void;
  on<K extends AudioPlayerEventName>(
    eventName: K,
    listener: AudioPlayerEventListener<K>,
  ): () => void;

  load(source: AudioSource): Promise<void>;
  play(source?: AudioSource): Promise<void>;
  pause(): void;
  toggle(): Promise<void>;
  seek(time: number): void;
  setRate(rate: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;

  setQueue(items: AudioSource[], options?: SetQueueOptions): Promise<void>;
  appendToQueue(items: AudioSource[]): void;
  removeFromQueue(id: string): void;
  clearQueue(): void;
  next(): Promise<void>;
  previous(options?: PreviousOptions): Promise<void>;
  setRepeatMode(mode: RepeatMode): void;

  destroy(): void;
}

const DEFAULT_PREVIOUS_RESTART_THRESHOLD_SECONDS = 5;
const DEFAULT_PERSISTENCE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_PERSISTENCE_SAVE_INTERVAL_MS = 5000;
const DEFAULT_PROGRESS_REPORT_INTERVAL_MS = 5000;
const DEFAULT_MEDIA_SESSION_ARTWORK_SIZES = [96, 128, 192, 256, 384, 512];
const DEFAULT_MEDIA_SESSION_SEEK_OFFSET_SECONDS = 10;

type AudioEngineEventName =
  | "loadedmetadata"
  | "timeupdate"
  | "progress"
  | "play"
  | "pause"
  | "seeked"
  | "ratechange"
  | "volumechange"
  | "ended"
  | "error";

interface AudioEngineSnapshot {
  currentTime: number;
  duration: number;
  buffered: number;
  rate: number;
  volume: number;
  muted: boolean;
}

interface AudioEngine {
  readonly available: boolean;
  getSnapshot(durationHint?: number): AudioEngineSnapshot;
  getRuntimeError(): unknown;
  on(eventName: AudioEngineEventName, listener: EventListener): () => void;
  setSource(src: string): void;
  clearSource(): void;
  load(): void;
  play(): Promise<void>;
  pause(): void;
  setCurrentTime(time: number): void;
  setPlaybackRate(rate: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  destroy(): void;
}

const createInitialState = (
  options: CreateAudioPlayerOptions,
): AudioPlayerState => ({
  status: "idle",
  currentSource: null,
  currentSourceId: null,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  progress: {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    playedFraction: 0,
    bufferedFraction: 0,
  },
  rate: options.initialRate ?? 1,
  volume: options.initialVolume ?? 1,
  muted: options.initialMuted ?? false,
  queue: {
    items: [],
    itemIds: [],
    position: {
      currentIndex: -1,
      currentSourceId: null,
      length: 0,
      repeatMode: options.initialRepeatMode ?? "off",
      hasNext: false,
      hasPrevious: false,
    },
  },
  error: null,
});

const createPlayerError = (
  code: AudioPlayerRuntimeError["code"],
  message: string,
  cause?: unknown,
): AudioPlayerRuntimeError => ({
  code,
  message,
  cause,
});

const isRuntimePlayerError = (
  value: unknown,
): value is AudioPlayerRuntimeError =>
  !!value &&
  typeof value === "object" &&
  "code" in value &&
  "message" in value;

const normalizePlayerError = (
  fallbackCode: AudioPlayerRuntimeError["code"],
  fallbackMessage: string,
  cause: unknown,
): AudioPlayerRuntimeError =>
  isRuntimePlayerError(cause)
    ? cause
    : createPlayerError(fallbackCode, fallbackMessage, cause);

const assertStableSource = (source: AudioSource): void => {
  if (!source.id || !source.src) {
    throw createPlayerError(
      "INVALID_QUEUE_ITEM",
      "AudioSource requires stable id and src.",
    );
  }
};

const isFiniteNumber = (value: number): boolean =>
  Number.isFinite(value) && !Number.isNaN(value);

const safeDuration = (audio: HTMLAudioElement | null, hint?: number): number => {
  const duration = audio?.duration;
  return duration !== undefined && isFiniteNumber(duration) ? duration : hint ?? 0;
};

const safeBuffered = (audio: HTMLAudioElement | null): number => {
  if (!audio || audio.buffered.length === 0) {
    return 0;
  }

  try {
    return audio.buffered.end(audio.buffered.length - 1);
  } catch {
    return 0;
  }
};

const cloneQueueState = (state: AudioPlayerState): AudioPlayerQueueState => ({
  items: [...state.queue.items],
  itemIds: [...state.queue.itemIds],
  position: {
    ...state.queue.position,
  },
});

const updateQueueFlags = (state: AudioPlayerState): AudioPlayerState => {
  const { items, position } = state.queue;
  const { currentIndex, repeatMode } = position;
  const lastIndex = items.length - 1;
  const hasItems = items.length > 0;
  const hasNext =
    !hasItems || currentIndex < 0
      ? false
      : repeatMode === "all"
        ? items.length > 0
        : currentIndex < lastIndex;
  const hasPrevious =
    !hasItems || currentIndex < 0
      ? false
      : repeatMode === "all"
        ? items.length > 0
        : currentIndex > 0;

  return {
    ...state,
    queue: {
      ...state.queue,
      itemIds: items.map((item) => item.id),
      position: {
        ...position,
        currentSourceId: state.currentSource?.id ?? null,
        length: items.length,
        hasNext,
        hasPrevious,
      },
    },
  };
};

const createAudioElement = (): HTMLAudioElement | null => {
  if (typeof Audio === "undefined") {
    return null;
  }

  return new Audio();
};

const createUnavailableAudioEngine = (): AudioEngine => {
  const unavailableError = (): AudioPlayerRuntimeError =>
    createPlayerError(
      "UNSUPPORTED_ENVIRONMENT",
      "HTMLAudioElement is not available in this environment.",
    );

  return {
    available: false,
    getSnapshot(durationHint) {
      return {
        currentTime: 0,
        duration: durationHint ?? 0,
        buffered: 0,
        rate: 1,
        volume: 1,
        muted: false,
      };
    },
    getRuntimeError() {
      return unavailableError();
    },
    on() {
      return () => {};
    },
    setSource() {
      throw unavailableError();
    },
    clearSource() {
      throw unavailableError();
    },
    load() {
      throw unavailableError();
    },
    play() {
      throw unavailableError();
    },
    pause() {
      throw unavailableError();
    },
    setCurrentTime() {
      throw unavailableError();
    },
    setPlaybackRate() {
      throw unavailableError();
    },
    setVolume() {
      throw unavailableError();
    },
    setMuted() {
      throw unavailableError();
    },
    destroy() {},
  };
};

const createHtmlAudioEngine = (): AudioEngine => {
  const audio = createAudioElement();
  if (!audio) {
    return createUnavailableAudioEngine();
  }

  audio.preload = "metadata";
  const clearSource = (): void => {
    const element = audio as HTMLAudioElement & {
      removeAttribute?: (name: string) => void;
    };
    if (typeof element.removeAttribute === "function") {
      element.removeAttribute("src");
      return;
    }

    audio.src = "";
  };

  return {
    available: true,
    getSnapshot(durationHint) {
      return {
        currentTime: audio.currentTime,
        duration: safeDuration(audio, durationHint),
        buffered: safeBuffered(audio),
        rate: audio.playbackRate,
        volume: audio.volume,
        muted: audio.muted,
      };
    },
    getRuntimeError() {
      return audio.error;
    },
    on(eventName, listener) {
      audio.addEventListener(eventName, listener);
      return () => {
        audio.removeEventListener(eventName, listener);
      };
    },
    setSource(src) {
      audio.src = src;
    },
    clearSource() {
      clearSource();
    },
    load() {
      audio.load();
    },
    play() {
      return audio.play();
    },
    pause() {
      audio.pause();
    },
    setCurrentTime(time) {
      audio.currentTime = time;
    },
    setPlaybackRate(rate) {
      audio.playbackRate = rate;
    },
    setVolume(volume) {
      audio.volume = volume;
    },
    setMuted(muted) {
      audio.muted = muted;
    },
    destroy() {
      audio.pause();
      clearSource();
      audio.load();
    },
  };
};

const isBrowserStorageAvailable = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isPersistedPlayerState = (value: unknown): value is PersistedPlayerState => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedPlayerState>;
  return (
    candidate.version === 1 &&
    typeof candidate.savedAt === "number" &&
    "currentSource" in candidate &&
    typeof candidate.currentTime === "number" &&
    typeof candidate.rate === "number" &&
    typeof candidate.volume === "number" &&
    typeof candidate.muted === "boolean" &&
    !!candidate.queue &&
    Array.isArray(candidate.queue.items) &&
    !!candidate.queue.position
  );
};

const toPersistedPlayerState = (state: AudioPlayerState): PersistedPlayerState => ({
  version: 1,
  savedAt: Date.now(),
  currentSource: state.currentSource,
  currentSourceId: state.currentSourceId,
  currentTime: state.currentTime,
  rate: state.rate,
  volume: state.volume,
  muted: state.muted,
  queue: {
    items: [...state.queue.items],
    position: {
      currentIndex: state.queue.position.currentIndex,
      currentSourceId: state.queue.position.currentSourceId,
      repeatMode: state.queue.position.repeatMode,
    },
  },
});

const toProgressSnapshot = (
  state: AudioPlayerState,
): AudioPlayerProgressSnapshot => ({
  source: state.currentSource,
  sourceId: state.currentSourceId,
  currentTime: state.currentTime,
  duration: state.duration,
  playedFraction: state.progress.playedFraction,
  status: state.status,
  queue: {
    ...state.queue.position,
  },
});

const hasMediaSession = (): boolean =>
  typeof navigator !== "undefined" && "mediaSession" in navigator;

const createMediaSessionArtwork = (
  source: AudioSource | null,
  sizes: number[],
): MediaImage[] => {
  if (!source?.artwork) {
    return [];
  }

  return sizes.map((size) => ({
    src: source.artwork as string,
    sizes: `${size}x${size}`,
  }));
};

export const createLocalStoragePersistenceAdapter = (
  key: string,
): AudioPlayerPersistenceAdapter => ({
  load() {
    if (!isBrowserStorageAvailable()) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);
      return isPersistedPlayerState(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  save(state) {
    if (!isBrowserStorageAvailable()) {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(state));
  },

  clear() {
    if (!isBrowserStorageAvailable()) {
      return;
    }

    window.localStorage.removeItem(key);
  },
});

export const createAudioPlayer = (
  options: CreateAudioPlayerOptions = {},
): AudioPlayer => {
  let state = updateQueueFlags(createInitialState(options));
  let destroyed = false;
  let shouldAutoplayAfterLoad = false;
  let suppressPauseEvent = false;

  const engine = createHtmlAudioEngine();
  const subscribers = new Set<(nextState: AudioPlayerState) => void>();
  const eventListeners: {
    [K in AudioPlayerEventName]: Set<AudioPlayerEventListener<K>>;
  } = {
    sourcechange: new Set(),
    queuechange: new Set(),
    play: new Set(),
    pause: new Set(),
    seeking: new Set(),
    seeked: new Set(),
    timeupdate: new Set(),
    ratechange: new Set(),
    volumechange: new Set(),
    ended: new Set(),
    error: new Set(),
    destroy: new Set(),
  };

  const getState = (): AudioPlayerState => state;

  const publishState = (): void => {
    for (const subscriber of subscribers) {
      subscriber(state);
    }
  };

  const emit = <K extends AudioPlayerEventName>(
    eventName: K,
    event: AudioPlayerEventMap[K],
  ): void => {
    for (const listener of eventListeners[eventName]) {
      listener(event);
    }
  };

  const setState = (
    updater: (currentState: AudioPlayerState) => AudioPlayerState,
  ): AudioPlayerState => {
    state = updateQueueFlags(updater(state));
    publishState();
    return state;
  };

  const setError = (error: AudioPlayerRuntimeError): void => {
    shouldAutoplayAfterLoad = false;
    const nextState = setState((currentState) => ({
      ...currentState,
      status: "error",
      error: {
        code: error.code,
        message: error.message,
      },
    }));
    emit("error", { error, state: nextState });
  };

  const clearError = (): void => {
    if (!state.error) {
      return;
    }

    setState((currentState) => ({
      ...currentState,
      error: null,
    }));
  };

  const syncAudioSnapshot = (
    statusOverride?: PlayerStatus,
  ): AudioPlayerState => {
    const snapshot = engine.getSnapshot(state.currentSource?.durationHint);
    const currentTime = snapshot.currentTime;
    const duration = snapshot.duration;
    const buffered = snapshot.buffered;
    const playedFraction =
      duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
    const bufferedFraction =
      duration > 0 ? Math.min(1, Math.max(0, buffered / duration)) : 0;

    const nextState = setState((currentState) => ({
      ...currentState,
      currentSourceId: currentState.currentSource?.id ?? null,
      currentTime,
      duration,
      buffered,
      progress: {
        currentTime,
        duration,
        buffered,
        playedFraction,
        bufferedFraction,
      },
      rate: snapshot.rate,
      volume: snapshot.volume,
      muted: snapshot.muted,
      status: statusOverride ?? currentState.status,
      error:
        statusOverride === "error" ? currentState.error : null,
    }));

    return nextState;
  };

  const findQueueIndexById = (id: string | null | undefined): number =>
    id ? state.queue.items.findIndex((item) => item.id === id) : -1;

  const resolveNextQueueIndex = (
    mode: "manual" | "ended",
  ): number | null => {
    const { items, position } = state.queue;
    const { currentIndex, repeatMode } = position;

    if (items.length === 0 || currentIndex < 0) {
      return null;
    }

    if (repeatMode === "one") {
      return currentIndex;
    }

    if (currentIndex < items.length - 1) {
      return currentIndex + 1;
    }

    if (repeatMode === "all") {
      return 0;
    }

    return mode === "ended" ? -1 : null;
  };

  const resolvePreviousQueueIndex = (): number | null => {
    const { items, position } = state.queue;
    const { currentIndex, repeatMode } = position;

    if (items.length === 0 || currentIndex < 0) {
      return null;
    }

    if (currentIndex > 0) {
      return currentIndex - 1;
    }

    if (repeatMode === "all") {
      return items.length - 1;
    }

    return null;
  };

  const updateCurrentSource = (
    source: AudioSource | null,
    nextStatus: PlayerStatus,
  ): AudioPlayerState => {
    const queueIndex = findQueueIndexById(source?.id);
    const nextState = setState((currentState) => ({
      ...currentState,
      currentSource: source,
      currentSourceId: source?.id ?? null,
      currentTime: 0,
      duration: source?.durationHint ?? 0,
      buffered: 0,
      progress: {
        currentTime: 0,
        duration: source?.durationHint ?? 0,
        buffered: 0,
        playedFraction: 0,
        bufferedFraction: 0,
      },
      status: nextStatus,
      error: null,
      queue: {
        ...currentState.queue,
        position: {
          ...currentState.queue.position,
          currentIndex: queueIndex,
          currentSourceId: source?.id ?? null,
        },
      },
    }));
    emit("sourcechange", { source, state: nextState });
    return nextState;
  };

  const setQueueState = (
    items: AudioSource[],
    currentIndex: number,
  ): AudioPlayerState =>
    setState((currentState) => ({
      ...currentState,
      queue: {
        ...currentState.queue,
        items,
        position: {
          ...currentState.queue.position,
          currentIndex,
        },
      },
    }));

  const emitQueueChange = (nextState: AudioPlayerState): void => {
    emit("queuechange", { queue: cloneQueueState(nextState), state: nextState });
  };

  const attachSourceToAudio = (
    source: AudioSource,
    autoplayAfterLoad: boolean,
  ): void => {
    shouldAutoplayAfterLoad = autoplayAfterLoad;
    suppressPauseEvent = true;
    try {
      engine.pause();
    } finally {
      suppressPauseEvent = false;
    }
    engine.setSource(source.src);
    engine.setCurrentTime(0);
    engine.setPlaybackRate(state.rate);
    engine.setVolume(state.volume);
    engine.setMuted(state.muted);
    engine.load();
  };

  const loadInternal = async (
    source: AudioSource,
    autoplayAfterLoad = false,
  ): Promise<void> => {
    assertStableSource(source);
    updateCurrentSource(source, "loading");
    attachSourceToAudio(source, autoplayAfterLoad);
  };

  const selectQueueIndex = async (
    index: number,
    autoplayAfterLoad = false,
  ): Promise<AudioSource | null> => {
    const item = state.queue.items[index] ?? null;
    if (!item) {
      return null;
    }

    await loadInternal(item, autoplayAfterLoad);
    const nextState = setQueueState(state.queue.items, index);
    emitQueueChange(nextState);
    return item;
  };

  const playLoadedAudio = async (): Promise<void> => {
    try {
      await engine.play();
    } catch (cause) {
      setError(createPlayerError("PLAY_ERROR", "Failed to start playback.", cause));
    }
  };

  const handlePlaybackEnded = async (): Promise<void> => {
    if (destroyed) {
      return;
    }

    if (state.queue.items.length > 0 && state.queue.position.currentIndex >= 0) {
      const nextIndex = resolveNextQueueIndex("ended");
      if (nextIndex === -1 || nextIndex === null) {
        const endedState = syncAudioSnapshot("ended");
        emit("ended", { source: endedState.currentSource, state: endedState });
        return;
      }

      await selectQueueIndex(nextIndex, true);
      return;
    }

    const endedState = syncAudioSnapshot("ended");
    emit("ended", { source: endedState.currentSource, state: endedState });
  };

  const detachEngineListeners = [
    engine.on("loadedmetadata", () => {
      if (destroyed || !state.currentSource) {
        return;
      }

      syncAudioSnapshot("ready");
      if (shouldAutoplayAfterLoad) {
        shouldAutoplayAfterLoad = false;
        void playLoadedAudio();
      }
    }),
    engine.on("timeupdate", () => {
      if (destroyed) {
        return;
      }

      const nextState = syncAudioSnapshot(
        state.status === "ended" ? "playing" : undefined,
      );
      emit("timeupdate", {
        currentTime: nextState.currentTime,
        duration: nextState.duration,
        state: nextState,
      });
    }),
    engine.on("progress", () => {
      if (!destroyed) {
        syncAudioSnapshot();
      }
    }),
    engine.on("play", () => {
      if (destroyed) {
        return;
      }

      const nextState = syncAudioSnapshot("playing");
      emit("play", { source: nextState.currentSource, state: nextState });
    }),
    engine.on("pause", () => {
      if (destroyed || suppressPauseEvent) {
        return;
      }

      const nextStatus =
        state.status === "ended" ? "ended" : state.currentSource ? "paused" : "idle";
      const nextState = syncAudioSnapshot(nextStatus);
      emit("pause", { source: nextState.currentSource, state: nextState });
    }),
    engine.on("seeked", () => {
      if (destroyed) {
        return;
      }

      const nextState = syncAudioSnapshot();
      emit("seeked", { currentTime: nextState.currentTime, state: nextState });
      emit("timeupdate", {
        currentTime: nextState.currentTime,
        duration: nextState.duration,
        state: nextState,
      });
    }),
    engine.on("ratechange", () => {
      if (destroyed) {
        return;
      }

      const nextState = syncAudioSnapshot();
      emit("ratechange", { rate: nextState.rate, state: nextState });
    }),
    engine.on("volumechange", () => {
      if (destroyed) {
        return;
      }

      const nextState = syncAudioSnapshot();
      emit("volumechange", {
        volume: nextState.volume,
        muted: nextState.muted,
        state: nextState,
      });
    }),
    engine.on("ended", () => {
      void handlePlaybackEnded();
    }),
    engine.on("error", () => {
      if (destroyed) {
        return;
      }

      setError(
        createPlayerError(
          "LOAD_ERROR",
          "Audio element reported a playback error.",
          engine.getRuntimeError(),
        ),
      );
    }),
  ];

  return {
    getState,

    subscribe(listener) {
      subscribers.add(listener);
      listener(state);
      return () => {
        subscribers.delete(listener);
      };
    },

    on(eventName, listener) {
      eventListeners[eventName].add(
        listener as AudioPlayerEventListener<typeof eventName>,
      );
      return () => {
        eventListeners[eventName].delete(
          listener as AudioPlayerEventListener<typeof eventName>,
        );
      };
    },

    async load(source) {
      try {
        await loadInternal(source);
      } catch (cause) {
        setError(
          normalizePlayerError("LOAD_ERROR", "Failed to load source.", cause),
        );
      }
    },

    async play(source) {
      try {
        if (source) {
          await loadInternal(source, true);
          return;
        }

        if (!state.currentSource) {
          setError(
            createPlayerError(
              "NO_ACTIVE_SOURCE",
              "Cannot play without an active source.",
            ),
          );
          return;
        }

        if (state.status === "loading") {
          shouldAutoplayAfterLoad = true;
          return;
        }

        await playLoadedAudio();
      } catch (cause) {
        setError(normalizePlayerError("PLAY_ERROR", "Failed to start playback.", cause));
      }
    },

    pause() {
      if (!engine.available) {
        return;
      }

      shouldAutoplayAfterLoad = false;
      engine.pause();
    },

    async toggle() {
      if (state.status === "playing") {
        this.pause();
        return;
      }

      await this.play();
    },

    seek(time) {
      if (!state.currentSource) {
        setError(
          createPlayerError("SEEK_ERROR", "Cannot seek without an active source."),
        );
        return;
      }

      const max = engine.getSnapshot(state.currentSource.durationHint).duration;
      const normalized = Math.max(
        0,
        max > 0 ? Math.min(time, max) : (isFiniteNumber(time) ? time : 0),
      );
      emit("seeking", { from: state.currentTime, to: normalized, state });

      try {
        engine.setCurrentTime(normalized);
      } catch (cause) {
        setError(normalizePlayerError("SEEK_ERROR", "Failed to seek audio.", cause));
      }
    },

    setRate(rate) {
      if (!engine.available) {
        setError(
          createPlayerError("INVALID_RATE", "Audio element is unavailable."),
        );
        return;
      }

      if (!isFiniteNumber(rate) || rate <= 0) {
        setError(
          createPlayerError("INVALID_RATE", "Playback rate must be greater than 0."),
        );
        return;
      }

      engine.setPlaybackRate(rate);
      clearError();
      syncAudioSnapshot();
    },

    setVolume(volume) {
      if (!engine.available) {
        setError(
          createPlayerError("INVALID_VOLUME", "Audio element is unavailable."),
        );
        return;
      }

      if (!isFiniteNumber(volume) || volume < 0 || volume > 1) {
        setError(
          createPlayerError("INVALID_VOLUME", "Volume must be between 0 and 1."),
        );
        return;
      }

      engine.setVolume(volume);
      clearError();
      syncAudioSnapshot();
    },

    setMuted(muted) {
      if (!engine.available) {
        return;
      }

      engine.setMuted(muted);
      clearError();
      syncAudioSnapshot();
    },

    async setQueue(items, queueOptions = {}) {
      try {
        for (const item of items) {
          assertStableSource(item);
        }

        const startIndex =
          queueOptions.startAtId === undefined
            ? items.length > 0
              ? 0
              : -1
            : items.findIndex((item) => item.id === queueOptions.startAtId);

        if (queueOptions.startAtId && startIndex < 0) {
          throw createPlayerError(
            "INVALID_QUEUE_ITEM",
            `Queue start item ${queueOptions.startAtId} was not found.`,
          );
        }

        const nextState = setState((currentState) => ({
          ...currentState,
          currentSource: startIndex >= 0 ? items[startIndex] ?? null : null,
          currentSourceId: startIndex >= 0 ? (items[startIndex]?.id ?? null) : null,
          currentTime: 0,
          duration: startIndex >= 0 ? (items[startIndex]?.durationHint ?? 0) : 0,
          buffered: 0,
          progress: {
            currentTime: 0,
            duration: startIndex >= 0 ? (items[startIndex]?.durationHint ?? 0) : 0,
            buffered: 0,
            playedFraction: 0,
            bufferedFraction: 0,
          },
          status: startIndex >= 0 ? "ready" : "idle",
          error: null,
          queue: {
            ...currentState.queue,
            items: [...items],
            position: {
              ...currentState.queue.position,
              currentIndex: startIndex,
              currentSourceId:
                startIndex >= 0 ? (items[startIndex]?.id ?? null) : null,
            },
          },
        }));

        emitQueueChange(nextState);
        emit("sourcechange", {
          source: nextState.currentSource,
          state: nextState,
        });

        if (nextState.currentSource) {
          await loadInternal(nextState.currentSource, queueOptions.autoplay === true);
          const syncedState = setQueueState(items, startIndex);
          emitQueueChange(syncedState);
        } else if (engine.available) {
          shouldAutoplayAfterLoad = false;
          suppressPauseEvent = true;
          engine.pause();
          suppressPauseEvent = false;
          engine.clearSource();
          engine.load();
        }
      } catch (cause) {
        setError(
          normalizePlayerError(
            "INVALID_QUEUE_ITEM",
            "Failed to set queue.",
            cause,
          ),
        );
      }
    },

    appendToQueue(items) {
      try {
        for (const item of items) {
          assertStableSource(item);
        }

        const nextState = setState((currentState) => ({
          ...currentState,
          queue: {
            ...currentState.queue,
            items: [...currentState.queue.items, ...items],
          },
        }));
        emitQueueChange(nextState);
      } catch (cause) {
        setError(
          normalizePlayerError(
            "INVALID_QUEUE_ITEM",
            "Failed to append queue items.",
            cause,
          ),
        );
      }
    },

    removeFromQueue(id) {
      const nextItems = state.queue.items.filter((item) => item.id !== id);
      const nextIndex = nextItems.findIndex(
        (item) => item.id === state.currentSource?.id,
      );

      const nextState = setState((currentState) => ({
        ...currentState,
        queue: {
          ...currentState.queue,
          items: nextItems,
          position: {
            ...currentState.queue.position,
            currentIndex: nextIndex,
            currentSourceId: nextIndex >= 0 ? (nextItems[nextIndex]?.id ?? null) : null,
          },
        },
      }));

      emitQueueChange(nextState);
    },

    clearQueue() {
      const nextState = setState((currentState) => ({
        ...currentState,
        queue: {
          ...currentState.queue,
          items: [],
          position: {
            ...currentState.queue.position,
            currentIndex: -1,
            currentSourceId: null,
          },
        },
      }));

      emitQueueChange(nextState);
    },

    async next() {
      const nextIndex = resolveNextQueueIndex("manual");
      if (nextIndex === null) {
        return;
      }

      await selectQueueIndex(nextIndex, true);
    },

    async previous(previousOptions = {}) {
      if (!state.currentSource) {
        return;
      }

      const threshold =
        previousOptions.restartThresholdSeconds ??
        DEFAULT_PREVIOUS_RESTART_THRESHOLD_SECONDS;

      if (state.currentTime > threshold) {
        this.seek(0);
        return;
      }

      const previousIndex = resolvePreviousQueueIndex();
      if (previousIndex === null) {
        this.seek(0);
        return;
      }

      await selectQueueIndex(previousIndex, true);
    },

    setRepeatMode(mode) {
      const nextState = setState((currentState) => ({
        ...currentState,
        queue: {
          ...currentState.queue,
          position: {
            ...currentState.queue.position,
            repeatMode: mode,
          },
        },
      }));
      emitQueueChange(nextState);
    },

    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;
      shouldAutoplayAfterLoad = false;
      for (const detach of detachEngineListeners) {
        detach();
      }
      suppressPauseEvent = true;
      engine.destroy();
      suppressPauseEvent = false;

      const nextState = setState(() => createInitialState(options));
      emit("destroy", { state: nextState });
      subscribers.clear();
      for (const eventName of Object.keys(eventListeners) as AudioPlayerEventName[]) {
        eventListeners[eventName].clear();
      }
    },
  };
};

export const attachAudioPlayerPersistence = (
  player: AudioPlayer,
  options: AudioPlayerPersistenceOptions,
): AudioPlayerPersistenceController => {
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_PERSISTENCE_MAX_AGE_MS;
  const saveIntervalMs =
    options.saveIntervalMs ?? DEFAULT_PERSISTENCE_SAVE_INTERVAL_MS;
  let destroyed = false;
  let playIntervalId: ReturnType<typeof setInterval> | null = null;

  const save = (): void => {
    if (destroyed) {
      return;
    }

    const state = player.getState();
    if (!state.currentSource) {
      options.adapter.clear();
      return;
    }

    options.adapter.save(toPersistedPlayerState(state));
  };

  const clear = (): void => {
    options.adapter.clear();
  };

  const stopPlayInterval = (): void => {
    if (playIntervalId !== null) {
      clearInterval(playIntervalId);
      playIntervalId = null;
    }
  };

  const startPlayInterval = (): void => {
    if (playIntervalId !== null) {
      return;
    }

    playIntervalId = setInterval(() => {
      save();
    }, saveIntervalMs);
  };

  const waitForRestoredSource = (sourceId: string): Promise<void> =>
    new Promise((resolve) => {
      const unsubscribe = player.subscribe((state) => {
        if (state.currentSourceId !== sourceId) {
          return;
        }

        if (state.status === "loading") {
          return;
        }

        unsubscribe();
        resolve();
      });
    });

  const restore = async (): Promise<PersistedPlayerState | null> => {
    const persisted = options.adapter.load();
    if (!persisted) {
      return null;
    }

    if (Date.now() - persisted.savedAt > maxAgeMs) {
      options.adapter.clear();
      return null;
    }

    player.setRepeatMode(persisted.queue.position.repeatMode);
    player.setVolume(persisted.volume);
    player.setMuted(persisted.muted);
    player.setRate(persisted.rate);

    if (persisted.queue.items.length > 0) {
      await player.setQueue(persisted.queue.items, {
        startAtId: persisted.queue.position.currentSourceId ?? undefined,
      });
    } else if (persisted.currentSource) {
      await player.load(persisted.currentSource);
    } else {
      return persisted;
    }

    if (persisted.currentSourceId) {
      await waitForRestoredSource(persisted.currentSourceId);
    }

    if (persisted.currentTime > 0) {
      player.seek(persisted.currentTime);
    }

    return persisted;
  };

  const stateUnsubscribe = player.subscribe((state) => {
    if (state.status === "playing") {
      startPlayInterval();
      return;
    }

    stopPlayInterval();
  });

  const pauseUnsubscribe = player.on("pause", () => {
    save();
  });
  const endedUnsubscribe = player.on("ended", () => {
    save();
  });
  const sourceUnsubscribe = player.on("sourcechange", () => {
    save();
  });
  const queueUnsubscribe = player.on("queuechange", () => {
    save();
  });
  const rateUnsubscribe = player.on("ratechange", () => {
    save();
  });
  const volumeUnsubscribe = player.on("volumechange", () => {
    save();
  });

  const beforeUnloadHandler = (): void => {
    save();
  };

  const visibilityHandler = (): void => {
    if (typeof document === "undefined") {
      return;
    }

    if (document.visibilityState === "hidden") {
      save();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", beforeUnloadHandler);
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", visibilityHandler);
  }

  if (options.autoRestore !== false) {
    void restore();
  }

  return {
    restore,
    save,
    clear,
    destroy() {
      destroyed = true;
      stopPlayInterval();
      stateUnsubscribe();
      pauseUnsubscribe();
      endedUnsubscribe();
      sourceUnsubscribe();
      queueUnsubscribe();
      rateUnsubscribe();
      volumeUnsubscribe();

      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", beforeUnloadHandler);
      }

      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
    },
  };
};

export const attachAudioPlayerProgressReporter = (
  player: AudioPlayer,
  options: AudioPlayerProgressReporterOptions,
): AudioPlayerProgressReporterController => {
  const intervalMs = options.intervalMs ?? DEFAULT_PROGRESS_REPORT_INTERVAL_MS;
  let destroyed = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const report = (): void => {
    if (destroyed) {
      return;
    }

    const state = player.getState();
    if (!state.currentSource) {
      return;
    }

    options.onReport(toProgressSnapshot(state));
  };

  const stopInterval = (): void => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const startInterval = (): void => {
    if (intervalId !== null) {
      return;
    }

    intervalId = setInterval(() => {
      report();
    }, intervalMs);
  };

  const stateUnsubscribe = player.subscribe((state) => {
    if (state.status === "playing") {
      startInterval();
      return;
    }

    stopInterval();
  });

  const pauseUnsubscribe = player.on("pause", () => {
    report();
  });
  const endedUnsubscribe = player.on("ended", () => {
    report();
  });
  const seekedUnsubscribe = player.on("seeked", () => {
    report();
  });
  const sourceUnsubscribe = player.on("sourcechange", () => {
    report();
  });

  return {
    report,
    destroy() {
      destroyed = true;
      stopInterval();
      stateUnsubscribe();
      pauseUnsubscribe();
      endedUnsubscribe();
      seekedUnsubscribe();
      sourceUnsubscribe();
    },
  };
};

export const attachAudioPlayerMediaSession = (
  player: AudioPlayer,
  options: AudioPlayerMediaSessionOptions = {},
): AudioPlayerMediaSessionController => {
  if (!hasMediaSession()) {
    return {
      sync() {},
      destroy() {},
    };
  }

  const artworkSizes =
    options.artworkSizes ?? DEFAULT_MEDIA_SESSION_ARTWORK_SIZES;
  const seekOffsetSeconds =
    options.seekOffsetSeconds ?? DEFAULT_MEDIA_SESSION_SEEK_OFFSET_SECONDS;
  let destroyed = false;

  const sync = (): void => {
    if (destroyed || !hasMediaSession()) {
      return;
    }

    const state = player.getState();
    const source = state.currentSource;

    navigator.mediaSession.metadata = source
      ? new MediaMetadata({
          title: source.title ?? "",
          artist: source.artist ?? "",
          album: source.album ?? "",
          artwork: createMediaSessionArtwork(source, artworkSizes),
        })
      : null;

    navigator.mediaSession.playbackState =
      state.status === "playing"
        ? "playing"
        : state.currentSource
          ? "paused"
          : "none";

    if (state.currentSource && state.duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: state.duration,
          playbackRate: state.rate,
          position: Math.min(state.currentTime, state.duration),
        });
      } catch {
        // Ignore unsupported position state implementations.
      }
    } else {
      try {
        navigator.mediaSession.setPositionState();
      } catch {
        // Ignore unsupported position state implementations.
      }
    }
  };

  const setActionHandler = (
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null,
  ): void => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // Ignore unsupported actions.
    }
  };

  setActionHandler("play", () => {
    void player.play();
  });
  setActionHandler("pause", () => {
    player.pause();
  });
  setActionHandler("seekbackward", () => {
    const state = player.getState();
    player.seek(Math.max(0, state.currentTime - seekOffsetSeconds));
  });
  setActionHandler("seekforward", () => {
    const state = player.getState();
    const max = state.duration > 0 ? state.duration : state.currentTime + seekOffsetSeconds;
    player.seek(Math.min(max, state.currentTime + seekOffsetSeconds));
  });
  setActionHandler("previoustrack", () => {
    void player.previous();
  });
  setActionHandler("nexttrack", () => {
    void player.next();
  });
  setActionHandler("seekto", (details) => {
    if (details.seekTime === undefined) {
      return;
    }

    player.seek(details.seekTime);
  });
  setActionHandler("stop", () => {
    player.pause();
  });

  const stateUnsubscribe = player.subscribe(() => {
    sync();
  });

  sync();

  return {
    sync,
    destroy() {
      destroyed = true;
      stateUnsubscribe();
      if (!hasMediaSession()) {
        return;
      }

      const actions: MediaSessionAction[] = [
        "play",
        "pause",
        "seekbackward",
        "seekforward",
        "previoustrack",
        "nexttrack",
        "seekto",
        "stop",
      ];

      for (const action of actions) {
        setActionHandler(action, null);
      }

      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      try {
        navigator.mediaSession.setPositionState();
      } catch {
        // Ignore unsupported position state implementations.
      }
    },
  };
};

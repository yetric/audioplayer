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

export interface AudioPlayerError {
  code:
    | "LOAD_ERROR"
    | "PLAY_ERROR"
    | "SEEK_ERROR"
    | "INVALID_VOLUME"
    | "INVALID_RATE"
    | "INVALID_QUEUE_ITEM"
    | "NO_ACTIVE_SOURCE"
    | "UNKNOWN_ERROR";
  message: string;
  cause?: unknown;
}

export interface AudioPlayerQueueState {
  items: AudioSource[];
  currentIndex: number;
  repeatMode: RepeatMode;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface AudioPlayerState {
  status: PlayerStatus;
  currentSource: AudioSource | null;
  currentTime: number;
  duration: number;
  buffered: number;
  rate: number;
  volume: number;
  muted: boolean;
  queue: AudioPlayerQueueState;
  error: AudioPlayerError | null;
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
  error: { error: AudioPlayerError; state: AudioPlayerState };
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

const createInitialState = (
  options: CreateAudioPlayerOptions,
): AudioPlayerState => ({
  status: "idle",
  currentSource: null,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  rate: options.initialRate ?? 1,
  volume: options.initialVolume ?? 1,
  muted: options.initialMuted ?? false,
  queue: {
    items: [],
    currentIndex: -1,
    repeatMode: options.initialRepeatMode ?? "off",
    hasNext: false,
    hasPrevious: false,
  },
  error: null,
});

const assertStableSource = (source: AudioSource): void => {
  if (!source.id || !source.src) {
    throw new Error("AudioSource requires stable id and src.");
  }
};

const cloneQueueState = (state: AudioPlayerState): AudioPlayerQueueState => ({
  items: [...state.queue.items],
  currentIndex: state.queue.currentIndex,
  repeatMode: state.queue.repeatMode,
  hasNext: state.queue.hasNext,
  hasPrevious: state.queue.hasPrevious,
});

const updateQueueFlags = (state: AudioPlayerState): AudioPlayerState => {
  const { items, currentIndex, repeatMode } = state.queue;
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
      hasNext,
      hasPrevious,
    },
  };
};

export const createAudioPlayer = (
  options: CreateAudioPlayerOptions = {},
): AudioPlayer => {
  let state = updateQueueFlags(createInitialState(options));
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

  const setCurrentSource = (source: AudioSource | null): AudioPlayerState => {
    const nextState = setState((currentState) => ({
      ...currentState,
      currentSource: source,
      currentTime: 0,
      duration: source?.durationHint ?? 0,
      buffered: 0,
      status: source ? "ready" : "idle",
      error: null,
    }));
    emit("sourcechange", { source, state: nextState });
    return nextState;
  };

  const setError = (error: AudioPlayerError): void => {
    const nextState = setState((currentState) => ({
      ...currentState,
      status: "error",
      error,
    }));
    emit("error", { error, state: nextState });
  };

  const selectQueueIndex = (index: number): AudioSource | null => {
    const item = state.queue.items[index] ?? null;
    setState((currentState) => ({
      ...currentState,
      currentSource: item,
      currentTime: 0,
      duration: item?.durationHint ?? 0,
      buffered: 0,
      status: item ? "ready" : "idle",
      error: null,
      queue: {
        ...currentState.queue,
        currentIndex: item ? index : -1,
      },
    }));
    emit("sourcechange", { source: item, state });
    return item;
  };

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
      assertStableSource(source);
      setCurrentSource(source);
    },

    async play(source) {
      if (source) {
        assertStableSource(source);
        setCurrentSource(source);
      }

      if (!state.currentSource) {
        setError({
          code: "NO_ACTIVE_SOURCE",
          message: "Cannot play without an active source.",
        });
        return;
      }

      const nextState = setState((currentState) => ({
        ...currentState,
        status: "playing",
        error: null,
      }));
      emit("play", { source: nextState.currentSource, state: nextState });
    },

    pause() {
      const nextState = setState((currentState) => ({
        ...currentState,
        status:
          currentState.currentSource && currentState.status !== "idle"
            ? "paused"
            : currentState.status,
      }));
      emit("pause", { source: nextState.currentSource, state: nextState });
    },

    async toggle() {
      if (state.status === "playing") {
        this.pause();
        return;
      }

      await this.play();
    },

    seek(time) {
      const to = Math.max(0, Number.isFinite(time) ? time : 0);
      emit("seeking", { from: state.currentTime, to, state });
      const nextState = setState((currentState) => ({
        ...currentState,
        currentTime: to,
      }));
      emit("seeked", { currentTime: nextState.currentTime, state: nextState });
      emit("timeupdate", {
        currentTime: nextState.currentTime,
        duration: nextState.duration,
        state: nextState,
      });
    },

    setRate(rate) {
      if (!Number.isFinite(rate) || rate <= 0) {
        setError({
          code: "INVALID_RATE",
          message: "Playback rate must be greater than 0.",
        });
        return;
      }

      const nextState = setState((currentState) => ({
        ...currentState,
        rate,
      }));
      emit("ratechange", { rate, state: nextState });
    },

    setVolume(volume) {
      if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
        setError({
          code: "INVALID_VOLUME",
          message: "Volume must be between 0 and 1.",
        });
        return;
      }

      const nextState = setState((currentState) => ({
        ...currentState,
        volume,
      }));
      emit("volumechange", {
        volume: nextState.volume,
        muted: nextState.muted,
        state: nextState,
      });
    },

    setMuted(muted) {
      const nextState = setState((currentState) => ({
        ...currentState,
        muted,
      }));
      emit("volumechange", {
        volume: nextState.volume,
        muted: nextState.muted,
        state: nextState,
      });
    },

    async setQueue(items, queueOptions = {}) {
      for (const item of items) {
        assertStableSource(item);
      }

      const startIndex =
        queueOptions.startAtId === undefined
          ? items.length > 0
            ? 0
            : -1
          : items.findIndex((item) => item.id === queueOptions.startAtId);

      const nextState = setState((currentState) => ({
        ...currentState,
        currentSource: startIndex >= 0 ? items[startIndex] ?? null : null,
        currentTime: 0,
        duration:
          startIndex >= 0 ? (items[startIndex]?.durationHint ?? 0) : 0,
        buffered: 0,
        status: startIndex >= 0 ? "ready" : "idle",
        error: null,
        queue: {
          ...currentState.queue,
          items: [...items],
          currentIndex: startIndex,
        },
      }));

      emit("queuechange", { queue: cloneQueueState(nextState), state: nextState });
      emit("sourcechange", {
        source: nextState.currentSource,
        state: nextState,
      });

      if (queueOptions.autoplay && nextState.currentSource) {
        await this.play();
      }
    },

    appendToQueue(items) {
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
      emit("queuechange", { queue: cloneQueueState(nextState), state: nextState });
    },

    removeFromQueue(id) {
      const nextItems = state.queue.items.filter((item) => item.id !== id);
      const nextIndex = nextItems.findIndex(
        (item) => item.id === state.currentSource?.id,
      );
      const currentSource = nextIndex >= 0 ? nextItems[nextIndex] : null;

      const nextState = setState((currentState) => ({
        ...currentState,
        currentSource,
        currentTime: currentSource ? currentState.currentTime : 0,
        duration: currentSource
          ? currentSource.durationHint ?? currentState.duration
          : 0,
        queue: {
          ...currentState.queue,
          items: nextItems,
          currentIndex: nextIndex,
        },
      }));

      emit("queuechange", { queue: cloneQueueState(nextState), state: nextState });
    },

    clearQueue() {
      const nextState = setState((currentState) => ({
        ...currentState,
        queue: {
          ...currentState.queue,
          items: [],
          currentIndex: -1,
        },
      }));
      emit("queuechange", { queue: cloneQueueState(nextState), state: nextState });
    },

    async next() {
      const { items, currentIndex, repeatMode } = state.queue;
      if (items.length === 0) {
        return;
      }

      let nextIndex = currentIndex + 1;
      if (nextIndex >= items.length) {
        if (repeatMode === "all") {
          nextIndex = 0;
        } else if (repeatMode === "one") {
          nextIndex = currentIndex;
        } else {
          const nextState = setState((currentState) => ({
            ...currentState,
            status: "ended",
          }));
          emit("ended", { source: nextState.currentSource, state: nextState });
          return;
        }
      }

      const item = selectQueueIndex(nextIndex);
      if (item) {
        await this.play();
      }
    },

    async previous(previousOptions = {}) {
      const threshold =
        previousOptions.restartThresholdSeconds ??
        DEFAULT_PREVIOUS_RESTART_THRESHOLD_SECONDS;

      if (state.currentTime > threshold) {
        this.seek(0);
        return;
      }

      const { items, currentIndex, repeatMode } = state.queue;
      if (items.length === 0) {
        if (state.currentSource) {
          this.seek(0);
        }
        return;
      }

      let previousIndex = currentIndex - 1;
      if (previousIndex < 0) {
        if (repeatMode === "all") {
          previousIndex = items.length - 1;
        } else {
          this.seek(0);
          return;
        }
      }

      const item = selectQueueIndex(previousIndex);
      if (item) {
        await this.play();
      }
    },

    setRepeatMode(mode) {
      const nextState = setState((currentState) => ({
        ...currentState,
        queue: {
          ...currentState.queue,
          repeatMode: mode,
        },
      }));
      emit("queuechange", { queue: cloneQueueState(nextState), state: nextState });
    },

    destroy() {
      const nextState = setState((currentState) => ({
        ...createInitialState(options),
        queue: {
          ...createInitialState(options).queue,
        },
        rate: currentState.rate,
        volume: currentState.volume,
        muted: currentState.muted,
      }));
      emit("destroy", { state: nextState });
      subscribers.clear();
      for (const eventName of Object.keys(eventListeners) as AudioPlayerEventName[]) {
        eventListeners[eventName].clear();
      }
    },
  };
};

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

export const createAudioPlayer = (
  options: CreateAudioPlayerOptions = {},
): AudioPlayer => {
  let state = updateQueueFlags(createInitialState(options));
  let destroyed = false;
  let shouldAutoplayAfterLoad = false;
  let suppressPauseEvent = false;

  const audio = createAudioElement();
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

  const requireAudio = (): HTMLAudioElement => {
    if (!audio) {
      throw createPlayerError(
        "UNKNOWN_ERROR",
        "HTMLAudioElement is not available in this environment.",
      );
    }

    return audio;
  };

  const syncAudioSnapshot = (
    statusOverride?: PlayerStatus,
  ): AudioPlayerState => {
    const currentTime = audio?.currentTime ?? state.currentTime;
    const duration = safeDuration(audio, state.currentSource?.durationHint);
    const buffered = safeBuffered(audio);
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
      rate: audio?.playbackRate ?? currentState.rate,
      volume: audio?.volume ?? currentState.volume,
      muted: audio?.muted ?? currentState.muted,
      status: statusOverride ?? currentState.status,
      error: statusOverride === "error" ? currentState.error : currentState.error,
    }));

    return nextState;
  };

  const findQueueIndexById = (id: string | null | undefined): number =>
    id ? state.queue.items.findIndex((item) => item.id === id) : -1;

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

  const attachSourceToAudio = (source: AudioSource): void => {
    const media = requireAudio();
    shouldAutoplayAfterLoad = false;
    suppressPauseEvent = true;
    media.pause();
    suppressPauseEvent = false;
    media.src = source.src;
    media.currentTime = 0;
    media.playbackRate = state.rate;
    media.volume = state.volume;
    media.muted = state.muted;
    media.load();
  };

  const loadInternal = async (source: AudioSource): Promise<void> => {
    assertStableSource(source);
    attachSourceToAudio(source);
    updateCurrentSource(source, "loading");
  };

  const selectQueueIndex = async (index: number): Promise<AudioSource | null> => {
    const item = state.queue.items[index] ?? null;
    if (!item) {
      return null;
    }

    await loadInternal(item);
    const nextState = setQueueState(state.queue.items, index);
    emitQueueChange(nextState);
    return item;
  };

  const playLoadedAudio = async (): Promise<void> => {
    const media = requireAudio();
    try {
      await media.play();
    } catch (cause) {
      setError(createPlayerError("PLAY_ERROR", "Failed to start playback.", cause));
    }
  };

  const handlePlaybackEnded = async (): Promise<void> => {
    if (destroyed) {
      return;
    }

    const { items, position } = state.queue;
    const { currentIndex, repeatMode } = position;
    if (items.length > 0 && currentIndex >= 0) {
      let nextIndex = currentIndex;

      if (repeatMode === "one") {
        nextIndex = currentIndex;
      } else if (currentIndex < items.length - 1) {
        nextIndex = currentIndex + 1;
      } else if (repeatMode === "all") {
        nextIndex = 0;
      } else {
        const endedState = syncAudioSnapshot("ended");
        emit("ended", { source: endedState.currentSource, state: endedState });
        return;
      }

      const nextItem = await selectQueueIndex(nextIndex);
      if (nextItem) {
        shouldAutoplayAfterLoad = true;
      }
      return;
    }

    const endedState = syncAudioSnapshot("ended");
    emit("ended", { source: endedState.currentSource, state: endedState });
  };

  if (audio) {
    audio.preload = "metadata";
    audio.playbackRate = state.rate;
    audio.volume = state.volume;
    audio.muted = state.muted;

    audio.addEventListener("loadedmetadata", () => {
      if (destroyed || !state.currentSource) {
        return;
      }

      syncAudioSnapshot("ready");
      if (shouldAutoplayAfterLoad) {
        shouldAutoplayAfterLoad = false;
        void playLoadedAudio();
      }
    });

    audio.addEventListener("timeupdate", () => {
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
    });

    audio.addEventListener("progress", () => {
      if (!destroyed) {
        syncAudioSnapshot();
      }
    });

    audio.addEventListener("play", () => {
      if (destroyed) {
        return;
      }

      const nextState = syncAudioSnapshot("playing");
      emit("play", { source: nextState.currentSource, state: nextState });
    });

    audio.addEventListener("pause", () => {
      if (destroyed || suppressPauseEvent) {
        return;
      }

      const nextStatus =
        state.status === "ended" ? "ended" : state.currentSource ? "paused" : "idle";
      const nextState = syncAudioSnapshot(nextStatus);
      emit("pause", { source: nextState.currentSource, state: nextState });
    });

    audio.addEventListener("seeked", () => {
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
    });

    audio.addEventListener("ratechange", () => {
      if (destroyed) {
        return;
      }

      const nextState = syncAudioSnapshot();
      emit("ratechange", { rate: nextState.rate, state: nextState });
    });

    audio.addEventListener("volumechange", () => {
      if (destroyed) {
        return;
      }

      const nextState = syncAudioSnapshot();
      emit("volumechange", {
        volume: nextState.volume,
        muted: nextState.muted,
        state: nextState,
      });
    });

    audio.addEventListener("ended", () => {
      void handlePlaybackEnded();
    });

    audio.addEventListener("error", () => {
      if (destroyed) {
        return;
      }

      setError(
        createPlayerError(
          "LOAD_ERROR",
          "Audio element reported a playback error.",
          audio.error,
        ),
      );
    });
  }

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
          cause && typeof cause === "object" && "code" in cause
            ? (cause as AudioPlayerRuntimeError)
            : createPlayerError("LOAD_ERROR", "Failed to load source.", cause),
        );
      }
    },

    async play(source) {
      try {
        if (source) {
          await loadInternal(source);
          shouldAutoplayAfterLoad = true;
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
        setError(createPlayerError("PLAY_ERROR", "Failed to start playback.", cause));
      }
    },

    pause() {
      if (!audio) {
        return;
      }

      shouldAutoplayAfterLoad = false;
      audio.pause();
    },

    async toggle() {
      if (state.status === "playing") {
        this.pause();
        return;
      }

      await this.play();
    },

    seek(time) {
      if (!audio || !state.currentSource) {
        setError(
          createPlayerError("SEEK_ERROR", "Cannot seek without an active source."),
        );
        return;
      }

      const max = safeDuration(audio, state.currentSource.durationHint);
      const normalized = Math.max(
        0,
        max > 0 ? Math.min(time, max) : (isFiniteNumber(time) ? time : 0),
      );
      emit("seeking", { from: state.currentTime, to: normalized, state });

      try {
        audio.currentTime = normalized;
      } catch (cause) {
        setError(createPlayerError("SEEK_ERROR", "Failed to seek audio.", cause));
      }
    },

    setRate(rate) {
      if (!audio) {
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

      audio.playbackRate = rate;
      syncAudioSnapshot();
    },

    setVolume(volume) {
      if (!audio) {
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

      audio.volume = volume;
      syncAudioSnapshot();
    },

    setMuted(muted) {
      if (!audio) {
        return;
      }

      audio.muted = muted;
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
          await loadInternal(nextState.currentSource);
          const syncedState = setQueueState(items, startIndex);
          emitQueueChange(syncedState);
          if (queueOptions.autoplay) {
            shouldAutoplayAfterLoad = true;
          }
        } else if (audio) {
          shouldAutoplayAfterLoad = false;
          suppressPauseEvent = true;
          audio.pause();
          suppressPauseEvent = false;
          audio.removeAttribute("src");
          audio.load();
        }
      } catch (cause) {
        setError(
          cause && typeof cause === "object" && "code" in cause
            ? (cause as AudioPlayerRuntimeError)
            : createPlayerError("INVALID_QUEUE_ITEM", "Failed to set queue.", cause),
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
          cause && typeof cause === "object" && "code" in cause
            ? (cause as AudioPlayerRuntimeError)
            : createPlayerError("INVALID_QUEUE_ITEM", "Failed to append queue items.", cause),
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
      const { items, position } = state.queue;
      const { currentIndex, repeatMode } = position;
      if (items.length === 0) {
        const endedState = syncAudioSnapshot("ended");
        emit("ended", { source: endedState.currentSource, state: endedState });
        return;
      }

      let nextIndex = currentIndex + 1;
      if (repeatMode === "one") {
        nextIndex = currentIndex >= 0 ? currentIndex : 0;
      } else if (nextIndex >= items.length) {
        if (repeatMode === "all") {
          nextIndex = 0;
        } else {
          const endedState = syncAudioSnapshot("ended");
          emit("ended", { source: endedState.currentSource, state: endedState });
          return;
        }
      }

      const nextItem = await selectQueueIndex(nextIndex);
      if (nextItem) {
        shouldAutoplayAfterLoad = true;
      }
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

      const { items, position } = state.queue;
      const { currentIndex, repeatMode } = position;
      if (items.length === 0 || currentIndex < 0) {
        this.seek(0);
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

      const previousItem = await selectQueueIndex(previousIndex);
      if (previousItem) {
        shouldAutoplayAfterLoad = true;
      }
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

      if (audio) {
        suppressPauseEvent = true;
        audio.pause();
        suppressPauseEvent = false;
        audio.removeAttribute("src");
        audio.load();
      }

      const nextState = setState(() => createInitialState(options));
      emit("destroy", { state: nextState });
      subscribers.clear();
      for (const eventName of Object.keys(eventListeners) as AudioPlayerEventName[]) {
        eventListeners[eventName].clear();
      }
    },
  };
};

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  attachAudioPlayerMediaSession,
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  createAudioPlayer,
  type AudioPlayer,
  type AudioPlayerMediaSessionOptions,
  type AudioPlayerPersistenceOptions,
  type AudioPlayerProgressReporterOptions,
  type AudioPlayerState,
  type CreateAudioPlayerOptions,
  type PersistedPlayerState,
} from "./index";

const AudioPlayerContext = createContext<AudioPlayer | null>(null);

export interface AudioPlayerProviderPersistenceOptions
  extends AudioPlayerPersistenceOptions {
  /**
   * Called once after the automatic restore finishes, with the restored state
   * or `null` when there was nothing to restore. Not called when
   * `autoRestore` is `false`.
   */
  onRestore?: (restored: PersistedPlayerState | null) => void;
}

export interface AudioPlayerProviderProps {
  children: ReactNode;
  options?: CreateAudioPlayerOptions;
  player?: AudioPlayer;
  /** Attaches persistence on mount and detaches it on unmount. Read once on mount. */
  persistence?: AudioPlayerProviderPersistenceOptions;
  /** Attaches Media Session on mount. `true` uses the defaults. Read once on mount. */
  mediaSession?: boolean | AudioPlayerMediaSessionOptions;
  /** Attaches the progress reporter on mount. Read once on mount. */
  progressReporter?: AudioPlayerProgressReporterOptions;
}

export const AudioPlayerProvider = ({
  children,
  options,
  player,
  persistence,
  mediaSession,
  progressReporter,
}: AudioPlayerProviderProps) => {
  const playerRef = useRef<AudioPlayer | null>(player ?? null);

  if (playerRef.current === null) {
    playerRef.current = createAudioPlayer(options);
  }

  const pluginsRef = useRef({ persistence, mediaSession, progressReporter });
  pluginsRef.current = { persistence, mediaSession, progressReporter };

  useEffect(() => {
    const active = playerRef.current as AudioPlayer;
    const plugins = pluginsRef.current;
    const detach: Array<() => void> = [];
    let cancelled = false;

    if (plugins.persistence) {
      const { onRestore, ...persistenceOptions } = plugins.persistence;
      const controller = attachAudioPlayerPersistence(active, {
        ...persistenceOptions,
        autoRestore: false,
      });
      detach.push(() => controller.destroy());

      if (persistenceOptions.autoRestore !== false) {
        controller
          .restore()
          .catch(() => null)
          .then((restored) => {
            if (!cancelled) {
              onRestore?.(restored);
            }
          });
      }
    }

    if (plugins.mediaSession) {
      const controller = attachAudioPlayerMediaSession(
        active,
        plugins.mediaSession === true ? {} : plugins.mediaSession,
      );
      detach.push(() => controller.destroy());
    }

    if (plugins.progressReporter) {
      const controller = attachAudioPlayerProgressReporter(
        active,
        plugins.progressReporter,
      );
      detach.push(() => controller.destroy());
    }

    return () => {
      cancelled = true;
      for (const fn of detach) {
        fn();
      }
    };
  }, [player]);

  const mountedRef = useRef(false);

  useEffect(() => {
    if (player) {
      return undefined;
    }

    const owned = playerRef.current;
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      // StrictMode re-runs effects right after cleanup, so only destroy if not re-mounted
      queueMicrotask(() => {
        if (!mountedRef.current) {
          owned?.destroy();
        }
      });
    };
  }, [player]);

  return (
    <AudioPlayerContext.Provider value={playerRef.current}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = (): AudioPlayer => {
  const player = useContext(AudioPlayerContext);

  if (!player) {
    throw new Error("useAudioPlayer must be used inside AudioPlayerProvider.");
  }

  return player;
};

/**
 * Subscribes to the player state. Without arguments it returns the whole
 * state and re-renders on every change. With a selector it re-renders only
 * when the selected value changes, which avoids a render on every
 * `timeupdate` for components that read, for example, `status`.
 *
 * @param selector Picks a value from the state.
 * @param isEqual Compares the previous and next selected values. Defaults to
 * `Object.is`. Pass a custom function when the selector returns a new object
 * or array on each call.
 */
export function useAudioPlayerState(): AudioPlayerState;
export function useAudioPlayerState<T>(
  selector: (state: AudioPlayerState) => T,
  isEqual?: (previous: T, next: T) => boolean,
): T;
export function useAudioPlayerState<T>(
  selector?: (state: AudioPlayerState) => T,
  isEqual: (previous: T, next: T) => boolean = Object.is,
): AudioPlayerState | T {
  const player = useAudioPlayer();
  const cache = useRef<{
    state: AudioPlayerState;
    selector: typeof selector;
    value: AudioPlayerState | T;
  } | null>(null);

  const getSnapshot = (): AudioPlayerState | T => {
    const state = player.getState();
    const cached = cache.current;

    if (cached && cached.state === state && cached.selector === selector) {
      return cached.value;
    }

    const value = selector ? selector(state) : state;
    const next =
      cached && selector && isEqual(cached.value as T, value as T)
        ? cached.value
        : value;
    cache.current = { state, selector, value: next };

    return next;
  };

  return useSyncExternalStore(player.subscribe, getSnapshot, getSnapshot);
}

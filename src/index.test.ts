import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachAudioPlayerMediaSession,
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  attachAudioPlayerCues,
  type AudioPlayerCue,
  createAudioPlayer,
  createLocalStoragePersistenceAdapter,
  type PersistedPlayerState,
} from "./index";

class MockTimeRanges implements TimeRanges {
  public length: number;

  constructor(private readonly ranges: Array<[number, number]>) {
    this.length = ranges.length;
  }

  start(index: number): number {
    const range = this.ranges[index];
    if (!range) {
      throw new Error("Range not found");
    }

    return range[0];
  }

  end(index: number): number {
    const range = this.ranges[index];
    if (!range) {
      throw new Error("Range not found");
    }

    return range[1];
  }
}

class MockAudio {
  static instances: MockAudio[] = [];
  static asyncLoad = false;
  static deferLoad = false;

  src = "";
  currentTime = 0;
  duration = 0;
  playbackRate = 1;
  volume = 1;
  muted = false;
  preload = "";
  error: MediaError | null = null;
  buffered: TimeRanges = new MockTimeRanges([]);

  private listeners = new Map<string, Set<EventListener>>();

  constructor() {
    MockAudio.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    const event = new Event(type);
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener(event);
    }
  }

  async play(): Promise<void> {
    this.dispatch("play");
  }

  pause(): void {
    this.dispatch("pause");
  }

  load(): void {
    if (MockAudio.deferLoad) {
      return;
    }

    if (MockAudio.asyncLoad) {
      void Promise.resolve().then(() => this.dispatch("loadedmetadata"));
      return;
    }

    this.dispatch("loadedmetadata");
  }
}

const episodeOne = {
  id: "episode-1",
  src: "https://example.com/episode-1.mp3",
  title: "Episode 1",
};

const episodeTwo = {
  id: "episode-2",
  src: "https://example.com/episode-2.mp3",
  title: "Episode 2",
};

const episodeThree = {
  id: "episode-3",
  src: "https://example.com/episode-3.mp3",
  title: "Episode 3",
};

const createMemoryAdapter = (initial: PersistedPlayerState | null = null) => {
  let stored = initial;
  return {
    load: vi.fn(() => stored),
    save: vi.fn((state: PersistedPlayerState) => {
      stored = state;
    }),
    clear: vi.fn(() => {
      stored = null;
    }),
  };
};

const persistedState = (
  overrides: Partial<PersistedPlayerState> = {},
): PersistedPlayerState => ({
  version: 1,
  savedAt: Date.now(),
  currentSource: episodeTwo,
  currentSourceId: "episode-2",
  currentTime: 42,
  rate: 1.5,
  volume: 0.4,
  muted: true,
  queue: {
    items: [episodeOne, episodeTwo, episodeThree],
    position: {
      currentIndex: 1,
      currentSourceId: "episode-2",
      repeatMode: "all",
    },
  },
  ...overrides,
});

describe("createAudioPlayer", () => {
  beforeEach(() => {
    MockAudio.instances = [];
    MockAudio.deferLoad = false;
    vi.stubGlobal("Audio", MockAudio);
  });

  it("loads a source and reaches ready state", async () => {
    const player = createAudioPlayer();

    await player.load(episodeOne);

    const state = player.getState();
    expect(state.currentSourceId).toBe("episode-1");
    expect(state.status).toBe("ready");
  });

  it("seeks and updates normalized progress", async () => {
    const player = createAudioPlayer();

    await player.load(episodeOne);

    const audio = MockAudio.instances[0];
    audio.duration = 100;
    audio.currentTime = 25;
    audio.buffered = new MockTimeRanges([[0, 60]]);
    audio.dispatch("timeupdate");

    expect(player.getState().progress.playedFraction).toBe(0.25);
    expect(player.getState().progress.bufferedFraction).toBe(0.6);

    player.seek(30);
    audio.dispatch("seeked");

    expect(player.getState().currentTime).toBe(30);
  });

  it("auto-advances to the next queue item on ended", async () => {
    const player = createAudioPlayer();

    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-1",
      autoplay: true,
    });

    const audio = MockAudio.instances[0];
    audio.dispatch("ended");

    expect(player.getState().currentSourceId).toBe("episode-2");
    expect(player.getState().queue.position.currentIndex).toBe(1);
  });

  it("keeps the ended item when repeat is off and queue is exhausted", async () => {
    const player = createAudioPlayer();

    await player.setQueue([episodeOne], {
      startAtId: "episode-1",
      autoplay: true,
    });

    const audio = MockAudio.instances[0];
    audio.dispatch("ended");

    expect(player.getState().currentSourceId).toBe("episode-1");
    expect(player.getState().status).toBe("ended");
  });

  it("does not mark ended on manual next at queue boundary", async () => {
    const player = createAudioPlayer();

    await player.setQueue([episodeOne], {
      startAtId: "episode-1",
      autoplay: true,
    });

    await player.next();

    expect(player.getState().currentSourceId).toBe("episode-1");
    expect(player.getState().status).not.toBe("ended");
  });

  it("unloads the active source without destroying the player", async () => {
    const player = createAudioPlayer();

    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-1",
      autoplay: true,
    });

    player.unload();

    expect(player.getState().status).toBe("idle");
    expect(player.getState().currentSource).toBeNull();
    expect(player.getState().currentSourceId).toBeNull();
    expect(player.getState().currentTime).toBe(0);
    expect(player.getState().queue.items).toEqual([episodeOne, episodeTwo]);
    expect(player.getState().queue.position.currentIndex).toBe(-1);
  });

  it("surfaces unsupported environments through the typed error state", async () => {
    vi.stubGlobal("Audio", undefined);

    const player = createAudioPlayer();

    await player.load(episodeOne);

    expect(player.getState().status).toBe("error");
    expect(player.getState().error?.code).toBe("UNSUPPORTED_ENVIRONMENT");
  });
});

describe("skip", () => {
  beforeEach(() => {
    MockAudio.instances = [];
    MockAudio.asyncLoad = false;
    MockAudio.deferLoad = false;
    vi.stubGlobal("Audio", MockAudio);
  });

  const loadAt = async (time: number, duration: number) => {
    const player = createAudioPlayer();
    await player.load(episodeOne);
    const audio = MockAudio.instances[0];
    audio.duration = duration;
    audio.currentTime = time;
    audio.dispatch("timeupdate");
    return { player, audio };
  };

  it("skips forward and back from the current position", async () => {
    const { player, audio } = await loadAt(50, 100);

    player.skip(10);
    expect(audio.currentTime).toBe(60);
    audio.dispatch("timeupdate");

    player.skip(-30);
    expect(audio.currentTime).toBe(30);
  });

  it("clamps at the start and at the known duration", async () => {
    const { player, audio } = await loadAt(5, 100);

    player.skip(-30);
    expect(audio.currentTime).toBe(0);

    audio.currentTime = 95;
    audio.dispatch("timeupdate");
    player.skip(30);
    expect(audio.currentTime).toBe(100);
  });

  it("advances from the current time while the duration is unknown", async () => {
    const { player, audio } = await loadAt(20, 0);

    player.skip(15);

    expect(audio.currentTime).toBe(35);
  });

  it("sets a seek error without a source", () => {
    const player = createAudioPlayer();

    player.skip(10);

    expect(player.getState().error?.code).toBe("SEEK_ERROR");
  });

  it("rejects NaN for skip and seek without moving", async () => {
    const { player, audio } = await loadAt(40, 100);

    player.skip(Number.NaN);
    expect(player.getState().error?.code).toBe("SEEK_ERROR");
    expect(audio.currentTime).toBe(40);

    player.seek(Number.NaN);
    expect(audio.currentTime).toBe(40);
  });
});

describe("queue navigation", () => {
  beforeEach(() => {
    MockAudio.instances = [];
    MockAudio.deferLoad = false;
    MockAudio.asyncLoad = false;
    vi.stubGlobal("Audio", MockAudio);
  });

  it("repeats the current item on ended when repeat is one", async () => {
    const player = createAudioPlayer({ initialRepeatMode: "one" });
    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-1",
      autoplay: true,
    });

    MockAudio.instances[0].dispatch("ended");

    expect(player.getState().currentSourceId).toBe("episode-1");
    expect(player.getState().status).not.toBe("ended");
  });

  it("wraps to the first item on ended when repeat is all", async () => {
    const player = createAudioPlayer({ initialRepeatMode: "all" });
    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-2",
      autoplay: true,
    });

    MockAudio.instances[0].dispatch("ended");

    expect(player.getState().currentSourceId).toBe("episode-1");
    expect(player.getState().queue.position.currentIndex).toBe(0);
  });

  it("wraps on manual next and previous when repeat is all", async () => {
    const player = createAudioPlayer({ initialRepeatMode: "all" });
    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-2",
    });

    await player.next();
    expect(player.getState().currentSourceId).toBe("episode-1");

    await player.previous();
    expect(player.getState().currentSourceId).toBe("episode-2");
  });

  it("goes to the previous item when within the restart threshold", async () => {
    const player = createAudioPlayer();
    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-2",
    });

    await player.previous();

    expect(player.getState().currentSourceId).toBe("episode-1");
  });

  it("restarts the current item when past the restart threshold", async () => {
    const player = createAudioPlayer();
    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-2",
    });

    const audio = MockAudio.instances[0];
    audio.currentTime = 10;
    audio.dispatch("timeupdate");
    await player.previous();

    expect(player.getState().currentSourceId).toBe("episode-2");
    expect(audio.currentTime).toBe(0);
  });

  it("honors a custom restart threshold", async () => {
    const player = createAudioPlayer();
    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-2",
    });

    const audio = MockAudio.instances[0];
    audio.currentTime = 10;
    audio.dispatch("timeupdate");
    await player.previous({ restartThresholdSeconds: 30 });

    expect(player.getState().currentSourceId).toBe("episode-1");
  });

  it("restarts the first item on previous when repeat is off", async () => {
    const player = createAudioPlayer();
    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-1",
    });

    await player.previous();

    expect(player.getState().currentSourceId).toBe("episode-1");
  });

  it("keeps the active item when queue items are appended or removed", async () => {
    const player = createAudioPlayer();
    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-2",
    });

    player.appendToQueue([episodeThree]);
    expect(player.getState().currentSourceId).toBe("episode-2");
    expect(player.getState().queue.position.currentIndex).toBe(1);

    player.removeFromQueue("episode-1");
    expect(player.getState().currentSourceId).toBe("episode-2");
    expect(player.getState().queue.position.currentIndex).toBe(0);
    expect(player.getState().queue.items).toEqual([episodeTwo, episodeThree]);
  });

  it("clears the queue", async () => {
    const player = createAudioPlayer();
    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-1",
    });

    player.clearQueue();

    expect(player.getState().queue.items).toEqual([]);
    expect(player.getState().queue.position.currentIndex).toBe(-1);
  });
});

describe("error handling", () => {
  it.each(["load", "unload", "destroy", "empty queue", "new play"])(
    "ignores a pending play rejection superseded by %s", async (action) => {
      const player = createAudioPlayer();
      await player.load(episodeOne);
      const audio = MockAudio.instances.at(-1)!;
      let rejectPlay!: (reason: unknown) => void;
      vi.spyOn(audio, "play").mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectPlay = reject; }));
      const errors = vi.fn();
      player.on("error", errors);
      const pending = player.play();
      if (action === "load") await player.load(episodeTwo);
      if (action === "unload") player.unload();
      if (action === "destroy") player.destroy();
      if (action === "empty queue") await player.setQueue([]);
      if (action === "new play") await player.play();
      const expected = player.getState();
      rejectPlay(new DOMException("Playback interrupted", "AbortError"));
      await pending;
      expect(player.getState()).toEqual(expected);
      expect(errors).not.toHaveBeenCalled();
    },
  );

  it("still reports a rejection from the current play request", async () => {
    const player = createAudioPlayer();
    await player.load(episodeOne);
    vi.spyOn(MockAudio.instances.at(-1)!, "play").mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
    await player.play();
    expect(player.getState().status).toBe("error");
    expect(player.getState().error?.code).toBe("PLAY_ERROR");
  });

  it("does not report a cancelled pending play as an error after pause", async () => {
    const player = createAudioPlayer();
    await player.load(episodeOne);
    const audio = MockAudio.instances.at(-1)!;
    let rejectPlay!: (reason: unknown) => void;
    vi.spyOn(audio, "play").mockImplementation(() => {
      audio.dispatch("play");
      return new Promise<void>((_, reject) => { rejectPlay = reject; });
    });
    const errors = vi.fn();
    player.on("error", errors);
    const pending = player.play();
    player.pause();
    rejectPlay(new DOMException("Playback interrupted by pause", "AbortError"));
    await pending;
    expect(player.getState().status).toBe("paused");
    expect(player.getState().error).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    MockAudio.instances = [];
    MockAudio.deferLoad = false;
    MockAudio.asyncLoad = false;
    vi.stubGlobal("Audio", MockAudio);
  });

  it("reports a typed error on invalid input and clears it on the next success", async () => {
    const player = createAudioPlayer();

    player.setVolume(5);
    expect(player.getState().error?.code).toBe("INVALID_VOLUME");

    await player.load(episodeOne);
    expect(player.getState().error).toBeNull();
    expect(player.getState().status).toBe("ready");
  });

  it("recovers from a failed load by loading another source", async () => {
    const player = createAudioPlayer();
    await player.load(episodeOne);

    const audio = MockAudio.instances[0];
    audio.error = { code: 4, message: "bad source" } as MediaError;
    audio.dispatch("error");
    expect(player.getState().status).toBe("error");
    expect(player.getState().error?.code).toBe("LOAD_ERROR");

    audio.error = null;
    await player.load(episodeTwo);
    expect(player.getState().status).toBe("ready");
    expect(player.getState().error).toBeNull();
    expect(player.getState().currentSourceId).toBe("episode-2");
  });
});

describe("localStorage persistence adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves, loads, and clears browser storage", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    } });
    const adapter = createLocalStoragePersistenceAdapter("player");
    const saved = persistedState();
    adapter.save(saved);
    expect(adapter.load()).toEqual(saved);
    adapter.clear();
    expect(adapter.load()).toBeNull();
  });

  it("handles a denied storage getter", () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("denied"); } });
    const adapter = createLocalStoragePersistenceAdapter("player");
    expect(adapter.load()).toBeNull();
    expect(() => adapter.save(persistedState())).not.toThrow();
    expect(() => adapter.clear()).not.toThrow();
  });

  it("does not interrupt playback when storage methods fail", () => {
    const fail = () => { throw new Error("storage unavailable"); };
    vi.stubGlobal("window", { localStorage: { getItem: fail, setItem: fail, removeItem: fail } });
    const adapter = createLocalStoragePersistenceAdapter("player");
    expect(adapter.load()).toBeNull();
    expect(() => adapter.save(persistedState())).not.toThrow();
    expect(() => adapter.clear()).not.toThrow();
  });
});

describe("attachAudioPlayerPersistence", () => {
  beforeEach(() => {
    MockAudio.instances = [];
    MockAudio.deferLoad = false;
    MockAudio.asyncLoad = true;
    vi.stubGlobal("Audio", MockAudio);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("restores queue, repeat mode, volume, mute, rate and position without autoplay when the source is already loaded", async () => {
    const adapter = createMemoryAdapter(persistedState());
    const player = createAudioPlayer();
    const persistence = attachAudioPlayerPersistence(player, {
      adapter,
      autoRestore: false,
    });

    await persistence.restore();

    const state = player.getState();
    const audio = MockAudio.instances[0];
    expect(state.currentSourceId).toBe("episode-2");
    expect(state.queue.items).toEqual([episodeOne, episodeTwo, episodeThree]);
    expect(state.queue.position.repeatMode).toBe("all");
    expect(state.queue.position.currentIndex).toBe(1);
    expect(state.volume).toBe(0.4);
    expect(state.muted).toBe(true);
    expect(state.rate).toBe(1.5);
    expect(audio.currentTime).toBe(42);
    expect(state.status).not.toBe("playing");
  });

  it("waits for a delayed load before seeking to the restored position", async () => {
    MockAudio.deferLoad = true;
    const adapter = createMemoryAdapter(persistedState());
    const player = createAudioPlayer();
    const persistence = attachAudioPlayerPersistence(player, {
      adapter,
      autoRestore: false,
    });

    let settled = false;
    const restoring = persistence.restore().then(() => {
      settled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const audio = MockAudio.instances[0];
    expect(player.getState().status).toBe("loading");
    expect(settled).toBe(false);
    expect(audio.currentTime).toBe(0);

    audio.dispatch("loadedmetadata");
    await restoring;

    expect(settled).toBe(true);
    expect(player.getState().currentSourceId).toBe("episode-2");
    expect(player.getState().status).not.toBe("loading");
    expect(audio.currentTime).toBe(42);
  });

  it("drops expired persisted state", async () => {
    const adapter = createMemoryAdapter(
      persistedState({ savedAt: Date.now() - 10_000 }),
    );
    const player = createAudioPlayer();
    const persistence = attachAudioPlayerPersistence(player, {
      adapter,
      autoRestore: false,
      maxAgeMs: 1000,
    });

    expect(await persistence.restore()).toBeNull();
    expect(adapter.clear).toHaveBeenCalled();
    expect(player.getState().currentSource).toBeNull();
  });

  it("does not restore when autoRestore is false", () => {
    const adapter = createMemoryAdapter(persistedState());
    attachAudioPlayerPersistence(createAudioPlayer(), {
      adapter,
      autoRestore: false,
    });

    expect(adapter.load).not.toHaveBeenCalled();
  });

  it("saves on pause, source change and queue change", async () => {
    MockAudio.asyncLoad = false;
    const adapter = createMemoryAdapter();
    const player = createAudioPlayer();
    attachAudioPlayerPersistence(player, { adapter, autoRestore: false });

    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-1",
    });
    expect(adapter.save).toHaveBeenCalled();
    expect(adapter.save.mock.lastCall?.[0].currentSourceId).toBe("episode-1");

    adapter.save.mockClear();
    await player.play();
    player.pause();
    expect(adapter.save).toHaveBeenCalled();
  });

  it("saves on an interval while playing and stops after pause", async () => {
    vi.useFakeTimers();
    MockAudio.asyncLoad = false;
    const adapter = createMemoryAdapter();
    const player = createAudioPlayer();
    attachAudioPlayerPersistence(player, {
      adapter,
      autoRestore: false,
      saveIntervalMs: 1000,
    });

    await player.load(episodeOne);
    await player.play();
    adapter.save.mockClear();

    vi.advanceTimersByTime(3000);
    expect(adapter.save).toHaveBeenCalledTimes(3);

    player.pause();
    adapter.save.mockClear();
    vi.advanceTimersByTime(3000);
    expect(adapter.save).not.toHaveBeenCalled();
  });

  it("stops saving after destroy", async () => {
    MockAudio.asyncLoad = false;
    const adapter = createMemoryAdapter();
    const player = createAudioPlayer();
    const persistence = attachAudioPlayerPersistence(player, {
      adapter,
      autoRestore: false,
    });

    await player.load(episodeOne);
    persistence.destroy();
    adapter.save.mockClear();
    player.pause();

    expect(adapter.save).not.toHaveBeenCalled();
  });
});

describe("attachAudioPlayerProgressReporter", () => {
  beforeEach(() => {
    MockAudio.instances = [];
    MockAudio.deferLoad = false;
    MockAudio.asyncLoad = false;
    vi.stubGlobal("Audio", MockAudio);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not report without a source", () => {
    const onReport = vi.fn();
    const player = createAudioPlayer();
    const reporter = attachAudioPlayerProgressReporter(player, { onReport });

    reporter.report();

    expect(onReport).not.toHaveBeenCalled();
  });

  it("reports source identity, time, fraction, status and queue position", async () => {
    const onReport = vi.fn();
    const player = createAudioPlayer();
    const reporter = attachAudioPlayerProgressReporter(player, { onReport });
    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-2",
    });

    const audio = MockAudio.instances[0];
    audio.duration = 200;
    audio.currentTime = 50;
    audio.dispatch("timeupdate");
    onReport.mockClear();
    reporter.report();

    const snapshot = onReport.mock.lastCall?.[0];
    expect(snapshot.sourceId).toBe("episode-2");
    expect(snapshot.currentTime).toBe(50);
    expect(snapshot.duration).toBe(200);
    expect(snapshot.playedFraction).toBe(0.25);
    expect(snapshot.status).toBeDefined();
    expect(snapshot.queue.currentIndex).toBe(1);
  });

  it("reports on pause, seek, source change and ended", async () => {
    const onReport = vi.fn();
    const player = createAudioPlayer();
    attachAudioPlayerProgressReporter(player, { onReport });

    await player.load(episodeOne);
    expect(onReport).toHaveBeenCalled();

    const audio = MockAudio.instances[0];
    await player.play();
    onReport.mockClear();
    player.pause();
    expect(onReport).toHaveBeenCalledTimes(1);

    audio.dispatch("seeked");
    expect(onReport).toHaveBeenCalledTimes(2);

    audio.dispatch("ended");
    expect(onReport).toHaveBeenCalledTimes(3);
  });

  it("reports on the configured interval while playing only", async () => {
    vi.useFakeTimers();
    const onReport = vi.fn();
    const player = createAudioPlayer();
    attachAudioPlayerProgressReporter(player, { onReport, intervalMs: 1000 });

    await player.load(episodeOne);
    await player.play();
    onReport.mockClear();

    vi.advanceTimersByTime(3000);
    expect(onReport).toHaveBeenCalledTimes(3);

    player.pause();
    onReport.mockClear();
    vi.advanceTimersByTime(3000);
    expect(onReport).not.toHaveBeenCalled();
  });

  it("stops reporting after destroy", async () => {
    const onReport = vi.fn();
    const player = createAudioPlayer();
    const reporter = attachAudioPlayerProgressReporter(player, { onReport });

    await player.load(episodeOne);
    reporter.destroy();
    onReport.mockClear();
    await player.load(episodeTwo);

    expect(onReport).not.toHaveBeenCalled();
  });
});

describe("attachAudioPlayerMediaSession", () => {
  class MockMediaMetadata {
    constructor(
      public init: {
        title: string;
        artist: string;
        album: string;
        artwork: Array<{ src: string; sizes: string }>;
      },
    ) {}
  }

  const createMediaSession = () => {
    const handlers = new Map<string, ((details: unknown) => void) | null>();
    return {
      handlers,
      metadata: null as MockMediaMetadata | null,
      playbackState: "none",
      setPositionState: vi.fn(),
      setActionHandler: vi.fn(
        (action: string, handler: ((details: unknown) => void) | null) => {
          handlers.set(action, handler);
        },
      ),
    };
  };

  let session: ReturnType<typeof createMediaSession>;

  const runHandler = (action: string, details: unknown = {}) => {
    const handler = session.handlers.get(action);
    expect(handler).toBeTypeOf("function");
    handler?.(details);
  };

  beforeEach(() => {
    MockAudio.instances = [];
    MockAudio.asyncLoad = false;
    MockAudio.deferLoad = false;
    vi.stubGlobal("Audio", MockAudio);
    session = createMediaSession();
    vi.stubGlobal("navigator", { mediaSession: session });
    vi.stubGlobal("MediaMetadata", MockMediaMetadata);
  });

  it("degrades silently when Media Session is unsupported", async () => {
    vi.stubGlobal("navigator", {});
    const player = createAudioPlayer();
    const controller = attachAudioPlayerMediaSession(player);

    await player.load(episodeOne);

    expect(() => controller.sync()).not.toThrow();
    expect(() => controller.destroy()).not.toThrow();
  });

  it("updates metadata and playback state with the source", async () => {
    const player = createAudioPlayer();
    attachAudioPlayerMediaSession(player);
    expect(session.metadata).toBeNull();
    expect(session.playbackState).toBe("none");

    await player.load({
      ...episodeOne,
      artist: "Artist",
      album: "Album",
      artwork: "https://example.com/art.png",
    });

    expect(session.metadata?.init.title).toBe("Episode 1");
    expect(session.metadata?.init.artist).toBe("Artist");
    expect(session.metadata?.init.album).toBe("Album");
    expect(session.metadata?.init.artwork).toHaveLength(1);
    expect(session.metadata?.init.artwork[0]).toEqual({
      src: "https://example.com/art.png",
      sizes: "96x96 128x128 192x192 256x256 384x384 512x512",
    });
    expect(session.playbackState).toBe("paused");

    await player.play();
    expect(session.playbackState).toBe("playing");

    player.unload();
    expect(session.metadata).toBeNull();
    expect(session.playbackState).toBe("none");
  });

  it("uses custom artwork sizes", async () => {
    const player = createAudioPlayer();
    attachAudioPlayerMediaSession(player, { artworkSizes: [64, 128] });

    await player.load({ ...episodeOne, artwork: "https://example.com/a.png" });

    expect(session.metadata?.init.artwork.map((image) => image.sizes)).toEqual([
      "64x64 128x128",
    ]);
  });

  it("does not replace metadata or position during ordinary playback updates", async () => {
    const player = createAudioPlayer();
    await player.load({ ...episodeOne, artwork: "https://example.com/art.png" });
    const audio = MockAudio.instances[0];
    audio.duration = 100;
    audio.dispatch("timeupdate");
    let metadata = session.metadata;
    const setMetadata = vi.fn((value: MockMediaMetadata | null) => { metadata = value; });
    Object.defineProperty(session, "metadata", { get: () => metadata, set: setMetadata });
    let playbackState = session.playbackState;
    const setPlaybackState = vi.fn((value: string) => { playbackState = value; });
    Object.defineProperty(session, "playbackState", { get: () => playbackState, set: setPlaybackState });
    const controller = attachAudioPlayerMediaSession(player);
    await player.play();
    session.setPositionState.mockClear();
    setPlaybackState.mockClear();
    for (let position = 1; position <= 10; position++) {
      audio.currentTime = position;
      audio.dispatch("timeupdate");
      audio.dispatch("progress");
    }
    player.setVolume(0.5);
    expect(setMetadata).toHaveBeenCalledTimes(1);
    expect(session.setPositionState).not.toHaveBeenCalled();
    expect(setPlaybackState).not.toHaveBeenCalled();
    controller.sync();
    expect(setMetadata).toHaveBeenCalledTimes(1);
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 100, playbackRate: 1, position: 10 });
  });

  it("detects metadata edits on the same source and clears artwork on removal", async () => {
    const player = createAudioPlayer();
    const controller = attachAudioPlayerMediaSession(player);
    const source = { ...episodeOne, artist: "Artist", album: "Album", artwork: "https://example.com/a.png" };
    await player.load(source);
    for (const [key, value] of Object.entries({ title: "New title", artist: "New artist", album: "New album", artwork: "https://example.com/b.png" })) {
      const previous = session.metadata;
      Object.assign(source, { [key]: value });
      controller.sync();
      expect(session.metadata).not.toBe(previous);
    }
    source.artwork = "";
    controller.sync();
    expect(session.metadata?.init.artwork).toEqual([]);
    await player.load(episodeTwo);
    expect(session.metadata?.init.title).toBe("Episode 2");
    player.unload();
    expect(session.metadata).toBeNull();
  });

  it("refreshes position after seeks, rate changes, pause, and duration changes", async () => {
    const player = createAudioPlayer();
    const controller = attachAudioPlayerMediaSession(player);
    await player.load(episodeOne);
    const audio = MockAudio.instances[0];
    audio.duration = 100;
    audio.dispatch("timeupdate");
    await player.play();
    session.setPositionState.mockClear();
    audio.currentTime = 42;
    audio.dispatch("seeked");
    expect(session.setPositionState).toHaveBeenCalledTimes(1);
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 100, playbackRate: 1, position: 42 });
    audio.playbackRate = 1.5;
    audio.dispatch("ratechange");
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 100, playbackRate: 1.5, position: 42 });
    audio.currentTime = 45;
    player.pause();
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 100, playbackRate: 1.5, position: 45 });
    audio.duration = 120;
    audio.dispatch("timeupdate");
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 120, playbackRate: 1.5, position: 45 });
    controller.destroy();
    session.setPositionState.mockClear();
    audio.dispatch("seeked");
    controller.sync();
    expect(session.setPositionState).not.toHaveBeenCalled();
  });

  it("keeps metadata working when position updates are unsupported", async () => {
    session.setPositionState.mockImplementation(() => { throw new TypeError("unsupported"); });
    const player = createAudioPlayer();
    const controller = attachAudioPlayerMediaSession(player, { artworkSizes: [] });
    await player.load({ ...episodeOne, artwork: "https://example.com/a.png" });
    expect(session.metadata?.init.artwork).toEqual([]);
    expect(() => controller.sync()).not.toThrow();
    expect(() => controller.destroy()).not.toThrow();
  });

  it("syncs position state when a duration is known and clears it otherwise", async () => {
    const player = createAudioPlayer();
    const controller = attachAudioPlayerMediaSession(player);
    await player.load(episodeOne);

    const audio = MockAudio.instances[0];
    audio.duration = 100;
    audio.currentTime = 20;
    audio.dispatch("timeupdate");
    controller.sync();

    expect(session.setPositionState).toHaveBeenLastCalledWith({
      duration: 100,
      playbackRate: 1,
      position: 20,
    });

    player.unload();
    expect(session.setPositionState).toHaveBeenLastCalledWith();
  });

  it("wires play, pause, stop, next and previous to the player", async () => {
    const player = createAudioPlayer();
    attachAudioPlayerMediaSession(player);
    await player.setQueue([episodeOne, episodeTwo], {
      startAtId: "episode-1",
    });

    runHandler("play");
    await Promise.resolve();
    expect(player.getState().status).toBe("playing");

    runHandler("pause");
    expect(player.getState().status).toBe("paused");

    runHandler("nexttrack");
    await Promise.resolve();
    expect(player.getState().currentSourceId).toBe("episode-2");

    runHandler("previoustrack");
    await Promise.resolve();
    expect(player.getState().currentSourceId).toBe("episode-1");

    await player.play();
    runHandler("stop");
    expect(player.getState().status).toBe("paused");
  });

  it("seeks with seekbackward, seekforward and seekto", async () => {
    const player = createAudioPlayer();
    attachAudioPlayerMediaSession(player, { seekOffsetSeconds: 15 });
    await player.load(episodeOne);

    const audio = MockAudio.instances[0];
    audio.duration = 100;
    audio.currentTime = 50;
    audio.dispatch("timeupdate");

    runHandler("seekforward");
    expect(audio.currentTime).toBe(65);
    audio.dispatch("timeupdate");

    runHandler("seekbackward");
    expect(audio.currentTime).toBe(50);
    audio.dispatch("timeupdate");

    runHandler("seekto", { seekTime: 80 });
    expect(audio.currentTime).toBe(80);

    runHandler("seekto", {});
    expect(audio.currentTime).toBe(80);
  });

  it("clamps seeking to the start and the end", async () => {
    const player = createAudioPlayer();
    attachAudioPlayerMediaSession(player);
    await player.load(episodeOne);

    const audio = MockAudio.instances[0];
    audio.duration = 100;
    audio.currentTime = 3;
    audio.dispatch("timeupdate");
    runHandler("seekbackward");
    expect(audio.currentTime).toBe(0);

    audio.currentTime = 95;
    audio.dispatch("timeupdate");
    runHandler("seekforward");
    expect(audio.currentTime).toBe(100);
  });

  it("ignores actions the browser does not support", async () => {
    session.setActionHandler.mockImplementation(() => {
      throw new TypeError("unsupported action");
    });
    const player = createAudioPlayer();

    expect(() => attachAudioPlayerMediaSession(player)).not.toThrow();
  });

  it("removes handlers and clears state on destroy", async () => {
    const player = createAudioPlayer();
    const controller = attachAudioPlayerMediaSession(player);
    await player.load(episodeOne);

    controller.destroy();

    for (const handler of session.handlers.values()) {
      expect(handler).toBeNull();
    }
    expect(session.metadata).toBeNull();
    expect(session.playbackState).toBe("none");

    await player.load(episodeTwo);
    expect(session.metadata).toBeNull();
  });
});

describe("cue controller", () => {
  beforeEach(() => {
    MockAudio.instances = [];
    MockAudio.deferLoad = false;
    MockAudio.asyncLoad = false;
    vi.stubGlobal("Audio", MockAudio);
  });
  afterEach(() => vi.unstubAllGlobals());

  const ranges: AudioPlayerCue<string>[] = [
    { id: "intro", start: 0, end: 2, data: "Intro" },
    { id: "note", start: 1, end: 3, data: "Note" },
    { id: "last", start: 4, data: "Last" },
  ];
  const position = (time: number, event = "timeupdate") => {
    const audio = MockAudio.instances[0];
    audio.currentTime = time;
    audio.dispatch(event);
  };

  it("publishes a stable initial snapshot and orders overlapping transitions", async () => {
    const player = createAudioPlayer();
    await player.load(episodeOne);
    const controller = attachAudioPlayerCues(player, { getCues: () => ranges });
    const listener = vi.fn();
    controller.subscribe(listener);
    const initial = controller.getSnapshot();
    expect(initial.activeCues.map((cue) => cue.id)).toEqual(["intro"]);
    position(0.5);
    player.setVolume(0.5);
    expect(controller.getSnapshot()).toBe(initial);
    expect(listener).toHaveBeenCalledTimes(1);
    const transitions: string[] = [];
    controller.on("cueexit", ({ cue }) => transitions.push(`exit:${cue.id}`));
    controller.on("cueenter", ({ cue }) => transitions.push(`enter:${cue.id}`));
    position(1);
    expect(controller.getSnapshot().activeCues.map((cue) => cue.id)).toEqual(["intro", "note"]);
    position(2);
    position(4);
    expect(transitions).toEqual(["enter:note", "exit:intro", "exit:note", "enter:last"]);
    controller.destroy();
    expect(controller.getSnapshot()).toEqual({ sourceId: null, activeCues: [] });
    const calls = listener.mock.calls.length;
    position(0);
    controller.refresh();
    expect(listener).toHaveBeenCalledTimes(calls);
    player.destroy();
  });

  it("coalesces seeks at their final destination without entering crossed cues", async () => {
    const player = createAudioPlayer();
    await player.load(episodeOne);
    const controller = attachAudioPlayerCues(player, { getCues: () => ranges });
    const entered = vi.fn();
    controller.on("cueenter", entered);
    player.seek(1);
    position(1);
    player.seek(4.5);
    position(4.5);
    expect(entered).not.toHaveBeenCalled();
    position(4.5, "seeked");
    expect(entered.mock.calls.map(([event]) => event.cue.id)).toEqual(["last"]);
    player.setRate(2);
    expect(controller.getSnapshot().activeCues[0].id).toBe("last");
    player.seek(0);
    position(0, "seeked");
    expect(controller.getSnapshot().activeCues[0].id).toBe("intro");
    player.destroy();
  });

  it("supports late attachment, refresh, and atomic rejection of invalid replacement", async () => {
    const player = createAudioPlayer();
    await player.load(episodeOne);
    position(4);
    let metadata = ranges;
    const getCues = vi.fn(() => metadata);
    const controller = attachAudioPlayerCues(player, { getCues });
    expect(controller.getSnapshot().activeCues[0].id).toBe("last");
    metadata = [{ id: "replacement", start: 3, end: 5, data: "Revised" }];
    controller.refresh();
    expect(controller.getSnapshot().activeCues[0].data).toBe("Revised");
    metadata = [{ id: "invalid", start: NaN, data: "Invalid" }];
    expect(() => controller.refresh()).toThrow(RangeError);
    position(4.5);
    expect(controller.getSnapshot().activeCues[0].data).toBe("Revised");
    metadata = [];
    controller.refresh();
    expect(controller.getSnapshot().activeCues).toEqual([]);
    player.destroy();
  });

  it("clears at the media end and rebuilds cues on repeat, queue transitions and unload", async () => {
    const player = createAudioPlayer();
    await player.setQueue([episodeOne, episodeTwo]);
    const controller = attachAudioPlayerCues(player, { getCues: () => ranges });
    player.setRepeatMode("one");
    position(4);
    MockAudio.instances[0].dispatch("ended");
    await Promise.resolve();
    expect(controller.getSnapshot().activeCues[0].id).toBe("intro");
    player.setRepeatMode("off");
    MockAudio.instances[0].dispatch("ended");
    await Promise.resolve();
    expect(controller.getSnapshot().sourceId).toBe(episodeTwo.id);
    position(4);
    MockAudio.instances[0].duration = 5;
    position(5);
    expect(controller.getSnapshot().activeCues).toEqual([]);
    position(4);
    MockAudio.instances[0].dispatch("ended");
    expect(controller.getSnapshot().activeCues).toEqual([]);
    player.unload();
    expect(controller.getSnapshot()).toEqual({ sourceId: null, activeCues: [] });
    player.destroy();
  });

  it.each([
    [{ id: "", start: 0, data: null }],
    [{ id: "x", start: -1, data: null }],
    [{ id: "x", start: 0, end: Infinity, data: null }],
    [{ id: "x", start: 1, end: 1, data: null }],
    [{ id: "x", start: 0, data: null }, { id: "x", start: 2, data: null }],
  ])("rejects invalid cue lists without leaving a subscription: %j", async (...invalid) => {
    const player = createAudioPlayer();
    await player.load(episodeOne);
    const subscribe = vi.spyOn(player, "subscribe");
    expect(() => attachAudioPlayerCues(player, { getCues: () => invalid })).toThrow(RangeError);
    expect(subscribe).not.toHaveBeenCalled();
    player.destroy();
  });

  it.each([false, true])("enters once per queue load, reload, and repeat with deferred metadata: %s", async (deferred) => {
    MockAudio.deferLoad = deferred;
    const player = createAudioPlayer();
    const controller = attachAudioPlayerCues(player, { getCues: () => ranges });
    const entered = vi.fn();
    controller.on("cueenter", entered);
    await player.setQueue([episodeOne]);
    expect(entered.mock.calls.map(([event]) => event.cue.id)).toEqual(["intro"]);
    if (deferred) {
      expect(player.getState().status).toBe("loading");
      MockAudio.instances[0].dispatch("loadedmetadata");
      expect(entered).toHaveBeenCalledTimes(1);
      MockAudio.deferLoad = false;
    }
    await player.load(episodeOne);
    expect(entered).toHaveBeenCalledTimes(2);
    player.setRepeatMode("one");
    MockAudio.instances[0].dispatch("ended");
    await Promise.resolve();
    expect(entered).toHaveBeenCalledTimes(3);
    player.destroy();
  });

  it("stops a superseded publication when an exit listener unloads the player", async () => {
    const player = createAudioPlayer();
    await player.load(episodeOne);
    const controller = attachAudioPlayerCues(player, { getCues: () => ranges });
    const entered = vi.fn();
    const staleExit = vi.fn();
    controller.on("cueexit", ({ cue }) => {
      if (cue.id === "intro") player.unload();
    });
    controller.on("cueexit", ({ cue }) => {
      if (cue.id === "intro") staleExit();
    });
    controller.on("cueenter", entered);
    position(4);
    expect(entered).not.toHaveBeenCalled();
    expect(staleExit).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({ sourceId: null, activeCues: [] });
    player.destroy();
  });

  it.each(["destroy", "unload"])("does not restore content after %s in an exit listener during reset", async (action) => {
    const player = createAudioPlayer();
    await player.load(episodeOne);
    const controller = attachAudioPlayerCues(player, { getCues: () => ranges });
    const entered = vi.fn();
    controller.on("cueenter", entered);
    controller.on("cueexit", () => {
      if (action === "destroy") controller.destroy();
      else player.unload();
    });
    await player.load(episodeTwo);
    expect(controller.getSnapshot()).toEqual({ sourceId: null, activeCues: [] });
    expect(entered).not.toHaveBeenCalled();
    player.destroy();
  });

  it.each(["destroy", "unload"])("stops remaining callbacks after %s in an enter listener", async (action) => {
    const player = createAudioPlayer();
    await player.load(episodeOne);
    const controller = attachAudioPlayerCues(player, { getCues: () => ranges });
    const staleEnter = vi.fn();
    controller.on("cueenter", () => {
      if (action === "destroy") controller.destroy();
      else player.unload();
    });
    controller.on("cueenter", staleEnter);
    position(1);
    expect(staleEnter).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({ sourceId: null, activeCues: [] });
    player.destroy();
  });

  it("finds active intervals in a large ordered transcript", async () => {
    const player = createAudioPlayer();
    await player.load(episodeOne);
    const transcript = Array.from({ length: 10000 }, (_, i) => ({
      id: String(i),
      get start() { reads++; return i; },
      get end() { reads++; return i + 1; },
      data: i,
    }));
    let reads = 0;
    const controller = attachAudioPlayerCues(player, { getCues: () => [
      { id: "long", start: 0, data: -1 }, ...transcript,
    ] });
    reads = 0;
    position(9998.5);
    expect(controller.getSnapshot().activeCues.map((cue) => cue.data)).toEqual([-1, 9998]);
    expect(reads).toBeLessThan(100);
    position(250.5);
    expect(controller.getSnapshot().activeCues.map((cue) => cue.data)).toEqual([-1, 250]);
    player.destroy();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  createAudioPlayer,
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

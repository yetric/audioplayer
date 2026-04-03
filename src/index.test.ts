import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAudioPlayer } from "./index";

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

describe("createAudioPlayer", () => {
  beforeEach(() => {
    MockAudio.instances = [];
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

// @vitest-environment jsdom
import { StrictMode, act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAudioPlayer,
  attachAudioPlayerCues,
  type AudioPlayer,
  type AudioPlayerState,
  type PersistedPlayerState,
} from "./index";
import { AudioPlayerProvider, useAudioPlayer, useAudioPlayerState, useAudioPlayerProgress, useAudioPlayerCues } from "./react";

class FakeAudio {
  static instances: FakeAudio[] = [];

  constructor() {
    FakeAudio.instances.push(this);
  }

  src = "";
  currentTime = 0;
  duration = 0;
  playbackRate = 1;
  volume = 1;
  muted = false;
  preload = "";
  error: MediaError | null = null;
  buffered = { length: 0 } as TimeRanges;

  private listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new Event(type));
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

const episode = {
  id: "episode-1",
  src: "https://example.com/episode-1.mp3",
  title: "Episode 1",
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("react adapter", () => {
  let container: HTMLDivElement;
  let root: Root;
  let captured: { player: AudioPlayer | null; state: AudioPlayerState | null };

  const Probe = () => {
    captured.player = useAudioPlayer();
    captured.state = useAudioPlayerState();
    return null;
  };

  const render = (element: React.ReactElement): void => {
    act(() => {
      root.render(element);
    });
  };

  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal("Audio", FakeAudio);
    captured = { player: null, state: null };
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("throws when used outside the provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(
      "useAudioPlayer must be used inside AudioPlayerProvider.",
    );

    consoleError.mockRestore();
  });

  it("creates a player from options and exposes its state", () => {
    render(
      <AudioPlayerProvider options={{ initialVolume: 0.3 }}>
        <Probe />
      </AudioPlayerProvider>,
    );

    expect(captured.state?.volume).toBe(0.3);
    expect(captured.state?.status).toBe("idle");
  });

  it("re-renders subscribers when the player state changes", async () => {
    render(
      <AudioPlayerProvider>
        <Probe />
      </AudioPlayerProvider>,
    );

    await act(async () => {
      await captured.player?.load(episode);
    });

    expect(captured.state?.currentSourceId).toBe("episode-1");
    expect(captured.state?.status).toBe("ready");
  });

  it("uses a provided player and does not destroy it on unmount", async () => {
    const player = createAudioPlayer();
    const destroy = vi.spyOn(player, "destroy");

    render(
      <AudioPlayerProvider player={player}>
        <Probe />
      </AudioPlayerProvider>,
    );
    expect(captured.player).toBe(player);

    act(() => {
      root.unmount();
    });
    expect(destroy).not.toHaveBeenCalled();

    root = createRoot(container);
  });

  it("destroys a player it created when unmounted", async () => {
    render(
      <AudioPlayerProvider>
        <Probe />
      </AudioPlayerProvider>,
    );
    const player = captured.player as AudioPlayer;
    const destroy = vi.spyOn(player, "destroy");

    await act(async () => {
      root.unmount();
    });

    expect(destroy).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });

  it("keeps a created player usable under StrictMode", async () => {
    render(
      <StrictMode>
        <AudioPlayerProvider>
          <Probe />
        </AudioPlayerProvider>
      </StrictMode>,
    );

    await act(async () => {
      await captured.player?.load(episode);
    });

    expect(captured.state?.currentSourceId).toBe("episode-1");
    expect(captured.state?.status).toBe("ready");
  });

  it("still destroys a StrictMode-created player on real unmount", async () => {
    render(
      <StrictMode>
        <AudioPlayerProvider>
          <Probe />
        </AudioPlayerProvider>
      </StrictMode>,
    );
    await act(async () => {});
    const destroy = vi.spyOn(captured.player as AudioPlayer, "destroy");

    await act(async () => {
      root.unmount();
    });

    expect(destroy).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });

  it("keeps destination subscriptions usable across StrictMode replay and closes pending selection on real unmount", async () => {
    let resolve!: (device: { deviceId: string }) => void;
    vi.stubGlobal("navigator", { mediaDevices: {
      selectAudioOutput: () => new Promise((done) => { resolve = done; }),
    } });
    const changes = vi.fn();
    const detach = vi.fn();
    const Output = () => {
      const player = useAudioPlayer();
      captured.player = player;
      useEffect(() => {
        const unsubscribe = player.destinations().subscribe(changes);
        return () => { unsubscribe(); detach(); };
      }, [player]);
      return null;
    };
    render(<StrictMode><AudioPlayerProvider><Output /></AudioPlayerProvider></StrictMode>);
    await act(async () => {});
    expect(detach).toHaveBeenCalledTimes(1);
    const audio = FakeAudio.instances.at(-1) as FakeAudio & { setSinkId: ReturnType<typeof vi.fn> };
    audio.setSinkId = vi.fn(async () => {});
    const route = captured.player!.destinations();
    expect((await route.setOutput("")).status).toBe("applied");
    const pending = route.selectOutput();
    await act(async () => { root.unmount(); });
    expect(detach).toHaveBeenCalledTimes(2);
    const count = changes.mock.calls.length;
    resolve({ deviceId: "speaker" });
    expect((await pending).status).toBe("destroyed");
    expect(audio.setSinkId).toHaveBeenCalledTimes(1);
    expect(changes).toHaveBeenCalledTimes(count);
    root = createRoot(container);
  });

  describe("useAudioPlayerState selector", () => {
    it("does not re-render when the selected value is unchanged", async () => {
      const player = createAudioPlayer();
      await player.load(episode);
      const audio = FakeAudio.instances[0];
      let renders = 0;
      let status: string | null = null;

      const StatusProbe = () => {
        renders += 1;
        status = useAudioPlayerState((state) => state.status);
        return null;
      };

      render(
        <AudioPlayerProvider player={player}>
          <StatusProbe />
        </AudioPlayerProvider>,
      );
      const initialRenders = renders;
      expect(status).toBe("ready");

      act(() => {
        audio.currentTime = 5;
        audio.dispatch("timeupdate");
      });
      expect(renders).toBe(initialRenders);

      await act(async () => {
        await player.play();
      });
      expect(status).toBe("playing");
      expect(renders).toBeGreaterThan(initialRenders);
    });

    it("keeps a stable value with a custom equality check", async () => {
      const player = createAudioPlayer();
      await player.load(episode);
      const audio = FakeAudio.instances[0];
      const seen: Array<{ id: string | null }> = [];

      const IdProbe = () => {
        seen.push(
          useAudioPlayerState(
            (state) => ({ id: state.currentSourceId }),
            (a, b) => a.id === b.id,
          ),
        );
        return null;
      };

      render(
        <AudioPlayerProvider player={player}>
          <IdProbe />
        </AudioPlayerProvider>,
      );
      const first = seen[seen.length - 1];

      act(() => {
        audio.currentTime = 5;
        audio.dispatch("timeupdate");
      });

      expect(seen[seen.length - 1]).toBe(first);
    });

    it("returns the whole state without a selector", async () => {
      const player = createAudioPlayer();
      await player.load(episode);

      render(
        <AudioPlayerProvider player={player}>
          <Probe />
        </AudioPlayerProvider>,
      );

      expect(captured.state).toBe(player.getState());
    });
  });

  describe("useAudioPlayerProgress", () => {
    it("coalesces updates, flushes on pause and seek, and cancels pending work on unmount", async () => {
      vi.useFakeTimers();
      const player = createAudioPlayer();
      await player.load(episode);
      await player.play();
      const audio = FakeAudio.instances[0];
      let time = -1;
      let renders = 0;
      const Progress = () => {
        time = useAudioPlayerProgress({ intervalMs: 500 }).currentTime;
        renders += 1;
        return null;
      };
      render(<AudioPlayerProvider player={player}><Progress /></AudioPlayerProvider>);
      const initialRenders = renders;
      act(() => vi.advanceTimersByTime(1000));
      expect(renders).toBe(initialRenders);

      act(() => {
        audio.currentTime = 1;
        audio.dispatch("timeupdate");
        vi.advanceTimersByTime(250);
        audio.currentTime = 2;
        audio.dispatch("timeupdate");
      });
      expect(time).toBe(0);
      act(() => vi.advanceTimersByTime(250));
      expect(time).toBe(2);
      expect(renders).toBe(initialRenders + 1);

      act(() => {
        audio.currentTime = 3;
        audio.dispatch("timeupdate");
        player.pause();
      });
      expect(time).toBe(3);
      act(() => {
        audio.currentTime = 10;
        audio.dispatch("seeked");
      });
      expect(time).toBe(10);
      act(() => {
        audio.currentTime = 11;
        audio.dispatch("timeupdate");
      });
      expect(vi.getTimerCount()).toBe(1);
      act(() => root.unmount());
      expect(vi.getTimerCount()).toBe(0);
      root = createRoot(container);
      player.destroy();
    });

    it("updates immediately for a replacement source and uses a changed interval", async () => {
      vi.useFakeTimers();
      const player = createAudioPlayer();
      await player.load(episode);
      let time = -1;
      const Progress = ({ intervalMs }: { intervalMs: number }) => {
        time = useAudioPlayerProgress({ intervalMs }).currentTime;
        return null;
      };
      const screen = (intervalMs: number) => <AudioPlayerProvider player={player}><Progress intervalMs={intervalMs} /></AudioPlayerProvider>;
      render(screen(500));
      act(() => {
        FakeAudio.instances[0].currentTime = 20;
        FakeAudio.instances[0].dispatch("seeked");
      });
      expect(time).toBe(20);
      await act(async () => { await player.load({ ...episode, id: "second" }); });
      expect(time).toBe(0);
      render(screen(100));
      act(() => {
        FakeAudio.instances[0].currentTime = 1;
        FakeAudio.instances[0].dispatch("timeupdate");
        vi.advanceTimersByTime(100);
      });
      expect(time).toBe(1);
      player.destroy();
    });

    it("rejects an invalid interval", () => {
      const Progress = () => { useAudioPlayerProgress({ intervalMs: 0 }); return null; };
      expect(() => render(<AudioPlayerProvider><Progress /></AudioPlayerProvider>)).toThrow(RangeError);
    });
  });

  it("subscribes to externally owned cues under StrictMode without rendering on every tick", async () => {
    const player = createAudioPlayer();
    await player.load(episode);
    const controller = attachAudioPlayerCues(player, { getCues: () => [
      { id: "intro", start: 0, end: 2, data: "Intro" },
      { id: "end", start: 2, data: "End" },
    ] });
    let renders = 0;
    const Cards = () => {
      renders++;
      return <p>{useAudioPlayerCues(controller).activeCues.map((cue) => cue.data).join(",")}</p>;
    };
    render(<StrictMode><Cards /></StrictMode>);
    expect(container.textContent).toBe("Intro");
    const initialRenders = renders;
    act(() => {
      FakeAudio.instances[0].currentTime = 1;
      FakeAudio.instances[0].dispatch("timeupdate");
    });
    expect(renders).toBe(initialRenders);
    act(() => {
      FakeAudio.instances[0].currentTime = 2;
      FakeAudio.instances[0].dispatch("seeked");
    });
    expect(container.textContent).toBe("End");
    const destroy = vi.spyOn(controller, "destroy");
    act(() => root.unmount());
    expect(destroy).not.toHaveBeenCalled();
    root = createRoot(container);
    controller.destroy();
    player.destroy();
  });

  describe("provider plugins", () => {
    const createAdapter = (initial: PersistedPlayerState | null = null) => {
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

    const persisted: PersistedPlayerState = {
      version: 1,
      savedAt: Date.now(),
      currentSource: episode,
      currentSourceId: "episode-1",
      currentTime: 0,
      rate: 1.5,
      volume: 1,
      muted: false,
      queue: {
        items: [episode],
        position: {
          currentIndex: 0,
          currentSourceId: "episode-1",
          repeatMode: "off",
        },
      },
    };

    it("restores state and reports it through onRestore", async () => {
      const adapter = createAdapter(persisted);
      const onRestore = vi.fn();

      render(
        <AudioPlayerProvider persistence={{ adapter, onRestore }}>
          <Probe />
        </AudioPlayerProvider>,
      );
      await act(async () => {
        await Promise.resolve();
        FakeAudio.instances[0]?.dispatch("loadedmetadata");
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(onRestore).toHaveBeenCalledTimes(1);
      expect(onRestore.mock.calls[0][0]?.currentSourceId).toBe("episode-1");
      expect(captured.state?.rate).toBe(1.5);
    });

    it("reports null when there is nothing to restore", async () => {
      const onRestore = vi.fn();

      render(
        <AudioPlayerProvider
          persistence={{ adapter: createAdapter(), onRestore }}>
          <Probe />
        </AudioPlayerProvider>,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(onRestore).toHaveBeenCalledWith(null);
    });

    it("does not restore when autoRestore is false", async () => {
      const adapter = createAdapter(persisted);
      const onRestore = vi.fn();

      render(
        <AudioPlayerProvider
          persistence={{ adapter, autoRestore: false, onRestore }}>
          <Probe />
        </AudioPlayerProvider>,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(adapter.load).not.toHaveBeenCalled();
      expect(onRestore).not.toHaveBeenCalled();
    });

    it("calls onRestore once under StrictMode", async () => {
      const onRestore = vi.fn();

      render(
        <StrictMode>
          <AudioPlayerProvider
            persistence={{ adapter: createAdapter(), onRestore }}>
            <Probe />
          </AudioPlayerProvider>
        </StrictMode>,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(onRestore).toHaveBeenCalledTimes(1);
    });

    it("preserves saved position in StrictMode restore callback", async () => {
      const onRestore = vi.fn();
      const adapter = createAdapter({ ...persisted, currentTime: 80 });
      render(
        <StrictMode>
          <AudioPlayerProvider persistence={{ adapter, onRestore }}>
            <Probe />
          </AudioPlayerProvider>
        </StrictMode>,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(onRestore).toHaveBeenCalledTimes(1);
      expect(onRestore.mock.calls[0][0]?.currentTime).toBe(80);
    });

    it("stops saving after unmount", async () => {
      const adapter = createAdapter();
      const player = createAudioPlayer();
      await player.load(episode);

      render(
        <AudioPlayerProvider
          player={player}
          persistence={{ adapter, autoRestore: false }}>
          <Probe />
        </AudioPlayerProvider>,
      );
      await act(async () => {
        await player.play();
        player.pause();
      });
      expect(adapter.save).toHaveBeenCalled();

      act(() => {
        root.unmount();
      });
      adapter.save.mockClear();
      await player.play();
      player.pause();

      expect(adapter.save).not.toHaveBeenCalled();
      root = createRoot(container);
    });

    it("attaches and detaches Media Session", async () => {
      const mediaSession = {
        metadata: null as unknown,
        playbackState: "none",
        setPositionState: vi.fn(),
        setActionHandler: vi.fn(),
      };
      vi.stubGlobal("navigator", { mediaSession });
      vi.stubGlobal(
        "MediaMetadata",
        class {
          constructor(public init: unknown) {}
        },
      );
      const player = createAudioPlayer();

      render(
        <AudioPlayerProvider player={player} mediaSession>
          <Probe />
        </AudioPlayerProvider>,
      );
      await act(async () => {
        await player.load(episode);
      });
      expect(mediaSession.metadata).not.toBeNull();
      expect(mediaSession.setActionHandler).toHaveBeenCalledWith(
        "play",
        expect.any(Function),
      );

      act(() => {
        root.unmount();
      });
      expect(mediaSession.metadata).toBeNull();
      expect(mediaSession.setActionHandler).toHaveBeenCalledWith("play", null);
      root = createRoot(container);
    });

    it("reports progress through the progress reporter", async () => {
      const onReport = vi.fn();
      const player = createAudioPlayer();
      await player.load(episode);

      render(
        <AudioPlayerProvider player={player} progressReporter={{ onReport }}>
          <Probe />
        </AudioPlayerProvider>,
      );
      await act(async () => {
        await player.play();
        player.pause();
      });

      expect(onReport).toHaveBeenCalled();
      expect(onReport.mock.lastCall?.[0].sourceId).toBe("episode-1");
    });
  });
});

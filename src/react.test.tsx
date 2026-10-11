// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAudioPlayer, type AudioPlayer, type AudioPlayerState } from "./index";
import { AudioPlayerProvider, useAudioPlayer, useAudioPlayerState } from "./react";

class FakeAudio {
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
    vi.stubGlobal("Audio", FakeAudio);
    captured = { player: null, state: null };
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
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
});

import { afterEach, expect, it, vi } from "vitest";
import { createAudioPlayer } from "./index";

afterEach(() => vi.unstubAllGlobals());
it("normalizes a DOMException to a string player error code while retaining its cause", async () => {
  const cause = new DOMException("Seeking unsupported", "NotSupportedError");
  class AudioFixture extends EventTarget {
    src = "";
    preload = "";
    duration = 30;
    playbackRate = 1;
    volume = 1;
    muted = false;
    buffered = { length: 0 };
    get currentTime() { return 0; }
    set currentTime(time: number) { if (time > 0) throw cause; }
    pause() {}
    load() { this.dispatchEvent(new Event("loadedmetadata")); }
  }
  vi.stubGlobal("Audio", AudioFixture);
  const player = createAudioPlayer();
  const errors = vi.fn();
  player.on("error", errors);
  await player.load({ id: "episode", src: "https://example.com/audio.mp3" });
  player.seek(5);
  expect(player.getState().error?.code).toBe("SEEK_ERROR");
  expect(errors.mock.calls[0][0].error.cause).toBe(cause);
  player.destroy();
});

import { expect, test, type Page } from "@playwright/test";
import type { AudioPlayer } from "../../src/index";

declare global { interface Window { player: AudioPlayer; } }

const playbackSnapshot = async (page: Page) => {
  const state = JSON.parse(await page.locator("#state").innerText());
  delete state.media.readyState;
  delete state.buffered;
  delete state.progress.buffered;
  delete state.progress.bufferedFraction;
  return state;
};

test("native routing retains the paused timeline and queue", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "remote", { configurable: true, get() {
      return Object.assign(new EventTarget(), { state: "disconnected", prompt: async () => {} });
    } });
    Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", { configurable: true, value: async function(id: string) {
      Object.defineProperty(this, "sinkId", { configurable: true, value: id });
    } });
  });
  await page.goto("/tests/browser/");
  await page.waitForFunction(() => !!window.player);
  await page.evaluate(() => window.player.setQueue([
    { id: "a", src: "/examples/audio/tone.wav" },
    { id: "b", src: "/examples/audio/short.wav" },
  ]));
  await expect.poll(() => page.evaluate(() => window.player.getState().status)).toBe("ready");
  const result = await page.evaluate(async () => {
    const player = window.player;
    await new Promise<void>((resolve) => {
      const off = player.on("seeked", () => { off(); resolve(); });
      player.seek(5);
    });
    const before = player.getState();
    const destinations = player.destinations();
    const sink = await destinations.setOutput("speaker");
    const remote = await destinations.promptRemote();
    const after = player.getState();
    player.destroy();
    return { before, after, sink, remote, destroyed: await destinations.setOutput("") };
  });
  expect(result.after).toEqual(result.before);
  expect(result.sink).toEqual({ status: "applied", sinkId: "speaker" });
  expect(result.remote.status).toBe("prompted");
  expect(result.destroyed.status).toBe("destroyed");
});

declare global {
  interface Window {
    routeTest: {
      finishSelection: () => void;
      failRemote: boolean;
      outputs: Array<{ kind: string; deviceId: string }>;
      devices: EventTarget;
      sinkCalls: string[];
    };
  }
}

test.describe("demo output controls", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const state = window.routeTest = {
        finishSelection: () => {}, failRemote: false,
        outputs: [{ kind: "audiooutput", deviceId: "speaker" }],
        devices: new EventTarget(), sinkCalls: [] as string[],
      };
      const devices = Object.assign(state.devices, {
        selectAudioOutput: () => new Promise((resolve) => {
          state.finishSelection = () => resolve({ deviceId: "speaker" });
        }),
        enumerateDevices: async () => state.outputs,
      });
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: devices });
      const routes = new WeakMap<HTMLMediaElement, EventTarget>();
      Object.defineProperty(HTMLMediaElement.prototype, "remote", { configurable: true, get() {
        if (!routes.has(this)) {
          const remote = Object.assign(new EventTarget(), { state: "disconnected", prompt: async () => {
            if (state.failRemote) throw new DOMException("Canceled or denied", "NotAllowedError");
            remote.state = remote.state === "connected" ? "disconnected" : "connected";
            remote.dispatchEvent(new Event(remote.state === "connected" ? "connect" : "disconnect"));
          } });
          routes.set(this, remote);
        }
        return routes.get(this);
      } });
      Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", { configurable: true, value: async function(id: string) {
        state.sinkCalls.push(id);
        Object.defineProperty(this, "sinkId", { configurable: true, value: id });
      } });
    });
    await page.goto("/demo/");
    await page.getByRole("button", { name: "Load Episode 1", exact: true }).click();
    await expect.poll(async () => JSON.parse(await page.locator("#state").innerText()).status).toBe("ready");
  });

  test("keyboard selection shows pending, removed output and explicit default recovery", async ({ page }) => {
    const before = await playbackSnapshot(page);
    await expect(page.locator("#destination-state")).toContainText("availability unknown");
    const output = page.getByRole("button", { name: "Choose audio output", exact: true });
    await output.focus();
    await page.keyboard.press("Enter");
    await expect(output).toBeDisabled();
    await expect(page.locator("#destination-state")).toHaveText("Waiting for output selection...");
    await page.evaluate(() => window.routeTest.finishSelection());
    await expect(page.locator("#destination-result")).toHaveText("The browser applied the audio output selection.");
    await expect(page.locator("#destination-state")).toContainText("device availability available");
    await page.evaluate(() => {
      window.routeTest.outputs = [];
      window.routeTest.devices.dispatchEvent(new Event("devicechange"));
    });
    await expect(page.locator("#destination-state")).toContainText("Selected device is unavailable");
    expect(await page.evaluate(() => window.routeTest.sinkCalls)).toEqual(["speaker"]);
    await page.getByRole("button", { name: "Use system default output", exact: true }).click();
    expect(await page.evaluate(() => window.routeTest.sinkCalls)).toEqual(["speaker", ""]);
    expect(await playbackSnapshot(page)).toEqual(before);
    await expect(page.locator("#cards")).toContainText("Studio notes");
  });

  test("remote failure preserves playback and retry observes connect and disconnect", async ({ page }) => {
    const before = await playbackSnapshot(page);
    await page.evaluate(() => { window.routeTest.failRemote = true; });
    const remote = page.getByRole("button", { name: "Choose remote output", exact: true });
    await remote.click();
    await expect(page.locator("#destination-result")).toContainText("NotAllowedError");
    expect(await playbackSnapshot(page)).toEqual(before);
    await page.evaluate(() => { window.routeTest.failRemote = false; });
    await remote.click();
    await expect(page.locator("#destination-state")).toContainText("Remote output: connected");
    await expect(page.locator("#rate")).toBeDisabled();
    await expect(page.locator("#destination-result")).toContainText("Connection status is reported separately");
    await remote.click();
    await expect(page.locator("#destination-state")).toContainText("Remote output: disconnected");
    await expect(page.locator("#rate")).toBeEnabled();
    expect(await playbackSnapshot(page)).toEqual(before);
  });

  test("reloading the episode during a picker suppresses the stale sink choice", async ({ page }) => {
    await page.getByRole("button", { name: "Choose audio output", exact: true }).click();
    await page.getByRole("button", { name: "Load Episode 1", exact: true }).click();
    await page.evaluate(() => window.routeTest.finishSelection());
    await expect(page.locator("#destination-result")).toHaveText("The source changed. Choose an output again.");
    expect(await page.evaluate(() => window.routeTest.sinkCalls)).toEqual([]);
  });
});

test("demo exposes system settings fallback when native pickers are absent", async ({ page }) => {
  await page.addInitScript(() => {
    for (const key of ["remote", "webkitShowPlaybackTargetPicker", "setSinkId"]) {
      Object.defineProperty(HTMLMediaElement.prototype, key, { configurable: true, value: undefined });
    }
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
  });
  await page.goto("/demo/");
  await expect(page.getByRole("button", { name: "Choose remote output", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Choose audio output", exact: true })).toBeDisabled();
  await expect(page.locator("#destination-state")).toContainText("Audio output picker unavailable. Use system settings.");
  await page.getByRole("button", { name: "Load Episode 1", exact: true }).click();
  await expect(page.locator("#cards")).toContainText("Studio notes");
});

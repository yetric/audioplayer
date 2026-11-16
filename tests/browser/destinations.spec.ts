import { expect, test } from "@playwright/test";
import type { AudioPlayer } from "../../src/index";

declare global { interface Window { player: AudioPlayer; } }

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
    player.seek(5);
    const before = player.getState();
    const destinations = player.destinations();
    const sink = await destinations.setOutput("speaker");
    const remote = await destinations.promptRemote();
    const after = player.getState();
    player.destroy();
    return { before, after, sink, remote, destroyed: await destinations.setOutput("") };
  });
  expect(result.after).toEqual(result.before);
  expect(result.sink.status).toBe("requested");
  expect(result.remote.status).toBe("requested");
  expect(result.destroyed.status).toBe("destroyed");
});

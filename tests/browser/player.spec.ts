import { expect, test } from "@playwright/test";
import type { AudioPlayer } from "../../src/index";
import { fileURLToPath } from "node:url";

declare global {
  interface Window { player: AudioPlayer; }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/");
  await page.waitForFunction(() => !!window.player);
});

test("loads real audio, plays, pauses, seeks, and skips", async ({ page }) => {
  await page.evaluate(() => window.player.load({ id: "first", src: "/examples/audio/tone.wav" }));
  await expect.poll(() => page.evaluate(() => window.player.getState().status)).toBe("ready");
  expect(await page.evaluate(() => window.player.getState().duration)).toBeCloseTo(4);
  await page.click("#play");
  await expect.poll(() => page.evaluate(() => window.player.getState().currentTime)).toBeGreaterThan(0);
  await page.evaluate(() => window.player.pause());
  await expect.poll(() => page.evaluate(() => window.player.getState().status)).toBe("paused");
  await page.evaluate(() => window.player.seek(2));
  await expect.poll(() => page.evaluate(() => window.player.getState().currentTime)).toBeCloseTo(2, 1);
  await page.evaluate(() => window.player.skip(-1));
  await expect.poll(() => page.evaluate(() => window.player.getState().currentTime)).toBeCloseTo(1, 1);
  await page.evaluate(() => window.player.skip(-100));
  await expect.poll(() => page.evaluate(() => window.player.getState().currentTime)).toBe(0);
});

test("preserves the source when playback ends", async ({ page }) => {
  await page.evaluate(() => window.player.load({ id: "short", src: "/examples/audio/short.wav" }));
  await expect.poll(() => page.evaluate(() => window.player.getState().status)).toBe("ready");
  await page.click("#play");
  await expect.poll(() => page.evaluate(() => window.player.getState().status)).toBe("ended");
  expect(await page.evaluate(() => window.player.getState().currentSourceId)).toBe("short");
});

test("auto-advances a queue after a native ended event", async ({ page }) => {
  await page.evaluate(() => window.player.setQueue([
    { id: "first", src: "/examples/audio/short.wav" },
    { id: "second", src: "/examples/audio/tone.wav" },
  ]));
  await expect.poll(() => page.evaluate(() => window.player.getState().status)).toBe("ready");
  await page.click("#play");
  await expect.poll(() => page.evaluate(() => window.player.getState().currentSourceId)).toBe("second");
  await expect.poll(() => page.evaluate(() => window.player.getState().status)).toBe("playing");
  expect(await page.evaluate(() => window.player.getState().queue.position.currentIndex)).toBe(1);
});

test("React example restores persistence and supports throttled progress and relative seeking", async ({ page }) => {
  await page.goto("/examples/react/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByTestId("status")).toHaveText("playing");
  await expect.poll(async () => Number(await page.getByTestId("time").textContent())).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByTestId("status")).toHaveText("paused");
  await page.getByRole("button", { name: "Forward 1s", exact: true }).click();
  await expect.poll(async () => Number(await page.getByTestId("time").textContent())).toBeGreaterThan(1);
  await page.reload();
  await expect(page.getByTestId("status")).toHaveText("ready");
  await expect.poll(async () => Number(await page.getByTestId("time").textContent())).toBeGreaterThan(1);
});

test("browser demo plays and navigates its queue", async ({ page }) => {
  await page.route("https://www.soundhelix.com/**", (route) => route.fulfill({
    path: fileURLToPath(new URL("../../examples/audio/tone.wav", import.meta.url)),
    contentType: "audio/wav",
    headers: { "access-control-allow-origin": "*" },
  }));
  await page.goto("/demo/");
  await page.locator("#load-queue").click();
  await expect.poll(async () => JSON.parse(await page.locator("#state").innerText()).status).toBe("playing");
  await page.locator("#pause").click();
  await expect.poll(async () => JSON.parse(await page.locator("#state").innerText()).status).toBe("paused");
  await page.locator("#next").click();
  await expect.poll(async () => JSON.parse(await page.locator("#state").innerText()).currentSourceId).toBe("episode-2");
});

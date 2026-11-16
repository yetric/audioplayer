import { expect, test, type Page } from "@playwright/test";
import story from "../../demo/story/story.json" with { type: "json" };

async function seekTo(page: Page, seconds: number) {
  await page.getByRole("slider", { name: "Playback position" }).evaluate((element: HTMLInputElement, value) => {
    element.value = String(value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, seconds);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/demo/story/");
  await expect(page.locator("#status")).toHaveText("Ready to listen");
});

test("shows only current story context and restores it after a backward seek", async ({ page }) => {
  const cards = page.locator("#context-cards");
  await expect(cards.getByRole("button")).toHaveCount(1);
  await expect(cards).not.toContainText("blue lamp");
  await seekTo(page, story.episodes[0].passages[3].start + 0.2);
  await expect(page.locator("#passage-title")).toHaveText("The folded note");
  await expect(cards.getByRole("button")).toHaveCount(4);
  await cards.getByRole("button", { name: /A walk to North Point/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect.poll(() => page.locator("#detail-art img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.getByRole("button", { name: "Return to the story", exact: true }).click();
  await expect(page.locator("#status")).not.toHaveText("Playing");
  await seekTo(page, 0);
  await expect(page.locator("#passage-title")).toHaveText("An unexpected delivery");
  await expect(cards.getByRole("button")).toHaveCount(1);
  await expect(page.locator("#transcript")).not.toContainText("second bell");
});

test("a detour pauses real audio and returns to its position and playback intent", async ({ page }) => {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator("#status")).toHaveText("Playing");
  await seekTo(page, 8);
  await expect(page.locator("#elapsed")).toHaveText("0:08");
  await page.locator("#context-cards button").first().click();
  await expect(page.locator("#status")).toHaveText("Paused");
  const paused = await page.locator("#seek").inputValue();
  await expect(page.locator("#return-note")).toContainText("Playback resumes");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator("#status")).toHaveText("Playing");
  const resumed = Number(await page.locator("#seek").inputValue());
  expect(resumed).toBeGreaterThanOrEqual(Number(paused));
  expect(resumed - Number(paused)).toBeLessThan(2);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.locator("#context-cards button").first().click();
  await expect(page.locator("#return-note")).toContainText("Playback stays paused");
  await page.getByRole("button", { name: "Return to the story", exact: true }).click();
  await expect(page.locator("#status")).toHaveText("Paused");
});

test("saved curiosity unlocks at the reveal and locks again when revisiting an earlier moment", async ({ page }) => {
  await seekTo(page, story.episodes[0].passages[4].start + 0.2);
  await page.getByRole("button", { name: "Save my question" }).click();
  await expect(page.getByRole("button", { name: "Question saved" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Explore the answer" })).toBeHidden();
  await page.locator('[data-episode="1"]').click();
  await expect(page.locator("#passage-title")).toHaveText("Back at the archive");
  await expect(page.locator("#context-cards")).not.toContainText("The parcel");
  await expect(page.getByRole("button", { name: "Explore the answer" })).toBeHidden();
  await expect(page.locator("#status")).toHaveText("Ready to listen");
  await seekTo(page, story.episodes[1].passages[3].start + 0.2);
  await page.getByRole("button", { name: "Explore the answer" }).click();
  await expect(page.locator("#detail-body")).toContainText("safely ashore");
  await page.getByRole("button", { name: "Return to the story", exact: true }).click();
  await seekTo(page, 0);
  await expect(page.getByRole("button", { name: "Explore the answer" })).toBeHidden();
  await expect(page.locator("#context-cards")).not.toContainText("safely ashore");
});

test("audio-only mode preserves playback and the mobile layout fits the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator("#status")).toHaveText("Playing");
  await page.getByRole("checkbox", { name: "Show story context" }).uncheck();
  await expect(page.locator("#context-content")).toBeHidden();
  await expect(page.locator("#audio-only")).toBeVisible();
  await expect(page.locator("#status")).toHaveText("Playing");
  await page.getByRole("checkbox", { name: "Show story context" }).check();
  await expect(page.locator("#context-content")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a failed source gives a recovery path without showing the previous episode's context", async ({ page }) => {
  await page.route("**/the-window.mp3", (route) => route.abort());
  await page.locator('[data-episode="1"]').click();
  await expect(page.getByRole("alert")).toContainText("Select an episode to reload");
  await expect(page.locator("#context-cards")).not.toContainText("The parcel");
  await page.unroute("**/the-window.mp3");
  await page.locator('[data-episode="1"]').click();
  await expect(page.locator("#status")).toHaveText("Ready to listen");
});

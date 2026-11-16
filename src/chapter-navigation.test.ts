import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { attachAudioPlayerChapters, createAudioPlayer, createPodcastChapterCues } from "./index";

class AudioFixture extends EventTarget {
  static last: AudioFixture;
  src = "";
  preload = "";
  duration = 30;
  currentTime = 0;
  playbackRate = 1;
  volume = 1;
  muted = false;
  buffered = { length: 0 };
  constructor() { super(); AudioFixture.last = this; }
  load() { this.dispatchEvent(new Event("loadedmetadata")); }
  async play() { this.dispatchEvent(new Event("play")); }
  pause() { this.dispatchEvent(new Event("pause")); }
}
const source = { id: "episode", src: "https://example.com/audio.mp3" };
const fixture = () => createPodcastChapterCues({ version: "1.2.0", chapters: [
  { startTime: 0, title: "Intro" },
  { startTime: 2, toc: false, img: "/detail.svg" },
  { startTime: 10, endTime: 12, title: "Middle" },
  { startTime: 10, title: "Duplicate" },
  { startTime: 20, title: "End" },
] }, { sourceId: source.id });
const move = (time: number) => {
  AudioFixture.last.currentTime = time;
  AudioFixture.last.dispatchEvent(new Event("timeupdate"));
};
beforeEach(() => vi.stubGlobal("Audio", AudioFixture));
afterEach(() => vi.unstubAllGlobals());

it("keeps hidden presentation cues out of navigation without ending the visible chapter", async () => {
  const player = createAudioPlayer();
  const chapters = attachAudioPlayerChapters(player, { getCues: fixture });
  await player.load(source);
  move(3);
  expect(chapters.getSnapshot().entries.map((cue) => cue.data.title)).toEqual(["Intro", "Middle", "End"]);
  expect(chapters.getSnapshot().current?.data.title).toBe("Intro");
  expect(chapters.cues.getSnapshot().activeCues[0].data.toc).toBe(false);
  expect(chapters.seekTo("episode:chapter:1")).toBe(false);
  expect(chapters.seekTo("episode:chapter:3")).toBe(false);
  player.destroy();
});

it("navigates strictly later starts, honors explicit gaps and never advances the queue", async () => {
  const player = createAudioPlayer();
  await player.setQueue([source, { id: "second", src: source.src }]);
  const chapters = attachAudioPlayerChapters(player, { getCues: fixture });
  expect(chapters.next()).toBe(true);
  expect(AudioFixture.last.currentTime).toBe(10);
  AudioFixture.last.dispatchEvent(new Event("seeked"));
  expect(chapters.getSnapshot().current?.data.title).toBe("Middle");
  move(13);
  expect(chapters.getSnapshot().current).toBeNull();
  expect(chapters.getSnapshot().previous?.start).toBe(10);
  expect(chapters.next()).toBe(true);
  expect(AudioFixture.last.currentTime).toBe(20);
  AudioFixture.last.dispatchEvent(new Event("seeked"));
  expect(chapters.next()).toBe(false);
  expect(player.getState().currentSourceId).toBe(source.id);
  expect(player.getState().status).toBe("ready");
  player.destroy();
});

it("restarts after the threshold and otherwise selects the earlier chapter", async () => {
  const player = createAudioPlayer();
  await player.load(source);
  const chapters = attachAudioPlayerChapters(player, { getCues: fixture, restartThresholdSeconds: 2 });
  move(23);
  expect(chapters.previous()).toBe(true);
  expect(AudioFixture.last.currentTime).toBe(20);
  AudioFixture.last.dispatchEvent(new Event("seeked"));
  expect(chapters.previous()).toBe(true);
  expect(AudioFixture.last.currentTime).toBe(10);
  AudioFixture.last.dispatchEvent(new Event("seeked"));
  move(0);
  expect(chapters.previous()).toBe(false);
  player.destroy();
});

it("bounds the final chapter by media duration and clears current on end", async () => {
  const player = createAudioPlayer();
  const chapters = attachAudioPlayerChapters(player, { getCues: fixture });
  await player.load(source);
  move(29);
  expect(chapters.getSnapshot().current?.start).toBe(20);
  move(30);
  expect(chapters.getSnapshot().current).toBeNull();
  expect(chapters.getSnapshot().next).toBeNull();
  expect(chapters.getSnapshot().previous?.start).toBe(20);
  player.destroy();
});

it("preserves play and pause intent and holds presentation until the completed seek", async () => {
  const player = createAudioPlayer();
  const chapters = attachAudioPlayerChapters(player, { getCues: fixture });
  await player.play(source);
  const entered = vi.fn();
  chapters.cues.on("cueenter", entered);
  chapters.next();
  expect(player.getState().status).toBe("playing");
  expect(entered).not.toHaveBeenCalled();
  AudioFixture.last.dispatchEvent(new Event("seeked"));
  expect(entered).toHaveBeenCalledTimes(2);
  player.pause();
  chapters.previous();
  expect(player.getState().status).toBe("paused");
  player.destroy();
});

it("refreshes metadata, handles source changes and releases both controllers", async () => {
  const player = createAudioPlayer();
  let data = fixture();
  const chapters = attachAudioPlayerChapters(player, { getCues: (current) => current.id === source.id ? data : [] });
  await player.load(source);
  data = data.slice(0, 1);
  chapters.refresh();
  expect(chapters.getSnapshot().entries).toHaveLength(1);
  await player.load({ id: "other", src: source.src });
  expect(chapters.getSnapshot().entries).toEqual([]);
  await player.load(source);
  player.unload();
  expect(chapters.getSnapshot().sourceId).toBeNull();
  player.destroy();
  expect(chapters.cues.getSnapshot().sourceId).toBeNull();
  expect(chapters.next()).toBe(false);
  expect(chapters.seekTo("episode:chapter:0")).toBe(false);
  expect(() => chapters.destroy()).not.toThrow();
});

it("keeps snapshots stable within a chapter and stops stale notifications on reentrant unload", async () => {
  const player = createAudioPlayer();
  const chapters = attachAudioPlayerChapters(player, { getCues: fixture });
  await player.load(source);
  move(1);
  const snapshot = chapters.getSnapshot();
  move(1.5);
  expect(chapters.getSnapshot()).toBe(snapshot);
  const seen: Array<string | null> = [];
  chapters.subscribe(({ current }) => { if (current?.start === 10) player.unload(); });
  chapters.subscribe(({ sourceId }) => seen.push(sourceId));
  move(10);
  expect(seen).toEqual([source.id, null]);
  expect(chapters.getSnapshot().sourceId).toBeNull();
  player.destroy();
});

it("retains valid metadata after a rejected refresh", async () => {
  const player = createAudioPlayer();
  let data = fixture();
  const chapters = attachAudioPlayerChapters(player, { getCues: () => data });
  await player.load(source);
  const snapshot = chapters.getSnapshot();
  data = [{ ...data[0], start: -1 }];
  expect(() => chapters.refresh()).toThrow(RangeError);
  expect(chapters.getSnapshot()).toBe(snapshot);
  move(1);
  expect(chapters.getSnapshot().current?.start).toBe(0);
  player.destroy();
});

it.each([-1, NaN, Infinity])("rejects invalid restart thresholds %s", (restartThresholdSeconds) => {
  const player = createAudioPlayer();
  expect(() => attachAudioPlayerChapters(player, { getCues: fixture, restartThresholdSeconds })).toThrow(RangeError);
  player.destroy();
});

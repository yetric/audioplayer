import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import * as esm from "@yetric/audioplayer";
import { createAudioPlayer, createLocalStoragePersistenceAdapter, attachAudioPlayerCues } from "@yetric/audioplayer";
import { AudioPlayerProvider, useAudioPlayerProgress, useAudioPlayerState, useAudioPlayerCues } from "@yetric/audioplayer/react";

test("ESM and CommonJS exports load without browser globals", async () => {
  assert.equal(typeof globalThis.Audio, "undefined");
  const require = createRequire(import.meta.url);
  for (const create of [createAudioPlayer, require("@yetric/audioplayer").createAudioPlayer]) {
    const player = create();
    assert.equal(player.getState().status, "idle");
    await player.load({ id: "server", src: "https://example.com/audio.wav" });
    assert.equal(player.getState().error.code, "UNSUPPORTED_ENVIRONMENT");
    const destinations = player.destinations();
    assert.equal(destinations.getState().remote.picker, null);
    assert.equal(destinations.getState().output.canSelect, false);
    assert.equal((await destinations.promptRemote()).status, "unsupported");
    assert.equal((await destinations.setOutput("")).status, "unsupported");
    player.destroy();
    assert.equal((await destinations.selectOutput()).status, "destroyed");
  }
  assert.equal(typeof require("@yetric/audioplayer/react").AudioPlayerProvider, "function");
});

test("React provider and hooks render on a server without browser storage", () => {
  const player = createAudioPlayer();
  const cues = attachAudioPlayerCues(player, { getCues: () => [] });
  const Screen = () => createElement("p", null,
    `${useAudioPlayerState((state) => state.status)}:${useAudioPlayerProgress().currentTime}:${useAudioPlayerCues(cues).activeCues.length}`);
  const html = renderToString(createElement(AudioPlayerProvider, {
    persistence: { adapter: createLocalStoragePersistenceAdapter("ssr-test") },
    mediaSession: true,
  }, createElement(Screen)));
  assert.equal(html, "<p>idle:0:0</p>");
  player.destroy();
});

test("chapter conversion and cue controllers load from ESM and CommonJS", () => {
  const require = createRequire(import.meta.url);
  for (const api of [esm, require("@yetric/audioplayer")]) {
    const chapters = api.createPodcastChapterCues({ version: "1.2.0", chapters: [{ startTime: 0 }] }, { sourceId: "episode" });
    assert.equal(chapters[0].id, "episode:chapter:0");
    const player = api.createAudioPlayer();
    const controller = api.attachAudioPlayerCues(player, { getCues: () => chapters });
    assert.deepEqual(controller.getSnapshot(), { sourceId: null, activeCues: [] });
    player.destroy();
    assert.equal(typeof require("@yetric/audioplayer/react").useAudioPlayerCues, "function");
  }
});

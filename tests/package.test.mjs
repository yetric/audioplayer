import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createAudioPlayer, createLocalStoragePersistenceAdapter } from "@yetric/audioplayer";
import { AudioPlayerProvider, useAudioPlayerProgress, useAudioPlayerState } from "@yetric/audioplayer/react";

test("ESM and CommonJS exports load without browser globals", async () => {
  assert.equal(typeof globalThis.Audio, "undefined");
  const require = createRequire(import.meta.url);
  for (const create of [createAudioPlayer, require("@yetric/audioplayer").createAudioPlayer]) {
    const player = create();
    assert.equal(player.getState().status, "idle");
    await player.load({ id: "server", src: "https://example.com/audio.wav" });
    assert.equal(player.getState().error.code, "UNSUPPORTED_ENVIRONMENT");
    player.destroy();
  }
  assert.equal(typeof require("@yetric/audioplayer/react").AudioPlayerProvider, "function");
});

test("React provider and hooks render on a server without browser storage", () => {
  const Screen = () => createElement("p", null,
    `${useAudioPlayerState((state) => state.status)}:${useAudioPlayerProgress().currentTime}`);
  const html = renderToString(createElement(AudioPlayerProvider, {
    persistence: { adapter: createLocalStoragePersistenceAdapter("ssr-test") },
    mediaSession: true,
  }, createElement(Screen)));
  assert.equal(html, "<p>idle:0</p>");
});

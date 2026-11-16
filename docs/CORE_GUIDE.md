---
id: core-api
slug: /core-api
---

# Core Guide

## Mental model

- One player instance per app.
- The player owns playback, queue, state, and browser integration.
- UI reads from `subscribe(state)`.
- Side effects attach through opt-in controllers.

## Create a player

```ts
import { createAudioPlayer } from "@yetric/audioplayer";

const player = createAudioPlayer({
  initialRate: 1,
  initialVolume: 1,
  initialMuted: false,
  initialRepeatMode: "off",
});
```

## Load and play

```ts
const source = {
  id: "ep-1",
  src: "https://cdn.example.com/ep-1.mp3",
  title: "Episode 1",
  artist: "Podcast Name",
  artwork: "https://cdn.example.com/ep-1.jpg",
  album: "Podcast Name",
};

await player.load(source);
await player.play();
```

Single-step start:

```ts
await player.play(source);
```

## Read state

```ts
const unsubscribe = player.subscribe((state) => {
  console.log(state.status);
  console.log(state.currentSourceId);
  console.log(state.progress.currentTime);
  console.log(state.progress.playedFraction);
  console.log(state.queue.position.currentIndex);
});
```

## Media readiness (unreleased 1.4)

`state.media` adds `{ readyState, buffering, seeking }` without changing `PlayerStatus`:

```ts
player.subscribe(({ media }) => {
  renderLoading(media.seeking ? "seeking" : media.buffering ? "buffering" : null);
});
```

`readyState` is the observed HTML media ready-state number (0 through 4), or null before an active source is observed, after unload, and where the property is unavailable. Metadata readiness is not a promise of enough data to play. `seeking` reports API/native seeks; it is reset on completion, pause, errors and source lifecycle transitions. `buffering` means the browser reported `waiting` while playback was requested and data was insufficient, outside a seek. `playing`, sufficient readiness, actual position progress, pause, seek, source change, error and end clear it. `stalled` reports network fetching trouble and does not itself set buffering. Connection progress remains in `player.destinations()`.

This is observation, not automatic retry or recovery. No timers, playback retries, alternate URLs or output changes are started. Media state is transient and is not persisted. React consumers can select `state.media.buffering` with the existing `useAudioPlayerState` hook.

Reviewed 2026-11-16 against the [HTML media readiness and playback specification](https://html.spec.whatwg.org/multipage/media.html#ready-states), [MDN waiting](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/waiting_event) and [MDN stalled](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/stalled_event) guidance.

## Queue operations

```ts
await player.setQueue(
  [
    { id: "ep-1", src: "https://cdn.example.com/ep-1.mp3", title: "Episode 1" },
    { id: "ep-2", src: "https://cdn.example.com/ep-2.mp3", title: "Episode 2" },
  ],
  {
    startAtId: "ep-1",
    autoplay: true,
  },
);

await player.next();
await player.previous();

player.appendToQueue([
  { id: "ep-3", src: "https://cdn.example.com/ep-3.mp3", title: "Episode 3" },
]);

player.removeFromQueue("ep-2");
player.clearQueue();
player.setRepeatMode("all");
```

## Playback controls

```ts
player.pause();
player.seek(120);
player.skip(-10); // relative, negative goes back
player.setRate(1.25);
player.setVolume(0.8);
player.setMuted(false);
```

## Error handling

```ts
player.on("error", ({ error, state }) => {
  console.log(error.code, error.message);
  console.log(state.error);
});
```

## Useful state fields

- `state.status`
- `state.currentSource`
- `state.currentSourceId`
- `state.progress.currentTime`
- `state.progress.duration`
- `state.progress.playedFraction`
- `state.queue.items`
- `state.queue.itemIds`
- `state.queue.position`
- `state.error`

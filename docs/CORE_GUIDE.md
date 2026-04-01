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

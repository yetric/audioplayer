# Core API

## Create a player

```ts
import { createAudioPlayer } from "@yetric/audioplayer";

const player = createAudioPlayer();
```

## Play a source

```ts
await player.play({
  id: "episode-42",
  src: "https://cdn.example.com/episode-42.mp3",
  title: "Episode 42",
  artist: "Podcast Name",
  artwork: "https://cdn.example.com/episode-42.jpg",
});
```

## Read state

```ts
const unsubscribe = player.subscribe((state) => {
  console.log(state.status);
  console.log(state.currentSourceId);
  console.log(state.progress.playedFraction);
});
```

## Queue

```ts
await player.setQueue(
  [
    { id: "ep-1", src: "https://cdn.example.com/ep-1.mp3", title: "Episode 1" },
    { id: "ep-2", src: "https://cdn.example.com/ep-2.mp3", title: "Episode 2" },
  ],
  { startAtId: "ep-1", autoplay: true },
);

await player.next();
await player.previous();
player.setRepeatMode("all");
```

## Controls

```ts
player.pause();
player.seek(120);
player.setRate(1.25);
player.setVolume(0.8);
player.setMuted(false);
```

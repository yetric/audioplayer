# Getting Started

## Install

```bash
npm install @yetric/audioplayer
```

React usage:

```bash
npm install @yetric/audioplayer react
```

## Core quick start

```ts
import { createAudioPlayer } from "@yetric/audioplayer";

const player = createAudioPlayer();

await player.play({
  id: "episode-42",
  src: "https://cdn.example.com/episode-42.mp3",
  title: "Episode 42",
  artist: "Podcast Name",
  artwork: "https://cdn.example.com/episode-42.jpg",
});

player.subscribe((state) => {
  console.log(state.status, state.progress.playedFraction);
});
```

## Add queue support

```ts
await player.setQueue(
  [
    { id: "ep-1", src: "https://cdn.example.com/ep-1.mp3", title: "Ep 1" },
    { id: "ep-2", src: "https://cdn.example.com/ep-2.mp3", title: "Ep 2" },
  ],
  { startAtId: "ep-1", autoplay: true },
);
```

## Add persistence

```ts
import {
  attachAudioPlayerPersistence,
  createLocalStoragePersistenceAdapter,
} from "@yetric/audioplayer";

const persistence = attachAudioPlayerPersistence(player, {
  adapter: createLocalStoragePersistenceAdapter("my-player"),
});
```

## Add progress reporting

```ts
import { attachAudioPlayerProgressReporter } from "@yetric/audioplayer";

const progress = attachAudioPlayerProgressReporter(player, {
  intervalMs: 5000,
  onReport(snapshot) {
    console.log(snapshot.sourceId, snapshot.currentTime);
  },
});
```

## Add Media Session support

```ts
import { attachAudioPlayerMediaSession } from "@yetric/audioplayer";

const mediaSession = attachAudioPlayerMediaSession(player);
```

## Cleanup

```ts
persistence.destroy();
progress.destroy();
mediaSession.destroy();
player.destroy();
```

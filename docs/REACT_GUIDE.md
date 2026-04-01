# React Guide

## Install

```bash
npm install @yetric/audioplayer react
```

## App-level provider

```tsx
import { AudioPlayerProvider } from "@yetric/audioplayer/react";

export const App = () => (
  <AudioPlayerProvider>
    <PlayerBootstrap />
    <Routes />
  </AudioPlayerProvider>
);
```

## Bootstrap app-level integrations

```tsx
import { useEffect } from "react";
import {
  attachAudioPlayerMediaSession,
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  createLocalStoragePersistenceAdapter,
} from "@yetric/audioplayer";
import { useAudioPlayer } from "@yetric/audioplayer/react";

const PlayerBootstrap = () => {
  const player = useAudioPlayer();

  useEffect(() => {
    const persistence = attachAudioPlayerPersistence(player, {
      adapter: createLocalStoragePersistenceAdapter("app-player"),
    });

    const reporter = attachAudioPlayerProgressReporter(player, {
      intervalMs: 5000,
      onReport(snapshot) {
        console.log(snapshot);
      },
    });

    const mediaSession = attachAudioPlayerMediaSession(player);

    return () => {
      persistence.destroy();
      reporter.destroy();
      mediaSession.destroy();
    };
  }, [player]);

  return null;
};
```

## Read player state

```tsx
import { useAudioPlayer, useAudioPlayerState } from "@yetric/audioplayer/react";

const episode = {
  id: "ep-1",
  src: "https://cdn.example.com/ep-1.mp3",
  title: "Episode 1",
  artist: "Podcast Name",
};

export const PlayerScreen = () => {
  const player = useAudioPlayer();
  const state = useAudioPlayerState();

  return (
    <div>
      <button onClick={() => void player.play(episode)}>Play</button>
      <button onClick={() => player.pause()}>Pause</button>
      <button onClick={() => player.seek(60)}>Seek to 60s</button>
      <div>{state.status}</div>
      <div>{state.progress.currentTime}</div>
    </div>
  );
};
```

## Why this adapter stays thin

- React does not own the playback engine.
- React does not copy player state into a second store.
- `useAudioPlayerState()` subscribes to the same core state every other framework can use.

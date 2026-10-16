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

## Attach persistence, Media Session and progress reporting

Pass them to the provider. It attaches them on mount and detaches them on unmount, including under StrictMode.

```tsx
import { AudioPlayerProvider } from "@yetric/audioplayer/react";
import { createLocalStoragePersistenceAdapter } from "@yetric/audioplayer";

export const App = () => (
  <AudioPlayerProvider
    persistence={{
      adapter: createLocalStoragePersistenceAdapter("app-player"),
      onRestore(restored) {
        console.log(restored ? "restored" : "nothing to restore");
      },
    }}
    mediaSession
    progressReporter={{
      intervalMs: 5000,
      onReport(snapshot) {
        console.log(snapshot);
      },
    }}>
    <Routes />
  </AudioPlayerProvider>
);
```

- These options are read once, when the provider mounts. Changing them later has no effect.
- `onRestore` runs once after the automatic restore, with the restored state or `null`. It is not called when `autoRestore` is `false`.
- `mediaSession` accepts `true` for the defaults, or Media Session options.
- You can still call the `attachAudioPlayer...` functions yourself. The provider options are a shortcut for the common case.

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

## Re-render only when a value changes

`useAudioPlayerState()` without arguments re-renders on every state change, including every `timeupdate`. Pass a selector to subscribe to one value:

```tsx
const status = useAudioPlayerState((state) => state.status);
const queueLength = useAudioPlayerState((state) => state.queue.items.length);
```

If the selector returns a new object or array on each call, pass an equality function as the second argument, otherwise the component re-renders on every change:

```tsx
const progress = useAudioPlayerState(
  (state) => ({ time: Math.floor(state.currentTime), duration: state.duration }),
  (a, b) => a.time === b.time && a.duration === b.duration,
);
```

## Why this adapter stays thin

- React does not own the playback engine.
- React does not copy player state into a second store.
- `useAudioPlayerState()` subscribes to the same core state every other framework can use.

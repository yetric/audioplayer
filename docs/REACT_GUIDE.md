---
id: react
slug: /react
---

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

## Throttled progress for a timeline

```tsx
import { useAudioPlayerProgress } from "@yetric/audioplayer/react";

export const Timeline = () => {
  const progress = useAudioPlayerProgress({ intervalMs: 250 });
  return <progress max={1} value={progress.playedFraction} />;
};
```

The hook returns `AudioPlayerProgressState` and listens to player notifications without polling. During playback it coalesces updates over `intervalMs` milliseconds (default 250). Source changes, playback status changes, and completed seeks update immediately. Unmounting clears pending work. The interval must be a positive finite number; invalid values throw `RangeError`.

Use this hook in a separate timeline component. A parent using the whole-state hook will still re-render on every state update. For backend reporting, use `progressReporter` instead.

For server-rendered apps, see [Server rendering](./SERVER_RENDERING.md).

## Timed content (1.3 development)

`useAudioPlayerCues(controller)` subscribes to an application-owned cue controller. It re-renders when the source or active cue objects change and releases its subscription on unmount. It does not create or destroy the controller. See [Timed metadata](./TIMED_METADATA.md#react) for usage and lifecycle details.

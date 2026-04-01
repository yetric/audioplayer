# podcast-app Migration

## Goal

Replace the current React-only audio context in `podcast-app` with `@yetric/audioplayer` core plus the React adapter.

Current source to replace:

- `/home/hising/src/github/yetric/podcast-app/src/context/audio.tsx`

## Mapping

### Current `podcast-app` usage

- `setAudio(src)`
- `play()`
- `pause()`
- `seek(time?)`
- `duration()`
- `rate(speed?)`
- `unload()`

### New library mapping

- `player.load(source)`
- `player.play(source?)`
- `player.pause()`
- `player.seek(time)`
- `useAudioPlayerState().duration`
- `player.setRate(rate)`
- `player.destroy()` or explicit source replacement

## Recommended integration

### 1. Replace the current provider

Wrap the app with `AudioPlayerProvider` from `@yetric/audioplayer/react`.

### 2. Replace direct context methods

Move player commands to `useAudioPlayer()`.

Move display state to `useAudioPlayerState()`.

### 3. Attach opt-in integrations once at app level

- persistence
- progress reporting
- Media Session

## Example app-level wiring

```tsx
import { useEffect } from "react";
import {
  attachAudioPlayerMediaSession,
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  createLocalStoragePersistenceAdapter,
} from "@yetric/audioplayer";
import {
  AudioPlayerProvider,
  useAudioPlayer,
} from "@yetric/audioplayer/react";

const PlayerBootstrap = () => {
  const player = useAudioPlayer();

  useEffect(() => {
    const persistence = attachAudioPlayerPersistence(player, {
      adapter: createLocalStoragePersistenceAdapter("podcast-app-player"),
    });

    const reporter = attachAudioPlayerProgressReporter(player, {
      intervalMs: 5000,
      onReport(snapshot) {
        if (!snapshot.sourceId) {
          return;
        }

        // Replace with existing userStore ping behavior.
        console.log(snapshot.sourceId, snapshot.currentTime);
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

export const AppAudioProvider = ({ children }: { children: React.ReactNode }) => (
  <AudioPlayerProvider>
    <PlayerBootstrap />
    {children}
  </AudioPlayerProvider>
);
```

## Episode loading shape

Convert the current episode model into the library `AudioSource` shape:

```ts
const source = {
  id: episode.id.toString(),
  src: episode.url,
  title: episode.title,
  artist: podcast.name,
  artwork: podcast.imageUrl,
  album: podcast.name,
};
```

## UI migration notes

- `PlayButton` should call `player.play(source)` for first play
- player timeline should read from `useAudioPlayerState().progress`
- speed controls should call `player.setRate(rate)`
- next/previous buttons should call `player.next()` and `player.previous()`
- queue UI should read from `useAudioPlayerState().queue`
- error UI should read from `useAudioPlayerState().error`

## Expected result

- one player instance for the whole app
- browser-native playback engine
- persisted resume state
- progress reporting hooks
- Media Session support

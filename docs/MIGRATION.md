---
id: migration
slug: /migration
---

# Migrating an Existing React Audio Layer

## Goal

Replace an application-owned audio context or wrapper with `@yetric/audioplayer` core plus the React adapter. The method names below illustrate a typical existing wrapper; adapt them to your application.

## Mapping

### Example existing wrapper

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
- `player.unload()` to clear a source; `player.destroy()` when disposing the player

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
import { createLocalStoragePersistenceAdapter } from "@yetric/audioplayer";
import { AudioPlayerProvider } from "@yetric/audioplayer/react";

export const AppAudioProvider = ({ children }: { children: React.ReactNode }) => (
  <AudioPlayerProvider
    persistence={{ adapter: createLocalStoragePersistenceAdapter("audio-player") }}
    mediaSession
    progressReporter={{
      intervalMs: 5000,
      onReport(snapshot) {
        console.log(snapshot.sourceId, snapshot.currentTime);
      },
    }}>
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
- player timeline should read from `useAudioPlayerProgress()`
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

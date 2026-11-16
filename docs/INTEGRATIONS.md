---
id: integrations
slug: /integrations
---

# Integrations

## Timed multimedia metadata (1.3 development)

Use an opt-in cue controller for synchronized images, text, and links, with a parsed Podcasting 2.0 JSON Chapters adapter and a React subscription hook. See [Timed metadata](./TIMED_METADATA.md) for the data contract, lifecycle, and demo.

## Persistence

The built-in localStorage adapter is best-effort: reads return `null` and writes/clears are ignored when storage is unavailable, denied, or full. Use a custom adapter if your application needs to report storage failures.

```ts
import {
  attachAudioPlayerPersistence,
  createLocalStoragePersistenceAdapter,
} from "@yetric/audioplayer";

const persistence = attachAudioPlayerPersistence(player, {
  adapter: createLocalStoragePersistenceAdapter("app-player"),
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
  saveIntervalMs: 5000,
});
```

## Progress reporting

```ts
import { attachAudioPlayerProgressReporter } from "@yetric/audioplayer";

const reporter = attachAudioPlayerProgressReporter(player, {
  intervalMs: 5000,
  onReport(snapshot) {
    sendProgressToBackend(snapshot.sourceId, snapshot.currentTime);
  },
});
```

## Media Session

```ts
import { attachAudioPlayerMediaSession } from "@yetric/audioplayer";

const mediaSession = attachAudioPlayerMediaSession(player, {
  seekOffsetSeconds: 10,
  artworkSizes: [96, 128, 192, 256, 384, 512],
});
```

Metadata is replaced only when source identity or metadata fields change. One artwork entry carries the space-separated `artworkSizes` hints for the source's single URL; this does not generate resized images. An empty size list omits artwork.

Playback-state changes, duration/rate changes, and completed seeks refresh position. Ordinary progress updates do not repeatedly assign metadata or position. Call `mediaSession.sync()` to explicitly refresh position; unchanged metadata remains intact. Unsupported position updates and actions are ignored. These updates follow the [Media Session position model](https://www.w3.org/TR/mediasession/#position-state).

## Cleanup

```ts
persistence.destroy();
reporter.destroy();
mediaSession.destroy();
```

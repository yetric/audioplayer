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

## Cleanup

```ts
persistence.destroy();
reporter.destroy();
mediaSession.destroy();
```

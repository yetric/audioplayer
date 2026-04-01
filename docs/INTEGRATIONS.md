# Integrations

## Persistence

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

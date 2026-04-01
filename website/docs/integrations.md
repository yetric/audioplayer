# Integrations

## Persistence

```ts
import {
  attachAudioPlayerPersistence,
  createLocalStoragePersistenceAdapter,
} from "@yetric/audioplayer";

attachAudioPlayerPersistence(player, {
  adapter: createLocalStoragePersistenceAdapter("app-player"),
});
```

## Progress reporting

```ts
import { attachAudioPlayerProgressReporter } from "@yetric/audioplayer";

attachAudioPlayerProgressReporter(player, {
  intervalMs: 5000,
  onReport(snapshot) {
    console.log(snapshot.sourceId, snapshot.currentTime);
  },
});
```

## Media Session

```ts
import { attachAudioPlayerMediaSession } from "@yetric/audioplayer";

attachAudioPlayerMediaSession(player);
```

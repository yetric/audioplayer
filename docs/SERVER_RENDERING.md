---
id: server-rendering
slug: /server-rendering
---

# Server Rendering

The core and React entry points can be imported without `window`, `Audio`, or browser storage. Creating a player on a server is safe; attempting playback reports `UNSUPPORTED_ENVIRONMENT` in `state.error`.

Create a separate player per provider or request. Do not share a module-level player between requests. React effects attach browser integrations only after mounting, so server rendering produces the initial idle state. Persisted state restores after mounting without autoplay.

## React Server Components and Next.js

Put the provider and hooks behind a client boundary. A client component can still be prerendered on the server.

```tsx
"use client";

import { AudioPlayerProvider, useAudioPlayer, useAudioPlayerProgress } from "@yetric/audioplayer/react";
import { createLocalStoragePersistenceAdapter } from "@yetric/audioplayer";

const Controls = () => {
  const player = useAudioPlayer();
  const progress = useAudioPlayerProgress();
  return <>
    <button onClick={() => void player.play({ id: "audio-1", src: "/audio.mp3" })}>Play</button>
    <progress max={1} value={progress.playedFraction} />
  </>;
};

export default function Player() {
  return <AudioPlayerProvider
    persistence={{ adapter: createLocalStoragePersistenceAdapter("audio-player") }}
    mediaSession>
    <Controls />
  </AudioPlayerProvider>;
}
```

Do not call playback commands during render. Use a user action after hydration. Server components can pass serializable source data to the client component.

`npm run test:package` checks ESM and CommonJS imports, unsupported server playback, and React `renderToString` with provider integrations and hooks. It does not run a Next.js application.

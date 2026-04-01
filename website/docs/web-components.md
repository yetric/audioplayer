# Web Components

Use the core player directly inside a custom element.

```ts
import { createAudioPlayer } from "@yetric/audioplayer";

class AudioPlayerElement extends HTMLElement {
  private readonly player = createAudioPlayer();
}

customElements.define("audio-player-demo", AudioPlayerElement);
```

The custom element owns DOM wiring only. The core player owns playback and state.

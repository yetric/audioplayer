# Angular

Use the core player directly from an Angular service.

```ts
import { Injectable } from "@angular/core";
import { createAudioPlayer } from "@yetric/audioplayer";

@Injectable({ providedIn: "root" })
export class AudioPlayerService {
  readonly player = createAudioPlayer();
}
```

Subscribe in components and render from Angular state. The playback engine stays in the core package.

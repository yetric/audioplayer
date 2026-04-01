# Angular Example

## Goal

Use the core player directly from an Angular service and component.

## Service

```ts
import { Injectable } from "@angular/core";
import {
  attachAudioPlayerMediaSession,
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  createAudioPlayer,
  createLocalStoragePersistenceAdapter,
} from "@yetric/audioplayer";

@Injectable({ providedIn: "root" })
export class AudioPlayerService {
  readonly player = createAudioPlayer();

  constructor() {
    attachAudioPlayerPersistence(this.player, {
      adapter: createLocalStoragePersistenceAdapter("angular-audioplayer"),
    });

    attachAudioPlayerProgressReporter(this.player, {
      onReport(snapshot) {
        console.log("progress", snapshot);
      },
    });

    attachAudioPlayerMediaSession(this.player);
  }
}
```

## Component

```ts
import { ChangeDetectionStrategy, Component, OnInit, signal } from "@angular/core";
import { AudioPlayerService } from "./audio-player.service";

const episode = {
  id: "angular-episode-1",
  src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  title: "Angular Example",
  artist: "Yetric",
};

@Component({
  selector: "app-player",
  template: `
    <button (click)="play()">Play</button>
    <button (click)="pause()">Pause</button>
    <button (click)="seek()">Seek to 30s</button>
    <pre>{{ state() | json }}</pre>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerComponent implements OnInit {
  readonly state = signal(this.audioPlayer.player.getState());

  constructor(private readonly audioPlayer: AudioPlayerService) {}

  ngOnInit(): void {
    this.audioPlayer.player.subscribe((state) => {
      this.state.set(state);
    });
  }

  play(): void {
    void this.audioPlayer.player.play(episode);
  }

  pause(): void {
    this.audioPlayer.player.pause();
  }

  seek(): void {
    this.audioPlayer.player.seek(30);
  }
}
```

## Notes

- No Angular-specific player engine is required.
- The Angular layer only owns rendering and DI.
- The core player remains the single source of truth.

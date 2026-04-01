# Web Component Example

## Goal

Use the core player directly from a custom element with no framework dependency.

## Example

```ts
import {
  attachAudioPlayerMediaSession,
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  createAudioPlayer,
  createLocalStoragePersistenceAdapter,
} from "@yetric/audioplayer";

const episode = {
  id: "web-component-episode-1",
  src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  title: "Web Component Example",
  artist: "Yetric",
};

class AudioPlayerElement extends HTMLElement {
  private readonly player = createAudioPlayer();
  private readonly stateEl = document.createElement("pre");

  connectedCallback(): void {
    const playButton = document.createElement("button");
    playButton.textContent = "Play";
    playButton.addEventListener("click", () => {
      void this.player.play(episode);
    });

    const pauseButton = document.createElement("button");
    pauseButton.textContent = "Pause";
    pauseButton.addEventListener("click", () => {
      this.player.pause();
    });

    const seekButton = document.createElement("button");
    seekButton.textContent = "Seek to 30s";
    seekButton.addEventListener("click", () => {
      this.player.seek(30);
    });

    this.append(playButton, pauseButton, seekButton, this.stateEl);

    attachAudioPlayerPersistence(this.player, {
      adapter: createLocalStoragePersistenceAdapter("web-component-audioplayer"),
    });

    attachAudioPlayerProgressReporter(this.player, {
      onReport(snapshot) {
        console.log("progress", snapshot);
      },
    });

    attachAudioPlayerMediaSession(this.player);

    this.player.subscribe((state) => {
      this.stateEl.textContent = JSON.stringify(state, null, 2);
    });
  }
}

customElements.define("audio-player-demo", AudioPlayerElement);
```

## Notes

- No wrapper package is required.
- The custom element owns only DOM wiring.
- The core player still owns playback, queue, state, persistence, and Media Session behavior.

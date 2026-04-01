import {
  attachAudioPlayerMediaSession,
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  createAudioPlayer,
  createLocalStoragePersistenceAdapter,
} from "../../dist/index.js";

const episode = {
  id: "example-episode-1",
  src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  title: "Example Episode",
  artist: "Yetric",
  album: "AudioPlayer Demo",
};

const player = createAudioPlayer();
const stateEl = document.querySelector("#state");

attachAudioPlayerPersistence(player, {
  adapter: createLocalStoragePersistenceAdapter("audioplayer-example"),
});

attachAudioPlayerProgressReporter(player, {
  onReport(snapshot) {
    console.log("progress", snapshot);
  },
});

attachAudioPlayerMediaSession(player);

player.subscribe((state) => {
  stateEl.textContent = JSON.stringify(state, null, 2);
});

document.querySelector("#load")?.addEventListener("click", async () => {
  await player.load(episode);
});

document.querySelector("#play")?.addEventListener("click", async () => {
  await player.play(episode);
});

document.querySelector("#pause")?.addEventListener("click", () => {
  player.pause();
});

document.querySelector("#seek")?.addEventListener("click", () => {
  player.seek(30);
});

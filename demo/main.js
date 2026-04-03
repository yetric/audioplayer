import {
  attachAudioPlayerMediaSession,
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  createAudioPlayer,
  createLocalStoragePersistenceAdapter,
} from "../src/index.ts";

const queue = [
  {
    id: "episode-1",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    title: "Episode 1",
    artist: "Yetric",
    album: "AudioPlayer Demo",
  },
  {
    id: "episode-2",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    title: "Episode 2",
    artist: "Yetric",
    album: "AudioPlayer Demo",
  },
];

const player = createAudioPlayer();
const stateEl = document.querySelector("#state");
const progressEl = document.querySelector("#progress");
const rateEl = document.querySelector("#rate");

attachAudioPlayerPersistence(player, {
  adapter: createLocalStoragePersistenceAdapter("audioplayer-demo"),
});

attachAudioPlayerProgressReporter(player, {
  intervalMs: 5000,
  onReport(snapshot) {
    progressEl.textContent = JSON.stringify(snapshot, null, 2);
  },
});

attachAudioPlayerMediaSession(player);

player.subscribe((state) => {
  stateEl.textContent = JSON.stringify(state, null, 2);
});

document.querySelector("#load-first")?.addEventListener("click", async () => {
  await player.load(queue[0]);
});

document.querySelector("#play")?.addEventListener("click", async () => {
  await player.play();
});

document.querySelector("#pause")?.addEventListener("click", () => {
  player.pause();
});

document.querySelector("#seek-30")?.addEventListener("click", () => {
  player.seek(30);
});

document.querySelector("#previous")?.addEventListener("click", async () => {
  await player.previous();
});

document.querySelector("#next")?.addEventListener("click", async () => {
  await player.next();
});

document.querySelector("#load-queue")?.addEventListener("click", async () => {
  await player.setQueue(queue, {
    startAtId: "episode-1",
    autoplay: true,
  });
});

document.querySelector("#repeat-off")?.addEventListener("click", () => {
  player.setRepeatMode("off");
});

document.querySelector("#repeat-all")?.addEventListener("click", () => {
  player.setRepeatMode("all");
});

document.querySelector("#clear-queue")?.addEventListener("click", () => {
  player.clearQueue();
});

rateEl?.addEventListener("change", (event) => {
  const nextRate = Number(event.target.value);
  player.setRate(nextRate);
});

import {
  attachAudioPlayerMediaSession,
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  attachAudioPlayerCues,
  createPodcastChapterCues,
  createAudioPlayer,
  createLocalStoragePersistenceAdapter,
} from "../src/index.ts";
import chapterDocument from "./chapters.json";

const queue = [
  {
    id: "episode-1",
    src: new URL("../examples/audio/tone.wav", import.meta.url).href,
    title: "Episode 1",
    artist: "Yetric",
    album: "AudioPlayer Demo",
  },
  {
    id: "episode-2",
    src: new URL("../examples/audio/tone.wav", import.meta.url).href,
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

const chapterCues = createPodcastChapterCues(chapterDocument, { sourceId: queue[0].id });
const cues = attachAudioPlayerCues(player, {
  getCues: (source) => source.id === queue[0].id ? chapterCues : [],
});
const cardsEl = document.querySelector("#cards");
const chaptersEl = document.querySelector("#chapters");
const chapterImages = {
  "./studio.svg": new URL("./studio.svg", import.meta.url).href,
  "./recording.svg": new URL("./recording.svg", import.meta.url).href,
};
for (const cue of chapterCues.filter(({ data }) => data.toc !== false)) {
  const button = document.createElement("button");
  button.textContent = cue.data.title ?? `Chapter at ${cue.start}s`;
  button.onclick = () => player.seek(cue.start);
  chaptersEl.append(button);
}
cues.subscribe(({ activeCues, sourceId }) => {
  cardsEl.replaceChildren();
  for (const { data: chapter } of activeCues) {
    const card = document.createElement("article");
    const title = document.createElement("p");
    title.textContent = chapter.title ?? "Recording detail";
    card.append(title);
    if (chapter.img) {
      const image = document.createElement("img");
      image.src = chapterImages[chapter.img];
      image.alt = chapter.title ?? "Illustration of the recording";
      image.width = 240;
      card.append(image);
    }
    if (chapter.url) {
      const link = document.createElement("a");
      link.href = chapter.url;
      link.textContent = "Read more";
      card.append(link);
    }
    cardsEl.append(card);
  }
  chaptersEl.hidden = sourceId !== queue[0].id;
});

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

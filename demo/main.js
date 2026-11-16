import {
  attachAudioPlayerMediaSession,
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  attachAudioPlayerChapters,
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
const chapterNavigation = attachAudioPlayerChapters(player, {
  getCues: (source) => source.id === queue[0].id ? chapterCues : [],
});
const cues = chapterNavigation.cues;
const cardsEl = document.querySelector("#cards");
const chaptersEl = document.querySelector("#chapters");
const chapterImages = {
  "./studio.svg": new URL("./studio.svg", import.meta.url).href,
  "./recording.svg": new URL("./recording.svg", import.meta.url).href,
};
for (const cue of chapterCues.filter(({ data }) => data.toc !== false)) {
  const button = document.createElement("button");
  button.textContent = cue.data.title ?? `Chapter at ${cue.start}s`;
  button.onclick = () => chapterNavigation.seekTo(cue.id);
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

const destinations = player.destinations();
const remoteButton = document.querySelector("#remote-output");
const outputButton = document.querySelector("#audio-output");
const defaultButton = document.querySelector("#default-output");
const destinationState = document.querySelector("#destination-state");
const destinationResult = document.querySelector("#destination-result");
destinations.subscribe(({ remote, output, pending }) => {
  remoteButton.disabled = pending !== null || remote.picker === null;
  outputButton.disabled = pending !== null || !output.canSelect;
  defaultButton.disabled = pending !== null || !output.canSetSink;
  rateEl.disabled = remote.connection !== "disconnected";
  destinationState.textContent = pending ? "Waiting for output selection..." : [
    remote.picker ? `Remote output: ${remote.connection}; availability ${remote.availability}.`
      : "Remote picker unavailable. Use system controls.",
    output.canSelect ? `Audio output picker available; device availability ${output.availability}.`
      : "Audio output picker unavailable. Use system settings.",
    output.availability === "unavailable" ? "Selected device is unavailable. Choose another output or explicitly use system default." : "",
    remote.connection !== "disconnected" ? "Remote seek, rate and volume support is unknown. Use receiver controls if needed." : "",
  ].filter(Boolean).join(" ");
});
const showDestinationResult = (result) => {
  const messages = {
    prompted: "Picker request completed. Connection status is reported separately.",
    applied: "The browser applied the audio output selection.",
    unsupported: "Output selection is unavailable. Use system settings.",
    busy: "An output selection is already pending.",
    destroyed: "Output controls have been closed.",
    superseded: "The source changed. Choose an output again.",
    failed: `Output selection failed (${result.cause?.name ?? "Error"}). It may have been canceled or denied. Use the picker to retry or use system settings.`,
  };
  destinationResult.textContent = messages[result.status];
};
remoteButton.onclick = () => { void destinations.promptRemote().then(showDestinationResult); };
outputButton.onclick = () => { void destinations.selectOutput().then(showDestinationResult); };
defaultButton.onclick = () => { void destinations.setOutput("").then(showDestinationResult); };
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) player.destroy();
});

const previousChapter = document.querySelector("#previous-chapter");
const nextChapter = document.querySelector("#next-chapter");
chapterNavigation.subscribe(({ current, previous, next }) => {
  previousChapter.disabled = previous === null;
  nextChapter.disabled = next === null;
  document.querySelector("#current-chapter").textContent = current?.data.title ?? "No current chapter";
});
previousChapter.onclick = () => chapterNavigation.previous();
nextChapter.onclick = () => chapterNavigation.next();
player.subscribe(({ media }) => {
  document.querySelector("#media-state").textContent = media.seeking ? "Seeking..."
    : media.buffering ? "Waiting for audio..." : `Media readyState: ${media.readyState ?? "unknown"}`;
});

import { createAudioPlayer, attachAudioPlayerCues } from "../../src/index.ts";
import story from "./story.json";
import { getStoryContext } from "./context.js";

const $ = (selector) => document.querySelector(selector);
const time = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const audioURLs = [
  new URL("./assets/the-parcel.mp3", import.meta.url).href,
  new URL("./assets/the-window.mp3", import.meta.url).href,
];
const artwork = new URL("./assets/north-point.svg", import.meta.url).href;
const map = new URL("./assets/map.svg", import.meta.url).href;
const sources = story.episodes.map((episode, index) => ({
  id: episode.id, src: audioURLs[index], title: episode.title,
  artist: "The Last Signal", durationHint: episode.duration,
}));
const player = createAudioPlayer();
const cues = attachAudioPlayerCues(player, {
  getCues: (source) => story.episodes.find((episode) => episode.id === source.id).passages.map((passage) => ({
    id: passage.id, start: passage.start, end: passage.end, data: passage,
  })),
});
const dialog = $("#detail-dialog");
let context = null;
let savedQuestion = false;
let detour = null;
let seeking = false;
let renderedKey = "";

function renderQuestion() {
  $("#curiosity").hidden = !context?.canAsk;
  const answered = savedQuestion && context?.canAnswer;
  $("#save-question").hidden = answered;
  $("#save-question").disabled = savedQuestion;
  $("#save-question").textContent = savedQuestion ? "Question saved" : "Save my question";
  $("#read-answer").hidden = !answered;
  $("#question-status").textContent = answered
    ? "The story has now given you enough to explore your question."
    : savedQuestion ? "Saved for this visit. Keep listening; we will respect the story's reveal order."
      : "Keep this question with you as the story unfolds.";
}

function renderContext() {
  const state = player.getState();
  const snapshot = cues.getSnapshot();
  let passageId = snapshot.sourceId === state.currentSourceId ? snapshot.activeCues[0]?.id : null;
  if (state.status === "ended") {
    passageId = story.episodes.find((episode) => episode.id === state.currentSourceId)?.passages.at(-1).id;
  }
  context = seeking ? null : getStoryContext(story, state.currentSourceId, passageId);
  const key = context ? `${context.episode.id}/${context.passage.id}` : "empty";
  if (key === renderedKey) return;
  renderedKey = key;
  $("#passage-title").textContent = context?.passage.title ?? "Finding your place...";
  $("#passage-text").textContent = context?.passage.text ?? "Context will appear when the audio is ready.";
  $("#context-cards").replaceChildren();
  $("#transcript").replaceChildren();
  for (const passage of context?.visiblePassages ?? []) {
    const card = document.createElement("button");
    card.className = `context-card${passage === context.passage ? " current" : ""}`;
    const kind = document.createElement("span");
    kind.className = "kind";
    kind.textContent = `${passage.card.kind} / Explore`;
    const title = document.createElement("strong");
    title.textContent = passage.card.title;
    const summary = document.createElement("p");
    summary.textContent = passage.card.summary;
    card.append(kind, title, summary);
    card.onclick = () => openDetail(passage.card);
    $("#context-cards").append(card);

    const transcript = document.createElement("button");
    transcript.className = "transcript-passage";
    const label = document.createElement("strong");
    label.textContent = `${time(passage.start)} / ${passage.title}`;
    transcript.append(label, document.createTextNode(passage.text));
    transcript.onclick = () => player.seek(passage.start);
    $("#transcript").append(transcript);
  }
  renderQuestion();
}

function openDetail(card) {
  if (detour) return;
  const state = player.getState();
  detour = { sourceId: state.currentSourceId, position: state.currentTime, playing: state.status === "playing" };
  player.pause();
  $("#detail-kind").textContent = card.kind.toUpperCase();
  $("#detail-title").textContent = card.title;
  $("#detail-body").textContent = card.body;
  $("#detail-art").replaceChildren();
  if (card.image === "map" || card.image === "lamp" || card.image === "archive") {
    const image = document.createElement("img");
    image.src = card.image === "map" ? map : artwork;
    image.alt = card.image === "map" ? "Map of the archive, station, lighthouse, and ferry steps in fictional Bellwether." : "An illustrated light in the window at North Point.";
    $("#detail-art").append(image);
  } else {
    const documentArt = document.createElement("div");
    documentArt.className = "document-art";
    documentArt.textContent = card.summary;
    $("#detail-art").append(documentArt);
  }
  $("#return-note").textContent = `${state.currentSource.title} / ${time(detour.position)} / ${detour.playing ? "Playback resumes when you return." : "Playback stays paused when you return."}`;
  dialog.showModal();
}

function returnToStory() {
  const checkpoint = detour;
  if (!checkpoint) return;
  detour = null;
  dialog.close();
  const state = player.getState();
  if (state.currentSourceId !== checkpoint.sourceId) return;
  // The modal pauses playback and blocks navigation, so the position normally stays unchanged.
  if (Math.abs(state.currentTime - checkpoint.position) > 0.05) player.seek(checkpoint.position);
  if (checkpoint.playing) void player.play();
}

player.on("pause", ({ state }) => {
  if (detour && detour.sourceId === state.currentSourceId) {
    // Native pause reports the actual stopping position after the last timeupdate snapshot.
    detour.position = state.currentTime;
    $("#return-note").textContent = `${state.currentSource.title} / ${time(detour.position)} / ${detour.playing ? "Playback resumes when you return." : "Playback stays paused when you return."}`;
  }
});

async function loadEpisode(index, autoplay = false) {
  detour = null;
  if (dialog.open) dialog.close();
  seeking = false;
  await player.load(sources[index]);
  if (autoplay) await player.play();
}

player.on("seeking", () => { seeking = true; renderContext(); });
player.on("seeked", () => { seeking = false; renderContext(); });
player.on("error", () => { seeking = false; renderContext(); });
cues.subscribe(renderContext);
player.subscribe((state) => {
  const index = sources.findIndex((source) => source.id === state.currentSourceId);
  const ready = index >= 0 && state.status !== "loading" && state.status !== "idle" && state.status !== "error";
  for (const selector of ["#play", "#back", "#forward", "#seek", "#begin"]) $(selector).disabled = !ready;
  $("#status").textContent = ({ idle: "Opening the archive", loading: "Loading audio", ready: "Ready to listen", playing: "Playing", paused: "Paused", ended: "Episode complete", error: "Playback unavailable" })[state.status];
  $("#play").setAttribute("aria-label", state.status === "playing" ? "Pause" : "Play");
  $("#play span").textContent = state.status === "playing" ? "II" : "\u25b6";
  $("#seek").max = String(state.duration || 1);
  $("#seek").value = String(state.currentTime);
  $("#seek").setAttribute("aria-valuetext", `${time(state.currentTime)} of ${time(state.duration)}`);
  $("#elapsed").textContent = time(state.currentTime);
  $("#total").textContent = time(state.duration);
  $("#error").hidden = !state.error;
  $("#error").textContent = state.error ? "The audio could not play. Select an episode to reload it, then press Play." : "";
  $("#episode-end").hidden = state.status !== "ended";
  $("#continue").hidden = index !== 0;
  $("#end-message").textContent = index === 0 ? "There is another side to this story." : "A light kept on for someone coming home. Thank you for listening.";
  if (index >= 0) {
    $("#now-playing").textContent = `0${index + 1}. ${story.episodes[index].title}`;
    $("#episode-label").textContent = `PART 0${index + 1} / ${story.episodes[index].title.toUpperCase()}`;
    for (const button of document.querySelectorAll("[data-episode]")) {
      const active = Number(button.dataset.episode) === index;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", String(active));
    }
  }
  if (state.status === "ended") renderContext();
});

$("#begin").onclick = async () => {
  await loadEpisode(0, true);
  $("#companion").scrollIntoView();
};
$("#play").onclick = () => player.toggle();
$("#back").onclick = () => player.skip(-10);
$("#forward").onclick = () => player.skip(10);
$("#seek").addEventListener("input", (event) => player.seek(Number(event.target.value)));
$("#speed").onchange = (event) => player.setRate(Number(event.target.value));
$("#continue").onclick = () => loadEpisode(1, true);
$("#context-enabled").onchange = (event) => {
  $("#context-content").hidden = !event.target.checked;
  $("#audio-only").hidden = event.target.checked;
};
$("#save-question").onclick = () => { savedQuestion = true; renderQuestion(); };
$("#read-answer").onclick = () => {
  if (context?.canAnswer && savedQuestion) openDetail({
    kind: "Your question", title: "Why are there two bells?", image: "lamp",
    body: "The lighthouse bell marked midnight. The ferry's hand bell confirmed that its passengers were safely ashore. The blue lamp stayed on until that second bell. What sounded like a mystery was a small act of care.",
  });
};
$("#return").onclick = returnToStory;
$("#close-detail").onclick = returnToStory;
dialog.addEventListener("cancel", (event) => { event.preventDefault(); returnToStory(); });
for (const button of document.querySelectorAll("[data-episode]")) {
  button.onclick = () => loadEpisode(Number(button.dataset.episode));
}
story.episodes.forEach((episode, index) => { $(`#duration-${index}`).textContent = `${time(episode.duration)} / FICTION`; });
window.addEventListener("pagehide", (event) => {
  if (event.persisted) player.pause();
  else { cues.destroy(); player.destroy(); }
});
void loadEpisode(0);

import { attachAudioPlayerChapters, createAudioPlayer, createPodcastChapterCues, type AudioPlayer } from "../../src/index";
import { HandoffAudio, type PrototypeMedia } from "./handoff";
import { SdkReceiver, type CastConstructors, type CastSession } from "./sdk-receiver";

interface CastContext {
  setOptions(options: { receiverApplicationId: string; autoJoinPolicy: string; resumeSavedSession: boolean }): void;
  requestSession(): Promise<void>;
  getCurrentSession(): CastSession | null;
  addEventListener(name: string, listener: (event: { sessionState: string }) => void): void;
}
declare global {
  interface Window {
    __onGCastApiAvailable?: (available: boolean) => void;
    cast?: { framework: { CastContext: { getInstance(): CastContext }; CastContextEventType: { SESSION_STATE_CHANGED: string } } };
    chrome?: { cast: { AutoJoinPolicy: { PAGE_SCOPED: string }; Volume: CastConstructors["Volume"]; media: CastConstructors & { DEFAULT_MEDIA_RECEIVER_APP_ID: string } } };
  }
}
const button = (id: string) => document.querySelector<HTMLButtonElement>(`#${id}`)!;
const url = document.querySelector<HTMLInputElement>("#url")!;
const contentType = document.querySelector<HTMLInputElement>("#type")!;
const result = document.querySelector<HTMLElement>("#result")!;
const revision = document.querySelector<HTMLInputElement>("#revision")!;
let descriptor: PrototypeMedia | null = null;
url.value = new URL("../../demo/story/assets/the-parcel.mp3", import.meta.url).href;
const NativeAudio = window.Audio;
const local = new NativeAudio();
let player: AudioPlayer;
const audio = new HandoffAudio(local, () => {
  const source = player.getState().currentSource;
  if (!source || !descriptor || source.src !== descriptor.mediaUrl) throw new Error("Load a source first");
  return descriptor;
});
// A synchronous test seam only. Production integration must use an internal transport boundary.
try {
  window.Audio = function () { return audio; } as unknown as typeof Audio;
  player = createAudioPlayer();
} finally { window.Audio = NativeAudio; }
let receiver: SdkReceiver | undefined;
let receiverSession: CastSession | undefined;
player.on("destroy", () => { audio.dispose(); receiver?.dispose(); });
const chapters = attachAudioPlayerChapters(player, { getCues: (source) => createPodcastChapterCues({
  version: "1.2.0", chapters: [{ startTime: 0, title: "Opening" }, { startTime: 10, title: "Second chapter" }],
}, { sourceId: source.id }) });
chapters.subscribe(({ current }) => { document.querySelector("#chapter")!.textContent = current?.data.title ?? "No current chapter"; });
player.subscribe((state) => { document.querySelector("#state")!.textContent = JSON.stringify(state, null, 2); });
button("load").onclick = () => {
  if (!url.reportValidity() || !revision.reportValidity() || !url.value.startsWith("https://")) { result.textContent = "Enter a receiver-reachable public HTTPS media URL."; return; }
  descriptor = { sourceId: "fixture", audioRevision: revision.value, mediaUrl: url.value, contentType: contentType.value };
  void player.load({ id: descriptor.sourceId, src: descriptor.mediaUrl });
};
button("play").onclick = () => { void player.play(); };
button("pause").onclick = () => player.pause();
button("seek").onclick = () => player.seek(10);
button("next").onclick = () => { chapters.next(); };
const show = (value: { status: string; cause?: unknown }) => { result.textContent = `${value.status}${value.cause ? `: ${String(value.cause)}` : ""}`; };
button("sdk").onclick = () => {
  if (!window.isSecureContext || location.protocol !== "https:") { result.textContent = "Google Cast sender testing requires HTTPS."; return; }
  button("sdk").disabled = true;
  window.__onGCastApiAvailable = (available) => {
    if (!available || !window.cast || !window.chrome?.cast) { result.textContent = "Google Cast is unavailable in this browser."; return; }
    const context = window.cast.framework.CastContext.getInstance();
    context.setOptions({ receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.PAGE_SCOPED, resumeSavedSession: false });
    context.addEventListener(window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED, ({ sessionState }) => {
      if (sessionState === "SESSION_ENDED") receiver?.disconnected();
    });
    button("connect").disabled = false;
    result.textContent = "SDK ready. Choose an idle receiver explicitly; existing media sessions are refused.";
    button("connect").onclick = () => {
      // requestSession must run directly within the click activation.
      void context.requestSession().then(async () => {
        const session = context.getCurrentSession();
        if (!session) throw new Error("No receiver session");
        const candidate = receiverSession === session && receiver ? receiver
          : new SdkReceiver(session, { ...window.chrome!.cast.media, Volume: window.chrome!.cast.Volume });
        const connected = await audio.connect(candidate);
        show(connected);
        const active = candidate.getState().requestId !== null && candidate.getState().requestId !== "unowned";
        if (active) { if (receiver !== candidate) receiver?.dispose(); receiver = candidate; receiverSession = session; }
        else if (candidate !== receiver) candidate.dispose();
        button("connect").disabled = active;
        button("local").disabled = !active;
        button("resume").disabled = !active;
      }).catch((cause) => show({ status: "failed", cause }));
    };
  };
  const script = document.createElement("script");
  script.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
  script.onerror = () => { result.textContent = "Cast SDK failed to load. Local playback remains available."; button("sdk").disabled = false; };
  document.head.append(script);
};
const returned = (value: Awaited<ReturnType<typeof audio.returnToLocal>>) => {
  show(value);
  if (value.status !== "local") return;
  button("connect").disabled = false;
  button("local").disabled = true;
  button("resume").disabled = true;
};
button("local").onclick = () => { void audio.returnToLocal().then(returned); };
button("resume").onclick = () => { void audio.returnToLocal(true).then(returned); };
window.addEventListener("pagehide", (event) => { if (!event.persisted) player.destroy(); });

import { afterEach, expect, it, vi } from "vitest";
import { attachAudioPlayerChapters, attachAudioPlayerPersistence, createAudioPlayer, createPodcastChapterCues } from "../../src/index";
import { HandoffAudio, type PrototypeMedia, type PrototypeReceiver, type ReceiverState } from "./handoff";

class LocalAudio extends EventTarget {
  src = "";
  preload = "";
  currentTime = 0;
  duration = 60;
  playbackRate = 1;
  volume = 1;
  muted = false;
  paused = true;
  readyState = 4;
  seeking = false;
  error = null;
  buffered = { length: 0 };
  getAttribute(name: string) { return name === "src" ? this.src || null : null; }
  load() { this.dispatchEvent(new Event("loadedmetadata")); }
  async play() { this.paused = false; this.dispatchEvent(new Event("play")); }
  pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
  tick(time: number) { this.currentTime = time; this.dispatchEvent(new Event("timeupdate")); }
}
class Receiver implements PrototypeReceiver {
  capabilities = { seek: true, rate: true, volume: true };
  state: ReceiverState = { requestId: null, sourceId: null, audioRevision: null, currentTime: 0, duration: 60,
    paused: true, rate: 1, volume: 1, muted: false, buffering: false, connected: true, ended: false };
  listeners = new Set<(state: ReceiverState) => void>();
  loadGate: Promise<void> = Promise.resolve();
  seekGate: Promise<void> = Promise.resolve();
  failLoad = false;
  failStop = false;
  failPlay = false;
  loads: Array<PrototypeMedia & { requestId: string; currentTime: number; autoplay: false }> = [];
  stops: string[] = [];
  seeks: number[] = [];
  getState() { return this.state; }
  publish(update: Partial<ReceiverState>) {
    this.state = { ...this.state, ...update };
    for (const listener of this.listeners) listener(this.state);
  }
  subscribe(listener: (state: ReceiverState) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  async load(request: PrototypeMedia & { requestId: string; currentTime: number; autoplay: false }) {
    this.loads.push(request);
    await this.loadGate;
    if (this.failLoad) throw new Error("load failed");
    this.publish({ requestId: request.requestId, sourceId: request.sourceId, audioRevision: request.audioRevision,
      currentTime: request.currentTime, paused: true, connected: true, ended: false });
  }
  async play(id: string) {
    if (this.failPlay) throw new Error("play failed");
    if (id === this.state.requestId) this.publish({ paused: false });
  }
  async pause(id: string) { if (id === this.state.requestId) this.publish({ paused: true }); }
  async seek(id: string, currentTime: number) {
    this.seeks.push(currentTime);
    await this.seekGate;
    if (id === this.state.requestId) this.publish({ currentTime });
  }
  async setRate(id: string, rate: number) { if (id === this.state.requestId) this.publish({ rate }); }
  async setVolume(id: string, volume: number, muted: boolean) { if (id === this.state.requestId) this.publish({ volume, muted }); }
  async stop(id: string) {
    this.stops.push(id);
    if (this.failStop) throw new Error("stop unacknowledged");
    if (id === this.state.requestId) this.publish({ paused: true, requestId: null });
  }
}
const first = { id: "first", src: "https://media.example/first.mp3" };
const second = { id: "second", src: "https://media.example/second.mp3" };
const settle = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const setup = async (playing = true) => {
  const local = new LocalAudio();
  let player: ReturnType<typeof createAudioPlayer>;
  const audio = new HandoffAudio(local as unknown as HTMLAudioElement, () => {
    const source = player.getState().currentSource!;
    return { sourceId: source.id, audioRevision: "revision-1", mediaUrl: source.src, contentType: "audio/mpeg" };
  });
  vi.stubGlobal("Audio", function () { return audio; });
  player = createAudioPlayer();
  player.on("destroy", () => audio.dispose());
  await player.setQueue([first, second]);
  if (playing) await player.play();
  local.tick(5);
  const chapters = attachAudioPlayerChapters(player, { getCues: (source) => createPodcastChapterCues({
    version: "1.2.0", chapters: [{ startTime: 0, title: "Intro" }, { startTime: 10, title: "Later" }],
  }, { sourceId: source.id }) });
  return { player, audio, local, chapters, receiver: new Receiver() };
};
afterEach(() => vi.unstubAllGlobals());

it.each([false, true])("hands off intent=%s, one authoritative position, queue and cues through the real player", async (playing) => {
  const { player, audio, local, chapters, receiver } = await setup(playing);
  expect(await audio.connect(receiver)).toEqual({ status: "connected" });
  expect(local.paused).toBe(true);
  expect(receiver.state.paused).toBe(!playing);
  expect(receiver.loads[0].autoplay).toBe(false);
  const current = player.getState();
  local.tick(40);
  expect(player.getState()).toBe(current);
  receiver.publish({ currentTime: 12 });
  expect(player.getState().currentTime).toBe(12);
  expect(chapters.getSnapshot().current?.data.title).toBe("Later");
  expect(chapters.cues.getSnapshot().activeCues[0].data.title).toBe("Later");
  expect(player.getState().queue.itemIds).toEqual([first.id, second.id]);
  player.destroy();
});

it("reconciles movement and pause intent while receiver loading is delayed", async () => {
  const { player, audio, local, receiver } = await setup();
  let ready!: () => void;
  receiver.loadGate = new Promise((resolve) => { ready = resolve; });
  const handoff = audio.connect(receiver);
  expect(local.paused).toBe(false);
  expect(receiver.state.paused).toBe(true);
  local.tick(9);
  player.pause();
  ready();
  expect((await handoff).status).toBe("connected");
  expect(receiver.state.currentTime).toBe(9);
  expect(receiver.state.paused).toBe(true);
  expect(player.getState().status).toBe("paused");
  player.destroy();
});

it.each(["load", "unload", "destroy"])("does not restore stale media after %s during connection", async (action) => {
  const { player, audio, receiver } = await setup();
  let ready!: () => void;
  receiver.loadGate = new Promise((resolve) => { ready = resolve; });
  const pending = audio.connect(receiver);
  if (action === "load") await player.load(second);
  if (action === "unload") player.unload();
  if (action === "destroy") player.destroy();
  const current = player.getState();
  ready();
  expect((await pending).status).toBe("superseded");
  expect(player.getState()).toBe(current);
  expect(receiver.state.paused).toBe(true);
  expect(receiver.stops).toContain(receiver.loads[0].requestId);
  player.destroy();
});

it("retains local playback when load fails and refuses an unrelated receiver session", async () => {
  const { player, audio, local, receiver } = await setup();
  receiver.failLoad = true;
  expect((await audio.connect(receiver)).status).toBe("failed");
  expect(local.paused).toBe(false);
  expect(player.getState().status).toBe("playing");
  receiver.failLoad = false;
  receiver.state.requestId = "unrelated";
  const stops = receiver.stops.length;
  expect((await audio.connect(receiver)).status).toBe("failed");
  expect(receiver.loads).toHaveLength(1);
  expect(receiver.stops).toHaveLength(stops);
  player.destroy();
});

it("uses remote play/pause/seek and waits for completed seeking to update cards", async () => {
  const { player, audio, chapters, receiver } = await setup();
  await audio.connect(receiver);
  player.pause();
  await settle();
  expect(receiver.state.paused).toBe(true);
  await player.play();
  expect(receiver.state.paused).toBe(false);
  const entered = vi.fn();
  chapters.cues.on("cueenter", entered);
  player.seek(15);
  expect(entered).not.toHaveBeenCalled();
  await settle();
  expect(player.getState().currentTime).toBe(15);
  expect(entered).toHaveBeenCalledOnce();
  expect(player.getState().media.seeking).toBe(false);
  player.destroy();
});

it("serializes delayed seeks and ignores superseded acknowledgments", async () => {
  const { player, audio, chapters, receiver } = await setup();
  await audio.connect(receiver);
  let ready!: () => void;
  receiver.seekGate = new Promise((resolve) => { ready = resolve; });
  const entered = vi.fn();
  chapters.cues.on("cueenter", entered);
  player.seek(15);
  await settle();
  player.seek(3);
  ready();
  await settle();
  expect(receiver.seeks.slice(-2)).toEqual([15, 3]);
  expect(player.getState().currentTime).toBe(3);
  expect(chapters.getSnapshot().current?.start).toBe(0);
  expect(entered).not.toHaveBeenCalled();
  player.destroy();
});

it("rejects unsupported setting changes without reporting success", async () => {
  const { player, audio, receiver } = await setup();
  receiver.capabilities = { seek: false, rate: false, volume: false };
  await audio.connect(receiver);
  player.setRate(2);
  expect(player.getState().rate).toBe(1);
  expect(player.getState().error?.code).toBe("INVALID_RATE");
  player.setVolume(0.2);
  expect(player.getState().volume).toBe(1);
  expect(player.getState().error?.code).toBe("INVALID_VOLUME");
  player.seek(20);
  expect(player.getState().currentTime).toBe(5);
  expect(player.getState().error?.code).toBe("SEEK_ERROR");
  player.destroy();
});

it("advances the sender queue exactly once and ignores old receiver and local ended events", async () => {
  const { player, audio, local, receiver } = await setup();
  await audio.connect(receiver);
  const old = { ...receiver.state };
  receiver.publish({ currentTime: 60, ended: true, paused: true });
  receiver.publish({ currentTime: 60, ended: true, paused: true });
  local.dispatchEvent(new Event("ended"));
  await settle();
  expect(receiver.loads.map((load) => load.sourceId)).toEqual([first.id, second.id]);
  expect(player.getState().currentSourceId).toBe(second.id);
  expect(player.getState().status).toBe("playing");
  for (const listener of receiver.listeners) listener({ ...old, ended: true });
  expect(player.getState().currentSourceId).toBe(second.id);
  expect(receiver.loads).toHaveLength(2);
  player.destroy();
});

it("reports receiver buffering independently and persists receiver-observed positions", async () => {
  const { player, audio, receiver } = await setup();
  await audio.connect(receiver);
  const save = vi.fn();
  const persistence = attachAudioPlayerPersistence(player, { autoRestore: false,
    adapter: { load: () => null, clear: vi.fn(), save } });
  receiver.publish({ buffering: true });
  expect(player.getState().media.buffering).toBe(true);
  expect(player.getState().status).toBe("playing");
  receiver.publish({ buffering: false, currentTime: 17 });
  persistence.save();
  expect(save.mock.calls.at(-1)?.[0].currentTime).toBe(17);
  player.destroy();
  persistence.destroy();
});

it("keeps local silent on disconnect or failed stop, then returns only on explicit action", async () => {
  const { player, audio, local, receiver } = await setup();
  await audio.connect(receiver);
  receiver.publish({ currentTime: 13 });
  receiver.publish({ connected: false, currentTime: 0 });
  expect(local.paused).toBe(true);
  expect(player.getState().currentTime).toBe(13);
  receiver.failStop = true;
  expect((await audio.returnToLocal(true)).status).toBe("failed");
  expect(local.paused).toBe(true);
  receiver.failStop = false;
  expect((await audio.returnToLocal()).status).toBe("local");
  expect(local.currentTime).toBe(13);
  expect(local.paused).toBe(true);
  await player.play();
  expect(local.paused).toBe(false);
  player.destroy();
});

it("does not restart local sound after receiver play fails during commit", async () => {
  const { player, audio, local, receiver } = await setup();
  receiver.failPlay = true;
  expect((await audio.connect(receiver)).status).toBe("failed");
  expect(local.paused).toBe(true);
  expect(receiver.state.paused).toBe(true);
  expect((await audio.returnToLocal(true)).status).toBe("local");
  expect(local.paused).toBe(false);
  player.destroy();
});

it("rejects a mismatched audio revision before stopping local playback", async () => {
  const { player, audio, local, receiver } = await setup();
  const getState = receiver.getState.bind(receiver);
  vi.spyOn(receiver, "getState").mockImplementation(() => ({ ...getState(), audioRevision: "wrong-revision" }));
  expect((await audio.connect(receiver)).status).toBe("failed");
  expect(local.paused).toBe(false);
  expect(player.getState().currentSourceId).toBe(first.id);
  player.destroy();
});

it("holds source identity if receiver status suddenly refers to different media", async () => {
  const { player, audio, local, receiver } = await setup();
  await audio.connect(receiver);
  receiver.publish({ sourceId: "unrelated", currentTime: 45 });
  expect(player.getState().currentSourceId).toBe(first.id);
  expect(player.getState().currentTime).toBe(5);
  expect(player.getState().status).toBe("error");
  expect(local.paused).toBe(true);
  player.destroy();
});

it("preserves a newer pause while explicit local return awaits stop acknowledgment", async () => {
  const { player, audio, local, receiver } = await setup();
  await audio.connect(receiver);
  let done!: () => void;
  const originalStop = receiver.stop.bind(receiver);
  vi.spyOn(receiver, "stop").mockImplementation(async (id) => {
    await new Promise<void>((resolve) => { done = resolve; });
    await originalStop(id);
  });
  const returning = audio.returnToLocal(true);
  player.pause();
  player.seek(8);
  done();
  expect((await returning).status).toBe("local");
  expect(local.paused).toBe(true);
  expect(local.currentTime).toBe(8);
  expect(player.getState().media.seeking).toBe(false);
  player.destroy();
});

it("unloads the owned remote source and ignores receiver callbacks after destruction", async () => {
  const { player, audio, local, receiver } = await setup();
  await audio.connect(receiver);
  const requestId = receiver.state.requestId!;
  player.unload();
  await settle();
  expect(receiver.stops).toContain(requestId);
  expect(receiver.state.paused).toBe(true);
  expect(player.getState().currentSourceId).toBeNull();
  player.destroy();
  expect(receiver.listeners.size).toBe(0);
  const current = player.getState();
  receiver.publish({ requestId, currentTime: 30, paused: false });
  local.tick(25);
  expect(player.getState()).toBe(current);
});

it("reconciles position again after delayed setting acknowledgments before receiver play", async () => {
  const { player, audio, local, receiver } = await setup();
  let done!: () => void;
  const setVolume = receiver.setVolume.bind(receiver);
  vi.spyOn(receiver, "setVolume").mockImplementation(async (...args) => {
    await new Promise<void>((resolve) => { done = resolve; });
    await setVolume(...args);
  });
  const connecting = audio.connect(receiver);
  await settle();
  local.tick(11);
  done();
  expect((await connecting).status).toBe("connected");
  expect(receiver.state.currentTime).toBe(11);
  expect(local.paused).toBe(true);
  expect(receiver.state.paused).toBe(false);
  player.destroy();
});

it("honors a reentrant pause at the authority boundary instead of starting receiver sound", async () => {
  const { player, audio, receiver } = await setup();
  const off = player.on("pause", () => player.pause());
  expect((await audio.connect(receiver)).status).toBe("connected");
  expect(receiver.state.paused).toBe(true);
  off();
  player.destroy();
});

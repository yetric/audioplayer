import { expect, it, vi } from "vitest";
import { SdkReceiver, type CastMediaSession } from "./sdk-receiver";

const setup = () => {
  const listeners = new Set<(alive: boolean) => void>();
  let position = 5;
  const media: CastMediaSession = {
    mediaSessionId: 1, media: { contentId: "https://media.example/audio.wav", duration: 30 },
    playerState: "PAUSED", playbackRate: 1, volume: { level: 1, muted: false },
    getEstimatedTime: vi.fn(() => position), supportsCommand: () => true,
    addUpdateListener: (listener) => { listeners.add(listener); }, removeUpdateListener: (listener) => { listeners.delete(listener); },
    play: (_request, done) => { media.playerState = "PLAYING"; done(); },
    pause: (_request, done) => { media.playerState = "PAUSED"; done(); },
    stop: vi.fn((_request, done) => { media.playerState = "IDLE"; done(); }),
    seek: (request, done) => { position = request.currentTime; done(); },
    setVolume: (request, done) => { media.volume = request.volume; done(); },
  };
  let current: CastMediaSession | null = null;
  const session = { getMediaSession: () => current, loadMedia: vi.fn(async () => { current = media; }) };
  const constructors = {
    MediaInfo: class { constructor(public contentId: string, public contentType: string) {} },
    LoadRequest: class { autoplay = true; currentTime = 0; constructor(public media: { contentId: string }) {} },
    SeekRequest: class { currentTime = 0; },
    Volume: class { constructor(public level: number, public muted: boolean) {} },
    VolumeRequest: class { constructor(public volume: { level: number; muted: boolean }) {} },
    MediaCommand: { SEEK: "seek", STREAM_VOLUME: "stream_volume", STREAM_MUTE: "stream_mute" },
  };
  const receiver = new SdkReceiver(session, constructors);
  const request = { requestId: "owned", sourceId: "episode", audioRevision: "rev-1", mediaUrl: media.media.contentId,
    contentType: "audio/wav", currentTime: 5, autoplay: false as const, signal: new AbortController().signal };
  return { receiver, media, session, request, constructors, listeners, setCurrent: (value: CastMediaSession | null) => { current = value; } };
};

it("loads paused and uses SDK status observations and supported constructors for commands", async () => {
  const { receiver, session, media, request, constructors } = setup();
  await receiver.load(request);
  expect(session.loadMedia).toHaveBeenCalledWith(expect.objectContaining({ autoplay: false, currentTime: 5 }));
  expect(receiver.getState().audioRevision).toBe("rev-1");
  expect(media.getEstimatedTime).toHaveBeenCalledOnce();
  await receiver.play("owned");
  expect(receiver.getState().paused).toBe(false);
  await receiver.seek("owned", 12);
  expect(receiver.getState().currentTime).toBe(12);
  await receiver.setVolume("owned", 0.3, true);
  expect(media.volume).toBeInstanceOf(constructors.Volume);
  expect(receiver.getState().muted).toBe(true);
  expect(receiver.capabilities.rate).toBe(false);
  await expect(receiver.setRate("owned", 2)).rejects.toHaveProperty("name", "NotSupportedError");
  receiver.dispose();
});

it("distinguishes FINISHED from disconnect even when the SDK marks media no longer alive", async () => {
  const { receiver, media, request, listeners, setCurrent } = setup();
  await receiver.load(request);
  media.playerState = "IDLE";
  media.idleReason = "FINISHED";
  setCurrent(null);
  for (const listener of listeners) listener(false);
  expect(receiver.getState().ended).toBe(true);
  expect(receiver.getState().connected).toBe(true);
  receiver.disconnected();
  expect(receiver.getState().paused).toBe(true);
  expect(receiver.getState().connected).toBe(false);
  receiver.dispose();
});

it("does not issue commands against a replaced or unrelated media session", async () => {
  const { receiver, media, request, setCurrent } = setup();
  await receiver.load(request);
  setCurrent({ ...media, mediaSessionId: 2 });
  await expect(receiver.stop("owned")).rejects.toThrow("ownership lost");
  expect(media.stop).not.toHaveBeenCalled();
  receiver.dispose();
});

it("allows cleanup of an owned load that completes after cancellation", async () => {
  const { receiver, media, request, session, listeners } = setup();
  let finish!: () => void;
  const load = session.loadMedia.getMockImplementation()!;
  session.loadMedia.mockImplementation(async () => {
    await new Promise<void>((resolve) => { finish = resolve; });
    await load();
  });
  const abort = new AbortController();
  const pending = receiver.load({ ...request, signal: abort.signal });
  await Promise.resolve(); await Promise.resolve();
  abort.abort();
  finish();
  await expect(pending).rejects.toHaveProperty("name", "AbortError");
  await receiver.stop("owned");
  expect(media.stop).toHaveBeenCalledOnce();
  expect(listeners.size).toBe(0);
});

import type { PrototypeMedia, PrototypeReceiver, ReceiverState } from "./handoff";

type Done = () => void;
type Fail = (cause: unknown) => void;
export interface CastMediaSession {
  mediaSessionId: number;
  media: { contentId: string; duration?: number };
  playerState: string;
  idleReason?: string;
  playbackRate: number;
  volume: { level?: number; muted?: boolean };
  getEstimatedTime(): number;
  supportsCommand(command: string): boolean;
  addUpdateListener(listener: (alive: boolean) => void): void;
  removeUpdateListener(listener: (alive: boolean) => void): void;
  play(request: null, done: Done, fail: Fail): void;
  pause(request: null, done: Done, fail: Fail): void;
  stop(request: null, done: Done, fail: Fail): void;
  seek(request: { currentTime: number }, done: Done, fail: Fail): void;
  setVolume(request: { volume: { level?: number; muted?: boolean } }, done: Done, fail: Fail): void;
}
export interface CastSession {
  getMediaSession(): CastMediaSession | null;
  loadMedia(request: { media: { contentId: string }; autoplay: boolean; currentTime: number }): Promise<void>;
}
export interface CastConstructors {
  MediaInfo: new (url: string, contentType: string) => { contentId: string };
  LoadRequest: new (media: { contentId: string }) => { media: { contentId: string }; autoplay: boolean; currentTime: number };
  SeekRequest: new () => { currentTime: number };
  Volume: new (level: number, muted: boolean) => { level: number; muted: boolean };
  VolumeRequest: new (volume: { level: number; muted: boolean }) => { volume: { level?: number; muted?: boolean } };
  MediaCommand: { SEEK: string; STREAM_VOLUME: string; STREAM_MUTE: string };
}

export class SdkReceiver implements PrototypeReceiver {
  private listeners = new Set<(state: ReceiverState) => void>();
  private media: CastMediaSession | null = null;
  private descriptor: (PrototypeMedia & { requestId: string }) | null = null;
  private loadChain: Promise<void> = Promise.resolve();
  private state: ReceiverState = { requestId: null, sourceId: null, audioRevision: null, currentTime: 0, duration: 0,
    paused: true, rate: 1, volume: 1, muted: false, buffering: false, connected: true, ended: false };
  constructor(private readonly session: CastSession, private readonly sdk: CastConstructors) {
    if (session.getMediaSession()) this.state = { ...this.state, requestId: "unowned" };
  }
  get capabilities() {
    return { seek: this.media?.supportsCommand(this.sdk.MediaCommand.SEEK) ?? false, rate: false,
      volume: (this.media?.supportsCommand(this.sdk.MediaCommand.STREAM_VOLUME) ?? false) &&
        (this.media?.supportsCommand(this.sdk.MediaCommand.STREAM_MUTE) ?? false) };
  }
  getState() { return this.state; }
  subscribe(listener: (state: ReceiverState) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private publish() { for (const listener of this.listeners) listener(this.state); }
  private update = (alive = true): void => {
    const media = this.media;
    if (!media || !this.descriptor) return;
    const current = this.session.getMediaSession();
    const finished = media.playerState === "IDLE" && media.idleReason === "FINISHED";
    if ((current && (current.mediaSessionId !== media.mediaSessionId || current.media.contentId !== this.descriptor.mediaUrl)) ||
      (!alive && !finished) || (!current && !finished)) {
      this.state = { ...this.state, connected: false, paused: true, buffering: false };
      this.publish();
      return;
    }
    this.state = {
      requestId: this.descriptor.requestId, sourceId: this.descriptor.sourceId, audioRevision: this.descriptor.audioRevision,
      currentTime: media.getEstimatedTime(), duration: media.media.duration ?? 0,
      paused: media.playerState !== "PLAYING" && media.playerState !== "BUFFERING",
      buffering: media.playerState === "BUFFERING", connected: true,
      ended: media.playerState === "IDLE" && media.idleReason === "FINISHED",
      rate: media.playbackRate, volume: media.volume.level ?? this.state.volume, muted: media.volume.muted ?? this.state.muted,
    };
    this.publish();
  };
  load(request: PrototypeMedia & { requestId: string; currentTime: number; autoplay: false; signal: AbortSignal }) {
    const loading = this.loadChain.catch(() => {}).then(async () => {
      if (request.signal.aborted) throw new DOMException("Canceled", "AbortError");
      const info = new this.sdk.MediaInfo(request.mediaUrl, request.contentType);
      const load = new this.sdk.LoadRequest(info);
      load.currentTime = request.currentTime;
      load.autoplay = false;
      await this.session.loadMedia(load);
      const media = this.session.getMediaSession();
      if (!media || media.media.contentId !== request.mediaUrl) throw new Error("Loaded receiver media does not match request");
      this.media?.removeUpdateListener(this.update);
      this.media = media;
      this.descriptor = request;
      media.addUpdateListener(this.update);
      this.update();
      if (request.signal.aborted) throw new DOMException("Canceled", "AbortError");
    });
    this.loadChain = loading;
    return loading;
  }
  private owned(requestId: string): CastMediaSession {
    const current = this.session.getMediaSession();
    if (!this.media || requestId !== this.descriptor?.requestId || current?.mediaSessionId !== this.media.mediaSessionId ||
      current.media.contentId !== this.descriptor.mediaUrl) throw new Error("Receiver media ownership lost");
    return this.media;
  }
  private command(requestId: string, invoke: (media: CastMediaSession, done: Done, fail: Fail) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const media = this.owned(requestId);
      invoke(media, () => {
        if (this.media === media) this.update();
        resolve();
      }, reject);
    });
  }
  play(id: string) { return this.command(id, (media, done, fail) => media.play(null, done, fail)); }
  pause(id: string) { return this.command(id, (media, done, fail) => media.pause(null, done, fail)); }
  seek(id: string, time: number) {
    return this.command(id, (media, done, fail) => {
      if (!this.capabilities.seek) throw new DOMException("Seek unsupported", "NotSupportedError");
      const request = new this.sdk.SeekRequest();
      request.currentTime = time;
      media.seek(request, done, fail);
    });
  }
  async setRate(_id: string, _rate: number): Promise<void> { throw new DOMException("Rate unsupported by this bridge", "NotSupportedError"); }
  setVolume(id: string, volume: number, muted: boolean) {
    return this.command(id, (media, done, fail) => {
      if (!this.capabilities.volume) throw new DOMException("Volume unsupported", "NotSupportedError");
      const request = new this.sdk.VolumeRequest(new this.sdk.Volume(volume, muted));
      media.setVolume(request, done, fail);
    });
  }
  async stop(id: string) {
    if (id !== this.descriptor?.requestId) return;
    await this.command(id, (media, done, fail) => media.stop(null, done, fail));
    this.media?.removeUpdateListener(this.update);
    this.media = null;
    this.descriptor = null;
    this.state = { ...this.state, requestId: null, paused: true };
    this.publish();
  }
  disconnected() { this.state = { ...this.state, connected: false, paused: true, buffering: false }; this.publish(); }
  dispose() { this.media?.removeUpdateListener(this.update); this.listeners.clear(); }
}

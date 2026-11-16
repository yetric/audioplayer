export interface PrototypeMedia {
  sourceId: string;
  audioRevision: string;
  mediaUrl: string;
  contentType: string;
}

export interface ReceiverState {
  requestId: string | null;
  sourceId: string | null;
  audioRevision: string | null;
  currentTime: number;
  duration: number;
  paused: boolean;
  rate: number;
  volume: number;
  muted: boolean;
  buffering: boolean;
  connected: boolean;
  ended: boolean;
}

export interface PrototypeReceiver {
  capabilities: { seek: boolean; rate: boolean; volume: boolean };
  getState(): ReceiverState;
  subscribe(listener: (state: ReceiverState) => void): () => void;
  load(request: PrototypeMedia & { requestId: string; currentTime: number; autoplay: false; signal: AbortSignal }): Promise<void>;
  play(requestId: string): Promise<void>;
  pause(requestId: string): Promise<void>;
  seek(requestId: string, time: number): Promise<void>;
  setRate(requestId: string, rate: number): Promise<void>;
  setVolume(requestId: string, volume: number, muted: boolean): Promise<void>;
  stop(requestId: string): Promise<void>;
}

export type HandoffResult = { status: "connected" | "local" | "superseded" | "busy" | "disposed" }
  | { status: "failed"; cause: unknown };

let nextRequestId = 0;
const events = ["loadstart", "loadedmetadata", "loadeddata", "canplay", "canplaythrough", "play", "pause",
  "waiting", "playing", "stalled", "seeking", "seeked", "timeupdate", "progress", "ratechange", "volumechange", "ended", "error"];

// Non-shipping media-element facade used to exercise the real player's private engine contract.
export class HandoffAudio extends EventTarget {
  private receiver: PrototypeReceiver | null = null;
  private snapshot: ReceiverState | null = null;
  private requestId: string | null = null;
  private version = 0;
  private abort = new AbortController();
  private loading = false;
  private pending: "connect" | "return" | null = null;
  private resumeAfterReturn = false;
  private freezing = false;
  private resumeAtCommit = false;
  private intentVersion = 0;
  private returnTime = 0;
  private disposed = false;
  private suppressLocal = false;
  private remoteSeeking = false;
  private seekVersion = 0;
  private seekChain: Promise<void> = Promise.resolve();
  private endedRequest: string | null = null;
  private runtimeError: unknown = null;
  private offReceiver: (() => void) | undefined;
  private localListeners: Array<() => void> = [];

  constructor(readonly local: HTMLAudioElement, private readonly resolveMedia: () => PrototypeMedia) {
    super();
    for (const event of events) {
      const listener = () => { if (!this.disposed && !this.receiver && !this.suppressLocal) this.emit(event); };
      local.addEventListener(event, listener);
      this.localListeners.push(() => local.removeEventListener(event, listener));
    }
  }
  private emit(event: string) { this.dispatchEvent(new Event(event)); }
  private invalidate() {
    this.version++;
    this.freezing = false;
    this.remoteSeeking = false;
    this.seekVersion++;
    this.seekChain = Promise.resolve();
    this.runtimeError = null;
    this.abort.abort();
    this.abort = new AbortController();
  }
  private isCurrent(version: number) { return !this.disposed && version === this.version; }
  private report(cause: unknown, version: number) {
    if (!this.isCurrent(version)) return;
    this.runtimeError = cause;
    this.emit("error");
  }
  private observe = (state: ReceiverState): void => {
    if (this.disposed || this.loading || state.requestId !== this.requestId || !this.snapshot) return;
    const previous = this.snapshot;
    if (state.connected && (state.sourceId !== previous.sourceId || state.audioRevision !== previous.audioRevision)) {
      this.report(new Error("Receiver identity changed"), this.version);
      return;
    }
    this.snapshot = state.connected ? state : { ...previous, connected: false, paused: true, buffering: false };
    const current = this.snapshot;
    if (previous.paused !== current.paused || previous.connected !== current.connected) {
      this.emit(current.paused ? "pause" : "play");
    }
    if (previous.currentTime !== current.currentTime) this.emit("timeupdate");
    if (previous.rate !== current.rate) this.emit("ratechange");
    if (previous.volume !== current.volume || previous.muted !== current.muted) this.emit("volumechange");
    if (previous.buffering !== current.buffering) this.emit(current.buffering ? "waiting" : "playing");
    if (current.ended && this.endedRequest !== this.requestId) {
      this.endedRequest = this.requestId;
      this.emit("ended");
    }
  };
  get src() { return this.local.src; }
  set src(value: string) {
    this.invalidate();
    this.local.src = value;
    if (this.receiver && this.snapshot) {
      this.loading = true;
      this.snapshot = { ...this.snapshot, currentTime: 0, ended: false, buffering: false, paused: true };
    }
  }
  get preload() { return this.local.preload; }
  set preload(value: HTMLMediaElement["preload"]) { this.local.preload = value; }
  get currentTime() { return this.snapshot?.currentTime ?? this.local.currentTime; }
  set currentTime(value: number) {
    if (this.pending === "return") { this.returnTime = value; return; }
    if (!this.receiver || !this.snapshot) { this.local.currentTime = value; return; }
    if (this.loading) { this.snapshot = { ...this.snapshot, currentTime: value }; return; }
    if (!this.receiver.capabilities.seek) throw new DOMException("Receiver cannot seek", "NotSupportedError");
    const version = this.version;
    const sequence = ++this.seekVersion;
    const receiver = this.receiver;
    const requestId = this.requestId!;
    this.remoteSeeking = true;
    this.emit("seeking");
    this.seekChain = this.seekChain.catch(() => {}).then(async () => {
      if (!this.isCurrent(version) || sequence !== this.seekVersion) return;
      await receiver.seek(requestId, value);
      if (!this.isCurrent(version) || sequence !== this.seekVersion) return;
      this.remoteSeeking = false;
      this.emit("seeked");
    }).catch((cause) => {
      if (!this.isCurrent(version) || sequence !== this.seekVersion) return;
      this.remoteSeeking = false;
      this.report(cause, version);
    });
  }
  get duration() { return this.snapshot?.duration ?? this.local.duration; }
  get buffered() { return this.receiver ? { length: 0, start: () => 0, end: () => 0 } : this.local.buffered; }
  get readyState() { return this.receiver ? this.loading || !this.snapshot?.connected ? 0 : this.snapshot.buffering ? 2 : 4 : this.local.readyState; }
  get seeking() { return this.receiver ? this.remoteSeeking : this.local.seeking; }
  get error() { return this.runtimeError ?? this.local.error; }
  get playbackRate() { return this.snapshot?.rate ?? this.local.playbackRate; }
  set playbackRate(rate: number) {
    if (!this.receiver || !this.snapshot) { this.local.playbackRate = rate; return; }
    if (this.loading) { this.snapshot = { ...this.snapshot, rate }; return; }
    if (rate === this.snapshot.rate) return;
    if (!this.receiver.capabilities.rate) throw new DOMException("Receiver cannot change rate", "NotSupportedError");
    const version = this.version;
    void this.receiver.setRate(this.requestId!, rate).catch((cause) => this.report(cause, version));
  }
  get volume() { return this.snapshot?.volume ?? this.local.volume; }
  set volume(volume: number) { this.changeVolume(volume, this.muted); }
  get muted() { return this.snapshot?.muted ?? this.local.muted; }
  set muted(muted: boolean) { this.changeVolume(this.volume, muted); }
  private changeVolume(volume: number, muted: boolean) {
    if (!this.receiver || !this.snapshot) { this.local.volume = volume; this.local.muted = muted; return; }
    if (this.loading) { this.snapshot = { ...this.snapshot, volume, muted }; return; }
    if (volume === this.snapshot.volume && muted === this.snapshot.muted) return;
    if (!this.receiver.capabilities.volume) throw new DOMException("Receiver cannot change volume", "NotSupportedError");
    const version = this.version;
    void this.receiver.setVolume(this.requestId!, volume, muted).catch((cause) => this.report(cause, version));
  }
  async play() {
    this.intentVersion++;
    if (this.freezing) { this.resumeAtCommit = true; return; }
    if (this.pending === "return") { this.resumeAfterReturn = true; return; }
    if (!this.receiver) return this.local.play();
    if (!this.snapshot?.connected) throw new Error("Receiver disconnected; explicit return required");
    await this.receiver.play(this.requestId!);
  }
  pause() {
    this.intentVersion++;
    if (this.freezing) { this.resumeAtCommit = false; return; }
    if (this.pending === "return") { this.resumeAfterReturn = false; return; }
    if (!this.receiver) { this.local.pause(); return; }
    const version = this.version;
    if (this.requestId) void this.receiver.pause(this.requestId).catch((cause) => this.report(cause, version));
  }
  removeAttribute(name: string) { if (name === "src") this.src = ""; }
  load() {
    if (!this.receiver) { this.local.load(); return; }
    const version = this.version;
    const oldRequest = this.requestId;
    if (!this.local.getAttribute("src")) {
      this.requestId = null;
      if (oldRequest) void this.receiver.stop(oldRequest).catch((cause) => this.report(cause, version));
      return;
    }
    const receiver = this.receiver;
    const requestId = this.requestId = String(++nextRequestId);
    const media = this.resolveMedia();
    this.emit("loadstart");
    void receiver.load({ ...media, requestId, currentTime: this.currentTime, autoplay: false, signal: this.abort.signal })
      .then(async () => {
        if (!this.isCurrent(version)) { await receiver.stop(requestId); return; }
        const desired = this.snapshot!;
        await this.reconcile(receiver, requestId, desired.currentTime, desired.rate, desired.volume, desired.muted);
        if (!this.isCurrent(version)) return;
        this.snapshot = this.confirm(receiver, media, requestId);
        this.loading = false;
        this.runtimeError = null;
        this.emit("loadedmetadata");
      }).catch((cause) => this.report(cause, version));
  }
  private confirm(receiver: PrototypeReceiver, media: PrototypeMedia, requestId: string) {
    const state = receiver.getState();
    if (state.requestId !== requestId || state.sourceId !== media.sourceId || state.audioRevision !== media.audioRevision || !state.connected) {
      throw new Error("Receiver identity mismatch");
    }
    return state;
  }
  private async reconcile(receiver: PrototypeReceiver, requestId: string, time: number, rate: number, volume: number, muted: boolean) {
    if (receiver.getState().currentTime !== time) {
      if (!receiver.capabilities.seek) throw new Error("Receiver cannot reconcile position");
      await receiver.seek(requestId, time);
    }
    if (receiver.capabilities.rate && receiver.getState().rate !== rate) await receiver.setRate(requestId, rate);
    if (receiver.capabilities.volume) await receiver.setVolume(requestId, volume, muted);
  }
  async connect(receiver: PrototypeReceiver): Promise<HandoffResult> {
    if (this.disposed) return { status: "disposed" };
    if (this.pending || this.receiver) return { status: "busy" };
    if (receiver.getState().requestId !== null) return { status: "failed", cause: new Error("Refusing occupied receiver") };
    this.pending = "connect";
    const version = this.version;
    const requestId = String(++nextRequestId);
    let owned = false;
    try {
      const media = this.resolveMedia();
      if (!/^https:\/\//.test(media.mediaUrl)) throw new Error("Prototype requires receiver-reachable HTTPS media");
      owned = true;
      await receiver.load({ ...media, requestId, currentTime: this.local.currentTime, autoplay: false, signal: this.abort.signal });
      if (!this.isCurrent(version)) return { status: "superseded" };
      this.confirm(receiver, media, requestId);
      await this.reconcile(receiver, requestId, this.local.currentTime, this.local.playbackRate, this.local.volume, this.local.muted);
      if (!this.isCurrent(version)) return { status: "superseded" };
      this.resumeAtCommit = !this.local.paused;
      this.freezing = true;
      this.suppressLocal = true;
      this.local.pause();
      this.suppressLocal = false;
      while (Math.abs(receiver.getState().currentTime - this.local.currentTime) > 0.05) {
        if (!receiver.capabilities.seek) throw new Error("Receiver cannot reconcile final position");
        await receiver.seek(requestId, this.local.currentTime);
        if (!this.isCurrent(version)) return { status: "superseded" };
      }
      this.freezing = false;
      this.receiver = receiver;
      this.requestId = requestId;
      this.snapshot = this.confirm(receiver, media, requestId);
      this.offReceiver = receiver.subscribe(this.observe);
      const intent = this.intentVersion;
      this.emit("pause");
      this.emit("timeupdate");
      if (this.resumeAtCommit && this.isCurrent(version) && intent === this.intentVersion) await receiver.play(requestId);
      return this.isCurrent(version) ? { status: "connected" } : { status: "superseded" };
    } catch (cause) {
      return this.isCurrent(version) ? { status: "failed", cause } : { status: "superseded" };
    } finally {
      this.pending = null;
      if (owned && this.receiver !== receiver) await receiver.stop(requestId).catch(() => {});
      if (this.freezing && this.isCurrent(version)) { this.freezing = false; this.emit("pause"); }
    }
  }
  async returnToLocal(resume = false): Promise<HandoffResult> {
    if (this.disposed) return { status: "disposed" };
    if (this.pending || !this.receiver || !this.snapshot || !this.requestId) return { status: "busy" };
    this.pending = "return";
    this.resumeAfterReturn = resume;
    this.returnTime = this.currentTime;
    const version = this.version;
    const snapshot = this.snapshot;
    try {
      await this.receiver.stop(this.requestId);
      if (!this.isCurrent(version)) return { status: "superseded" };
      this.offReceiver?.();
      this.offReceiver = undefined;
      this.receiver = null;
      this.snapshot = null;
      this.suppressLocal = true;
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          this.local.removeEventListener("loadedmetadata", ready);
          this.local.removeEventListener("error", failed);
          this.abort.signal.removeEventListener("abort", failed);
        };
        const ready = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error("Local recovery interrupted")); };
        this.local.addEventListener("loadedmetadata", ready);
        this.local.addEventListener("error", failed);
        this.abort.signal.addEventListener("abort", failed, { once: true });
        this.local.load();
      });
      if (!this.isCurrent(version)) return { status: "superseded" };
      this.local.currentTime = this.returnTime;
      this.local.playbackRate = snapshot.rate;
      this.local.volume = snapshot.volume;
      this.local.muted = snapshot.muted;
      this.suppressLocal = false;
      this.emit("pause");
      this.emit("timeupdate");
      this.emit("seeked");
      this.pending = null;
      if (this.resumeAfterReturn) await this.local.play();
      return { status: "local" };
    } catch (cause) {
      return this.isCurrent(version) ? { status: "failed", cause } : { status: "superseded" };
    } finally { this.pending = null; this.suppressLocal = false; }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.invalidate();
    this.offReceiver?.();
    for (const detach of this.localListeners) detach();
    this.local.pause();
    if (this.requestId && this.receiver) void this.receiver.stop(this.requestId).catch(() => {});
  }
}

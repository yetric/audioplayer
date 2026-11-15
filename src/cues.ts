import type { AudioPlayer, AudioPlayerState, AudioSource } from "./index.js";

export interface AudioPlayerCue<T = unknown> {
  readonly id: string;
  readonly start: number;
  readonly end?: number;
  readonly data: T;
}

export interface AudioPlayerCueSnapshot<T = unknown> {
  readonly sourceId: string | null;
  readonly activeCues: readonly AudioPlayerCue<T>[];
}

export interface AudioPlayerCuesOptions<T> {
  getCues: (source: AudioSource) => readonly AudioPlayerCue<T>[];
}

export interface AudioPlayerCuesController<T = unknown> {
  getSnapshot(): AudioPlayerCueSnapshot<T>;
  subscribe(listener: (snapshot: AudioPlayerCueSnapshot<T>) => void): () => void;
  on(event: "cueenter" | "cueexit", listener: (event: { cue: AudioPlayerCue<T> }) => void): () => void;
  refresh(): void;
  destroy(): void;
}

export const attachAudioPlayerCues = <T>(
  player: AudioPlayer,
  options: AudioPlayerCuesOptions<T>,
): AudioPlayerCuesController<T> => {
  let snapshot: AudioPlayerCueSnapshot<T> = { sourceId: null, activeCues: [] };
  let source: AudioSource | null = null;
  let previousStatus: AudioPlayerState["status"] = "idle";
  let cues: readonly AudioPlayerCue<T>[] = [];
  let maxEnds: number[] = [];
  let leafCount = 1;
  let seeking = false;
  let destroyed = false;
  const subscribers = new Set<(snapshot: AudioPlayerCueSnapshot<T>) => void>();
  const events = {
    cueenter: new Set<(event: { cue: AudioPlayerCue<T> }) => void>(),
    cueexit: new Set<(event: { cue: AudioPlayerCue<T> }) => void>(),
  };

  const publish = (sourceId: string | null, activeCues: readonly AudioPlayerCue<T>[]) => {
    const previous = snapshot;
    if (previous.sourceId === sourceId && previous.activeCues.length === activeCues.length &&
      previous.activeCues.every((cue, index) => cue === activeCues[index])) return;
    snapshot = { sourceId, activeCues };
    const nextSet = new Set(activeCues);
    const previousSet = new Set(previous.activeCues);
    for (const cue of previous.activeCues) {
      if (previous.sourceId !== sourceId || !nextSet.has(cue)) {
        for (const listener of events.cueexit) listener({ cue });
      }
    }
    for (const cue of activeCues) {
      if (previous.sourceId !== sourceId || !previousSet.has(cue)) {
        for (const listener of events.cueenter) listener({ cue });
      }
    }
    for (const listener of subscribers) listener(snapshot);
  };

  const readCues = (nextSource: AudioSource | null) => {
    const nextCues = nextSource ? [...options.getCues(nextSource)] : [];
    const ids = new Set<string>();
    for (const cue of nextCues) {
      if (typeof cue.id !== "string" || !cue.id || ids.has(cue.id) || !Number.isFinite(cue.start) || cue.start < 0 ||
        (cue.end !== undefined && (!Number.isFinite(cue.end) || cue.end <= cue.start))) {
        throw new RangeError("Cues require unique non-empty IDs and finite ranges with 0 <= start < end.");
      }
      ids.add(cue.id);
    }
    nextCues.sort((a, b) => a.start - b.start);
    leafCount = 1;
    while (leafCount < nextCues.length) leafCount *= 2;
    maxEnds = new Array(leafCount * 2).fill(0);
    nextCues.forEach((cue, index) => { maxEnds[leafCount + index] = cue.end ?? Infinity; });
    for (let i = leafCount - 1; i > 0; i--) {
      maxEnds[i] = Math.max(maxEnds[i * 2], maxEnds[i * 2 + 1]);
    }
    cues = nextCues;
    source = nextSource;
  };

  const sync = (state: AudioPlayerState, refresh = false) => {
    if (destroyed) return;
    const reset = state.currentSource !== source ||
      (state.status === "loading" && previousStatus !== "loading");
    previousStatus = state.status;
    if (reset || refresh) {
      readCues(state.currentSource);
      if (reset) {
        seeking = false;
        publish(state.currentSourceId, []);
      }
    }
    if (seeking) return;
    const active: AudioPlayerCue<T>[] = [];
    if (source && state.status !== "ended" &&
      !(state.duration > 0 && state.currentTime >= state.duration)) {
      const visit = (node: number, start: number, end: number): void => {
        if (start >= cues.length || cues[start].start > state.currentTime ||
          maxEnds[node] <= state.currentTime) return;
        if (end - start === 1) {
          active.push(cues[start]);
          return;
        }
        const middle = (start + end) >>> 1;
        visit(node * 2, start, middle);
        visit(node * 2 + 1, middle, end);
      };
      visit(1, 0, leafCount);
    }
    publish(state.currentSourceId, active);
  };

  // Validate before installing listeners, so a failed attachment leaves no subscriptions.
  readCues(player.getState().currentSource);
  const unsubscribe = player.subscribe((state) => sync(state));
  const offSeeking = player.on("seeking", () => { seeking = true; });
  const offSeeked = player.on("seeked", () => {
    seeking = false;
    sync(player.getState());
  });
  const offError = player.on("error", () => {
    seeking = false;
    sync(player.getState());
  });
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    unsubscribe();
    offSeeking();
    offSeeked();
    offError();
    offDestroy();
    publish(null, []);
    subscribers.clear();
    events.cueenter.clear();
    events.cueexit.clear();
  };
  const offDestroy = player.on("destroy", destroy);

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (destroyed) {
        listener(snapshot);
        return () => {};
      }
      subscribers.add(listener);
      listener(snapshot);
      return () => { subscribers.delete(listener); };
    },
    on(event, listener) {
      if (!destroyed) events[event].add(listener);
      return () => { events[event].delete(listener); };
    },
    refresh: () => sync(player.getState(), true),
    destroy,
  };
};

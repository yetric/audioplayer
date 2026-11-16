import type { AudioPlayer, AudioSource } from "./index.js";
import { attachAudioPlayerCues, type AudioPlayerCue, type AudioPlayerCuesController } from "./cues.js";
import type { PodcastChapter } from "./chapters.js";

type Chapter = AudioPlayerCue<PodcastChapter>;

export interface AudioPlayerChaptersSnapshot {
  sourceId: string | null;
  entries: readonly Chapter[];
  current: Chapter | null;
  next: Chapter | null;
  previous: Chapter | null;
}

export interface AudioPlayerChaptersOptions {
  getCues: (source: AudioSource) => readonly Chapter[];
  restartThresholdSeconds?: number;
}

export interface AudioPlayerChaptersController {
  cues: AudioPlayerCuesController<PodcastChapter>;
  getSnapshot(): AudioPlayerChaptersSnapshot;
  subscribe(listener: (snapshot: AudioPlayerChaptersSnapshot) => void): () => void;
  next(): boolean;
  previous(): boolean;
  seekTo(id: string): boolean;
  refresh(): void;
  destroy(): void;
}

export const attachAudioPlayerChapters = (
  player: AudioPlayer,
  options: AudioPlayerChaptersOptions,
): AudioPlayerChaptersController => {
  const threshold = options.restartThresholdSeconds ?? 5;
  if (!Number.isFinite(threshold) || threshold < 0) throw new RangeError("Invalid chapter restart threshold.");
  let entries: readonly Chapter[] = [];
  const cues = attachAudioPlayerCues(player, {
    getCues(source) {
      const all = options.getCues(source);
      const starts = new Set<number>();
      entries = [...all].sort((a, b) => a.start - b.start).filter((cue) => {
        if (cue.data.toc === false || starts.has(cue.start)) return false;
        starts.add(cue.start);
        return true;
      });
      return all;
    },
  });
  let destroyed = false;
  const listeners = new Set<(snapshot: AudioPlayerChaptersSnapshot) => void>();
  let snapshot: AudioPlayerChaptersSnapshot = { sourceId: null, entries: [], current: null, next: null, previous: null };
  const sync = (): void => {
    if (destroyed) return;
    const state = player.getState();
    if (!state.currentSource && entries.length) entries = [];
    const time = state.currentTime;
    let index = -1;
    for (let i = 0; i < entries.length && entries[i].start <= time; i++) index = i;
    const entry = entries[index];
    const end = entry?.data.endTime ?? entries[index + 1]?.start ?? Infinity;
    const ended = state.status === "ended" || (state.duration > 0 && time >= state.duration);
    const current = entry && !ended && time < end ? entry : null;
    const next = ended ? null : entries.find((cue) => cue.start > time) ?? null;
    const previous = current && time - current.start <= threshold
      ? entries[index - 1] ?? null : entry ?? null;
    if (snapshot.sourceId === state.currentSourceId && snapshot.entries === entries &&
      snapshot.current === current && snapshot.next === next && snapshot.previous === previous) return;
    snapshot = { sourceId: state.currentSourceId, entries, current, next, previous };
    const published = snapshot;
    for (const listener of listeners) {
      if (destroyed || snapshot !== published) break;
      listener(published);
    }
  };
  const unsubscribe = player.subscribe(sync);
  const seek = (chapter: Chapter | null): boolean => {
    if (destroyed || !chapter || !player.getState().currentSource) return false;
    player.seek(chapter.start);
    return true;
  };
  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    unsubscribe();
    offDestroy();
    cues.destroy();
    snapshot = { sourceId: null, entries: [], current: null, next: null, previous: null };
    for (const listener of listeners) listener(snapshot);
    listeners.clear();
  };
  const offDestroy = player.on("destroy", destroy);
  return {
    cues,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (!destroyed) listeners.add(listener);
      listener(snapshot);
      return () => { listeners.delete(listener); };
    },
    next: () => seek(snapshot.next),
    previous: () => seek(snapshot.previous),
    seekTo: (id) => seek(entries.find((cue) => cue.id === id) ?? null),
    refresh() {
      if (destroyed) return;
      const previous = entries;
      try { cues.refresh(); } catch (cause) { entries = previous; throw cause; }
      sync();
    },
    destroy,
  };
};

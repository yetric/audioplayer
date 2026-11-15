import type { AudioPlayerCue } from "./cues.js";

export interface PodcastChapter {
  readonly startTime: number;
  readonly endTime?: number;
  readonly title?: string;
  readonly img?: string;
  readonly url?: string;
  readonly toc?: boolean;
  readonly location?: unknown;
  readonly [key: string]: unknown;
}

export interface PodcastChapterCuesOptions {
  sourceId: string;
  duration?: number;
}

export const createPodcastChapterCues = (
  document: unknown,
  { sourceId, duration }: PodcastChapterCuesOptions,
): AudioPlayerCue<PodcastChapter>[] => {
  if (!sourceId || (duration !== undefined && (!Number.isFinite(duration) || duration <= 0))) {
    throw new RangeError("Chapter cues require a source ID and a positive finite duration when supplied.");
  }
  if (!document || typeof document !== "object" || !("version" in document) ||
    !("chapters" in document) || !Array.isArray(document.chapters)) {
    throw new TypeError("JSON Chapters requires version and chapters fields.");
  }
  if (document.version !== "1.2.0") {
    throw new RangeError("Unsupported JSON Chapters version. Expected 1.2.0.");
  }
  let previousStart = -1;
  for (const chapter of document.chapters) {
    if (!chapter || typeof chapter !== "object" ||
      typeof chapter.startTime !== "number" || !Number.isFinite(chapter.startTime) ||
      chapter.startTime < 0 || chapter.startTime < previousStart ||
      (chapter.endTime !== undefined && (typeof chapter.endTime !== "number" ||
        !Number.isFinite(chapter.endTime) || chapter.endTime <= chapter.startTime))) {
      throw new RangeError("Chapters require ascending finite startTime values and valid endTime values.");
    }
    if (["title", "img", "url"].some((key) => chapter[key] !== undefined && typeof chapter[key] !== "string") ||
      (chapter.toc !== undefined && typeof chapter.toc !== "boolean")) {
      throw new TypeError("Chapter title, img and url must be strings; toc must be boolean.");
    }
    previousStart = chapter.startTime;
  }
  const chapters = document.chapters as PodcastChapter[];
  let nextStart: number | undefined;
  const cues: AudioPlayerCue<PodcastChapter>[] = new Array(chapters.length);
  for (let i = chapters.length - 1; i >= 0; i--) {
    const chapter = chapters[i];
    if (i + 1 < chapters.length && chapters[i + 1].startTime > chapter.startTime) {
      nextStart = chapters[i + 1].startTime;
    }
    const end = chapter.endTime ?? nextStart ??
      (duration !== undefined && duration > chapter.startTime ? duration : undefined);
    cues[i] = {
      id: `${sourceId}:chapter:${i}`,
      start: chapter.startTime,
      ...(end === undefined ? {} : { end }),
      data: chapter,
    };
  }
  return cues;
};

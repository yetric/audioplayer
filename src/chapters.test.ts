import { describe, expect, it } from "vitest";
import { createPodcastChapterCues } from "./index";

const options = { sourceId: "episode" };

describe("JSON Chapters adapter", () => {
  it("preserves standard fields and hidden markers, deriving ends and deterministic IDs", () => {
    const chapters = [
      { startTime: 0, title: "Intro", img: "/intro.svg", url: "https://example.com" },
      { startTime: 2, toc: false, img: "/detail.svg", location: { name: "Studio", geo: "geo:1,2" } },
      { startTime: 2, title: "Same time" },
      { startTime: 5, endTime: 6, title: "Explicit end" },
      { startTime: 8 },
    ];
    const document = { version: "1.2.0", chapters, title: "Episode" };
    const cues = createPodcastChapterCues(document, options);
    expect(cues.map(({ start, end }) => [start, end])).toEqual([[0, 2], [2, 5], [2, 5], [5, 6], [8, undefined]]);
    expect(cues[1].data).toBe(chapters[1]);
    expect(cues[1].data.toc).toBe(false);
    expect(cues.map((cue) => cue.id)).toEqual(createPodcastChapterCues(document, options).map((cue) => cue.id));
    expect(createPodcastChapterCues(document, { ...options, duration: 10 })[4].end).toBe(10);
    expect(createPodcastChapterCues(document, { ...options, duration: 7 })[4].end).toBeUndefined();
  });

  it("accepts empty chapter lists", () => {
    expect(createPodcastChapterCues({ version: "1.2.0", chapters: [] }, options)).toEqual([]);
  });

  it.each([
    null,
    {},
    { version: "1.2.0", chapters: null },
    { version: "2.0.0", chapters: [] },
    { version: "1.2.0", chapters: [{ title: "Missing start" }] },
    { version: "1.2.0", chapters: [{ startTime: -1 }] },
    { version: "1.2.0", chapters: [{ startTime: Infinity }] },
    { version: "1.2.0", chapters: [{ startTime: 2 }, { startTime: 1 }] },
    { version: "1.2.0", chapters: [{ startTime: 2, endTime: 2 }] },
    { version: "1.2.0", chapters: [{ startTime: 0, toc: "false" }] },
    { version: "1.2.0", chapters: [{ startTime: 0, img: 42 }] },
  ])("rejects malformed or unsupported documents: %j", (document) => {
    expect(() => createPodcastChapterCues(document, options)).toThrow();
  });

  it.each([0, -1, Infinity, NaN])("rejects an invalid supplied duration: %s", (duration) => {
    expect(() => createPodcastChapterCues({ version: "1.2.0", chapters: [] }, { ...options, duration })).toThrow(RangeError);
  });
});

import { describe, expect, it } from "vitest";
import { getStoryContext } from "./context.js";
import story from "./story.json";
import script from "./script.json";
import firstChapters from "./assets/the-parcel.chapters.json";
import secondChapters from "./assets/the-window.chapters.json";
import { createPodcastChapterCues } from "../../src/chapters.ts";

describe("fictional story fixture", () => {
  it("keeps generated narration, chapters, and authored passages in agreement", () => {
    expect(story.revision).toBe(script.revision);
    for (const [index, episode] of story.episodes.entries()) {
      expect(episode.passages.map(({ start, end, ...passage }) => passage)).toEqual(script.episodes[index].passages);
      expect(episode.passages[0].start).toBe(0);
      expect(new Set(episode.passages.map((passage) => passage.id)).size).toBe(episode.passages.length);
      for (const [passageIndex, passage] of episode.passages.entries()) {
        expect(passage.end).toBeGreaterThan(passage.start);
        if (passageIndex) expect(passage.start).toBe(episode.passages[passageIndex - 1].end);
      }
      expect(episode.duration).toBe(episode.passages.at(-1).end);
      const chapters = createPodcastChapterCues([firstChapters, secondChapters][index], { sourceId: episode.id, duration: episode.duration });
      expect(chapters.map((cue) => cue.start)).toEqual(episode.passages.map((passage) => passage.start));
      expect(chapters.map((cue) => cue.data.title)).toEqual(episode.passages.map((passage) => passage.title));
    }
  });

  it("reveals only passages up to the current moment, including after going backward", () => {
    const late = getStoryContext(story, "the-parcel", "door");
    expect(late.visiblePassages).toHaveLength(6);
    const early = getStoryContext(story, "the-parcel", "mara");
    expect(early.visiblePassages.map((passage) => passage.id)).toEqual(["arrival", "mara"]);
    expect(early.canAsk).toBe(false);
    expect(early.canAnswer).toBe(false);
  });

  it("keeps the answer unavailable until the narration establishes it", () => {
    expect(getStoryContext(story, "the-parcel", "bells")).toMatchObject({ canAsk: true, canAnswer: false });
    expect(getStoryContext(story, "the-window", "ledger").canAnswer).toBe(false);
    expect(getStoryContext(story, "the-window", "ada").canAnswer).toBe(false);
    expect(getStoryContext(story, "the-window", "answer").canAnswer).toBe(true);
    expect(getStoryContext(story, "the-window", "return").canAnswer).toBe(false);
  });

  it("does not reuse context for unknown sources or mismatched passages", () => {
    expect(getStoryContext(story, "missing", "arrival")).toBeNull();
    expect(getStoryContext(story, "the-window", "arrival")).toBeNull();
    expect(getStoryContext(story, null, null)).toBeNull();
  });
});

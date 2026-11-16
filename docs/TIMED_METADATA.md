---
id: timed-metadata
slug: /timed-metadata
---

# Timed metadata

Available in stable `1.3.0`. Install with `npm install @yetric/audioplayer`. The player stays headless: your application supplies metadata, renders images and text, and handles links. The cue controller supplies the active content for the current audio position.

## Generic cues

```ts
import { attachAudioPlayerCues } from "@yetric/audioplayer";

const metadata = new Map([
  ["episode-1", [
    { id: "studio", start: 0, end: 10, data: { text: "Inside the studio" } },
    { id: "credits", start: 20, data: { text: "Credits" } },
  ]],
]);

const cues = attachAudioPlayerCues(player, {
  getCues: (source) => metadata.get(source.id) ?? [],
});
const unsubscribe = cues.subscribe(({ sourceId, activeCues }) => {
  renderCards(sourceId, activeCues);
});
const offEnter = cues.on("cueenter", ({ cue }) => console.log(cue.id));

// After replacing metadata for the current source:
cues.refresh();

// When this integration is no longer needed:
unsubscribe();
offEnter();
cues.destroy();
```

`AudioPlayerCue<T>` contains `id`, `start`, optional `end`, and generic `data`. IDs must be non-empty and unique within the source. Supplied times must be finite, non-negative seconds; an end must be greater than its start. Invalid lists throw `RangeError`. Validation on `refresh()` happens before replacing the current index. Keep `getCues` synchronous and supply valid data for each source.

Intervals include their start and exclude their end. An omitted end lasts until the source ends. Overlapping cues are returned in start-time order, with input order breaking ties. The controller indexes interval boundaries so long transcripts do not require a full list scan per notification.

`getSnapshot()` returns `{ sourceId, activeCues }`. Subscriptions receive an immediate snapshot, then updates only when source identity or active cue objects change. Treat cues and payloads as immutable; replace objects and call `refresh()` when metadata changes. `getCues` runs when sources change or are reloaded and on explicit refresh, not on every tick.

## Podcasting 2.0 chapters

Applications discover chapter files using [`podcast:chapters`](https://podcasting2.org/docs/podcast-namespace/tags/chapters) and fetch and parse them. The adapter accepts a parsed [JSON Chapters](https://podcasting2.org/docs/podcast-namespace/examples/chapters/jsonChapters) document:

```ts
import { attachAudioPlayerCues, createPodcastChapterCues } from "@yetric/audioplayer";

const document = {
  version: "1.2.0",
  chapters: [
    { startTime: 0, title: "Welcome", img: "https://example.com/welcome.jpg" },
    { startTime: 15, img: "https://example.com/detail.jpg", toc: false },
    { startTime: 30, title: "Read more", url: "https://example.com/notes" },
  ],
};
const chapters = createPodcastChapterCues(document, { sourceId: "episode-1" });
const cues = attachAudioPlayerCues(player, {
  getCues: (source) => source.id === "episode-1" ? chapters : [],
});
const navigation = chapters.filter((cue) => cue.data.toc !== false);
// A navigation button calls player.seek(cue.start).
```

The adapter currently supports document version `1.2.0`. Missing required fields and invalid optional presentation fields throw `TypeError`; unsupported versions, invalid timing/order, or invalid options throw `RangeError`. Unknown chapter fields, including location data, remain on the original object in `cue.data`. The caller retains the original document and its episode-level metadata.

IDs combine source identity and chapter index. They remain stable for an unchanged document; do not use them as permanent identifiers across edited documents.

An explicit `endTime` wins. Otherwise a cue ends at the next strictly later marker, including hidden markers. Same-time markers share that boundary. The final marker can remain open-ended; the controller clears it at the media end and responds to duration changes. Passing a positive finite `duration` to the adapter provides a finite final boundary when that boundary is later than its start. Omit unknown durations. Recreate cues and refresh if a supplied duration changes.

`toc: false` excludes a marker from chapter navigation but retains its timed content. It does not mark audio silence. Optional titles must have application-provided fallback labels; applications also provide image alt text and URL safety policies. The adapter does not render content or inherit missing fields from earlier chapters.

## Chapter navigation (unreleased 1.4)

`attachAudioPlayerChapters(player, options)` adds navigation on top of the existing cue controller. It is not in stable 1.3.1. Supply the same revision-matched PodcastChapter cues returned by `createPodcastChapterCues`:

```ts
import { attachAudioPlayerChapters } from "@yetric/audioplayer";

const chapters = attachAudioPlayerChapters(player, {
  getCues: (source) => chapterMetadata.get(source.id) ?? [],
  restartThresholdSeconds: 5,
});
const offCards = chapters.cues.subscribe(renderCards);
const offNavigation = chapters.subscribe(({ entries, current, next, previous }) => {
  renderChapterControls(entries, current, next, previous);
});
nextButton.onclick = () => { chapters.next(); };
previousButton.onclick = () => { chapters.previous(); };
// Individual chapter buttons call chapters.seekTo(cue.id).

// After replacing metadata:
chapters.refresh();
// Teardown:
offCards();
offNavigation();
chapters.destroy();
```

The controller owns `chapters.cues`; destroying either the chapter controller or player releases that cue controller. Reuse it for presentation, including `useAudioPlayerCues(chapters.cues)` in React. Do not attach a second cue engine for the same chapter presentation. The chapter snapshot is stable between navigation changes and can be consumed with `useSyncExternalStore(chapters.subscribe, chapters.getSnapshot, chapters.getSnapshot)`; unsubscribe on component cleanup, leaving controller ownership with the application.

`getSnapshot()` returns `{ sourceId, entries, current, next, previous }` with immediate subscriptions. The navigation rules are:

- `entries` excludes `toc: false`. Equal start times use the first visible entry in input order; other markers still participate in timed presentation.
- The current navigation chapter is the latest visible start at or before the observed position. An explicit `data.endTime` ends it; otherwise it lasts until the next visible chapter, bounded by media end. Hidden presentation markers therefore do not end a navigation chapter. Explicit ends can leave gaps with `current: null`. A known duration and `ended` status bound the final chapter.
- `next` is the first strictly later visible start. It is null at the final chapter/media end. `next()` never advances the queue or starts playback.
- While within the restart threshold (including exactly the threshold), `previous` targets the earlier visible chapter. Beyond it, it targets the current chapter's start. In a gap or at media end it targets the latest visible start. With no earlier target it is null; `previous()` is a no-op.
- The threshold defaults to five seconds and must be finite and non-negative. A zero threshold selects the earlier entry at the exact start and restarts after any progress.
- `next()`, `previous()` and `seekTo(id)` return whether a seek was requested, not a receiver acknowledgment. Missing, hidden and discarded same-time IDs return false. They use `player.seek()` and never call play/pause; existing seek clamping, errors, and completed-seek cue semantics apply.
- Source replacement, reload, refresh, unload and destruction update or clear navigation. Refresh validation failure retains the previous snapshot. No independent clock is added.

The demo's Previous chapter and Next chapter controls use this API and leave queue navigation on the existing Previous/Next buttons.

## Timed transcripts

[`podcast:transcript`](https://podcasting2.org/docs/podcast-namespace/tags/transcript) can identify timed or untimed documents. Parse the chosen format in your application and map timed entries to the same generic cues. For example, already parsed WebVTT entries with numeric start and end seconds:

```ts
const transcriptCues = entries.map((entry, index) => ({
  id: `transcript:${index}`,
  start: entry.startTime,
  end: entry.endTime,
  data: { text: entry.text },
}));
```

Use a distinct ID prefix when combining transcripts and chapters. Zero-length entries need an application policy before conversion, since range cues require a positive interval. File parsers and untimed transcript alignment are not included.

## Synchronization and cleanup

- All timestamps refer to the original audio, even when playback rate changes.
- Seeking updates content at the completed destination. Cues crossed during a seek do not emit enter events. While an API seek is pending, intermediate notifications are held until `seeked` or an error.
- Exit events precede enter events for each transition. `subscribe` is the immediate active-state API; enter events are not replayed to late event listeners.
- Reloads, repeat, and queue transitions rebuild cue state. Unload and source end clear active content. Open-ended ranges are also bounded by a known media duration.
- Updates follow browser/player notifications, without a fixed timing or animation-frame guarantee.
- `destroy()` detaches listeners, clears the snapshot, and releases subscribers. Destroying the player also destroys its cue controller. Repeated cleanup is safe; attach a new controller to resume cue tracking.

Consumers must match metadata to the exact audio revision. Dynamic ads or replaced files can invalidate timestamps. Silence skipping is separate playback work; its seeks use the same destination-state behavior.

## React

`useAudioPlayerCues(controller)` subscribes to an existing controller. It does not require a provider, attach a controller, or destroy one. The application owns its lifecycle. A stable controller can be shared by several components:

```tsx
import type { AudioPlayerCuesController } from "@yetric/audioplayer";
import { useAudioPlayerCues } from "@yetric/audioplayer/react";

function Cards({ controller }: {
  controller: AudioPlayerCuesController<{ text: string }>;
}) {
  const { activeCues } = useAudioPlayerCues(controller);
  return activeCues.map((cue) => <p key={cue.id}>{cue.data.text}</p>);
}
```

Create the controller in your application setup, outside component rendering, and destroy it when that integration ends. The hook cleans up only its own subscription on unmount and supports React StrictMode. Unchanged active content does not cause a render on each audio tick.

## Run the demo

Run `npm run demo:start` from the repository and open the address printed by Vite. Load Episode 1 and play. Chapter content changes at 2 and 4 seconds; chapter buttons seek directly. The hidden marker at 2 seconds changes the artwork without appearing in navigation. Episode 2 has no cues, demonstrating cleanup on a source change. The demo uses local audio and artwork.

# Design Note: Timeline Events and Cues

Status: implemented on the 1.3.0 development branch, pending release validation. See [Timed metadata](./TIMED_METADATA.md) for the implemented API and ownership contract. Follow-up proposals below are not shipped APIs.

## Goal

Let an app react to where playback is, so clients can show media and data in step with the audio: chapter art, show notes, links, ads, lyrics, slides, transcript lines, visual effects. The first milestone is synchronized images, links, and text with a runnable demo. Applications provide metadata and rendering; the library provides timing and active state.

## Podcasting 2.0 alignment

Use existing interchange formats at the boundary and generic cues internally. The first milestone includes an opt-in, pure adapter for parsed [Podcasting 2.0 JSON Chapters](https://podcasting2.org/docs/podcast-namespace/examples/chapters/jsonChapters). Applications discover the file through [`podcast:chapters`](https://podcasting2.org/docs/podcast-namespace/tags/chapters), fetch it, and associate it with an audio source. The player does not parse RSS or fetch URLs.

| JSON Chapters field | Planned use |
| ------------------- | ----------- |
| `startTime`, optional `endTime` | Cue boundaries on the original audio timeline |
| `title` | Chapter label and display text |
| `img`, `url` | Timed image and related link |
| `toc: false` | Keep the metadata cue active, but omit it from chapter navigation |
| `location` and document metadata | Preserve in adapter data; no map rendering required |

The document requires `version` and `chapters`; a chapter only requires `startTime`. The published format is version 1.2, with `"version": "1.2.0"` in its examples. This is independent of the library's release version. A hidden chapter marker is not an audio silence range. JSON Chapters does not define our generic payload's `text`, `links`, or image `alt` fields; applications supply accessible rendering.

Adapter policies proposed for this library, rather than additional format requirements:

- Preserve the original chapter object as cue data. Derive IDs from source identity and document index, stable for an unchanged document. Replacing a document can replace IDs.
- Respect an explicit `endTime`. Otherwise end at the next strictly later marker, including hidden markers. Markers sharing a start remain in input order and share the next boundary; do not manufacture zero-length intervals.
- A final marker without an end remains open until the source ends. Use a finite media duration as its end once known. Recompute after duration or metadata changes.
- Validate timing and document versions at the adapter boundary. Specify unsupported-version and malformed-input behavior before implementation; do not silently discard valid hidden markers.
- Do not infer audio identity from the document's optional `fileName`. Consumers remain responsible for audio revisions and metadata refreshes.

Timed text uses the same cue controller. [`podcast:transcript`](https://podcasting2.org/docs/podcast-namespace/tags/transcript) links several formats, including WebVTT, SRT, and JSON. The first milestone documents mapping already parsed timed text into cues. Transcript file parsers are follow-up work; plain text and HTML transcripts do not inherently supply timings.

Episode-level [`podcast:image`](https://podcasting2.org/docs/podcast-namespace/tags/image) and [`podcast:contentLink`](https://podcasting2.org/docs/podcast-namespace/tags/content-link) can supply fallback artwork and links. They do not supply timed cue boundaries. This milestone targets chapters and timed text, not the entire Podcast Namespace.

## What exists today

- Events: `sourcechange`, `queuechange`, `play`, `pause`, `seeking`, `seeked`, `timeupdate`, `ratechange`, `volumechange`, `ended`, `error`, `destroy`.
- State: `currentTime`, `duration`, `progress`, `status`, queue position.
- `timeupdate` is a browser event whose frequency varies. The first milestone promises correct cue state at observed positions, not frame-accurate animation.

Gaps for the goal above:

- No "a chapter started" or "a time was reached" event. Apps compare `currentTime` themselves on every `timeupdate`.
- No chapter model.
- No events for loaded, buffering or can-play, so "new sound is ready" cannot be told from "new sound requested" (`sourcechange` fires when loading starts).
- No frame-rate clock for animation.

## Proposed API

Opt-in attach functions, matching persistence and Media Session. Names are provisional.

### Cues

```ts
const cues = attachAudioPlayerCues(player, {
  getCues: (source) => metadataBySource[source.id]?.cues ?? [],
});

cues.subscribe(({ activeCues }) => renderCards(activeCues));
cues.on("cueenter", ({ cue }) => console.log("entered", cue.id));
cues.on("cueexit", ({ cue }) => console.log("exited", cue.id));
```

The first milestone uses range cues: `{ id, start, end?, data }`. `data` is a generic consumer-defined payload. An omitted end means a range lasting until the source ends, not a point event. Point cues are deferred until their seek and replay semantics are specified.

Example payload and interval:

```ts
{
  id: "recording-details",
  start: 42.5,
  end: 58,
  data: {
    text: "How the recording was made",
    image: { src: "/images/studio.jpg", alt: "The recording studio" },
    links: [{ label: "Read more", href: "https://example.com/article" }],
  },
}
```

Intervals are half-open: `start <= currentTime < end`, or `start <= currentTime` until the source ends when no end is supplied. Supplied times are finite, non-negative seconds on the original media timeline, with `start < end` when an end is present. Cue IDs are unique within a source. Overlapping intervals are supported and expose all active cues in deterministic start-time/input order.

Consumers match metadata to the exact source and audio revision. The library does not verify file hashes, infer revisions, fetch metadata, or interpret the payload as HTML. Image loading, link navigation, rendering, and accessibility belong to the application.

The controller supplies an initial active snapshot on subscription, even when attached after playback or a seek. Detaching removes listeners; no cue work runs when the feature is not attached. Updating metadata for an already loaded source will need an explicit refresh/set operation, with the same destination-state semantics as a seek.

### Chapters

The first milestone's JSON Chapters adapter feeds the same cue controller as generic metadata. The demo derives a visible chapter list from markers where `toc !== false` and seeks using the existing player API. Hidden markers still update timed content. Chapter metadata stays outside the core `AudioSource` shape.

Dedicated current-chapter state, a chapter hook, and navigation helpers can follow once the adapter and demo establish their contracts. They must use the same timeline rather than introduce a second synchronization model.

### Source and loading events, follow-up candidates

- `sourceready` when metadata is loaded and playback can start
- `waiting` and `playing` for stalls and recovery (shared with the 1.4 buffering work)
- `sourcestart` on the first play of a source, `sourceend` when it ends

### Clock for visuals, deferred

A proposed `player.getCurrentTime()` would expose a fresh engine position for animation; it is not part of the current API. A small helper, for example `attachAudioPlayerClock(player, onFrame)`, runs `requestAnimationFrame` only while playing and stops when paused. React: `useAudioPlayerTime()`.

### React

`useAudioPlayerCues(controller)` subscribes to an application-owned controller without creating or destroying it. Its snapshot changes only with source identity or active cue objects. A dedicated current-chapter hook remains a follow-up.

## Required synchronization semantics

These are where bugs and surprises come from. Each needs tests before release.

- **Seeking.** Recompute the active set at the destination. Exit cues no longer active and enter newly active cues. Cues wholly crossed during a seek do not fire presentation events. Point-cue behavior is deferred.
- **Scrubbing.** While the user drags, `seeking` events flood in. Cue changes are computed from the resulting position and coalesced, so the app sees the final state, not every cue crossed.
- **Playback rate.** Cues are keyed to media time, not wall-clock time, so rate changes do not move them.
- **Loops.** Repeat `one` and `all` replay from the start, so cues fire again.
- **Source change.** Active cues exit when the source changes or unloads, then the new source's supplied metadata determines the active set. Apply this to manual replacement and queue auto-advance.
- **Ordering.** On a single update, `cueexit` events fire before `cueenter` events, in cue order.
- **Accuracy.** Start with player state notifications and completed seeks. Document observed browser timing without a fixed frequency guarantee. A frame-rate clock is a later increment.
- **Many cues.** Index cues by start time so a long transcript with thousands of lines does not scan the whole list on every tick.

## Tests

- Unit tests with the existing mock audio for enter, exit, seeks, loops, source changes and ordering.
- Browser-level tests for real `timeupdate` timing and seeking.
- A performance test with a few thousand cues.
- Active snapshots on late attachment and metadata replacement, overlapping intervals, invalid ranges, unload, queue auto-advance, and cleanup.
- A browser demo showing images, links, and text, with assertions after playback, seeking, and source changes.
- JSON Chapters fixtures covering start-only markers, missing titles, explicit ends, hidden markers, equal starts, invalid timing, and metadata replacement. Test the final open-ended marker before and after duration becomes known.

## Out of scope for this note

- Audio visualization (waveform or spectrum). That needs the Web Audio API and CORS-enabled audio, and the engine currently owns the element. Tracked as an exploration in [`RELEASE_1_4.md`](./RELEASE_1_4.md) and as engine work in [`RELEASE_2_0.md`](./RELEASE_2_0.md).
- Loading cue data. The app parses feeds and fetches files. The chapter adapter accepts parsed JSON; transcript parsers are follow-up work. The library does not make network requests.

## Open questions

- Decide whether subsequent JSON Chapters versions need support beyond the implemented `1.2.0` format.
- Dedicated chapter helpers should use the controller's existing `refresh()` contract and keep payloads outside the core `AudioSource` shape.
- Specify point-cue behavior before introducing it; no `fireSkipped` option is planned for the first milestone.
- Naming: `cueenter` and `cueexit` follow `TextTrack` cue events. Is that familiar or confusing?

## Separate playback instructions

Silence skip ranges are not presentation cues. They authorize seeking across a portion of the original audio. A future consumer-supplied silence map may contain source identity, an audio revision, and sorted, non-overlapping safe-to-skip ranges with speech padding already applied.

After any skip, presentation is recomputed at the destination using the normal seek semantics. Skipped content must not flash or run presentation side effects. Metadata-driven skipping can use the current seek API; client-side detection and sample-level editing are separate work.

## First demo and implementation order

1. Define the range-cue and controller contracts, including open ends, validation, and metadata replacement. Specify the JSON Chapters adapter against published fixtures.
2. Implement active-set synchronization and test seek, repeat, source, and cleanup behavior.
3. Add the chapter adapter, React subscription, and an accessible demo with chapter images, titles, links, hidden markers, and navigation. Document mapping parsed timed transcripts into cues.
4. Validate the demo in the browser suite, document the public API, and publish a prerelease.
5. Add dedicated chapter helpers and transcript parsers only after the foundation is validated.

The multimedia use case is now the agreed next focus. The demo validates the implementation and usability; it is not dependent on a particular consuming application.

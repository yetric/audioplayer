# Design Note: Timeline Events and Cues

Status: proposal for 1.3. Additive only. Not built.

## Goal

Let an app react to where playback is, so clients can show media and data in step with the audio: chapter art, show notes, links, ads, lyrics, slides, transcript lines, visual effects. This is the main way to build clients that feel rich, and it is the main thing a headless audio library can add on top of `<audio>`.

## What exists today

- Events: `sourcechange`, `queuechange`, `play`, `pause`, `seeking`, `seeked`, `timeupdate`, `ratechange`, `volumechange`, `ended`, `error`, `destroy`.
- State: `currentTime`, `duration`, `progress`, `status`, queue position.
- `timeupdate` is the browser's event. The spec only guarantees it about every 250 ms, so it is too coarse for tight visual sync.

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
  getCues: (source) => source.cues ?? [],
});

cues.on("cueenter", ({ cue }) => showCard(cue.data));
cues.on("cueexit", ({ cue }) => hideCard(cue.id));
```

A cue is `{ id, start, end?, data? }`. With no `end` it is a point cue that fires `cueenter` once.

### Chapters

An optional `chapters: { id, start, title, image?, url? }[]` on `AudioSource`, sorted by `start`. The player adds `currentChapter` and `chapterIndex` to state and emits `chapterchange`. `seekToChapter(id)` jumps to a chapter. Chapters are also available as cues, so one mechanism drives both.

### Source and loading events

- `sourceready` when metadata is loaded and playback can start
- `waiting` and `playing` for stalls and recovery (shared with the 1.4 buffering work)
- `sourcestart` on the first play of a source, `sourceend` when it ends

### Clock for visuals

`player.getCurrentTime()` is cheap and safe to call every animation frame. A small helper, for example `attachAudioPlayerClock(player, onFrame)`, runs `requestAnimationFrame` only while playing and stops when paused. React: `useAudioPlayerTime()`.

### React

`useActiveCues()`, `useCurrentChapter()`. Both re-render only when the value changes.

## Semantics to decide

These are where bugs and surprises come from. Each needs tests before release.

- **Seeking.** Seeking into a range cue fires `cueenter`. Seeking past a point cue does not fire it by default. An option `fireSkipped` fires it anyway.
- **Scrubbing.** While the user drags, `seeking` events flood in. Cue changes are computed from the resulting position and coalesced, so the app sees the final state, not every cue crossed.
- **Playback rate.** Cues are keyed to media time, not wall-clock time, so rate changes do not move them.
- **Loops.** Repeat `one` and `all` replay from the start, so cues fire again.
- **Source change.** Active cues exit when the source changes, then the new source's cues load.
- **Ordering.** On a single update, `cueexit` events fire before `cueenter` events, in cue order.
- **Accuracy.** Two modes: `timeupdate` driven (cheap, about 250 ms), or clock driven (frame-rate checks while playing). Default to the cheap one.
- **Many cues.** Index cues by start time so a long transcript with thousands of lines does not scan the whole list on every tick.

## Tests

- Unit tests with the existing mock audio for enter, exit, point cues, seeks, loops, source changes and ordering.
- Browser-level tests (1.2) for real `timeupdate` timing and seeking.
- A performance test with a few thousand cues.

## Out of scope for this note

- Audio visualization (waveform or spectrum). That needs the Web Audio API and CORS-enabled audio, and the engine currently owns the element. Tracked as an exploration in [`RELEASE_1_4.md`](./RELEASE_1_4.md) and as engine work in [`RELEASE_2_0.md`](./RELEASE_2_0.md).
- Loading cue data. The app parses feeds and transcripts. The library does not make network requests.

## Open questions

- Should chapters and cues be one concept, or separate types that share an engine?
- Does `AudioSource` carry `cues` directly, or does the app supply them through `getCues`? The latter keeps the source type small and works for lazily loaded data.
- Is `fireSkipped` needed at launch, or can it wait for a real request?
- Naming: `cueenter` and `cueexit` follow `TextTrack` cue events. Is that familiar or confusing?

## Demand check before building

Hypothesis, not evidence: app developers want this. Before committing, build one visible demo in `podcast-app` (chapter art and a linked note appearing in step with the episode) and see if it holds up. Collect requests through Discussions (see [`OPEN_SOURCE.md`](./OPEN_SOURCE.md)).

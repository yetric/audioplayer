---
id: roadmap
slug: /roadmap
---

# Roadmap

## Target

Maintain a standalone, headless browser audio library with a small public API, reliable playback, and tested examples that applications can adopt independently.

## Principles

1. Core before adapters.
2. Browser support before React Native.
3. State machine and events before UI helpers.
4. Common listening flows before specialized streaming features.
5. Progressive enhancement for Media Session and persistence.

## Next focus: timed multimedia metadata

1.2 is shipped. The next milestone is an opt-in synchronization layer for consumer-supplied images, links, text, and other timed data. The library stays headless: applications own metadata production, fetching, and presentation.

First deliverable for 1.3:

- Typed range cues and an observable set of active cues.
- An opt-in adapter for Podcasting 2.0 JSON Chapters, including timed images, titles, links, and hidden metadata markers. Document how parsed timed transcripts use the same cues.
- Correct active state after seeking, scrubbing, playback-rate changes, loops, and source changes.
- A React hook for active cues, backed by the same controller used by vanilla JS.
- A runnable multimedia demo with images, links, and text, plus unit and browser tests.

All timestamps use the original media timeline. Playback instructions such as silence skip ranges remain separate from presentation cues. A future skip controller must synchronize presentation at its destination without replaying content it skipped.

Use Podcasting 2.0 formats at the boundary while keeping the core generic. Applications own RSS discovery and fetching. Dedicated chapter helpers can build on the first adapter and demo. Sleep timers, listening history, and other convenience features do not block the multimedia milestone. Details: [`RELEASE_1_3.md`](./RELEASE_1_3.md) and [`DESIGN_CUES.md`](./DESIGN_CUES.md).

## Architecture Direction

### Core

- `createAudioPlayer(options?)`
- wraps one `HTMLAudioElement`
- accepts a single source per queue item in `1.0`
- requires stable caller-provided IDs for sources and queue items
- exposes commands: `load`, `play`, `pause`, `toggle`, `seek`, `setRate`, `setVolume`, `destroy`
- supports auto-load on `play(...)` for common app flows
- treats one active player instance per page as the intended `1.0` deployment model
- preserves the ended item and exposes `status: "ended"` instead of resetting silently
- emits state changes through `subscribe(listener)`
- exposes typed events for integration work such as progress, queue changes, and playback lifecycle
- imperative-first API shape, with optional plugins attached after construction or through small focused options
- built-in queue support for next/previous/autoplay in `1.0`
- opt-in persistence plugin, with `localStorage` first and pluggable storage later
- optional Media Session plugin

### Framework Integration

- Vanilla JS should work with zero adapters
- React should get a provider-owned singleton player plus hook, not a different engine
- Angular and Web Components should consume the same core instance
- React Native is a stretch goal and likely needs a custom engine contract

### Internal Engine Boundary

- the public `AudioPlayer` API stays browser-first for `1.0`
- browser playback now sits behind a small internal audio engine boundary
- the browser engine remains the only shipped runtime engine today
- any future React Native work should implement the same internal engine contract instead of forking the public API

## 1.0 Definition

`1.0.0` should include:

- stable core command API
- serializable state model
- queue + auto-advance
- persistence restore flow
- progress event hooks for backend pinging
- Media Session integration
- examples for vanilla JS and React
- test coverage for core behavior

## Not 1.0 Blockers

- waveform UI
- skip silence
- transcript features
- annotations
- custom renderer packages
- full React Native support

## Release Plan After 1.0

Every 1.x release is additive and ships a prerelease first. Validate changes with this repo's automated tests, browser demo, and relevant framework examples. External app feedback informs priorities but is not a release requirement. Defer features without a clear use case and a reproducible example. 2.0 is the only release that may break.

| Release | Theme | Details |
| ------- | ----- | ------- |
| 1.1 | Quality and publishing | Shipped. StrictMode fix, more tests, OIDC publishing |
| 1.2 | Less glue code, shipped | [`RELEASE_1_2.md`](./RELEASE_1_2.md) |
| 1.3 | Timed multimedia metadata, next focus | [`RELEASE_1_3.md`](./RELEASE_1_3.md), [`DESIGN_CUES.md`](./DESIGN_CUES.md) |
| 1.4 | Resilience and reach | [`RELEASE_1_4.md`](./RELEASE_1_4.md) |
| 2.0 | Long shots, not committed | [`RELEASE_2_0.md`](./RELEASE_2_0.md), [`DOCS_PLAN.md`](./DOCS_PLAN.md) |

Rules:

- No breaking changes in 1.x. Collect them in `RELEASE_2_0.md`.
- Every feature needs a documented use case and acceptance criteria. Hypotheses are marked as such in the release docs.
- Keep the public API small. Prefer opt-in attach functions and optional fields.
- 2.0 has a documentation, LLM support and demo quality bar, with groundwork in each 1.x release. See [`DOCS_PLAN.md`](./DOCS_PLAN.md).
- The library is open source. Community and adoption work is tracked in [`OPEN_SOURCE.md`](./OPEN_SOURCE.md) and scheduled into these releases.

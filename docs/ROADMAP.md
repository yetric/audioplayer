# Roadmap

## Target

Ship `1.0.0` only when the library can replace the current `podcast-app` audio context with a cleaner headless API and no meaningful feature regression in core listening flows.

## Principles

1. Core before adapters.
2. Browser support before React Native.
3. State machine and events before UI helpers.
4. Podcast use cases before generic streaming edge cases.
5. Progressive enhancement for Media Session and persistence.

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

Every 1.x release is additive and ships a prerelease first. Each is validated in `podcast-app` where the work applies to it. Platform-specific work (for example Angular or Web Components) is validated with its example project or another named consumer. Items with no named consumer get dropped. 2.0 is the only release that may break.

| Release | Theme | Details |
| ------- | ----- | ------- |
| 1.1 | Quality and publishing | Shipped. StrictMode fix, more tests, OIDC publishing |
| 1.2 | Less glue code | [`RELEASE_1_2.md`](./RELEASE_1_2.md) |
| 1.3 | Timeline events and listening features | [`RELEASE_1_3.md`](./RELEASE_1_3.md), [`DESIGN_CUES.md`](./DESIGN_CUES.md) |
| 1.4 | Resilience and reach | [`RELEASE_1_4.md`](./RELEASE_1_4.md) |
| 2.0 | Long shots, not committed | [`RELEASE_2_0.md`](./RELEASE_2_0.md), [`DOCS_PLAN.md`](./DOCS_PLAN.md) |

Rules:

- No breaking changes in 1.x. Collect them in `RELEASE_2_0.md`.
- Every feature needs a named consumer need. Hypotheses are marked as such in the release docs.
- Keep the public API small. Prefer opt-in attach functions and optional fields.
- 2.0 has a documentation, LLM support and demo quality bar, with groundwork in each 1.x release. See [`DOCS_PLAN.md`](./DOCS_PLAN.md).
- The library is open source. Community and adoption work is tracked in [`OPEN_SOURCE.md`](./OPEN_SOURCE.md) and scheduled into these releases.

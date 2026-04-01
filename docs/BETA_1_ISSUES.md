# Pre-Beta Issue List

Priority is based on one question only: does this unblock replacing the current `podcast-app` player?

## P0

### Issue 001: Define the core player contract

- Goal: lock the smallest stable public API for load, play, pause, seek, rate, volume, subscribe, and destroy.
- Why first: every adapter and integration depends on this.
- Primary artifacts:
  - `src/index.ts`
  - `docs/API_CONTRACT.md`
- Done when:
  - imperative instance API is the primary public model
  - `load()` and queue items use one flat source object in `beta.1`
  - stable caller-provided IDs are required
  - `play(...)` can auto-load an item for the common case
  - the intended `beta.1` usage model is one active player instance per page
  - playback end preserves the current item with `status: "ended"` when not auto-advancing
  - public types exist for source metadata, player state, and events
  - `subscribe(state)` is paired with typed event listeners for side effects
  - API is framework-agnostic
  - vanilla JS usage is documented
  - command semantics are explicit enough that two developers would not design different APIs from the same issue text

### Issue 002: Implement browser engine on top of `HTMLAudioElement`

- Goal: reliable browser playback engine with state syncing and error handling.
- `podcast-app` mapping:
  - replaces current `AudioContext` wrapper
  - supports current play, pause, seek, duration, rate flows
- Done when:
  - engine handles `loadedmetadata`, `timeupdate`, `play`, `pause`, `ended`, and `error`
  - state updates are consistent after imperative commands and native events

### Issue 003: Build a serializable player state model

- Goal: expose one normalized state object suitable for React, Angular, and persistence.
- Done when:
  - state includes status, current source, current time, duration, buffered, rate, volume, muted, queue position, and error
  - state is plain-data and does not leak DOM objects or runtime-only error causes
  - derived progress information is available without reading the underlying audio element
  - queue position is normalized enough for adapters and persistence to consume directly
  - state can be consumed without direct DOM access

### Issue 004: Add queue, next/previous, and auto-advance

- Goal: make podcast playlist playback a first-class feature.
- `podcast-app` mapping:
  - playlist navigation
  - autoplay next episode on `ended`
- Done when:
  - queue is part of the player instance API for `beta.1`
  - queue supports set, append, remove, clear, next, previous
  - previous behavior supports "restart current if more than N seconds in"
  - repeat modes are supported at least as `off | one | all`
  - manual next/previous behavior is distinct from actual playback-end behavior
  - queue mutations keep active playback stable unless the caller explicitly changes source

### Issue 005: Persistence and resume plugin

- Goal: restore paused playback state across sessions.
- `podcast-app` mapping:
  - restore last episode, time, rate, volume, queue index
- Done when:
  - persistence is opt-in, not implicit
  - a `localStorage` adapter exists
  - persisted state expires
  - restore never auto-plays without an explicit user action
  - restore reapplies queue, repeat mode, volume, mute, rate, and seek position
  - save happens on pause, end, queue/source changes, and on an interval during playback
  - storage adapter is `localStorage` first and swappable later

### Issue 006: Progress reporting hooks

- Goal: support backend progress pings without coupling analytics to the core.
- `podcast-app` mapping:
  - current 5-second ping flow to backend
- Done when:
  - a consumer can attach a progress reporting controller
  - progress reports include source identity, current time, duration, played fraction, status, and queue position
  - configurable reporting interval exists
  - reports fire on interval while playing and on key transitions like pause, ended, seek, and source change
  - library does not own network requests

### Issue 007: Media Session integration

- Goal: lock-screen and OS media controls for supported browsers.
- Done when:
  - a consumer can attach Media Session integration explicitly
  - metadata is updated on source changes
  - playback state and position state are synchronized when supported
  - play, pause, seek, next, previous handlers work
  - unsupported browsers degrade silently

### Issue 008: Error model and fallback behavior

- Goal: make loading and playback failures debuggable and recoverable.
- Done when:
  - errors have typed codes
  - unsupported environments surface a typed error
  - failed loads do not leave the player in a corrupt state
  - successful operations clear stale error state
  - consumer can show useful UI from state alone

### Issue 009: React adapter for `podcast-app`

- Goal: thin React integration proving the headless core is usable.
- Scope:
  - `AudioPlayerProvider` as the primary app-level integration
  - `useAudioPlayer` hook on top of the provider
  - no React-owned playback engine
- Done when:
  - `podcast-app` can integrate with a small wrapper layer
  - React API does not diverge from the core mental model

### Issue 010: Examples and migration guide for `podcast-app`

- Goal: reduce adoption friction.
- Done when:
  - vanilla JS example exists
  - React example exists
  - migration notes exist for replacing current `src/context/audio.tsx`

## P1

### Issue 011: Testing strategy and browser-level verification

- Goal: protect timing-sensitive playback behavior.
- Done when:
  - unit tests cover state transitions
  - browser tests cover load, seek, ended, and auto-advance

### Issue 012: Package ergonomics and distribution

- Goal: make the package easy to consume in TS and JS.
- Done when:
  - ESM and CJS builds exist
  - type declarations are emitted
  - package exports are stable

### Issue 013: Angular and Web Component integration docs

- Goal: prove the core API works outside React.
- Done when:
  - one Angular usage example exists
  - one Web Component usage example exists

## P2

### Issue 014: Alternate engine contract for React Native

- Goal: explore whether the same high-level API can sit above a non-DOM engine.
- Done when:
  - an engine interface is extracted
  - feasibility is documented
  - browser core remains the default path

### Issue 015: Nice-to-have playback features

- Candidates:
  - sleep timer
  - skip silence
  - advanced speed presets
  - share-position helpers
- Note: useful, but not required for `beta.1` unless `podcast-app` proves they are blocking

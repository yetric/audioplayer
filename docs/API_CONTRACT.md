# API Contract

This document freezes the intended `Issue 001` contract for `1.0.0-beta.1`.

It is not the full implementation spec for browser playback internals. It is the public TypeScript surface and the behavior a developer should build against.

The current implementation target is a browser `HTMLAudioElement` engine. Non-browser environments may construct the player, but actual playback commands require a browser audio implementation.

## Core Principles

- Imperative instance API first
- One active player instance per app/page is the intended `beta.1` model
- Queue is built into the player instance
- Persistence is opt-in
- One flat source object per item
- Stable caller-provided IDs are required
- `subscribe(state)` is for UI consumption
- Typed events are for integrations and side effects

## Main Types

See [src/index.ts](/home/hising/src/github/yetric/audioplayer/src/index.ts) for the canonical type definitions.

Primary exported types:

- `AudioSource`
- `AudioPlayerState`
- `AudioPlayerProgressState`
- `AudioPlayerQueueState`
- `AudioPlayerQueuePositionState`
- `AudioPlayerErrorState`
- `AudioPlayerRuntimeError`
- `AudioPlayerEventMap`
- `AudioPlayer`
- `PersistedPlayerState`
- `AudioPlayerPersistenceAdapter`
- `AudioPlayerPersistenceOptions`
- `AudioPlayerPersistenceController`
- `AudioPlayerProgressSnapshot`
- `AudioPlayerProgressReporterOptions`
- `AudioPlayerProgressReporterController`
- `AudioPlayerMediaSessionOptions`
- `AudioPlayerMediaSessionController`

## Command Semantics

### Persistence

- Persistence is opt-in through `attachAudioPlayerPersistence(...)`
- The first built-in adapter is `createLocalStoragePersistenceAdapter(key)`
- Restore must not auto-play by itself
- Persistence saves plain-data only
- Persistence should save on pause, ended, source change, queue change, rate/volume changes, and periodically while playing

### Progress Reporting

- Progress reporting is opt-in through `attachAudioPlayerProgressReporter(...)`
- The library emits normalized progress snapshots and does not own network requests
- Reporting should happen on an interval while playing
- Reporting should also happen on pause, ended, seek completion, and source changes

### Media Session

- Media Session integration is opt-in through `attachAudioPlayerMediaSession(...)`
- Unsupported browsers should no-op cleanly
- Metadata should come from the current `AudioSource`
- Play, pause, seek backward, seek forward, previous track, next track, seek to, and stop should be wired when supported
- Playback state and position state should stay in sync while the player changes

### `load(source)`

- Requires a stable `source.id` and `source.src`
- Replaces the active source
- Does not start playback by itself
- Resets `currentTime` to `0`
- Transitions to `loading`, then to `ready` when metadata becomes available

### `play(source?)`

- If `source` is provided, the player auto-loads it first
- If no source is active, this is an error condition
- Intended to return `Promise<void>` because browser playback can be async and reject
- If a source is still loading, play intent should be remembered and start once loading completes

### `pause()`

- Pauses the active source
- Keeps the current source and playback position intact

### `toggle()`

- If currently playing, pauses
- Otherwise tries to play the active source

### `seek(time)`

- Clamps to `>= 0`
- Clamps to duration when duration is known
- `beta.1` contract should not throw for normal out-of-range values

### `setRate(rate)`

- Must reject invalid values through the typed error path

### `setVolume(volume)`

- Volume is normalized to `0..1`
- Invalid values go through the typed error path

### `setQueue(items, options?)`

- Replaces the queue
- `startAtId` selects the active item if provided
- `autoplay` starts playback after selection

### `next()`

- Moves to the next queue item and plays it
- If there is no next item and repeat is off, manual `next()` is a no-op
- If `repeatMode === "all"` and the queue is exhausted, wraps to the first item
- If `repeatMode === "one"`, keeps the current item
- Only actual playback end should move the player into `status: "ended"` when repeat is off

### `previous(options?)`

- If current time is greater than the restart threshold, restarts the current item
- Otherwise moves to the previous queue item
- If there is no previous item and repeat is off, restarts the current item

### Queue mutation behavior

- Removing the active item from the queue does not forcibly unload the current source
- Clearing the queue removes queue navigation state but does not forcibly unload the current source
- Queue mutations should keep active playback stable unless the caller explicitly loads another item

### `destroy()`

- Tears down the player instance and listeners
- Caller should treat the instance as unusable after destroy

## State Semantics

The exported player state is intended to be plain-data and serializable:

- no DOM nodes
- no functions
- no runtime-only error causes in the state snapshot
- enough derived data that UI consumers do not need to inspect `HTMLAudioElement`

### `status`

- `idle`: no active source
- `loading`: source change in progress
- `ready`: source loaded but not currently playing
- `playing`: currently playing
- `paused`: paused with active source
- `ended`: playback finished without silent reset
- `error`: last operation failed

### `queue`

- Queue state is always present, even when empty
- `queue.position.currentIndex = -1` means no active queued item
- `queue.itemIds` exists so consumers can compare queue identity without walking full item payloads

### `progress`

- `progress.currentTime`, `progress.duration`, and `progress.buffered` mirror the flat playback values
- `progress.playedFraction` and `progress.bufferedFraction` are normalized `0..1`
- UI consumers should not need direct DOM access to render sliders or progress bars

### `error`

- `state.error` is intentionally serializable and contains only `code` and `message`
- runtime-only details such as original thrown values stay in the `error` event payload, not the state snapshot
- successful operations clear stale `state.error`
- unsupported environments should surface a typed `UNSUPPORTED_ENVIRONMENT` error instead of failing silently

## Error Semantics

- `state.error` is the user-facing, serializable failure snapshot
- the `error` event payload may include richer runtime causes
- failed operations should not corrupt queue structure or silently replace the active source
- successful playback, metadata load, seek completion, rate changes, and volume changes should clear stale errors

## Event Semantics

The intent is:

- UI uses `subscribe(state)`
- Integrations use `on(eventName, listener)`

Important event families:

- `sourcechange`
- `queuechange`
- `play` / `pause`
- `seeking` / `seeked`
- `timeupdate`
- `ratechange`
- `volumechange`
- `ended`
- `error`
- `destroy`

## Beta Boundaries

Explicitly in scope for `beta.1`:

- browser-first playback
- built-in queue
- repeat modes
- ended-state preservation
- opt-in persistence with `localStorage`
- opt-in Media Session integration
- React provider integration later

Explicitly not required for `Issue 001`:

- Media Session implementation
- persistence implementation
- React adapter implementation
- React Native engine abstraction

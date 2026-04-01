# API Contract

This document freezes the intended `Issue 001` contract for `1.0.0-beta.1`.

It is not the full implementation spec for browser playback internals. It is the public TypeScript surface and the behavior a developer should build against.

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
- `AudioPlayerQueueState`
- `AudioPlayerError`
- `AudioPlayerEventMap`
- `AudioPlayer`

## Command Semantics

### `load(source)`

- Requires a stable `source.id` and `source.src`
- Replaces the active source
- Does not start playback by itself
- Resets `currentTime` to `0`

### `play(source?)`

- If `source` is provided, the player auto-loads it first
- If no source is active, this is an error condition
- Intended to return `Promise<void>` because browser playback can be async and reject

### `pause()`

- Pauses the active source
- Keeps the current source and playback position intact

### `toggle()`

- If currently playing, pauses
- Otherwise tries to play the active source

### `seek(time)`

- Clamps to `>= 0`
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
- If `repeatMode === "all"` and the queue is exhausted, wraps to the first item
- If `repeatMode === "one"`, keeps the current item
- If repeat is off and no next item exists, the current item remains loaded and status becomes `ended`

### `previous(options?)`

- If current time is greater than the restart threshold, restarts the current item
- Otherwise moves to the previous queue item
- If there is no previous item and repeat is off, restarts the current item

### `destroy()`

- Tears down the player instance and listeners
- Caller should treat the instance as unusable after destroy

## State Semantics

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
- `currentIndex = -1` means no active queued item

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
- React provider integration later

Explicitly not required for `Issue 001`:

- Media Session implementation
- persistence implementation
- React adapter implementation
- React Native engine abstraction

# Roadmap

## Target

Ship `1.0.0-beta.1` only when the library can replace the current `podcast-app` audio context with a cleaner headless API and no meaningful feature regression in core listening flows.

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
- accepts a single source per queue item in `beta.1`
- requires stable caller-provided IDs for sources and queue items
- exposes commands: `load`, `play`, `pause`, `toggle`, `seek`, `setRate`, `setVolume`, `destroy`
- supports auto-load on `play(...)` for common app flows
- treats one active player instance per page as the intended `beta.1` deployment model
- preserves the ended item and exposes `status: "ended"` instead of resetting silently
- emits state changes through `subscribe(listener)`
- exposes typed events for integration work such as progress, queue changes, and playback lifecycle
- imperative-first API shape, with optional plugins attached after construction or through small focused options
- built-in queue support for next/previous/autoplay in `beta.1`
- opt-in persistence plugin, with `localStorage` first and pluggable storage later
- optional Media Session plugin

### Framework Integration

- Vanilla JS should work with zero adapters
- React should get a provider-owned singleton player plus hook, not a different engine
- Angular and Web Components should consume the same core instance
- React Native is a stretch goal and likely needs a custom engine contract

## Beta Definition

`1.0.0-beta.1` should include:

- stable core command API
- serializable state model
- queue + auto-advance
- persistence restore flow
- progress event hooks for backend pinging
- Media Session integration
- examples for vanilla JS and React
- test coverage for core behavior

## Not Beta Blockers

- waveform UI
- skip silence
- transcript features
- annotations
- custom renderer packages
- full React Native support

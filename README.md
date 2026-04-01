# `@yetric/audioplayer`

Headless TypeScript audio player for modern browsers.

The first milestone is not "generic media player." It is "good enough to replace the current `podcast-app` audio layer with a simpler, testable, framework-agnostic library."

## Product Direction

- Browser-first, using `HTMLAudioElement` as the primary engine
- Headless core API, so React/Angular/Web Components/vanilla JS can all use the same package
- Imperative instance API first: `const player = createAudioPlayer()`
- Queue management lives inside the player instance for `beta.1`
- Persistence is opt-in, with `localStorage` as the first storage adapter
- `load()` accepts one flat audio source object in `beta.1`
- `subscribe(state)` is the primary UI model, with typed events for side effects
- Every source / queue item must have a stable caller-provided `id`
- `play(...)` may auto-load the requested item instead of requiring a separate `load()`
- `beta.1` is optimized for one active player instance per app/page
- When playback finishes without auto-advancing, the current item remains loaded with `status: "ended"`
- Strong TypeScript types without making vanilla JS usage awkward
- React Native compatibility treated as a later adapter problem, not a `beta` blocker

## Beta 1 Goal

`1.0.0-beta.1` is ready when `podcast-app` can use this package for:

- load / replace a source
- play / pause
- seek
- playback rate changes
- progress reporting
- queue navigation
- persisted resume state
- Media Session integration

## Early API Shape

```ts
import { createAudioPlayer } from "@yetric/audioplayer";

const player = createAudioPlayer();

await player.load({
  id: "episode-42",
  src: "https://cdn.example.com/episode-42.mp3",
  title: "Episode 42",
  artist: "My Podcast",
  artwork: "https://cdn.example.com/episode-42.jpg",
});

await player.play();
player.seek(120);
player.setRate(1.25);

const unsubscribe = player.subscribe((state) => {
  console.log(state.status, state.currentTime);
});
```

The public API should stay small. Extra behavior like persistence, progress pings, analytics, and Media Session should be opt-in modules or config hooks around the same core. The first persistence target is `localStorage`, but the design should leave room for custom storage backends later. UI consumers should mostly read state through `subscribe(...)`, while integrations can rely on typed events instead of diffing state manually.

## Planned Package Surface

- `@yetric/audioplayer`
  - headless browser player core
  - queue support
  - persistence hooks
  - Media Session integration
- later:
  - `@yetric/audioplayer-react`
    - provider-owned singleton player for app-level usage
    - hook-based consumption on top of the provider
  - `@yetric/audioplayer-rn`

## Repo Docs

- [`docs/ROADMAP.md`](./docs/ROADMAP.md)
- [`docs/BETA_1_ISSUES.md`](./docs/BETA_1_ISSUES.md)

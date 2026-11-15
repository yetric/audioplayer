# `@yetric/audioplayer`

Headless TypeScript audio player for modern browsers.

[GitHub](https://github.com/yetric/audioplayer)

## Status

`1.1.1` is the current stable release.

Recommended current focus:

- use the browser package
- validate playback through this repo's tests, demos, and framework examples
- treat React Native support as later work

## Install

```bash
npm install @yetric/audioplayer
```

React usage:

```bash
npm install @yetric/audioplayer react
```

## Quick Start

```ts
import { createAudioPlayer } from "@yetric/audioplayer";

const player = createAudioPlayer();

await player.play({
  id: "episode-42",
  src: "https://cdn.example.com/episode-42.mp3",
  title: "Episode 42",
  artist: "Podcast Name",
});

player.subscribe((state) => {
  console.log(state.status, state.progress.playedFraction);
});
```

Use it to build audio interfaces for podcasts, audiobooks, music, and other browser audio. The library owns playback state and commands; your app owns the UI, content, and network requests.

## Product Direction

- Browser-first, using `HTMLAudioElement` as the primary engine
- Headless core API, so React/Angular/Web Components/vanilla JS can all use the same package
- Imperative instance API first: `const player = createAudioPlayer()`
- Queue management lives inside the player instance for `1.0`
- Persistence is opt-in, with `localStorage` as the first storage adapter
- `load()` accepts one flat audio source object in `1.0`
- `subscribe(state)` is the primary UI model, with typed events for side effects
- Every source / queue item must have a stable caller-provided `id`
- `play(...)` may auto-load the requested item instead of requiring a separate `load()`
- `1.0` is optimized for one active player instance per app/page
- When playback finishes without auto-advancing, the current item remains loaded with `status: "ended"`
- Strong TypeScript types without making vanilla JS usage awkward
- React Native compatibility treated as a later adapter problem, not a 1.0 blocker

## Core capabilities

The stable browser API supports:

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
- [`docs/V1_ISSUES.md`](./docs/V1_ISSUES.md)
- [`docs/RELEASE_1_2.md`](./docs/RELEASE_1_2.md)
- [`docs/RELEASE_1_3.md`](./docs/RELEASE_1_3.md)
- [`docs/RELEASE_1_4.md`](./docs/RELEASE_1_4.md)
- [`docs/RELEASE_2_0.md`](./docs/RELEASE_2_0.md)
- [`docs/DESIGN_CUES.md`](./docs/DESIGN_CUES.md)
- [`docs/DOCS_PLAN.md`](./docs/DOCS_PLAN.md)
- [`docs/OPEN_SOURCE.md`](./docs/OPEN_SOURCE.md)
- [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md)
- [`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md)
- [`docs/CORE_GUIDE.md`](./docs/CORE_GUIDE.md)
- [`docs/REACT_GUIDE.md`](./docs/REACT_GUIDE.md)
- [`docs/INTEGRATIONS.md`](./docs/INTEGRATIONS.md)
- [`docs/RECIPES.md`](./docs/RECIPES.md)
- [`docs/MIGRATION.md`](./docs/MIGRATION.md)
- [`docs/ANGULAR_EXAMPLE.md`](./docs/ANGULAR_EXAMPLE.md)
- [`docs/WEB_COMPONENT_EXAMPLE.md`](./docs/WEB_COMPONENT_EXAMPLE.md)

## External Docs

- Docusaurus site source: [`website/`](./website/)
- Local dev: `npm run docs:start`
- Production build: `npm run docs:build`

## Local Demo

- Start demo: `npm run demo:start`
- Build demo: `npm run demo:build`
- Preview demo build: `npm run demo:preview`

## Examples

- [`examples/vanilla/index.html`](./examples/vanilla/index.html)
- [`examples/vanilla/playlist-demo.js`](./examples/vanilla/playlist-demo.js)
- [`examples/react/App.tsx`](./examples/react/App.tsx)
- [`examples/react/PodcastPlayerDemo.tsx`](./examples/react/PodcastPlayerDemo.tsx)

# 2.0: Long Shots

Status: ideas, not commitments. Nothing here is scheduled. Breaking changes are allowed only in a major version.

## Theme

Stop assuming one browser `HTMLAudioElement` and one player per page. Make engines pluggable and public.

## What 1.x taught us (inputs to decide on)

- Every 1.x limitation we document today is a candidate: one active player per page, a flat single-source `AudioSource`, browser-only engine.
- The internal engine boundary (`AudioEngine`) already exists. 2.0 would make it a public, versioned contract.
- Decisions here should be driven by real consumers. If `podcast-app` and at least one other consumer do not need an item, drop it.

## Candidate themes

### 1. Public engine contract

- Export a stable `AudioEngine` interface and document it.
- Ship a Web Audio engine for features `HTMLAudioElement` cannot do: skip silence, volume boost, loudness normalization.
- Ship a React Native engine as a separate package, `@yetric/audioplayer-rn`, on the same contract.
- Breaking candidate: engine selection becomes an explicit option instead of an implicit default.

### 2. Multiple sources and multiple players

- Support several player instances per page, for example narration plus background audio, with explicit audio focus rules.
- First-class `sources[]` per item for format fallback (for example opus then mp3).
- Breaking candidate: `AudioSource.src` becomes `sources`, with a migration helper.

### 3. Adaptive streaming and casting

- HLS and DASH through an engine, for example one built on hls.js.
- Chromecast and AirPlay through engines or plugins.
- Open question: is this in scope for a podcast-first library, or a different package?

### 4. Sync and listening history

- A remote persistence adapter contract, so positions and queue can sync across devices.
- Standard listening-event schema for stats and analytics, compatible with podcast measurement approaches.
- The library still does not own network requests. It defines the contract only.

### 5. Time-aligned content

- Build on the 1.3 cues and chapters ([`DESIGN_CUES.md`](./DESIGN_CUES.md)): transcripts as a first-class synchronized content API, with current cue in state and seek to cue.
- Audio analysis for visual clients (waveform, spectrum) through a Web Audio engine.
- Bookmarks and clips with start and end times.

### 6. Packaging and platform

- ESM only, with CJS dropped (breaking for CommonJS consumers).
- Raise the minimum browser and Node targets.
- Separate packages for adapters (`-react`, `-element`, `-angular`) if the single package grows too large.

### 7. Governance

- A second maintainer or an npm organization, and a documented release and triage process, before wider adoption.
- Support policy for 1.x after 2.0 ships (proposal: security and bug fixes for a stated period).

## Launch quality bar

2.0 does not ship on features alone. It ships when these are true. Details and the path through 1.x are in [`DOCS_PLAN.md`](./DOCS_PLAN.md).

- **World-class online documentation:** a published, searchable, versioned site with quickstarts per framework, concepts, recipes, a generated API reference, troubleshooting, and a 1.x to 2.0 migration guide.
- **LLM support:** `llms.txt` and Markdown pages, JSDoc on every public symbol, usage notes in the package, tested examples, and evals that track how well assistants build with the docs.
- **Really good demos:** a hosted gallery led by a flagship chapters and cards player, own-hosted licensed audio, and starters for each framework.

## Candidate breaking changes

Collect them as they come up during 1.x. Do not break anything in 1.x.

| Change | Why | Migration |
| ------ | --- | --------- |
| Explicit engine option | Pluggable engines | Default stays the browser engine |
| `sources[]` replaces `src` | Format fallback | Codemod or helper |
| Drop CJS | Smaller package, simpler exports | Use ESM or a bundler |
| Status model redesign if the 1.4 buffering flag proves limiting | Clearer states | Documented mapping |

## Decision gate

Start 2.0 planning only when at least one of these is true:

- Two consumers need multi-instance or a non-browser engine.
- A 1.x feature cannot be built without a breaking change.
- A required platform (for example React Native) cannot be served by the current contract.

Before that, keep shipping 1.x. If the gate is met, write a design note per theme, ship `2.0.0-alpha.1` to a consumer, and keep 1.x on a maintenance branch with security and bug fixes.

## Explicitly not planned

- A UI component library. The library stays headless.
- Owning network, auth or DRM.

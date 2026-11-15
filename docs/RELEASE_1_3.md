# 1.3: Timed Multimedia Metadata

Status: first milestone published as `1.3.0-beta.1`. Additive only, no breaking changes. Stable npm installs remain on 1.2.0; install `@yetric/audioplayer@beta` to evaluate timed metadata before promotion.

Implemented API and demo instructions: [Timed metadata](./TIMED_METADATA.md).

## Goal

Let applications turn audio listening into a multimedia experience with synchronized images, links, text, slides, and other data. The library manages timing and active cues. Consumers produce and fetch metadata and decide how to render it.

The design and [Podcasting 2.0 alignment](./DESIGN_CUES.md#podcasting-20-alignment) are in [`DESIGN_CUES.md`](./DESIGN_CUES.md). Use JSON Chapters as the first interchange format rather than inventing a competing chapter format.

## First milestone

| Item | Acceptance criteria |
| ---- | ------------------- |
| Typed range cues with generic payloads | Stable IDs, finite supplied times in original-media seconds, optional end for terminal ranges, overlapping cues supported |
| Podcasting 2.0 JSON Chapters adapter | Pure conversion from parsed documents; preserve titles, images, links, and hidden markers; infer missing ends with documented policies |
| Opt-in cue controller | Observable active-cue snapshot, enter/exit notifications, predictable attachment and cleanup |
| Synchronization semantics | Seeking, scrubbing, rate changes, repeat, unload, and queue auto-advance produce the correct active set |
| React integration | An active-cues hook subscribes to the controller and re-renders only when active content changes |
| Multimedia demo | A JSON Chapters fixture drives accessible images, titles, links, and chapter navigation; hidden markers update content without appearing in navigation |
| Verification and documentation | Unit tests for cue transitions; browser tests for demo playback, seeking, and source changes; documented contracts and examples |

## Consumer data contract

- Metadata is supplied as plain data; no backend, feed format, or detection service is required.
- Cue payloads are generic. An application may define image/text/link types without adding presentation fields to the core player state.
- Consumers associate metadata with the exact source and audio revision. Dynamic ad insertion or file replacement can invalidate timings.
- The initial API accepts parsed data. Ship an opt-in adapter for Podcasting 2.0 JSON Chapters and document mapping parsed timed transcripts into generic cues. RSS discovery, fetching, and transcript file parsing remain with consumers.
- Follow the published chapter fields, including `toc: false` for metadata-only markers. It does not authorize skipping audio. Episode artwork and content links are fallback content, not timed markers.
- The library does not fetch metadata, load images, insert HTML, or navigate links.

## Next increments after the first milestone

- Dedicated chapter navigation helpers and optional current-chapter state, using the same timeline as the first milestone's adapter.
- Transcript file parsers for formats linked by `podcast:transcript`, based on concrete consumer needs.
- Point cues and finer visual timing if the demo establishes a need and their seek/replay semantics are specified.
- Generated API reference and compile-checked examples as the API settles.

## Separate follow-up: metadata-driven silence skipping

Presentation cues and silence skip ranges share the original media timeline but have different responsibilities. A skip range authorizes a playback jump; a presentation cue describes content to display.

A future opt-in controller can consume precomputed, consumer-supplied skip ranges and use the existing seek API. This does not inherently require Web Audio or a new engine. Client-side silence detection is a separate project.

After a skip, active presentation must match the destination. Cues wholly inside the skipped interval must not flash on screen or trigger presentation side effects.

## Deferred from this release's core scope

- Sleep timers, per-source position/rate memory, played thresholds, and share-position helpers.
- Shuffle, A-B loop, and unrelated listening features.
- A frame-rate clock, animation guarantees, and additional lifecycle events unless required by the milestone.
- Transcript parsing, annotation editing, silence detection, waveform analysis, and a new playback engine.
- Fetching, caching, authentication, network synchronization, or a UI component library.

Deferred features need their own use case and scheduling decision; they do not automatically move into 1.4.

## Success measures

- The demo presents images, links, and text from consumer-supplied metadata without application-owned timing loops.
- Seeking into an interval immediately activates its content; seeking out removes it.
- Overlapping cues render together. Source changes and unload clear stale content.
- Queue transitions and repeat rebuild the correct active set.
- Published-format chapter fixtures work without a custom interchange schema. Missing ends and hidden markers retain their documented meaning.
- Playback position, persistence, and chapters retain original-media timestamps.
- No existing playback API or behavior changes when cues are not attached.

## Release gate

Publish `1.3.0-beta.1` after the milestone passes unit, browser, package, type, size, and docs checks. Validate the multimedia demo and examples before promoting. External app adoption and silence skipping are not release gates.

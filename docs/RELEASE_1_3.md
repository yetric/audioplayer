# 1.3: Timeline Events and Listening Features

Status: proposed. Additive only, no breaking changes.

## Theme

Let apps react to where playback is (chapter changes, cues, a new sound, a certain time) so they can build visibly rich clients, and add the playback features listeners expect. Everything is opt-in, and the headless core does not force any of it on anyone.

The timeline events are the headline. The design is in [`DESIGN_CUES.md`](./DESIGN_CUES.md).

## Evidence and hypotheses

Repo evidence:

- `V1_ISSUES.md` Issue 015 lists sleep timer, skip silence, advanced speed presets and share-position helpers as candidates, deferred until `podcast-app` shows a need.
- The persistence plugin stores one session (the last item and position). It does not remember positions for other episodes.

Hypotheses to validate before building (none of these are confirmed demand):

- Listeners want to resume any episode where they left off, not only the last one.
- Chapters are worth showing when a feed provides them.
- A sleep timer is a common request for evening listening.

Validate each with `podcast-app` usage data or listener feedback before committing.

## Scope

| Item | Priority | Size | Notes |
| ---- | -------- | ---- | ----- |
| Cue events: `attachAudioPlayerCues` with `cueenter` and `cueexit`, point and range cues | P0 | L | See `DESIGN_CUES.md`. Seek, scrub, loop and ordering rules need tests. |
| Chapters: optional `chapters` on `AudioSource`, `currentChapter` in state, `chapterchange`, `seekToChapter` | P0 | M | Built on the cue mechanism. Media Session chapter info is a stretch. |
| Source lifecycle events: `sourceready`, `sourcestart`, `sourceend`, plus `waiting` and `playing` shared with 1.4 | P0 | S | Separates "new sound requested" from "new sound ready" |
| React hooks: `useActiveCues`, `useCurrentChapter`, `useAudioPlayerTime` | P1 | S | Re-render only on change |
| Frame-rate clock helper for animation, active only while playing | P1 | S | Cheap `getCurrentTime()` read per frame |
| Sleep timer: stop after N minutes or at end of episode, exposed in state with an event | P1 | M | Opt-in plugin, same attach pattern as persistence |
| Per-source position memory: a positions store keyed by source `id`, with expiry | P1 | M | Separate from the single-session persistence. Pluggable adapter. |
| Per-source or per-show playback rate memory | P1 | S | Builds on the positions store |
| Played threshold: mark a source as played at a configurable fraction | P1 | S | Reported through the progress hooks |
| Share-position helper: build and parse a `?t=` style timestamp | P2 | S | Pure helpers, no player coupling |
| Skip silence | P2 | L | Needs Web Audio. Parked until the 2.0 engine work, see `RELEASE_2_0.md`. |

Other users (see [`OPEN_SOURCE.md`](./OPEN_SOURCE.md)): shuffle and A-B loop are likely asks from music and language-learning users. Build them only if demand is collected through Discussions or issues. Discussions and a "use case" issue template ship in this release.

## Out of scope

- Transcripts and annotations (long shot, 2.0 area).
- Waveform UI.
- Any network or sync behavior. The library does not own network requests.

## Success measures

- `podcast-app` ships at least two of the P0 and P1 features using the library API, with no feature-specific playback code of its own.
- Public API additions stay under the size of one attach function each.

## Risks

- Feature creep against the rule "keep the public API small". Each feature must justify itself with a `podcast-app` need and ship as an opt-in attach function or an optional field.
- A positions store can grow without bound. It needs a cap and expiry from day one.

## Open questions

- Where should positions live: the library's own `localStorage` key, or only through an adapter the app provides?
- Should chapters come from the app (it parses the feed) or from the library (it reads embedded metadata)? Leaning to the app, since the library does not fetch.

## Scope note

This release is large. If it runs long, ship cues, chapters and lifecycle events as 1.3, and move the sleep timer, position memory and rate memory to a 1.4 release. Timeline events come first because they enable the visible-client use cases.

## Release gate

Publish `1.3.0-beta.1`. Build a visible demo in `podcast-app` (chapter art and linked notes appearing in step with the audio), drop any feature that the app does not use, then promote.

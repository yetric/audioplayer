# 1.3: Listening Features

Status: proposed. Additive only, no breaking changes.

## Theme

Add the playback features listeners expect from a podcast player, as opt-in pieces that the headless core does not force on anyone.

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
| Sleep timer: stop after N minutes or at end of episode, exposed in state with an event | P0 | M | Opt-in plugin, same attach pattern as persistence |
| Per-source position memory: a positions store keyed by source `id`, with expiry | P0 | M | Separate from the single-session persistence. Pluggable adapter. |
| Chapters: optional `chapters` on `AudioSource`, `currentChapter` in state, `seekToChapter` | P1 | M | Additive field. Media Session chapter info is a stretch. |
| Per-source or per-show playback rate memory | P1 | S | Builds on the positions store |
| Played threshold: mark a source as played at a configurable fraction | P1 | S | Reported through the progress hooks |
| Share-position helper: build and parse a `?t=` style timestamp | P2 | S | Pure helpers, no player coupling |
| Skip silence | P2 | L | Needs Web Audio. Parked until the 2.0 engine work, see `RELEASE_2_0.md`. |

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

## Release gate

Publish `1.3.0-beta.1`, run it in `podcast-app`, drop any feature that the app does not use, then promote.

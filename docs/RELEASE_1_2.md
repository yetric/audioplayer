# 1.2: Less Glue Code

Status: proposed. Additive only, no breaking changes.

## Theme

Make the library do the wiring that every consumer currently writes by hand, so `podcast-app` can delete most of its custom provider.

## Evidence

Taken from reading `podcast-app/src/context/audio.tsx` and `src/components/player/Player.tsx` on the 1.1.0 line:

- The app has its own `AudioProvider` instead of using `AudioPlayerProvider`. It attaches persistence and Media Session by hand in `useEffect`, and tears them down by hand.
- The player UI polls `sound.seek()` every second with `setInterval` instead of reading time from state.
- Rewind and forward by 10 seconds are written in the app (`jump(-10)`, `jump(10)`), with clamping done by the caller.
- Playback rate presets (`0.5` to `2`) and the cycle logic live in the app.
- Load, play and restore errors are caught and written to `console.error`. The app's `AudioState` does not expose the library's `state.error`, so the UI cannot show a failure.
- The app does not use the queue or the progress reporter. It tracks play and pause with its own store.

## Scope

| Item | Priority | Size | Notes |
| ---- | -------- | ---- | ----- |
| `skip(seconds)` on the player, clamped at 0 and, when the duration is known, at the duration | P0 | S | Media Session already does this internally. Keep its unknown-duration fallback: before metadata loads, a forward skip advances from the current time instead of seeking to 0. Expose it. |
| React provider accepts plugin options (`persistence`, `mediaSession`, `progressReporter`) and tears them down itself | P0 | M | Goal: `podcast-app` uses `AudioPlayerProvider` directly |
| `useAudioPlayerState(selector)` with a selector and equality check | P0 | S | Stops components re-rendering on every `timeupdate` |
| Throttled progress hook, for example `useAudioPlayerProgress({ intervalMs })` | P1 | S | Replaces the `setInterval` polling in the player UI |
| Exported default rate presets and a `cycleRate(presets?)` helper | P1 | S | Only if `podcast-app` still hand-rolls it after the other items |
| Browser-level tests with a real runner, covering load, seek, ended, auto-advance | P1 | L | Closes Issue 011. Run in CI. |
| Recipes and the React guide updated to show the provider with plugins | P1 | S | Docs are part of done |
| Publish the docs site, remove template leftovers, merge `docs/` and `website/docs/` into one source | P0 | M | The site is not published today. See `DOCS_PLAN.md`. |
| JSDoc on every public symbol | P0 | M | Helps editors and assistants |
| README rewrite for newcomers, with a scope statement | P0 | S | See `OPEN_SOURCE.md` |
| Support matrix, `engines` review and a stability policy | P0 | S | Matrix is backed by the browser tests |
| Server rendering recipe with a Node import test, bundle size budget in CI, `CODE_OF_CONDUCT.md` | P1 | S | See `OPEN_SOURCE.md` |

## Out of scope

- New playback features (that is 1.3).
- Changing the flat `AudioSource` shape.
- Any change to the engine boundary.

## Success measures

- A newcomer can tell from the README what the library is for, and which browsers and frameworks it supports.
- `podcast-app` deletes its custom `AudioProvider` and uses the library provider. Target: at least half of `src/context/audio.tsx` removed.
- The player UI no longer polls on an interval.
- One browser-level test run in CI passes on Chromium.

## Risks

- Plugin options on the provider add API surface. Keep them as thin as the attach functions, with no new behavior.
- A browser test runner adds CI time and a flaky-test risk. Start with a handful of stable tests.

## Open questions

- Does `podcast-app` need the progress reporter and queue, or should its own store keep owning play and pause reporting?
- Should `skip` live on the player, or only as a React helper?

## Release gate

Publish a prerelease (`1.2.0-beta.1`), run it in `podcast-app`, then promote to `1.2.0`.

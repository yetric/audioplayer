# 1.2: Less Glue Code

Status: proposed. Additive only, no breaking changes.

## Theme

Reduce the integration code needed to build an audio app with the core API and React adapter.

## Integration needs

- React consumers attach persistence, Media Session, and progress reporting manually and manage their cleanup.
- Player controls need relative seeking with consistent clamping.
- Components should subscribe to the state they display without polling or re-rendering on unrelated updates.
- Examples should show loading, playback, errors, queues, and optional integrations using only the public API.
- Playback rate presets are a candidate convenience feature; validate their usefulness in the demo before adding API surface.

## Scope

| Item | Priority | Size | Notes |
| ---- | -------- | ---- | ----- |
| `skip(seconds)` on the player, clamped at 0 and, when the duration is known, at the duration | P0 | S | Media Session already does this internally. Keep its unknown-duration fallback: before metadata loads, a forward skip advances from the current time instead of seeking to 0. Expose it. |
| React provider accepts plugin options (`persistence`, `mediaSession`, `progressReporter`) and tears them down itself | P0 | M | Goal: the React example uses `AudioPlayerProvider` directly |
| `useAudioPlayerState(selector)` with a selector and equality check | P0 | S | Stops components re-rendering on every `timeupdate` |
| Throttled progress hook, for example `useAudioPlayerProgress({ intervalMs })` | P1 | S | Replaces the `setInterval` polling in the player UI |
| Exported default rate presets and a `cycleRate(presets?)` helper | P1 | S | Only if the demo demonstrates a need after the other items |
| Browser-level tests with a real runner, covering load, seek, ended, auto-advance | P1 | L | Closes Issue 011. Run in CI. |
| Recipes and the React guide updated to show the provider with plugins | P1 | S | Docs are part of done |
| Keep the docs site published, remove template leftovers, merge `docs/` and `website/docs/` into one source | P0 | M | The site is published. Consolidation remains. See `DOCS_PLAN.md`. |
| JSDoc where the type cannot say enough: units, defaults, side effects, error behavior, edge cases | P0 | M | Skip comments that restate the type. |
| README rewrite for newcomers, with a scope statement | P0 | S | See `OPEN_SOURCE.md` |
| Support matrix, `engines` review and a stability policy | P0 | S | Matrix is backed by the browser tests |
| Server rendering recipe with a Node import test, bundle size budget in CI, `CODE_OF_CONDUCT.md` | P1 | S | See `OPEN_SOURCE.md` |

## Out of scope

- New playback features (that is 1.3).
- Changing the flat `AudioSource` shape.
- Any change to the engine boundary.

## Success measures

- A newcomer can tell from the README what the library is for, and which browsers and frameworks it supports.
- The React example uses the library provider and demonstrates plugin setup and cleanup without a custom provider.
- The player UI no longer polls on an interval.
- One browser-level test run in CI passes on Chromium.

## Risks

- Plugin options on the provider add API surface. Keep them as thin as the attach functions, with no new behavior.
- A browser test runner adds CI time and a flaky-test risk. Start with a handful of stable tests.

## Open questions

- Which optional integrations belong in the minimal React example, and which need separate recipes?
- Should `skip` live on the player, or only as a React helper?

## Release gate

Publish a prerelease (`1.2.0-beta.1`), pass the automated checks and browser tests, and verify the browser demo and React example before promoting to `1.2.0`. External app adoption is not a release gate.

# Open Source Track

The library is public on npm and MIT licensed. `podcast-app` is the first consumer, not the only one. This doc covers what an outside user needs and which release carries each item. Release docs: [`RELEASE_1_2.md`](./RELEASE_1_2.md), [`RELEASE_1_3.md`](./RELEASE_1_3.md), [`RELEASE_1_4.md`](./RELEASE_1_4.md), [`RELEASE_2_0.md`](./RELEASE_2_0.md).

## Where we are

Checked against the repo and GitHub on the 1.1.0 line:

Exists:

- MIT license, `SECURITY.md`, issue and pull request templates, `CONTRIBUTING.md`, `CHANGELOG.md`, Dependabot
- ESM, CJS and type declarations, `sideEffects: false`, about 7 KB gzipped for the main chunk
- Docs site, `examples/` (vanilla and React), Angular and Web Component docs
- Releases published from CI with provenance (since 1.1.0)
- Importing and creating a player in Node works and does not throw. `load` on a server returns the typed `UNSUPPORTED_ENVIRONMENT` error. This is not documented yet.

Gaps:

- The README speaks to one consumer: "validate it in `podcast-app`", and a milestone line that says the library is not a generic media player. A newcomer cannot tell what it is for.
- No supported browser or runtime matrix. `engines` says `node >=22`, which is a build requirement but reads as a consumer requirement for a browser library.
- No stability or deprecation policy, so nobody can tell how safe `^1.x` is.
- No code of conduct. GitHub Discussions are off, so there is no place for questions or use-case reports.
- No bundle size check in CI, so size can drift unnoticed.
- No guidance for Vue, Svelte, Solid, or server-rendered React (Next.js).
- One maintainer, and the npm package is owned by a personal account (no npm organization).
- No external users yet (no stars, one open item). Everything below is readiness work, not a response to requests.

## Audience and scope

Hypothesis to validate: other users are building music, audiobook, radio, language-learning or meditation apps, not only podcast apps. They would ask for features the code does not have today: shuffle, gapless or crossfade playback, A-B loop.

Differentiator to aim for: clients that look and feel rich. Timeline events (chapter changes, cues, source lifecycle) let an app show media and data in step with the audio. See [`DESIGN_CUES.md`](./DESIGN_CUES.md).

Proposed scope statement for the README:

- The library is a headless, browser-first audio player with a queue, persistence and Media Session.
- Podcast and long-form listening is the first-class use case and the tie-breaker for priorities.
- Other uses are welcome. A feature for them is accepted when it fits the small public API and has a named user.

## Work items

| Item | Release | Priority | Size |
| ---- | ------- | -------- | ---- |
| Rewrite README status and intro for newcomers, with the scope statement and a short "who is this for" | 1.2 | P0 | S |
| Support matrix doc: browsers (verified by the browser tests on Chromium, Firefox and WebKit), React versions, module formats | 1.2 | P0 | S |
| Review `engines`, and say plainly that consumers need no particular Node version | 1.2 | P0 | S |
| Stability policy: semver, deprecations last at least one minor release and are noted in the changelog, breaking changes only in a major | 1.2 | P1 | S |
| Server rendering recipe (Next.js and similar), backed by a test that imports and creates a player in Node | 1.2 | P1 | S |
| Bundle size budget checked in CI | 1.2 | P1 | S |
| `CODE_OF_CONDUCT.md` and a stated response expectation in `CONTRIBUTING.md` | 1.2 | P1 | S |
| Enable Discussions and add a "use case" issue template, to collect needs from outside users | 1.3 | P1 | S |
| Vue and Svelte recipes. The player's `subscribe` already emits the current state on subscribe and returns an unsubscribe function, so it may work directly as a Svelte store. Verify before documenting. | 1.3 | P2 | S |
| Evaluate shuffle and A-B loop, only if collected demand supports it | 1.3 | P2 | M |
| Tested Web Component export and Angular example | 1.4 | P2 | M |
| Governance: second maintainer or an npm organization, documented release and triage process | 2.0 planning | P2 | S |

## Working with outside contributors

- Every feature request needs a user and a use case, not only a solution.
- Labels: `good first issue`, `help wanted`, `needs use case`.
- Docs and tests ship with every change. This is already in `CONTRIBUTING.md`.
- Triage cadence and response time are written down, even if modest.

## Risks

- Building for imagined users. Keep this track small, and let collected demand decide anything beyond docs and policy.
- A single maintainer and a personal npm account are a continuity risk for adopters.
- Promises in the support matrix must match what the tests cover.

## Open questions

- Is the target audience podcast apps only, or long-form and general audio?
- Should the project move under an npm organization before wider promotion?
- Do you want to announce the library (blog post, socials) before 1.2, or after the README and docs are ready?

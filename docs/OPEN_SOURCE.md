# Open Source Track

The library is public on npm and MIT licensed. Its scope, validation, and releases are maintained independently of any consuming app. This doc covers what an outside user needs and which release carries each item. Release docs: [`RELEASE_1_2.md`](./RELEASE_1_2.md), [`RELEASE_1_3.md`](./RELEASE_1_3.md), [`RELEASE_1_4.md`](./RELEASE_1_4.md), [`RELEASE_2_0.md`](./RELEASE_2_0.md).

## Where we are

Current foundation in the 1.2 release branch:

Exists:

- MIT license, `SECURITY.md`, issue and pull request templates, `CONTRIBUTING.md`, `CHANGELOG.md`, Dependabot
- ESM, CJS and type declarations, `sideEffects: false`, about 7 KB gzipped for the main chunk
- Docs site, `examples/` (vanilla and React), Angular and Web Component docs
- Releases published from CI with provenance (since 1.1.0)
- README positioning and release gates are independent of any consuming app.
- Importing and creating a player in Node works and does not throw. `load` on a server returns the typed `UNSUPPORTED_ENVIRONMENT` error. This is not documented yet.

Remaining adoption work and policies:

- Keep the [support matrix](./SUPPORT.md) aligned with browser and React compatibility checks. Node and browser requirements are documented separately.
- The [stability policy](./STABILITY.md) documents semver and deprecation expectations.
- A code of conduct is in place. GitHub Discussions remain a proposed channel for questions and use-case reports.
- CI checks bundle size, server imports/rendering, and browser behavior.
- Server-rendered React is documented and tested with ReactDOMServer. Vue, Svelte, and Solid recipes remain future work.
- One maintainer, and the npm package is owned by a personal account (no npm organization).
- No external users yet (no stars, one open item). Everything below is readiness work, not a response to requests.

## Audience and scope

Candidate use cases include podcasts, music, audiobooks, radio, language learning, and meditation. Possible requests include features the code does not have today: shuffle, gapless or crossfade playback, A-B loop. Validate demand before adding them.

Documentation, LLM support and demos are the adoption lever for outside users. See [`DOCS_PLAN.md`](./DOCS_PLAN.md).

Differentiator to aim for: clients that look and feel rich. Timeline events (chapter changes, cues, source lifecycle) let an app show media and data in step with the audio. See [`DESIGN_CUES.md`](./DESIGN_CUES.md).

Proposed scope statement for the README:

- The library is a headless, browser-first audio player with a queue, persistence and Media Session.
- Prioritize reliable playback and common listening flows across audio applications.
- Accept features when they fit the small public API, have a documented use case, and can be validated with tests and examples.

## Work items

| Item | Release | Priority | Size |
| ---- | ------- | -------- | ---- |
| Keep README status and intro focused on standalone usage; add a short "who is this for" | 1.2 | P0 | S |
| Support matrix doc: browsers (verified by the browser tests on Chromium, Firefox and WebKit), React versions, module formats | 1.2 | P0 | S |
| Review `engines`, and say plainly that consumers need no particular Node version | 1.2 | P0 | S |
| Stability policy: semver, deprecations last at least one minor release and are noted in the changelog, breaking changes only in a major | 1.2 | P1 | S |
| Server rendering recipe (Next.js and similar), backed by a test that imports and creates a player in Node | 1.2 | P1 | S |
| Bundle size budget checked in CI | 1.2 | P1 | S |
| `CODE_OF_CONDUCT.md` and a stated response expectation in `CONTRIBUTING.md` | 1.2 | P1 | S |
| Enable Discussions and add a "use case" issue template, to collect needs from outside users | 1.3 | P1 | S |
| Vue and Svelte recipes. The player's `subscribe` already emits the current state on subscribe and returns an unsubscribe function, so it may work directly as a Svelte store. Verify before documenting. | 1.3 | P2 | S |
| Evaluate shuffle and A-B loop, only if collected demand supports it | 1.3 | P2 | M |
| Tested Web Component export and Angular example | Deferred / unscheduled; not 1.4 scope | P2 | M |
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

- Which additional audio use cases can be supported without expanding the core API?
- Should the project move under an npm organization before wider promotion?
- Do you want to announce the library (blog post, socials) before 1.2, or after the README and docs are ready?

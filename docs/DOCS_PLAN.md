# Documentation, LLM Support and Demos

Status: proposal. This is the quality bar for 2.0, plus the steps in 1.x that get us there. It cannot be built in one release.

## Quality bar for 2.0

A developer, or their coding assistant, can find the library, get sound playing in minutes, and build something impressive without reading the source.

## Where we are

Checked against the repo and GitHub on the 1.1.0 line:

- The Docusaurus site is configured for `https://yetric.github.io/audioplayer/`, but GitHub Pages is not enabled and there is no deploy workflow. The docs are not published from this repo. (If they are hosted elsewhere, this note is wrong on that point.)
- The site still has template leftovers: an empty tutorial folder and a 2021 "welcome" blog post.
- The docs exist twice, in `docs/` and `website/docs/`. The copies differ in length and content, so they will drift.
- No JSDoc comments on the public API (`src/index.ts` has none), so editors and assistants see types but no explanations.
- No generated API reference, no site search, no versioned docs.
- Demos: a small Vite demo (`demo/`) and examples (`examples/react`, `examples/vanilla`). The demo audio is hot-linked from a third-party host.
- No `llms.txt`, and nothing in the npm package that explains usage to an assistant.

## Documentation

Structure the site by need (tutorials, how-to guides, reference, explanation):

- **Quickstart per framework** (vanilla, React, Angular, Vue, Svelte, Web Component). Goal: sound playing in about five minutes.
- **Concepts:** state model, status transitions, events, queue, persistence, cues and chapters, engines.
- **How-to recipes:** each one a task a developer actually has (playlist, resume, chapter cards, Media Session, offline).
- **API reference generated from the types** (for example with TypeDoc), so it cannot drift. Every public symbol has JSDoc.
- **Troubleshooting and FAQ:** browser autoplay rules, iOS Safari behavior, CORS, Media Session limits. Fill it from real bug reports.
- **Support matrix, stability policy, changelog**, and a **1.x to 2.0 migration guide** with a codemod where the change is mechanical.
- **Versioned docs** so 1.x users can still read 1.x pages, with site search.
- **Live, editable examples** on pages (for example Sandpack or StackBlitz).

Process:

- One source of truth for docs. `docs/` and `website/docs/` collapse into one.
- Docs CI: build on every pull request with a preview, link checking, and every code snippet compiled against the current types.
- A docs change is part of the definition of done for any public API change (already in `CONTRIBUTING.md`).

## LLM support

Assistants write a lot of integration code. Make the right answer easy to produce and easy to check.

- **`llms.txt` and `llms-full.txt`** at the site root, an index and a full dump of the docs in Markdown. `llms.txt` is a community convention, so confirm current tooling support before relying on it.
- **Markdown for every docs page** (a raw `.md` URL, and a "copy as Markdown" button).
- **JSDoc on every public symbol**, so the `.d.ts` files inside `node_modules` explain themselves. Assistants often read those.
- **Usage notes shipped in the npm package** (a short `llms.txt` or `AGENTS.md`-style file) so an assistant working in a consumer repo can read it from `node_modules`. This adds package size, so keep it small and measure.
- **Tested examples.** Every snippet in the docs compiles and runs in CI. Wrong examples teach assistants wrong code.
- **Small, consistent API.** Fewer ways to do one thing means fewer wrong guesses. This is already a project principle.
- **Evals.** A fixed set of tasks (for example "add a playlist with chapter cards in React", "resume playback after reload") given to a model with only the docs, scored on whether the result compiles and works. Track the pass rate per release.
- **Stretch, unvalidated:** a docs MCP server for search. Only if the evals show assistants struggle to find answers in `llms.txt`.

## Demos

Hosted on the docs site as a gallery. Each demo shows one capability, has viewable source, a runnable link, and a short "what to copy" note.

Candidates:

1. **Podcast player with chapters and show-note cards** (the flagship, uses the 1.3 cues; see [`DESIGN_CUES.md`](./DESIGN_CUES.md)).
2. **Music player** with queue and repeat (shuffle and gapless only if built).
3. **Audiobook player** with sleep timer, per-book resume and bookmarks.
4. **Language learning:** transcript sync and A-B loop (depends on demand).
5. **Visualizer** with waveform or spectrum (depends on the engine work in 2.0).
6. **Offline PWA** using the source resolver from 1.4.
7. **Starters** for React, Vue, Svelte, Angular and vanilla, each a minimal copyable project.
8. **React Native demo**, only if the RN engine ships.

Quality rules:

- Responsive, keyboard accessible, dark mode, fast.
- Audio and artwork are own-hosted and licensed for reuse (CC0 or CC-BY with attribution), not hot-linked, so demos do not rot. Licensing needs checking for each asset.
- A short screen recording or GIF per flagship demo for the README and social posts.
- Demos are built from the public package, never from internal code, so they double as integration tests.

## Path from here

| Release | Work |
| ------- | ---- |
| 1.2 | Publish the docs site (enable Pages and add a deploy workflow, or choose another host). Remove template leftovers. Merge `docs/` and `website/docs/` into one source. Add JSDoc to every public symbol. |
| 1.3 | Generate the API reference. Add site search. Ship the flagship chapters demo and host the demo gallery. Compile-check docs snippets in CI. |
| 1.4 | Add `llms.txt` and `llms-full.txt`, Markdown page export, the troubleshooting section, and the first LLM evals. Add two more demos. |
| 2.0 | Versioned docs, the migration guide and codemod, the full demo set, evals gating the release, and a reviewed quickstart for every supported framework. |

## Success measures

- A developer who has never seen the library gets sound playing from the quickstart in about five minutes. Test with at least two outside people.
- Every public export has JSDoc and an API reference entry. No broken links. All docs snippets pass in CI.
- The LLM eval pass rate is recorded each release and does not fall.
- The demo gallery loads without third-party audio hosts.

## Risks

- One maintainer and a large surface to keep current. Prefer generated and tested content over hand-written, and cut demos before cutting quality.
- Docs rot. Mitigate with a single source, CI checks and the definition of done.
- Demo audio licensing, and the effort of making good-looking demos. Budget design time and treat the flagship demo as a real product.

## Open questions

- Where is the docs site hosted, and is a custom domain wanted?
- Who reviews the quickstarts as an outside reader?
- How much of the package should ship usage notes for assistants, given the size cost?

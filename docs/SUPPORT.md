---
id: support
slug: /support
---

# Supported Environments

The core uses `HTMLAudioElement`. React is optional for core usage; the React adapter is exported from `@yetric/audioplayer/react`.

| Environment | Validation in 1.2 |
| --- | --- |
| Chromium | Playwright: real WAV load, play, pause, seek, skip, ended, queue auto-advance, React persistence |
| Firefox | Same Playwright suite |
| WebKit | Same Playwright suite; useful coverage for Safari's engine, not a claim of iOS device testing |
| React 19 | Unit tests, StrictMode browser example, and server rendering |
| React 18 | Declared peer compatibility; separate compatibility checks run in CI |
| ESM and CommonJS | Built-package import checks in Node |
| Angular and Web Components | Core integration recipes; no dedicated framework test suite yet |
| React Native | No shipped playback engine |

CI installs the browser revisions pinned by the locked Playwright version. Older browser versions and physical mobile devices are not covered by this matrix. Test your supported devices before relying on browser-specific features.

Audio codec support and autoplay rules come from the browser. Start playback from a user action and show `state.error` if it fails. Media Session is optional and falls back to a no-op where unsupported. Persistence needs browser storage; applications in restricted storage environments can supply their own adapter.

## Node and build tools

Playback runs in the browser and does not require Node on an end user's device. The package metadata retains `node >=22` for compatibility with the existing package policy. Building this repository requires Node 22.18+, Node 24.11+, or a newer supported Node release because of its development tools. CI validates Node 22 and publishes with Node 24.

Importing the package and creating a player on a server are supported. Playback there reports `UNSUPPORTED_ENVIRONMENT`. See [Server rendering](./SERVER_RENDERING.md).

## Bundle budget

`npm run check:size` bundles and minifies each public entry point and measures gzip bytes, excluding React and its JSX runtime. The core budget is 6.25 KiB and the React entry point budget is 8 KiB, including the core. The core allowance increased by 256 bytes in 1.3.1 for Media Session update tracking; the measured increase is 108 gzip bytes. These are CI regression limits, not the size of every consumer's application bundle.

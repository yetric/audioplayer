# 1.4: Resilience and Reach

Status: proposed. Additive only, no breaking changes.

## Theme

Make playback behave well on bad networks and offline, and make the library easier to adopt outside React.

## Evidence and hypotheses

Repo evidence:

- The state model has `loading`, `ready`, `playing`, `paused`, `ended` and `error`. It has no distinct state for stalled or rebuffering playback, so a UI cannot tell a slow network from a paused player.
- `podcast-app` is a PWA (`vite-plugin-pwa` and Workbox are in its build), so offline and cache behavior is relevant to it.
- Error codes are typed, but a failed load needs a manual retry by the caller.
- Angular and Web Component usage exists only as documentation (`ANGULAR_EXAMPLE.md`, `WEB_COMPONENT_EXAMPLE.md`).

Hypotheses to validate:

- Mobile listeners hit stalls often enough that a buffering indicator matters.
- Preloading the next queue item reduces gaps between episodes.

## Scope

| Item | Priority | Size | Notes |
| ---- | -------- | ---- | ----- |
| Buffering and stalled state: `waiting` and `stalled` engine events surfaced as a state flag or status | P0 | M | Must not break existing `status` consumers. Prefer an additive flag over a new status value. |
| Retry policy for failed loads: configurable attempts and backoff, off by default | P0 | M | Emits events per attempt. Clears stale error on success. |
| Source resolver hook: the app can map a source to another URL (cached blob, local file) before load | P1 | M | The hook for offline playback. The library does not own caching. |
| Preload the next queue item | P1 | M | Opt-in. Needs a second engine or a hidden element. Measure before shipping. |
| Official Web Component entry point (a custom element on a subpath export) | P2 | M | Turns the docs example into a tested export |
| Angular service example moves from docs into a tested example project | P2 | S | A package only if there is demand |
| Structured diagnostics: an opt-in event stream for errors and stalls | P2 | S | Helps field debugging without owning analytics |

## Out of scope

- Owning caching, downloads or background sync. The app and its service worker do that.
- HLS, DASH or adaptive streaming (2.0 area).
- Casting.

## Success measures

- A UI built only from library state can show loading, buffering, playing, paused, ended and error distinctly.
- A load that fails transiently recovers without app code when a retry policy is set.
- `podcast-app` plays an already-cached episode offline through the source resolver.

## Risks

- Preloading doubles audio resources and can hurt data-limited users. Default off.
- Stall detection differs across browsers. Test on Chromium, Firefox and Safari before promising behavior.

## Open questions

- Is a `buffering` flag enough, or do consumers need a new `status` value? A new value risks breaking exhaustive switches in consumer code.
- Does a Web Component export belong in this package or a separate one?

## Release gate

Publish `1.4.0-beta.1`, test on a throttled network and offline in `podcast-app`, then promote.

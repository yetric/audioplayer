# Design Note: Playback Backend Support

Status: proposed companion work for [1.4 playback destinations](./RELEASE_1_4.md). No service or endpoints are implemented. Contract names and routes below are provisional.

## Goal and ownership

Deliver the server-side pieces needed to make supported playback destinations work end to end. Backend requirements become implementation tasks with examples and tests, rather than a reason to leave a feature incomplete.

Keep `@yetric/audioplayer` usable as a standalone browser library. Add a small, optional TypeScript/Node reference service in a separate workspace when the first server-dependent flow is implemented. Consumers can run it independently or implement the same contract in an existing backend. Application identity, media ownership, and hosting remain explicit integration points; no Hittapodd database or account model is required.

The browser core accepts application-supplied async callbacks for resolving destination media and obtaining provider credentials. It does not embed server URLs, user sessions, secrets, or a mandatory service dependency. Node/server dependencies must not enter the browser bundle.

## When a backend is needed

| Flow | Server work to include |
| ---- | ---------------------- |
| Bluetooth/system output and native AirPlay controls | No new service requirement for selecting the output. Source hosting and authorization still follow that source's needs. |
| Cast with a public, receiver-accessible URL | No application backend required solely for casting. Validate the URL and media type on the receiver. |
| Cast with protected or browser-only media access | Resolve an authorized source into a receiver-accessible URL. Prefer an existing signed origin/CDN URL; implement scoped streaming only when the origin cannot supply a suitable URL. |
| Custom Cast authentication or renewal | Include the smallest receiver implementation and its hosting/setup instructions if the Default Media Web Receiver cannot complete the selected flow. Receiver HTML/JS hosting is separate from a dynamic backend. |
| Revision-bound chapter metadata | Serve or resolve chapter/artwork URLs and the matching audio revision where source resolution needs them. Reuse Podcasting 2.0 JSON Chapters rather than inventing a new chapter format. |
| Spotify Connect | Evaluate browser PKCE first. Include a server-side OAuth/session/token integration if the chosen flow needs confidential credentials or server-managed sessions. A backend does not turn arbitrary podcast URLs into Spotify content. |
| Precomputed silence ranges | Define how a consumer can return ranges for the exact audio revision. Generating those ranges is a separate analysis task, not a prerequisite for remote output. |

Google's [receiver overview](https://developers.google.com/cast/docs/web_receiver) describes the Default Media Web Receiver loading a media URL. [Custom receivers](https://developers.google.com/cast/docs/web_receiver/basic) provide a route for application-specific behavior. Spotify recommends [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow) for clients that cannot store secrets, and documents [server-side authorization alternatives](https://developer.spotify.com/documentation/web-api/concepts/authorization).

## First contract: resolve destination media

The first server-dependent milestone is protected-media Cast playback. Do not build a general media platform before this flow works.

A proposed resolver accepts source identity, the expected audio revision, destination kind, and a cancellation signal. When a service is needed, the application translates that into an authenticated request using its existing session. It returns:

- Stable `sourceId` and `audioRevision` identifying the original media timeline.
- A receiver-accessible media URL and content type.
- An expiry time when access is temporary, plus an opaque grant ID if refresh/revocation is supported.
- Optional chapter/artwork URLs referring to the same revision.

Keep this ephemeral descriptor separate from persisted `AudioSource` data. Refreshing an access URL must not change source identity, reset playback, or remap cues. Reject revision mismatches before handoff. Ignore canceled or stale resolution results after source changes or controller destruction.

Proposed HTTP surface for the reference service:

| Route | Purpose |
| ----- | ------- |
| `POST /playback-grants` | Authorize a configured source/revision for a destination and return its playback descriptor. Accept source identity, not an arbitrary client-provided fetch URL. |
| `POST /playback-grants/:id/refresh` | Reauthorize and renew a grant when the selected integration supports renewal. |
| `DELETE /playback-grants/:id` | Revoke future access under that grant. Define its relationship to receiver session termination explicitly. |
| `GET /media/:grantId` and `HEAD /media/:grantId` | Optional scoped media delivery when a signed origin URL is insufficient. Support byte-range requests needed by the tested receiver. |

These routes are a design starting point, not a promised API. Publish a versioned schema and request/response fixtures before implementation; test the client adapter and reference service against the same fixtures.

## Media delivery and session behavior

- Start with configured media fixtures and an application authorization hook. Production consumers supply source lookup and access policy; do not require a library-owned user database.
- Grants must authorize the specific source/revision and expire or be revocable. A protected source must not become a permanent public URL merely to make casting work.
- A streaming implementation must support the receiver's `GET`, `HEAD`, range/partial responses, content type, and applicable CORS requirements. Preserve the audio bytes and timeline. Never create an unrestricted fetch proxy or forward browser cookies/provider tokens to arbitrary media origins.
- Define how the receiver gets renewed access during long playback, pauses, and later seeks. Test whether the Default Receiver can complete that flow. If it cannot, include a minimal custom receiver or report the flow unsupported; do not assume issuing another URL updates an active receiver automatically.
- Revoking a grant controls future requests; stopping an already buffered stream also requires a receiver command. Choose grant lifetime and cleanup rules together with the sender/receiver disconnect policy.
- Backend timeouts, expired grants, and failed renewal must preserve a recoverable local session. Do not silently fall back from protected media to public media or a different episode.
- Use HTTPS for device-reachable deployment and document where the reference service, media origin, and receiver assets run. A receiver cannot load the sender's `localhost` or browser blob URLs. Uploading local files or transcoding media requires a separately scoped feature.

## Spotify integration boundary

The Spotify feasibility work must choose a concrete supported content example and account/authentication flow before implementing a service. A browser-only PKCE flow may be sufficient; it is not inherently a backend requirement. If a server flow is chosen, implement callback handling, session binding, token refresh, and disconnect/revocation with secrets held server-side. The browser receives only the scoped access required by its integration.

Specify who owns playback commands and token renewal before adding a provider adapter. Backend support cannot override provider content or API limitations. Device support is claimed only after the complete provider flow passes its own tests and applicable usage requirements.

## Implementation and acceptance

1. In M0, inventory each destination's browser, SDK, receiver, and backend requirements. Select a public-media baseline and a protected-media case; decide the minimal contract and deployment layout.
2. Ship M1 native controls without requiring a service. Include callback cancellation and unsupported-path contracts where resolution is exposed.
3. For M2 Cast, implement the resolver, optional reference backend, and any receiver changes needed by the selected protected-media flow together. Provide a local fixture setup plus a reproducible HTTPS/device-accessible deployment recipe.
4. Require contract/integration tests for allowed and denied sources, revision mismatches, expiration, refresh/revocation, range seeking, unavailable backend, and late responses after source changes. Keep unauthenticated requests from obtaining protected grants.
5. Test the full protected-media handoff on a real receiver, including a seek after initial buffering and the chosen renewal behavior. Clearly distinguish fake-server coverage from hardware evidence.
6. If Spotify implementation passes its feasibility gate, include its required backend work in that adapter's delivery and release gate. Do not label a browser-only mock as a completed integration.

The first service remains small and independently runnable. A particular consuming app adopting it is not a release gate. No production deployment, new hosted service, account system, proxying of arbitrary feeds, or analysis pipeline is implied by this planning document.

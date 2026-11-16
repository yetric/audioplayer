# Cast handoff architecture review

Decision on 2026-11-16: defer a shipped Cast adapter until an internal single-timeline handoff prototype passes. Native destination selection remains the first 1.4 milestone. A [controlled handoff experiment and development SDK sender](./CAST_PROTOTYPE.md) now exist outside the published package. The controlled transport and mocked SDK tests pass, but no real SDK session/device result has been recorded. The user has identified Android and a Chromecast/Google TV for manual validation.

## Native contract boundary

The existing engine owns one media element. `seek`, rate and volume changes are synchronous; media readiness and playback events come from that element. Queue progression, persistence, Media Session and cues consume the same state. Native output selection can preserve this ownership because it routes that element.

Cast independently loads media and supplies receiver state. Google's [Web Sender integration](https://developers.google.com/cast/docs/web_sender/integrate) uses asynchronous load requests and remote event updates; [RemotePlayer](https://developers.google.com/cast/docs/reference/web_sender/cast.framework.RemotePlayer) exposes pause/seek/volume capabilities and receiver position. Forwarding commands while leaving local events authoritative would produce a stale timeline and potentially duplicate queue transitions. Copying receiver time into `player.seek()` is not a transport implementation: local events and local end-of-media behavior would still be active.

A private engine extension is therefore required before a Cast adapter. Preserve the public `AudioPlayer`, `PlayerStatus`, cue and persistence contracts; do not expose a generic mutable engine or a second application-owned player state. Review asynchronous load/seek/rate errors and media identity before changing the internal transport. Unsupported commands must be rejected or explicitly unavailable, never fabricated as successful local settings.

## Required prototype order

1. Start with one public, receiver-reachable WAV/MP3 fixture served over HTTPS. Use the Default Media Web Receiver and an explicitly requested new session. Do not adopt an unrelated existing session or allow auto-join to switch media authority.
2. Capture stable source/revision, observed position, settings and current intent. [LoadRequest](https://developers.google.com/cast/docs/reference/web_sender/chrome.cast.media.LoadRequest) supports initial time and autoplay. Load paused; leave local playback active until successful loading and source identity are confirmed. Reconcile movement/pause/seek during connection before committing. Account for the actual device's load latency.
3. Commit authority once: stop local sound before starting receiver sound, detach/suppress old element events, route commands and observed positions through the private transport. Do not interpolate cues from an independent sender timer.
4. Prove paused/playing handoff, receiver play/pause/seek, unsupported rate/volume, stale acknowledgments after source replacement/unload/destruction, and once-only sender queue progression with a fake transport. Then repeat on hardware. A fake alone cannot establish receiver support.
5. On failed connection retain the current local session. Once remote authority has committed, disconnect must not automatically play local audio. Preserve the last observed position/intent and expose an explicit local-return action. Stop the owned receiver session before playing locally; failed stop leaves recovery explicit to avoid two audible streams. Define what happens if the SDK loses acknowledgment.
6. Only after this passes, add the protected-media resolver, reference service and any minimal receiver needed for renewal. Test receiver range seeks after initial buffering and expiration; a renewed URL from a backend does not itself update an already loaded receiver.

The controlled suite exercises the real player, cues, chapters, queue, media observations and persistence through a provisional media facade: 20 handoff cases and 4 SDK bridge cases pass. It proves software behavior for delayed loads/seeks/settings, identity checks, one queue owner, unsupported operations and explicit recovery. A separate browser case exercises real local media through the facade. The development page enables Google's SDK explicitly and targets the Default Media Receiver. These results do not complete real-receiver or production-integration acceptance. The inability to finish hardware checks is not evidence that Cast is impossible; it keeps the gate open. No unconditional SDK load or provider/session attachment is introduced by native controls. The experimental page uses a temporary synchronous Audio-constructor substitution to exercise the closed engine and restores it immediately; shipping integration still requires a private transport seam. The SDK bridge binds ownership to the acknowledged mediaSessionId and URL. It samples the SDK's recommended getEstimatedTime() on status updates without an independent advancing timer; sparse updates and SDK estimation must be measured on hardware.

## Packaging decision

Keep native controls in the current root API, lazily instantiated by `player.destinations()`. The root API, including chapter navigation and readiness, fits the proposed 8 KiB gzip budget. The development Cast sender is built separately and is not part of a package entry. If Cast passes hardware and production transport review, use an explicitly imported optional `@yetric/audioplayer/cast` entry and application-controlled SDK initialization. Do not add that placeholder export now. Share internal transport ownership without duplicating registries across ESM/CommonJS entry bundles. Measure core-only, React and adapter bundles before committing the export layout. Server code remains a separate optional workspace and never enters browser imports.

## Backend inventory and selected baseline

| Case | Browser / receiver / service ownership | Decision |
| --- | --- | --- |
| Native AirPlay / output picker | Existing element and platform picker; existing source origin handles access | No selection service required |
| Public Cast fixture | Optional SDK, Default Media Receiver, HTTPS fixture reachable by receiver | First handoff case; no grant service required |
| Protected Cast fixture | Application-authorized source/revision, temporary signed origin URL, receiver access and range/CORS checks | First service-dependent case after handoff passes |
| Protected renewal | Sender resolver plus origin/service and possibly a custom receiver | Default Receiver renewal is unproven; do not claim support without an end-to-end result |
| Spotify existing device | Provider catalog ID, application OAuth/PKCE and Web API | Separate deferred feasibility decision |

The protected fixture will use the same audio bytes/timeline as its public counterpart, served through an authorized signed origin URL. Prefer that over a general streaming proxy. The reference service authorizes configured identities, not arbitrary client URLs. If the origin cannot supply a usable URL, scoped range delivery and a tested custom receiver become part of the same milestone. See [backend ownership and delivery requirements](./DESIGN_PLAYBACK_BACKEND.md).

## Draft resolver contract v1

This schema is a design contract, not an exported TypeScript API or implemented endpoint:

```ts
type ResolveCastMedia = (request: {
  sourceId: string;
  audioRevision: string;
  destination: "cast";
  signal: AbortSignal;
}) => Promise<{
  version: 1;
  sourceId: string;
  audioRevision: string;
  mediaUrl: string;
  contentType: string;
  expiresAt: number | null;
  grantId?: string;
  chaptersUrl?: string;
  artworkUrl?: string;
}>;
```

`expiresAt` is Unix epoch milliseconds or null for public non-expiring media. Applications supply revision identity separately from `AudioSource` until a reviewed additive API is needed. A URL refresh cannot alter source/revision or original-media timestamps. Reject mismatches, expired results and receiver-inaccessible URLs before committing authority. Abort on source changes/unload/destruction and ignore late responses even when an application ignores cancellation. Never persist access URLs, grants or provider credentials in source state.

For the protected case, authorize `(sourceId, audioRevision, destination)` using the consumer's access hook. Grant creation, refresh and revocation must reauthorize; shared versioned request/response fixtures will test both client and service when implementation starts. Revocation affects future requests; stopping buffered playback still needs an owned receiver command. An expiry/renewal failure must preserve an explicit recovery path without making the media public or starting local sound automatically.

Native controls do not expose this unimplemented resolver. Implementation remains conditional on the handoff evidence and ships together with its reference backend and required receiver, rather than leaving a protected-media adapter incomplete.

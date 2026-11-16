# 1.4: Playback Destinations and Multimedia

Status: prototype, based on stable `1.3.1`. Native destination controls are implemented for review; see [contract and evidence](./DESTINATIONS.md). Cast handoff and hardware validation remain outstanding. No 1.4 release is authorized.

## Goal

Let listeners keep using the player when moving sound to headphones, speakers, and receivers. Playback commands, queue state, and timed multimedia must follow the active destination. Keep the core headless and small; expose capabilities that an application can use to build its own output controls.

Remote playback is the main new workstream. Chapter convenience APIs and network resilience support that work where needed. Silence skipping remains a separate, bounded investigation rather than another release requirement.

Include backend and receiver implementation wherever a selected destination needs them. The browser library remains independently usable; server support is an optional companion with a documented contract and runnable reference service. Do not leave a destination incomplete merely because part of its implementation runs on a server.

## Engineering rule: current APIs with smart fallbacks

Prefer modern web media capabilities when they improve the listening experience. Keep a functioning baseline and an explicit fallback for each enhancement. Review [MDN's media guides](https://developer.mozilla.org/en-US/docs/Web/Media/Guides), linked compatibility data, current specifications, and vendor documentation during design and before every release. Record the review date and tested browser versions; this plan's initial review is 2026-11-15.

- Detect individual methods and capabilities at runtime, rather than browser names or version strings. API presence alone does not establish permission, receiver availability, or successful execution.
- Separate unsupported from unknown availability and connection failure. Report only distinctions the platform exposes; some APIs cannot distinguish cancellation from denial. An unavailable availability watcher must not hide a working user-initiated picker.
- Keep permission prompts and playback activation on an explicit user action. Preserve that activation through picker calls; do not request microphone access merely to populate an output list.
- Reassess newer APIs each release, including those with limited browser coverage. Use opt-in experiments with tested fallback paths while their contracts or support remain unsettled. Do not raise the baseline merely to enable an optional feature.
- Test enhanced, unsupported, partially supported, and rejected-call paths. A failed enhancement must preserve source identity, position, queue, and user playback intent. Recovery must not start a different output unexpectedly; expose an explicit return-to-local action when necessary.

| Capability | Preferred path to evaluate | Fallback |
| ---------- | -------------------------- | -------- |
| Remote device selection | Standard [Remote Playback API](https://developer.mozilla.org/en-US/docs/Web/API/RemotePlayback), checked per operation | Feature-detected Safari picker where applicable, otherwise system controls or local playback |
| Audio output selection | [selectAudioOutput](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/selectAudioOutput) followed by [setSinkId](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId) | Already permitted sinks where supported; otherwise retain the system-selected output and explain how to use OS settings |
| Headset and lock-screen controls | Supported [Media Session](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API) actions and position reporting | In-app controls keep working; unsupported actions stay absent |
| Format suitability | [Media Capabilities](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capabilities_API) where enough source information exists | Use existing media-element support checks and actual load results; a local codec result does not establish remote receiver support |

MDN currently marks Remote Playback as limited availability and `selectAudioOutput` as experimental. These are candidates for progressive enhancement, not reasons to omit them or assume universal support. Format negotiation remains an investigation, not a commitment to add alternate-source selection in 1.4. Web Audio, WebCodecs, and streaming APIs stay on the technology review list; adopt them for a demonstrated feature rather than replacing working playback solely because an API is newer.

## Starting point: 1.3

`1.3.0` provides generic range cues, indexed active snapshots, enter/exit events, metadata refresh, a parsed Podcasting 2.0 JSON Chapters adapter, and `useAudioPlayerCues(controller)`. The demo uses local audio and artwork and demonstrates chapter navigation. The stable release includes the fictional storytelling demo and passed 114 unit tests and 33 browser cases. See [Timed metadata](./TIMED_METADATA.md).

The current engine owns one private `HTMLAudioElement`. Public commands control that local engine, and cues subscribe to its state. The unreleased prototype adds native output pickers and separate destination state on that same element. Independent receiver command routing and remote position authority remain unimplemented. Adding a Cast button alone would leave two players with conflicting state.

Consumer feedback informs feature design; the library remains independently usable and no application adoption is a release dependency.

## Before starting 1.4

1. Triage feedback and fix reproducible 1.3 defects in patch releases before adding destination behavior. The 1.3 public API is stable.
2. Completed: [Media Session issue #35](https://github.com/yetric/audioplayer/issues/35) was fixed and released in 1.3.1, with metadata assignment and artwork regression coverage.
3. Record the stable 1.3 contract and supported browser baseline. No existing source, command, status, persistence, or cue semantics may break in 1.4.

External adoption is not a release gate. Confirmed 1.3 defects belong in patch releases.

## Destination scope

These routes need different implementations and must not be presented as universally interchangeable.

| Destination | Proposed 1.4 work | Constraints and evidence |
| ----------- | ----------------- | ------------------------ |
| Bluetooth, wired, USB, and default system output | First milestone: document OS routing and add an opt-in output picker where browser APIs support it | The browser can use an already paired output. Pairing and system route selection remain with the OS. `selectAudioOutput` / `setSinkId` require capability and permission checks; unsupported browsers keep their default output. [Audio Output Devices API](https://www.w3.org/TR/audio-output/) |
| AirPlay | First milestone: capability detection, a user-initiated native picker, and observable connection state where available | Use the media element's Remote Playback support or a feature-detected Safari picker. Verify on actual Safari and receiver hardware. Do not promise device names, enumeration, or disconnect commands the browser does not expose. [Remote Playback API](https://www.w3.org/TR/remote-playback/), [WebKit picker behavior](https://results.webkit.org/commit?uuid=178830909000) |
| Chromecast / Google Cast | Target a later 1.4 beta through an optional adapter after the handoff prototype passes | Use the Web Sender SDK and initially the Default Media Web Receiver. HTTPS and compatible sender/device support are required; Chrome on iOS does not support the Web Sender SDK. The receiver loads a reachable media URL, so local blobs and browser-only credentials are not portable sources. [Web Sender setup](https://developers.google.com/cast/docs/web_sender), [Receiver overview](https://developers.google.com/cast/docs/web_receiver) |
| Spotify Connect | Feasibility deliverable, not a promise to cast arbitrary podcast URLs | Spotify's SDK creates a Connect device for Spotify content. Its Web Playback SDK requires a Premium account/token and documents restrictions on synchronizing Spotify content with visual media. Establish content mapping, account requirements, permitted use, and whether a separate integration is useful before scheduling implementation. [Connect](https://developer.spotify.com/documentation/web-playback-sdk/concepts/spotify-connect), [SDK requirements](https://developer.spotify.com/documentation/web-playback-sdk/tutorials/getting-started) |
| Other receivers and delivery services | Document extension points after the first working destinations | Assess named providers individually. Do not add placeholder adapters or advertise support without a runnable integration and hardware evidence. |

Spotify Connect is the intended Spotify feature, not simply opening an episode in the Spotify app. It cannot be assumed to accept an `AudioSource.src` URL. Spotify-specific credentials and content IDs stay outside the generic source model unless a reviewed, additive contract justifies them.

## Backend and receiver workstream

Plan each destination end to end: browser adapter, SDK, receiver, media access, and any backend. Start with public media where no extra service is needed, then include a protected-media Cast case using receiver-accessible playback grants. A minimal custom receiver is in scope if that chosen authentication or renewal flow cannot work with the Default Receiver.

Deliver an optional reference backend and an application-supplied async media resolver, with stable source/revision identity, temporary media URLs, cancellation, expiry, and renewal behavior. Provide shared contract fixtures, source authorization hooks, media range/CORS checks, and a runnable deployment example. Keep ephemeral access URLs separate from persisted source data and keep server dependencies out of the browser package.

Spotify authentication is a feasibility decision: browser PKCE does not inherently need a server. If the selected Spotify integration needs server-held credentials or sessions, its OAuth and token-renewal work ships with the adapter. Backend support cannot remove provider content restrictions.

Detailed ownership, proposed routes, and acceptance criteria: [Playback backend support](./DESIGN_PLAYBACK_BACKEND.md). This is optional service implementation, not a dependency on any particular application backend or a commitment to operate a hosted service.

## Shared playback contract

Decide this contract first and prove it with one handoff prototype before building multiple adapters:

- **Capabilities:** expose only operations actually supported by the active route, such as selection, seek, rate, volume, and return to local playback. Feature absence is a normal state. Do not silently claim a rate or volume change succeeded when it was unsupported.
- **Separate connection and playback state:** destination discovery/connection must not add values to the existing `PlayerStatus` union. Keep connection progress, errors, and playback buffering distinct. A canceled picker must not turn working local playback into an error.
- **One authoritative timeline:** all public playback commands, progress reports, persistence, and cue subscriptions follow the active player. During Cast playback, receiver position and status are authoritative. Never keep an independent local timer advancing cues.
- **Handoff:** transfer source identity, position, paused/playing intent, and supported settings. Keep local playback until connection is confirmed; then prevent duplicate sound. Define rollback and an explicit resume policy for failed connection, disconnection, and return to local playback.
- **Lifecycle:** source replacement, unload, controller destruction, and stale receiver callbacks cannot restore old content or start a second stream. Do not attach automatically to unrelated existing receiver sessions.
- **Queue ownership:** start with the sender owning the queue. Do not run sender and receiver auto-advance independently. Document whether queue transitions continue if the sender closes; do not promise background queue continuity without a receiver-owned implementation.
- **Multimedia:** use receiver-observed positions to recompute the 1.3 active set after handoff and seeks. Document position latency; no sample-accurate or lip-sync promise. Chapter cards remain in the sender UI initially. Custom artwork/cards on the receiver screen require a separate receiver project.
- **Packaging:** vendor SDKs load only when explicitly enabled. Applications configure receiver IDs and their authorization policy. The optional backend and receiver examples implement required server flows against documented contracts; the browser core uses injected callbacks. No unconditional Cast, Spotify, or server dependency in the core bundle.

Native output routing can remain attached to the existing media element. Independent remote playback may need an internal transport extension. Preserve the public player API; a public engine interface and unrelated engine redesign remain outside this release. If Cast cannot meet the contract additively, publish the prototype findings and defer that adapter rather than fork player state.

## Milestones and acceptance

### M0: stabilize 1.3 and prove the architecture

- [x] Review current open issues and keep confirmed 1.3 defects in patch releases. Issue #35 is resolved in 1.3.1; the 2026-11-16 open-issue review found enhancement requests and no open bug-labeled issue. Continue triage during beta.
- [x] Write a small destination/capability contract with explicit unsupported, unavailable, connecting, connected, and failure behavior. Names are provisional, not new `PlayerStatus` values.
- [x] Build a dated API/support/fallback matrix from MDN and vendor sources, including secure-context, permission, user-activation, and receiver requirements. Test partial API support and runtime rejection, not just missing methods.
- [ ] Prototype AirPlay on the existing element and Cast handoff with remote play/pause/seek and position updates. Record browser, OS, receiver, source URL requirements, and limitations.
- [x] Review native bundle impact and define conditional optional Cast packaging in [the architecture review](./DESIGN_CAST_HANDOFF.md); no Cast export is committed before its prototype passes.
- [x] Inventory backend requirements and define a draft public/protected resolver contract and service scope in [the architecture review](./DESIGN_CAST_HANDOFF.md). Receiver renewal remains unproven and must be validated with implementation.
- [x] Produce a [Spotify Connect feasibility note](./SPOTIFY_CONNECT_FEASIBILITY.md): defer; a documented catalog track is identified as an untested experiment, with no verified podcast/timeline mapping.

### M1: first 1.4 beta, native output controls

- [ ] User-initiated AirPlay picker and supported audio-output selection work without exposing the private element as a general mutation API.
- [ ] Unsupported browsers, no devices, denied permissions, and picker cancellation preserve working local playback and give applications enough information for appropriate UI.
- [ ] Bluetooth/system route changes preserve source identity and playback position. Use system settings where there is no browser picker; no Bluetooth pairing API is implied.
- [ ] Unit tests cover capability checks, selection errors, listener cleanup, source changes, and callback reentrancy. Browser tests cover supported API behavior with controlled fakes; physical-device checks verify actual routing.
- [x] Demonstrate the preferred path and an unsupported configuration through controlled browser fakes; physical routing remains a separate gate. Unknown device availability still permits a user-initiated picker where the platform supports it.
- [x] A demo exposes output controls and existing chapter cards through public APIs, with keyboard-accessible controls and explicit unsupported states.

Hardware validation is currently unavailable. Follow the [manual procedure and evidence record](./DESTINATION_VALIDATION.md); do not mark physical routing complete from automated mocks.

### M2: optional Cast adapter, later beta after M0 succeeds

- [ ] Connect, load at the current position, play, pause, seek, disconnect, and return to local playback follow the shared contract without duplicate sound.
- [ ] Receiver updates drive shared state and cues. Queue auto-advance happens once; reconnect and stale callbacks cannot attach the wrong episode.
- [ ] Unsupported remote rate/volume operations have documented outcomes. Source or authorization failures can be recovered from without losing the local session.
- [ ] Test at least one real receiver and a supported sender, plus contract tests with a fake receiver for disconnects, delayed acknowledgments, seeks, and queue boundaries.
- [ ] Document SDK setup, receiver URL accessibility, codec/CORS requirements, and private-media limitations using a reproducible example. Never forward browser credentials to a receiver implicitly.
- [ ] Deliver the protected-media resolver and reference backend together with any receiver changes needed for authorization/renewal. Test grants, cancellation, revision mismatches, expiration, renewal/revocation, and range seeking end to end; provide a device-accessible HTTPS setup recipe.

M1 is the minimum releasable 1.4 scope. M2 is the intended extension, conditional on the M0 evidence. Publish explicit implementation status per destination; a feasibility note does not count as support. Stable 1.4 may omit Cast if the prototype cannot meet the contract without breaking changes.

## Supporting work, only where justified

| Item | Scheduling rule | Acceptance criteria |
| ---- | --------------- | ------------------- |
| Chapter navigation helpers | Next small increment if beta feedback demonstrates repeated application glue; not a second synchronization engine | Reuse the 1.3 chapter data and cue controller. Specify next/previous/current behavior, equal timestamps, explicit ends, and hidden markers before coding. Hidden markers update content without becoming navigation entries. |
| Readiness and buffering state | Include the minimum needed for truthful local/remote UI; defer automatic recovery policies | Add state without expanding `PlayerStatus`. Distinguish connection from media buffering; reset correctly on pause, seek, source change, error, and unload. Treat `stalled` as evidence to evaluate rather than proof that buffered playback stopped. |
| Integration documentation | Required for each implemented destination | Public-API examples compile and demonstrate cleanup, unsupported routes, handoff, and cue behavior. Include backend contracts, reference-service setup, and receiver deployment where needed. Update the support matrix and troubleshooting with tested browser/device combinations. |

## Separate investigation: metadata-driven silence skipping

Carry forward the user's silence-removal use case without combining it with destination selection. Scope a local prototype using consumer-supplied safe-to-skip ranges with original-media `start`/`end` seconds, source identity, and audio revision. It stays off by default, and missing or mismatched revision data disables it. Consumers apply speech padding upstream; the library does not analyze audio.

Before scheduling a controller, prove that skips do not loop or seek while paused and that presentation updates atomically at the destination, independent of cue/skip controller attachment order. The current cue controller observes state before later listeners can seek, so calling the existing seek API alone is not proof that crossed cards will never flash.

Do not assume the local skipper works with Cast or Spotify. Remote seeking and background execution have different constraints. Test against reported route capabilities or disable the feature on unsupported routes. A failed prototype does not block destination support.

## Deferred from the old 1.4 plan

- Automatic retry/backoff, URL resolution for offline media, caching/downloads, and next-item preloading. Revisit with concrete reproduction cases and resource measurements.
- The tested Web Component export, a standalone tested Angular example project, and official framework packages are deferred and unscheduled. Existing framework documentation and examples remain available; expanding their coverage is not a 1.4 deliverable.
- A diagnostics/analytics subsystem, frame-rate clocks, point cues, transcript file parsers, and audio visualization/analysis.
- Sleep timers, listening-history stores, rate memory, share links, and unrelated listener conveniences. Existing issues remain backlog, not automatic 1.4 commitments.
- A custom Cast receiver with multimedia UI, multi-room orchestration, service-specific streaming engines, and guaranteed playback after the sender closes. A minimal receiver required for the selected authentication/renewal flow is included in M2.
- The full docs/LLM/gallery program. Keep the required destination recipes and tested examples; schedule the rest separately in [DOCS_PLAN.md](./DOCS_PLAN.md).

## Release gate

1. Use stable 1.3 as the baseline and fix confirmed regressions before building on its contract.
2. Publish `1.4.0-beta.1` when M0 decisions and M1 implementation pass unit, browser, package, type, size, example, and docs checks, including React 18 and StrictMode compatibility.
3. Record real-device AirPlay and system-output results, plus manual mobile/background behavior. Headless WebKit mocks do not establish AirPlay support. If hardware is unavailable, record the missing evidence and keep that destination experimental.
4. Add Cast only in a later beta after M2 passes, including its required backend and protected-media tests; record actual receiver tests. Spotify Connect remains explicitly experimental/unimplemented unless its separate feasibility gate is met and any required authentication service is validated.
5. Promote only the tested, documented destinations. Keep local-only playback unchanged when output integrations are not attached. Confirm existing 1.3 cue behavior throughout handoff and failure cases.
6. Recheck the API/support/fallback matrix against current MDN compatibility and specifications, then exercise both enhancement and fallback paths before promotion.

No calendar date or external adoption is a release requirement. Cut an unproven adapter before weakening playback correctness or claiming universal device support.

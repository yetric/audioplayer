# Native destination prototype (unreleased 1.4)

Experimental API for review, based on 1.3.1. No physical receiver or output-device validation has been performed. Automated fakes establish control flow, not AirPlay support. Cast, Spotify Connect and silence skipping are unimplemented. This increment does not satisfy the complete M0/M1 release gates.

```ts
const destinations = player.destinations();
const unsubscribe = destinations.subscribe(({ remote, output }) => {
  remoteButton.disabled = remote.picker === null;
  outputButton.disabled = !output.canSelect;
});
remoteButton.onclick = () => { void destinations.promptRemote(); };
outputButton.onclick = () => { void destinations.selectOutput(); };
// Cleanup on application teardown:
unsubscribe();
player.destroy();
```

The controller is created lazily and cached per player. No prompts run on attachment. `player.destroy()` destroys it; destroying the controller permanently disables that player's destination controls. Destruction removes listeners and cancels availability monitoring, including late registrations. It does not disconnect a receiver or change the output. No media element is exposed.

## Contract

`getState()` and immediately invoked `subscribe()` expose independent remote and output capabilities. These are additive; `PlayerStatus`, playback errors, persisted sources and cue semantics remain unchanged.

- `remote.picker`: `standard`, `webkit`, or `null`. Standard `prompt()` takes priority. This is a generic native remote picker, not a claim that the protocol is AirPlay.
- `remote.availability`: `unknown`, `available`, or `unavailable`. Standard monitoring may fail even when the picker works. Unknown or unavailable availability never disables a picker. WebKit availability remains unknown in this prototype.
- `remote.connection`: observed `disconnected`, `connecting`, or `connected`. WebKit exposes only a wireless boolean, so connecting cannot be inferred there. Picker completion alone never marks a connection confirmed.
- `output.canSelect`: both `selectAudioOutput()` and element `setSinkId()` exist. `canSetSink`: `setSinkId()` exists independently. These capabilities do not imply permission or device availability.
- `output.sinkId`: current element sink, or the empty default ID. Device names and IDs are not persisted or enumerated by the library.

`promptRemote()`, `selectOutput()`, and `setOutput(deviceId)` return `DestinationResult`. `requested` means the browser call completed, not that hardware routing was verified. `unsupported`, `busy`, and `destroyed` are normal outcomes. `failed` retains the original `cause`, including its platform error name. Cancellation and permission denial may be indistinguishable. Applications must inspect results and present appropriate UI.

Only one operation runs at a time. Picker invocation occurs before any await; call directly in a user action. Output selection awaits permission before setting the chosen sink. Destruction during selection prevents the subsequent sink call. Already issued browser operations cannot be canceled. A pending native output choice applies to the element, including a replacement source, rather than loading or restoring an old source. No source URL, position, queue, playing intent, rate or volume is written by routing code.

`setOutput(id)` accepts an already permitted sink. `setOutput("")` explicitly requests the default system output. It is not a remote disconnect command. Remote return-to-local selection uses the native picker/system controls; there is no portable programmatic disconnect API. A rejected picker never automatically opens another picker or starts another output. Standard availability failure falls back to unknown; missing standard prompt falls back to the WebKit picker.

Playback commands, progress, persistence and timed cues continue to observe the same media element. There is no independent remote timer or second audio element. Browser events remain authoritative. This does not establish that rate, volume or seeking works on every native receiver. Receiver-specific command capabilities require hardware evidence before promotion. Independent Cast playback will need a separate proven handoff contract before implementation.

## API review and fallback matrix

Reviewed 2026-11-16 against the [Remote Playback specification](https://www.w3.org/TR/remote-playback/), [MDN Remote Playback compatibility](https://developer.mozilla.org/en-US/docs/Web/API/RemotePlayback#browser_compatibility), [Audio Output specification](https://www.w3.org/TR/audio-output/), [MDN output guidance](https://developer.mozilla.org/en-US/docs/Web/API/Audio_Output_Devices_API), [selectAudioOutput compatibility](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/selectAudioOutput#browser_compatibility), [setSinkId compatibility](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId#browser_compatibility), and [WebKit's media element interface](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/HTMLMediaElement.h).

| Operation | Requirements | Fallback |
| --- | --- | --- |
| Standard native picker | Per-element prompt method, user activation, eligible source/receiver; platform policy may reject | Missing prompt uses WebKit picker; rejected prompt reports failure |
| Availability watcher | Both watch and cancellation methods; platform may refuse monitoring | Unknown availability, picker remains callable |
| WebKit picker | Feature-detected method and user gesture; actual Safari/receiver validation pending | System route controls |
| Output picker | Secure context, speaker-selection policy, transient activation, picker and setter methods | Already permitted sink via setter, otherwise system settings |
| Permitted sink | Secure context, speaker-selection policy and prior permission | Retain current output on rejection; explicit default request available |

No microphone permission, Bluetooth pairing, provider SDK, or backend is required by these controls. Native support is limited and output selection remains experimental per MDN. Runtime checks take precedence over browser names. Source hosting/authentication still follows the media platform's requirements.

## Evidence and remaining gates

Unit tests cover absent/partial methods, failed monitoring, synchronous picker activation, standard/WebKit choice, rejected prompts, sink failures, concurrent operations and late cleanup. Browser tests exercise routing on real media elements with controlled API fakes in Chromium, Firefox and WebKit. Record installed browser versions with `npx playwright --version` and the Playwright installation metadata when reproducing results. Validation on 2026-11-16: 128 unit tests passed; all 24 Chromium 159.0.8154.6 and Firefox 159.0 browser cases passed. WebKit 27.2 (revision 2388) could not launch because this Linux environment lacks `libicudata.so.74`; all 12 WebKit cases remain locally unverified. These are automated engines, not hardware evidence.

Before beta: test actual Safari/AirPlay and default/permitted output routing, paused and playing transitions, queue boundaries, source replacement, disconnect, background/mobile behavior and failed device connections. Record exact browser/OS/receiver versions and source accessibility. Add accessible demo controls and complete the Cast handoff investigation, backend inventory and separate Spotify feasibility note required by the release plan. Public-media Cast needs no new service; protected media must ship its resolver/reference service and any required receiver together, per the backend design.

The prototype uses the existing root export with lazy controller attachment and no new dependencies. Measured core bundle: 6,884 bytes gzip; proposed budget 7 KiB. No version bump or feature release is included. Optional Cast packaging remains undecided pending handoff evidence.

# Destination hardware validation

Status on 2026-11-16: not run. No physical AirPlay receiver or audio-output device is available in the current environment, as confirmed by the user. Native controls remain experimental. Automated browser tests and CI are separate evidence and do not complete this gate.

Use `npm run demo:start` and the demo's public output controls. For receiver testing, serve the demo and media over device-accessible HTTPS. Use a public media URL reachable by the receiver, not a sender-local blob, cookie-only origin or receiver-inaccessible localhost. The checked-in WAV is a local browser test fixture, not evidence of remote codec support.

Record exact date, browser version/build, OS/device version, receiver model/firmware, source URL/content type/access requirements, system output, permission policy and whether the tab is foreground/background. Record source identity, queue index, playback intent, position before/after, active chapter and observed connection state. Capture the observed audible route separately from API success. Redact credentials and ephemeral grant URLs.

| Scenario | Procedure and expected evidence | Result |
| --- | --- | --- |
| Paused AirPlay selection | Load, pause at a known chapter, choose receiver; identity/position/cue retained, no autoplay | Not run |
| Playing AirPlay selection | Play and choose receiver; verify one audible stream and continuing observed timeline | Not run |
| Unsupported/unknown discovery | Confirm a working picker remains usable without availability monitoring | Not run |
| Cancel/deny/no devices | Dismiss or reject picker and test no receiver; local source, queue, position and intent remain recoverable | Not run |
| Remote seek/rate/volume | Exercise each control on real receiver, record accepted/rejected/ignored behavior; unknown until established | Not run |
| Explicit return | Select this device in native picker/system controls; record intent, position and cue behavior without relying on automatic resume | Not run |
| Disconnect/failure | Power off receiver or interrupt network; observe status/timeline/audible output and confirm no library-triggered local play or route switch | Not run |
| System output selection | Choose paired headset/USB/speaker through picker or system settings; paused and playing cases preserve state | Not run |
| Removed permitted sink | Unplug/disconnect selected sink; observe unavailable status where exposed; verify no automatic switch; explicitly request default | Not run |
| Source change/unload | Change source, reload same source, empty queue and unload while picker is pending; no old source restoration or deferred sink call | Not run |
| Queue/repeat boundary | Let an episode end on receiver; confirm exactly one transition and correct next source/cue | Not run |
| Mobile/background | Lock screen, background tab, return and use Media Session; record platform-specific behavior and gaps | Not run |
| Destruction/recreation | Destroy player during picker/connection; no late library actions, duplicate streams or old source restoration | Not run |

Do not infer inaudible playback from `playing` or a missing-device event. A removed sink can leave the timeline advancing without rendered sound under the [Audio Output Devices specification](https://www.w3.org/TR/audio-output/#sink-no-longer-available). The library does not automatically choose another sink. Native platforms may perform their own route changes; record those separately from library behavior.

Before promotion, replace the relevant "Not run" entries with reproducible observations and links to evidence, resolve discrepancies, and update the [support matrix](./SUPPORT.md). Real-device failures must remain visible release gates; publishing a beta or stable release requires a separate user instruction.

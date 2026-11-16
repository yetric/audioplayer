---
id: cast-prototype
slug: /cast-prototype
---

# Cast handoff experiment

Development-only experiment for the unreleased 1.4 work. It is outside `src` and the package's `files` list. It adds no published Cast export, production transport, SDK dependency or backend. A caller explicitly enables Google's hosted SDK in this page. Source and SDK hardware behavior remain unverified.

## Run on Android with Chromecast or Google TV

Use Chrome on the Android sender and a receiver on the same network. Google's [Web Sender setup](https://developers.google.com/cast/docs/web_sender) requires HTTPS and excludes iOS Chrome. iPhone Safari testing uses native AirPlay in the normal demo, not this Google Cast page.

Start the local experiment from the repository root:

```sh
npm run prototype:cast -- --host 0.0.0.0 --port 5173 --strictPort
```

Open `/prototypes/cast/` on the printed address to inspect the page. A plain HTTP LAN address does not enable the Google Cast SDK in this experiment. The page and media must be reachable over HTTPS by the sender and receiver. A receiver cannot fetch the sender's localhost, a browser blob, a login-only URL or an origin whose TLS certificate it does not trust.

One development option is a temporary [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/). With `cloudflared` already installed, run this in another terminal:

```sh
cloudflared tunnel --url http://localhost:5173
```

It prints a temporary HTTPS hostname. Keep that process running, stop the Vite process, then restart Vite with that exact hostname allowed:

```sh
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=your-host.trycloudflare.com npm run prototype:cast -- --port 5173 --strictPort
```

Open `https://your-host.trycloudflare.com/prototypes/cast/` on Android. Replace `your-host` with the generated hostname in both commands. This exposes the development server publicly while the tunnel runs; use public fixtures and stop it after testing. This recipe does not start or publish a tunnel automatically. Do not put an interactive login in front of the media fixture: the receiver cannot complete it. Vite's [host and TLS options](https://vite.dev/config/server-options) document the host setting.

Alternatively, use an existing trusted HTTPS host/reverse proxy. The experiment's Vite config accepts `AUDIOPLAYER_TLS_CERT` and `AUDIOPLAYER_TLS_KEY` for a local HTTPS listener. The certificate must be trusted by both phone and receiver; trusting a private CA on the phone alone does not establish receiver access.

## Device procedure

1. Leave the default public MP3, content type and revision for the checked-in Last Signal fixture. Its asset URL uses the same HTTPS origin as the page. If testing your own public media, supply its content type and matching revision before loading it. The descriptor is captured on load; editing fields alone does not change active media identity. No hash or audio revision is inferred by the library.
2. Tap **Load public media**, then **Play**, and reach a known position. Record the source, time and chapter. Repeat the whole procedure with playback paused.
3. Tap **Enable Google Cast SDK**. Loading the page and local playback do not request the SDK. Then tap **Choose Cast receiver** and choose an idle receiver. Existing media sessions are refused; stop them through their owning controls before retrying. No automatic rejoin or takeover is intended.
4. Observe local playback continuing while the receiver loads paused. Confirm only the receiver is audible once handoff completes. Test play, pause, seek and next chapter; record received positions and card updates. This page uses the real player, queue, cues and readiness state through a provisional media facade.
5. Tap **Return here, paused** or **Return here and play**. Local sound starts only after a confirmed stop of the owned remote media. A failed stop leaves local playback silent. Disconnect the receiver and repeat recovery; record actual SDK behavior, including timeout or ownership loss.
6. Record exact Android/Chrome version, receiver model/firmware, network, HTTPS setup, content URL/type/revision, paused/playing intent, position before/after, audible streams, chapter updates and any result/error. Share observations, not credentials or private media URLs.

The chosen MP3 and two chapter markers demonstrate synchronization, not receiver-screen chapter artwork. The normal library demo covers native routing; the controlled test suite covers queue boundaries and stale callbacks. Protected-media grants, URL renewal, authentication, receiver UI and background continuity are unimplemented and must not be inferred from public-media success.

## Evidence and limits

```sh
npm run test:cast-prototype
npm run prototype:cast:build
```

The controlled tests run the real player with a fake local element and receiver, plus mocked SDK method contracts. They cover intent, position, queue progression once, cue updates, persistence, buffering, unsupported commands, source/revision checks, delayed seeks/settings, failure recovery, ownership and cleanup. Browser tests exercise the facade's real local playback and disabled SDK path over HTTP. They do not establish a successful real Cast session.

The SDK bridge binds request/source/revision to the acknowledged `mediaSessionId` and media URL. Revision describes the caller's media descriptor; the receiver does not independently verify audio bytes. It uses `supportsCommand()` for seek/stream-volume capabilities and reports rate unsupported. It uses `getEstimatedTime()` only when SDK status is observed; there is no independent advancing timer. Position/card updates may be sparse and include SDK estimation and network latency. No sample-accurate or lip-sync claim is made. See Google's [Media contract](https://developers.google.com/cast/docs/reference/web_sender/chrome.cast.media.Media).

To exercise the existing closed engine without exporting a public engine API, the isolated page temporarily substitutes `Audio` only during synchronous player construction and restores it in `finally`. A private production transport integration is still required before shipping an adapter. The receiver interface additionally requires commands/stops to target the owned media session. Hardware must establish SDK ordering, final-position reconciliation, command availability, disconnection, background behavior and recovery before any promotion. A missing stop acknowledgment deliberately blocks automatic local playback.

If a final reconciliation fails after the receiver has loaded, the prototype can leave local playback paused for explicit recovery. If local return fails while loading local metadata, no autoplay occurs. These are recorded limitations of the experiment, not a production fallback policy. Public-media device results are the next decision point; the protected resolver/reference backend remains a later conditional milestone.

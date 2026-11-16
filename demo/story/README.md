# The Last Signal

An original, two-part fictional audio story and a working example of contextual listening. Approximately five minutes in total. All people, places, documents, and events are invented.

## Run

```sh
npm install
npm run demo:start
```

Open `/story/` on the printed demo URL. From a Vite server rooted at the repository, use `/demo/story/` instead. The original library demo links to the story.

```sh
npm run demo:build
npm run demo:preview
```

The production build includes both demos and their local audio and illustrations. No external API, account, font service, or audio host is needed at playback time.

## Try it without spoiling the ending

1. Start part one. Open a contextual card while the audio plays. The story pauses; returning resumes it. Open a card while paused and it stays paused on return.
2. Around 0:50, explore the map. Around 1:15, inspect the folded note.
3. Around 1:37, save the question about the two bells. There is no answer or announcement of which future passage will answer it.
4. Start part two. Around 1:10, the saved question has an explanation available. Open it and return.
5. Seek back to the beginning. Context returns to that earlier perspective, even though the question remains saved for this visit.
6. Turn off story context to compare the same audio with ordinary listening.

Use the scrubber to demonstrate these moments quickly. Seeking deliberately changes the story position; it is not proof that intervening passages were heard.

## What the example implements

- Existing `createAudioPlayer` and `attachAudioPlayerCues` APIs drive real local MP3 playback and timed context.
- Each authored passage has a title, transcript, and contextual card. Cards and transcript passages accumulate up to the current passage and disappear again on backward seeks.
- Context is suspended during a seek rather than rendering an intermediate time. Source changes clear the previous source's material.
- Detail dialogs preserve source, position, and play/pause intent. Escape and the return button follow the same behavior. The native pause event supplies the actual stopping position.
- A single editorial question demonstrates deferred answers. Its answer becomes available after the explanatory passage in part two. Rewinding hides it again.
- Audio-only mode changes presentation without changing playback.
- Native controls, labelled inputs, keyboard-accessible dialogs, reduced-motion support, and a responsive layout are included.

This is application code demonstrating candidate capabilities, not a new public SDK or a committed 2.0 schema. The browser library remains headless and unchanged.

## Deliberate limits

- Reveal boundaries are **passage-level**, not word-level. A passage's transcript and card become available at its start. A production story may need finer boundaries for individual sentences or facts.
- The policy follows the current story position. It does not infer what a listener knows, record completed listening intervals, or remember historical reveals.
- The saved question is in memory for this visit. There is no cross-device sync, persistent account state, AI, remote destination adapter, or creator editor in this example.
- The full fictional metadata is downloaded by the browser. Hiding later content is a presentation rule, not authorization or secrecy. Protected content would require separate server enforcement.
- Narration is intentionally a replaceable synthetic fixture, generated locally with eSpeak NG. It demonstrates timing and playback, not final voice production quality. The bells are described in the narration, not separate sound effects.
- The map is illustrative and not geographic. The visual scene supplies atmosphere; it is not evidence in a real investigation.

## Assets and reproducibility

`script.json` is the authored source. `story.json` adds timestamps measured from generated PCM audio. The Python script also emits Podcasting 2.0 chapter documents (version 1.2.0) and compresses the narration to MP3. Those chapter documents contain the full chapter list; the story UI separately controls which contextual passages it presents.

All story text and SVG illustrations were authored for this repository. Generated MP3s contain only that text spoken by local eSpeak NG; no third-party recordings, samples, or cloned voices are used. These demo assets are provided under the repository's license.

To change the narration, edit `script.json`, then regenerate audio and metadata together:

```sh
# Requires Python 3, eSpeak NG, and ffmpeg with libmp3lame.
python3 scripts/generate-story-audio.py
npm test
npm run demo:build
```

The checked-in fixture was generated using eSpeak NG 1.52.0, British English, 148 words per minute, pitch 38, and ffmpeg 9.0.2 at 64 kbit/s mono. Different tool versions may change timings; always commit the regenerated metadata and audio together. The existing audio assets require no generation tools to run.

## Verification

- Unit checks verify script/metadata agreement, contiguous timed ranges, valid standard chapters, source isolation, backward reveal boundaries, and question availability.
- Browser tests in `tests/browser/story.spec.ts` cover actual audio, seek behavior, modal pause/return intent, deferred answers, episode changes, mobile overflow, audio-only mode, and source failure/recovery.

Run browser checks with `npm run test:browser -- tests/browser/story.spec.ts` after installing Playwright browsers and their system dependencies.

## Questions this raises for 2.0

1. Should an optional context controller publish playback position and active metadata as one coherent snapshot, avoiding application-level seek coordination?
2. What belongs in a reusable exploration checkpoint when playback moves to another destination?
3. How should current position, listened intervals, and an explicit spoiler preference remain separate?
4. Which identifiers and revision checks are needed to carry bookmarks and questions between sessions without applying them to edited audio?
5. Can finer editorial boundaries extend existing cue data without introducing a competing chapter or transcript format?

These are technical questions for versioned feature proposals. The prototype does not establish that a breaking change is necessary.

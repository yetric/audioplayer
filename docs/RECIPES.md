---
id: recipes
slug: /recipes
---

# Recipes

## Let the React provider manage integrations

```tsx
import { createLocalStoragePersistenceAdapter } from "@yetric/audioplayer";
import { AudioPlayerProvider } from "@yetric/audioplayer/react";

export const App = () => (
  <AudioPlayerProvider
    persistence={{ adapter: createLocalStoragePersistenceAdapter("audio-player") }}
    mediaSession
    progressReporter={{ intervalMs: 5000, onReport: (snapshot) => console.log(snapshot) }}>
    <PlayerScreen />
  </AudioPlayerProvider>
);
```

The provider restores saved state without autoplay and cleans up integrations on unmount. Keep queue setup separate from automatic restore so it does not overwrite a restored queue. See the [React guide](./REACT_GUIDE.md) for option lifetimes and state selectors.

## Relative seek controls

```tsx
const player = useAudioPlayer();
const controls = <>
  <button onClick={() => player.skip(-10)}>Back 10 seconds</button>
  <button onClick={() => player.skip(30)}>Forward 30 seconds</button>
</>;
```

`skip` uses seconds and clamps at zero and, once metadata is available, the duration. For a timeline without polling, use [useAudioPlayerProgress](./REACT_GUIDE.md#throttled-progress-for-a-timeline).

## Convert a podcast episode into `AudioSource`

```ts
const toAudioSource = (episode, podcast) => ({
  id: episode.id.toString(),
  src: episode.url,
  title: episode.title,
  artist: podcast.name,
  artwork: podcast.imageUrl,
  album: podcast.name,
});
```

## Keep one queue for the whole app

```ts
await player.setQueue(episodes.map((episode) => toAudioSource(episode, podcast)), {
  startAtId: activeEpisodeId,
  autoplay: true,
});
```

## Use progress for a slider

```ts
player.subscribe((state) => {
  slider.value = String(state.progress.playedFraction * 100);
});
```

## Handle errors in UI

```ts
player.subscribe((state) => {
  if (!state.error) {
    hideError();
    return;
  }

  showError(state.error.message);
});
```

## Handle first play vs resume

```ts
if (player.getState().currentSourceId === source.id) {
  await player.play();
} else {
  await player.play(source);
}
```

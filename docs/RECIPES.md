# Recipes

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

# podcast-app migration

## Replace the current provider

Current source:

- `src/context/audio.tsx`

Recommended replacement:

- `AudioPlayerProvider` from `@yetric/audioplayer/react`
- app-level bootstrap for persistence, progress reporting, and Media Session

## Source mapping

```ts
const source = {
  id: episode.id.toString(),
  src: episode.url,
  title: episode.title,
  artist: podcast.name,
  artwork: podcast.imageUrl,
  album: podcast.name,
};
```

## UI mapping

- play buttons call `player.play(source)`
- progress slider reads `state.progress`
- speed controls call `player.setRate(rate)`
- queue UI reads `state.queue`
- errors read `state.error`

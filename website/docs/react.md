# React

React integration lives at `@yetric/audioplayer/react`.

## Provider

```tsx
import { AudioPlayerProvider } from "@yetric/audioplayer/react";

export const App = () => (
  <AudioPlayerProvider>
    <PlayerScreen />
  </AudioPlayerProvider>
);
```

## Hooks

```tsx
import { useAudioPlayer, useAudioPlayerState } from "@yetric/audioplayer/react";

const episode = {
  id: "ep-1",
  src: "https://cdn.example.com/ep-1.mp3",
  title: "Episode 1",
  artist: "Podcast Name",
};

export const PlayerScreen = () => {
  const player = useAudioPlayer();
  const state = useAudioPlayerState();

  return (
    <div>
      <button onClick={() => void player.play(episode)}>Play</button>
      <button onClick={() => player.pause()}>Pause</button>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
};
```

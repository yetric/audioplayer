import { createLocalStoragePersistenceAdapter } from "../../dist/index.js";
import {
  AudioPlayerProvider,
  useAudioPlayer,
  useAudioPlayerState,
  useAudioPlayerProgress,
} from "../../dist/react.js";

const episode = {
  id: "example-episode-1",
  src: new URL("../audio/tone.wav", import.meta.url).href,
  title: "Example Episode",
  artist: "Yetric",
  album: "AudioPlayer Demo",
};

const PlayerScreen = () => {
  const player = useAudioPlayer();
  const status = useAudioPlayerState((state) => state.status);
  const progress = useAudioPlayerProgress({ intervalMs: 250 });
  const error = useAudioPlayerState((state) => state.error);

  return (
    <div>
      <button onClick={() => void player.play(episode)}>Play</button>
      <button onClick={() => player.pause()}>Pause</button>
      <button onClick={() => player.skip(-1)}>Back 1s</button>
      <button onClick={() => player.skip(1)}>Forward 1s</button>
      <p data-testid="status">{status}</p>
      <output data-testid="time">{progress.currentTime.toFixed(2)}</output>
      <p>{error?.message}</p>
    </div>
  );
};

export const App = () => (
  <AudioPlayerProvider
    persistence={{ adapter: createLocalStoragePersistenceAdapter("audioplayer-react-example") }}
    mediaSession
    progressReporter={{ onReport: (snapshot) => console.log("progress", snapshot) }}>
    <PlayerScreen />
  </AudioPlayerProvider>
);

import { useEffect } from "react";
import {
  attachAudioPlayerMediaSession,
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  createLocalStoragePersistenceAdapter,
} from "../../dist/index.js";
import {
  AudioPlayerProvider,
  useAudioPlayer,
  useAudioPlayerState,
} from "../../dist/react.js";

const episode = {
  id: "example-episode-1",
  src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  title: "Example Episode",
  artist: "Yetric",
  album: "AudioPlayer Demo",
};

const PlayerScreen = () => {
  const player = useAudioPlayer();
  const state = useAudioPlayerState();

  useEffect(() => {
    const persistence = attachAudioPlayerPersistence(player, {
      adapter: createLocalStoragePersistenceAdapter("audioplayer-react-example"),
    });
    const reporter = attachAudioPlayerProgressReporter(player, {
      onReport(snapshot) {
        console.log("progress", snapshot);
      },
    });
    const mediaSession = attachAudioPlayerMediaSession(player);

    return () => {
      persistence.destroy();
      reporter.destroy();
      mediaSession.destroy();
    };
  }, [player]);

  return (
    <div>
      <button onClick={() => void player.play(episode)}>Play</button>
      <button onClick={() => player.pause()}>Pause</button>
      <button onClick={() => player.seek(30)}>Seek to 30s</button>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
};

export const App = () => (
  <AudioPlayerProvider>
    <PlayerScreen />
  </AudioPlayerProvider>
);

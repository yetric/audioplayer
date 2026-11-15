import { useEffect } from "react";
import {
  createLocalStoragePersistenceAdapter,
} from "../../dist/index.js";
import {
  AudioPlayerProvider,
  useAudioPlayer,
  useAudioPlayerState,
} from "../../dist/react.js";

const queue = [
  {
    id: "episode-1",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    title: "Episode 1",
    artist: "Yetric",
    album: "Podcast Demo",
  },
  {
    id: "episode-2",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    title: "Episode 2",
    artist: "Yetric",
    album: "Podcast Demo",
  },
];

const Bootstrap = () => {
  const player = useAudioPlayer();

  useEffect(() => {
    void player.setQueue(queue, {
      startAtId: "episode-1",
      autoplay: false,
    });

  }, [player]);

  return null;
};

const Screen = () => {
  const player = useAudioPlayer();
  const state = useAudioPlayerState();

  return (
    <div>
      <button onClick={() => void player.play()}>Play</button>
      <button onClick={() => player.pause()}>Pause</button>
      <button onClick={() => void player.previous()}>Previous</button>
      <button onClick={() => void player.next()}>Next</button>
      <button onClick={() => player.seek(60)}>Seek to 60s</button>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
};

export const PodcastPlayerDemo = () => (
  <AudioPlayerProvider
    persistence={{ adapter: createLocalStoragePersistenceAdapter("react-podcast-demo"), autoRestore: false }}
    mediaSession
    progressReporter={{ onReport: (snapshot) => console.log("progress", snapshot) }}>
    <Bootstrap />
    <Screen />
  </AudioPlayerProvider>
);

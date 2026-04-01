import {
  attachAudioPlayerMediaSession,
  attachAudioPlayerPersistence,
  attachAudioPlayerProgressReporter,
  createAudioPlayer,
  createLocalStoragePersistenceAdapter,
} from "../../dist/index.js";

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

const player = createAudioPlayer();

attachAudioPlayerPersistence(player, {
  adapter: createLocalStoragePersistenceAdapter("playlist-demo"),
});

attachAudioPlayerProgressReporter(player, {
  intervalMs: 5000,
  onReport(snapshot) {
    console.log("progress", snapshot);
  },
});

attachAudioPlayerMediaSession(player);

player.subscribe((state) => {
  console.log("state", state);
});

await player.setQueue(queue, {
  startAtId: "episode-1",
  autoplay: true,
});

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  createAudioPlayer,
  type AudioPlayer,
  type AudioPlayerState,
  type CreateAudioPlayerOptions,
} from "./index";

const AudioPlayerContext = createContext<AudioPlayer | null>(null);

export interface AudioPlayerProviderProps {
  children: ReactNode;
  options?: CreateAudioPlayerOptions;
  player?: AudioPlayer;
}

export const AudioPlayerProvider = ({
  children,
  options,
  player,
}: AudioPlayerProviderProps) => {
  const playerRef = useRef<AudioPlayer | null>(player ?? null);

  if (playerRef.current === null) {
    playerRef.current = createAudioPlayer(options);
  }

  useEffect(() => {
    if (!player) {
      return () => {
        playerRef.current?.destroy();
      };
    }

    return undefined;
  }, [player]);

  return (
    <AudioPlayerContext.Provider value={playerRef.current}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = (): AudioPlayer => {
  const player = useContext(AudioPlayerContext);

  if (!player) {
    throw new Error("useAudioPlayer must be used inside AudioPlayerProvider.");
  }

  return player;
};

export const useAudioPlayerState = (): AudioPlayerState => {
  const player = useAudioPlayer();

  return useSyncExternalStore(
    player.subscribe,
    player.getState,
    player.getState,
  );
};

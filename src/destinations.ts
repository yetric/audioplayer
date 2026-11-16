export interface AudioPlayerDestinationState {
  remote: {
    picker: "standard" | "webkit" | null;
    availability: "unknown" | "available" | "unavailable";
    connection: "disconnected" | "connecting" | "connected";
  };
  output: { canSelect: boolean; canSetSink: boolean; sinkId: string };
}

export type DestinationResult =
  | { status: "requested" }
  | { status: "unsupported" | "busy" | "destroyed" }
  | { status: "failed"; cause: unknown };

export interface AudioPlayerDestinationsController {
  getState(): AudioPlayerDestinationState;
  subscribe(listener: (state: AudioPlayerDestinationState) => void): () => void;
  promptRemote(): Promise<DestinationResult>;
  selectOutput(): Promise<DestinationResult>;
  setOutput(deviceId: string): Promise<DestinationResult>;
  destroy(): void;
}

type NativeAudio = HTMLAudioElement & {
  remote?: EventTarget & {
    state: "disconnected" | "connecting" | "connected";
    prompt?: () => Promise<void>;
    watchAvailability?: (callback: (available: boolean) => void) => Promise<number>;
    cancelWatchAvailability?: (id: number) => Promise<void>;
  };
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
};

export const createDestinationsController = (
  audio: NativeAudio | null,
): AudioPlayerDestinationsController => {
  const remote = audio?.remote;
  const devices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices as
    | (MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> })
    | undefined;
  const listeners = new Set<(state: AudioPlayerDestinationState) => void>();
  let destroyed = false;
  let busy = false;
  let watchId: number | undefined;
  let availability: AudioPlayerDestinationState["remote"]["availability"] = "unknown";
  const picker = typeof remote?.prompt === "function" ? "standard"
    : typeof audio?.webkitShowPlaybackTargetPicker === "function" ? "webkit" : null;
  const getState = (): AudioPlayerDestinationState => ({
    remote: {
      picker,
      availability,
      connection: picker === "standard" ? remote!.state
        : audio?.webkitCurrentPlaybackTargetIsWireless ? "connected" : "disconnected",
    },
    output: {
      canSelect: typeof devices?.selectAudioOutput === "function" && typeof audio?.setSinkId === "function",
      canSetSink: typeof audio?.setSinkId === "function",
      sinkId: audio?.sinkId ?? "",
    },
  });
  const notify = (): void => {
    if (destroyed) return;
    for (const listener of listeners) {
      if (destroyed) break;
      listener(getState());
    }
  };
  const events = ["connecting", "connect", "disconnect"];
  for (const event of events) remote?.addEventListener(event, notify);
  audio?.addEventListener("webkitcurrentplaybacktargetiswirelesschanged", notify);
  const cancelWatch = (id: number): void => {
    void remote?.cancelWatchAvailability?.(id).catch(() => {});
  };
  if (typeof remote?.watchAvailability === "function" && typeof remote.cancelWatchAvailability === "function") {
    void remote.watchAvailability((available) => {
      if (destroyed) return;
      availability = available ? "available" : "unavailable";
      notify();
    }).then((id) => {
      if (destroyed) cancelWatch(id);
      else watchId = id;
    }).catch(() => {});
  }
  const run = async (supported: boolean, operation: () => void | Promise<void>): Promise<DestinationResult> => {
    if (destroyed) return { status: "destroyed" };
    if (!supported) return { status: "unsupported" };
    if (busy) return { status: "busy" };
    busy = true;
    try {
      await operation();
      if (destroyed) return { status: "destroyed" };
      notify();
      return { status: "requested" };
    } catch (cause) {
      return destroyed ? { status: "destroyed" } : { status: "failed", cause };
    } finally {
      busy = false;
    }
  };
  return {
    getState,
    subscribe(listener) {
      if (destroyed) return () => {};
      listeners.add(listener);
      listener(getState());
      return () => { listeners.delete(listener); };
    },
    promptRemote() {
      return run(picker !== null, () => picker === "standard"
        ? remote!.prompt!() : audio!.webkitShowPlaybackTargetPicker!());
    },
    selectOutput() {
      return run(getState().output.canSelect, async () => {
        const device = await devices!.selectAudioOutput!();
        if (!destroyed) await audio!.setSinkId(device.deviceId);
      });
    },
    setOutput(deviceId) {
      return run(getState().output.canSetSink, () => audio!.setSinkId(deviceId));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      listeners.clear();
      for (const event of events) remote?.removeEventListener(event, notify);
      audio?.removeEventListener("webkitcurrentplaybacktargetiswirelesschanged", notify);
      if (watchId !== undefined) cancelWatch(watchId);
    },
  };
};

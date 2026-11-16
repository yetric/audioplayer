export type DestinationAvailability = "unknown" | "available" | "unavailable";

export interface AudioPlayerDestinationState {
  pending: "remote" | "output" | null;
  remote: {
    picker: "standard" | "webkit" | null;
    availability: DestinationAvailability;
    commands: { seek: "unknown"; rate: "unknown"; volume: "unknown" };
    returnToLocal: "picker" | "system";
    connection: "disconnected" | "connecting" | "connected";
  };
  output: { canSelect: boolean; canSetSink: boolean; sinkId: string; availability: DestinationAvailability };
}

export type DestinationResult =
  | { status: "prompted" }
  | { status: "applied"; sinkId: string }
  | { status: "unsupported" | "busy" | "destroyed" | "superseded" }
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
  getSourceRevision: () => number = () => 0,
): AudioPlayerDestinationsController => {
  const remote = audio?.remote;
  const devices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices as
    | (MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> })
    | undefined;
  const listeners = new Set<(state: AudioPlayerDestinationState) => void>();
  let destroyed = false;
  let pending: AudioPlayerDestinationState["pending"] = null;
  let outputAvailability: DestinationAvailability = "unknown";
  let outputRevision = 0;
  let watchId: number | undefined;
  let availability: AudioPlayerDestinationState["remote"]["availability"] = "unknown";
  const picker = typeof remote?.prompt === "function" ? "standard"
    : typeof audio?.webkitShowPlaybackTargetPicker === "function" ? "webkit" : null;
  const getState = (): AudioPlayerDestinationState => ({
    pending,
    remote: {
      picker,
      availability,
      commands: { seek: "unknown", rate: "unknown", volume: "unknown" },
      returnToLocal: picker === null ? "system" : "picker",
      connection: picker === "standard" ? remote!.state
        : audio?.webkitCurrentPlaybackTargetIsWireless ? "connected" : "disconnected",
    },
    output: {
      canSelect: typeof devices?.selectAudioOutput === "function" && typeof audio?.setSinkId === "function",
      canSetSink: typeof audio?.setSinkId === "function",
      sinkId: audio?.sinkId ?? "",
      availability: outputAvailability,
    },
  });
  const notify = (): void => {
    if (destroyed) return;
    for (const listener of listeners) {
      if (destroyed) break;
      listener(getState());
    }
  };
  const refreshOutput = (): void => {
    if (destroyed) return;
    const revision = ++outputRevision;
    const sinkId = audio?.sinkId;
    outputAvailability = "unknown";
    notify();
    if (!sinkId || typeof devices?.enumerateDevices !== "function") return;
    void devices.enumerateDevices().then((outputs) => {
      if (destroyed || revision !== outputRevision || audio?.sinkId !== sinkId) return;
      outputAvailability = outputs.some((device) => device.kind === "audiooutput" && device.deviceId === sinkId)
        ? "available" : "unavailable";
      notify();
    }).catch(() => {});
  };
  devices?.addEventListener?.("devicechange", refreshOutput);
  const events = ["connecting", "connect", "disconnect"];
  for (const event of events) remote?.addEventListener(event, notify);
  audio?.addEventListener("webkitcurrentplaybacktargetiswirelesschanged", notify);
  const cancelWatch = (id: number): void => {
    void remote?.cancelWatchAvailability?.(id).catch(() => {});
  };
  try {
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
  } catch {}
  const run = async (
    supported: boolean,
    kind: "remote" | "output",
    operation: (isCurrent: () => boolean) => void | Promise<void>,
  ): Promise<DestinationResult> => {
    if (destroyed) return { status: "destroyed" };
    if (!supported) return { status: "unsupported" };
    if (pending) return { status: "busy" };
    const revision = getSourceRevision();
    const isCurrent = (): boolean => !destroyed && revision === getSourceRevision();
    pending = kind;
    let result: DestinationResult;
    try {
      notify();
      if (isCurrent()) await operation(isCurrent);
      result = kind === "remote" ? { status: "prompted" }
        : { status: "applied", sinkId: audio?.sinkId ?? "" };
    } catch (cause) {
      result = { status: "failed", cause };
    } finally {
      pending = null;
      if (kind === "output") refreshOutput();
      else notify();
    }
    return destroyed ? { status: "destroyed" }
      : !isCurrent() ? { status: "superseded" } : result;
  };
  refreshOutput();
  return {
    getState,
    subscribe(listener) {
      if (destroyed) return () => {};
      listeners.add(listener);
      listener(getState());
      return () => { listeners.delete(listener); };
    },
    promptRemote() {
      return run(picker !== null, "remote", () => picker === "standard"
        ? remote!.prompt!() : audio!.webkitShowPlaybackTargetPicker!());
    },
    selectOutput() {
      return run(getState().output.canSelect, "output", async (isCurrent) => {
        const device = await devices!.selectAudioOutput!();
        if (isCurrent()) await audio!.setSinkId(device.deviceId);
      });
    },
    setOutput(deviceId) {
      return run(getState().output.canSetSink, "output", () => audio!.setSinkId(deviceId));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      pending = null;
      devices?.removeEventListener?.("devicechange", refreshOutput);
      listeners.clear();
      for (const event of events) remote?.removeEventListener(event, notify);
      audio?.removeEventListener("webkitcurrentplaybacktargetiswirelesschanged", notify);
      if (watchId !== undefined) cancelWatch(watchId);
    },
  };
};

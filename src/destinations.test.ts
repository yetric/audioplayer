import { afterEach, expect, it, vi } from "vitest";
import { createDestinationsController } from "./destinations";

const element = () => Object.assign(new EventTarget(), { sinkId: "", setSinkId: vi.fn(async () => {}) });
const controller = (audio: object | null) => createDestinationsController(audio as HTMLAudioElement | null);
afterEach(() => vi.unstubAllGlobals());

it("reports missing and partial APIs without affecting playback", async () => {
  vi.stubGlobal("navigator", { mediaDevices: { selectAudioOutput: vi.fn() } });
  const route = controller(null);
  expect(route.getState().output.canSelect).toBe(false);
  expect(await route.selectOutput()).toEqual({ status: "unsupported" });
  expect(await route.promptRemote()).toEqual({ status: "unsupported" });
  const audio = element();
  vi.stubGlobal("navigator", {});
  const partial = controller(audio);
  expect(partial.getState().output.canSelect).toBe(false);
  expect(await partial.setOutput("permitted")).toEqual({ status: "applied", sinkId: "" });
  expect(audio.setSinkId).toHaveBeenCalledWith("permitted");
});

it("opens the standard picker synchronously despite unavailable monitoring", async () => {
  const remote = Object.assign(new EventTarget(), {
    state: "disconnected", prompt: vi.fn(async () => {}),
    watchAvailability: vi.fn(async () => { throw new Error("not supported"); }),
    cancelWatchAvailability: vi.fn(async () => {}),
  });
  const route = controller(Object.assign(element(), { remote }));
  await Promise.resolve();
  const result = route.promptRemote();
  expect(remote.prompt).toHaveBeenCalledOnce();
  expect(await result).toEqual({ status: "prompted" });
  expect(route.getState().remote.availability).toBe("unknown");
  remote.state = "connected";
  remote.dispatchEvent(new Event("connect"));
  expect(route.getState().remote.connection).toBe("connected");
  route.destroy();
});

it("uses WebKit when standard prompt is absent and reports observed connection", async () => {
  const audio = Object.assign(element(), { remote: new EventTarget(),
    webkitShowPlaybackTargetPicker: vi.fn(), webkitCurrentPlaybackTargetIsWireless: false });
  const route = controller(audio);
  expect(await route.promptRemote()).toEqual({ status: "prompted" });
  expect(audio.webkitShowPlaybackTargetPicker).toHaveBeenCalledOnce();
  audio.webkitCurrentPlaybackTargetIsWireless = true;
  expect(route.getState().remote.connection).toBe("connected");
  route.destroy();
});

it("retains picker errors without silently trying another route", async () => {
  const cause = new DOMException("denied or canceled", "NotAllowedError");
  const fallback = vi.fn();
  const audio = Object.assign(element(), { remote: Object.assign(new EventTarget(), {
    state: "disconnected", prompt: vi.fn(() => { throw cause; }),
  }), webkitShowPlaybackTargetPicker: fallback });
  expect(await controller(audio).promptRemote()).toEqual({ status: "failed", cause });
  expect(fallback).not.toHaveBeenCalled();
});

it("selects before setting a sink and serializes requests", async () => {
  let resolve!: (value: { deviceId: string }) => void;
  const select = vi.fn(() => new Promise<{ deviceId: string }>((done) => { resolve = done; }));
  vi.stubGlobal("navigator", { mediaDevices: { selectAudioOutput: select } });
  const audio = element();
  const route = controller(audio);
  const selection = route.selectOutput();
  expect(select).toHaveBeenCalledOnce();
  expect(audio.setSinkId).not.toHaveBeenCalled();
  expect(await route.setOutput("")).toEqual({ status: "busy" });
  resolve({ deviceId: "speaker" });
  expect(await selection).toEqual({ status: "applied", sinkId: "" });
  expect(audio.setSinkId).toHaveBeenCalledWith("speaker");
});

it("does not set a sink after destruction while the picker is pending", async () => {
  let resolve!: (value: { deviceId: string }) => void;
  vi.stubGlobal("navigator", { mediaDevices: { selectAudioOutput: () => new Promise((done) => { resolve = done; }) } });
  const audio = element();
  const route = controller(audio);
  const selection = route.selectOutput();
  route.destroy();
  resolve({ deviceId: "speaker" });
  expect(await selection).toEqual({ status: "destroyed" });
  expect(audio.setSinkId).not.toHaveBeenCalled();
});

it("cancels a late watcher and ignores callbacks after destroy", async () => {
  let resolve!: (id: number) => void;
  let callback!: (available: boolean) => void;
  const remote = Object.assign(new EventTarget(), { state: "disconnected", prompt: vi.fn(),
    watchAvailability: (cb: typeof callback) => { callback = cb; return new Promise<number>((done) => { resolve = done; }); },
    cancelWatchAvailability: vi.fn(async () => {}),
  });
  const route = controller(Object.assign(element(), { remote }));
  const listener = vi.fn();
  route.subscribe(listener);
  callback(false);
  expect(route.getState().remote.availability).toBe("unavailable");
  route.destroy();
  resolve(7);
  callback(true);
  await Promise.resolve();
  expect(listener).toHaveBeenCalledTimes(2);
  expect(remote.cancelWatchAvailability).toHaveBeenCalledWith(7);
});

it("surfaces failed sink changes without attempting the default output", async () => {
  const cause = new DOMException("device removed", "NotFoundError");
  const audio = element();
  audio.setSinkId.mockRejectedValue(cause);
  expect(await controller(audio).setOutput("missing")).toEqual({ status: "failed", cause });
  expect(audio.setSinkId).toHaveBeenCalledTimes(1);
});

it("allows destruction from a connection callback without notifying later listeners", () => {
  const remote = Object.assign(new EventTarget(), { state: "disconnected", prompt: vi.fn() });
  const route = controller(Object.assign(element(), { remote }));
  route.subscribe((state) => { if (state.remote.connection === "connected") route.destroy(); });
  const later = vi.fn();
  route.subscribe(later);
  remote.state = "connected";
  remote.dispatchEvent(new Event("connect"));
  expect(later).toHaveBeenCalledOnce();
});

it("notifies pending state and rejects a reentrant second request", async () => {
  const audio = element();
  const route = controller(audio);
  const pending: Array<string | null> = [];
  let reentrant: Promise<unknown> | undefined;
  route.subscribe((state) => {
    pending.push(state.pending);
    if (state.pending) reentrant = route.setOutput("other");
  });
  await route.setOutput("speaker");
  expect(await reentrant).toEqual({ status: "busy" });
  expect(pending).toEqual([null, "output", null]);
  expect(audio.setSinkId).toHaveBeenCalledTimes(1);
});

it("does not invoke the browser when a pending notification destroys the controller", async () => {
  const audio = element();
  const route = controller(audio);
  route.subscribe(({ pending }) => { if (pending) route.destroy(); });
  expect(await route.setOutput("speaker")).toEqual({ status: "destroyed" });
  expect(audio.setSinkId).not.toHaveBeenCalled();
});

it("reports removal and reappearance without silently routing to default", async () => {
  let outputs: Array<{ kind: string; deviceId: string }> = [];
  const devices = Object.assign(new EventTarget(), { enumerateDevices: vi.fn(async () => outputs) });
  vi.stubGlobal("navigator", { mediaDevices: devices });
  const audio = Object.assign(element(), { sinkId: "speaker" });
  const route = controller(audio);
  await Promise.resolve();
  expect(route.getState().output.availability).toBe("unavailable");
  outputs = [{ kind: "audiooutput", deviceId: "speaker" }];
  devices.dispatchEvent(new Event("devicechange"));
  await Promise.resolve();
  expect(route.getState().output.availability).toBe("available");
  expect(audio.setSinkId).not.toHaveBeenCalled();
  route.destroy();
  devices.dispatchEvent(new Event("devicechange"));
  expect(devices.enumerateDevices).toHaveBeenCalledTimes(2);
});

it("ignores stale device enumeration and leaves denied enumeration unknown", async () => {
  let resolve!: (value: unknown[]) => void;
  const devices = Object.assign(new EventTarget(), {
    enumerateDevices: vi.fn(() => new Promise<unknown[]>((done) => { resolve = done; })),
  });
  vi.stubGlobal("navigator", { mediaDevices: devices });
  const audio = Object.assign(element(), { sinkId: "speaker" });
  const route = controller(audio);
  const oldResolve = resolve;
  audio.sinkId = "other";
  devices.dispatchEvent(new Event("devicechange"));
  oldResolve([{ kind: "audiooutput", deviceId: "speaker" }]);
  await Promise.resolve();
  expect(route.getState().output.availability).toBe("unknown");
  route.destroy();
  resolve([{ kind: "audiooutput", deviceId: "other" }]);
  await Promise.resolve();
  expect(route.getState().output.availability).toBe("unknown");
  devices.enumerateDevices.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
  const denied = controller(audio);
  await Promise.resolve();
  await Promise.resolve();
  expect(denied.getState().output.availability).toBe("unknown");
  denied.destroy();
});

it.each(["NotAllowedError", "NotFoundError", "AbortError"])("preserves %s from output selection without applying a sink", async (name) => {
  const cause = new DOMException("selection failed", name);
  vi.stubGlobal("navigator", { mediaDevices: { selectAudioOutput: vi.fn(async () => { throw cause; }) } });
  const audio = element();
  const route = controller(audio);
  expect(await route.selectOutput()).toEqual({ status: "failed", cause });
  expect(route.getState().pending).toBeNull();
  expect(audio.setSinkId).not.toHaveBeenCalled();
});

it("reports native command capabilities as unknown and observes disconnect without resuming playback", () => {
  const remote = Object.assign(new EventTarget(), { state: "connected", prompt: vi.fn() });
  const route = controller(Object.assign(element(), { remote }));
  const states: string[] = [];
  route.subscribe(({ remote }) => states.push(remote.connection));
  expect(route.getState().remote.commands).toEqual({ seek: "unknown", rate: "unknown", volume: "unknown" });
  expect(route.getState().remote.returnToLocal).toBe("picker");
  remote.state = "disconnected";
  remote.dispatchEvent(new Event("disconnect"));
  expect(states).toEqual(["connected", "disconnected"]);
  route.destroy();
});

it("keeps the picker callable when availability monitoring throws synchronously", async () => {
  const remote = Object.assign(new EventTarget(), {
    state: "disconnected", prompt: vi.fn(async () => {}),
    watchAvailability: () => { throw new DOMException("disabled", "NotSupportedError"); },
    cancelWatchAvailability: vi.fn(async () => {}),
  });
  const route = controller(Object.assign(element(), { remote }));
  expect(route.getState().remote.availability).toBe("unknown");
  expect(await route.promptRemote()).toEqual({ status: "prompted" });
  route.destroy();
});

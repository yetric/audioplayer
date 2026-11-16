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
  expect(await partial.setOutput("permitted")).toEqual({ status: "requested" });
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
  expect(await result).toEqual({ status: "requested" });
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
  expect(await route.promptRemote()).toEqual({ status: "requested" });
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
  expect(await selection).toEqual({ status: "requested" });
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
